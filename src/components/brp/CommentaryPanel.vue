<script setup>
/**
 * CommentaryPanel — 解经面板（brp 子组件）
 *
 * 常驻于经文右侧的空白区域（移动端为覆盖层），由 brp 页"解经"按钮控制显隐。
 * 多注释源架构：数据按 sources[].key 组织（data-src/brp/commentary/<key>/），
 * 面板自动显示第一个可用源（v1：马太亨利）；未来增加注释源时，
 * 传入 sources 数组与 sourceKey 即可扩展（当前版本单源）。
 *
 * 渲染：当前书卷+章节 → 概要（summary）+ 小节注释列表（ref + heading + text）
 * 无注释（卷/章缺失）→ 空状态提示。
 */
import { ref, watch, computed } from 'vue'
import {
  fetchCommentary,
  fetchCommentaryManifest,
  resolveCommentarySource,
  findCommentaryChapter,
  isCommentaryEnabled,
} from '../../lib/data.js'
import EmptyState from '../EmptyState.vue'
import { flowCommentary, commentaryToHtml } from '../../lib/text.js'

const props = defineProps({
  open: { type: Boolean, default: true },
  book: { type: Object, default: null }, // manifest 中的书卷信息（含 bookId）
  chapter: { type: Number, default: 0 },
})
const emit = defineEmits(['toggle'])

const sources = ref([])
const sourceKey = ref('')
const bookData = ref(null)
const loading = ref(false)

/** 小节展开状态：Set<索引>，默认全部收起 */
const expanded = ref(new Set())

function toggleSection(i) {
  const s = new Set(expanded.value)
  s.has(i) ? s.delete(i) : s.add(i)
  expanded.value = s
}

const allExpanded = computed(
  () => !!chapterData.value && chapterData.value.sections.every((_, i) => expanded.value.has(i)),
)

function toggleAll() {
  if (!chapterData.value) return
  expanded.value = allExpanded.value ? new Set() : new Set(chapterData.value.sections.map((_, i) => i))
}

// 切换章节时重置展开状态
watch(
  () => [props.book?.id, props.chapter],
  () => {
    expanded.value = new Set()
  },
)

// 首次挂载加载注释源清单
watch(
  () => props.open,
  (v) => {
    if (v && !sources.value.length) loadSources()
  },
  { immediate: true },
)

async function loadSources() {
  try {
    const m = await fetchCommentaryManifest()
    sources.value = m.sources || []
    if (sources.value.length) {
      const s = resolveCommentarySource(m, sourceKey.value)
      sourceKey.value = s.key
    }
  } catch {
    sources.value = []
  }
}

// 书卷/章节/注释源变化 → 加载对应卷注释
watch(
  () => [props.book?.id, props.chapter, sourceKey.value],
  async ([bookId]) => {
    if (!bookId || !sourceKey.value) return
    loading.value = true
    try {
      bookData.value = await fetchCommentary(sourceKey.value, bookId)
    } catch {
      bookData.value = null // 该卷无注释
    } finally {
      loading.value = false
    }
  },
)

const chapterData = computed(() => {
  const c = findCommentaryChapter(bookData.value, props.chapter)
  if (!c) return null
  // 智能排版：合并 PDF 硬换行、脚注移到文末、上标转 <sup>（见 src/lib/text.js）
  return {
    ...c,
    summaryHtml: commentaryToHtml(flowCommentary(c.summary)),
    sections: c.sections.map((s) => ({ ...s, html: commentaryToHtml(flowCommentary(s.text)) })),
  }
})
const sourceName = computed(() => sources.value.find((s) => s.key === sourceKey.value)?.name || '')
/** 当前卷注释是否被暂时关闭（白名单外；数据保留，仅前端不显示） */
const bookDisabled = computed(() => !!props.book && !isCommentaryEnabled(props.book.id))
</script>

<template>
  <aside v-show="open" class="commentary-panel" aria-label="解经">
    <header class="panel-head">
      <h2 class="panel-title">
        解经<template v-if="book"> · {{ book.zh }} 第 {{ chapter }} 章</template>
      </h2>
      <button class="panel-close" @click="emit('toggle')" aria-label="收起解经面板">✕</button>
    </header>
    <div class="panel-body">
      <div v-if="loading" class="commentary-state">注释加载中…</div>
      <template v-else-if="chapterData">
        <div class="commentary-top">
          <span v-if="sourceName" class="commentary-source">{{ sourceName }}</span>
          <button
            v-if="chapterData.sections.length"
            class="toggle-all"
            @click="toggleAll"
          >
            {{ allExpanded ? '全部收起' : '全部展开' }}
          </button>
        </div>
        <div v-html="chapterData.summaryHtml" class="commentary-summary"></div>
        <div v-for="(s, i) in chapterData.sections" :key="i" class="commentary-section">
          <button
            class="commentary-heading"
            :aria-expanded="expanded.has(i)"
            :title="s.heading || '注释'"
            @click="toggleSection(i)"
          >
            <span class="chevron" :class="{ open: expanded.has(i) }" aria-hidden="true">▸</span>
            <span v-if="s.ref" class="commentary-ref">{{ s.ref }}</span>
            <span v-if="s.heading" class="heading-text">{{ s.heading }}</span>
            <span v-if="!s.ref && !s.heading" class="heading-text">注释</span>
          </button>
          <Transition name="fold">
            <div v-if="expanded.has(i)" class="fold-wrap">
              <div class="commentary-text" v-html="s.html"></div>
            </div>
          </Transition>
        </div>
      </template>
      <EmptyState
        v-else-if="!loading"
        :title="bookDisabled ? '该卷注释暂时关闭' : '本卷暂无注释'"
        :message="bookDisabled
          ? '当前书卷的注释已暂时关闭（数据保留，未删除）；恢复方式见 docs/COMMENTARY.md。'
          : '当前书卷/章节尚未收录马太亨利注释（部分书卷素材缺失，详见 docs/COMMENTARY.md）。'"
      />
    </div>
  </aside>
</template>

<style scoped>
.commentary-panel {
  width: min(24rem, 34vw);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line);
  background: #fbfcfd;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line);
  background: #fff;
}
.panel-title {
  margin: 0;
  font-size: 1rem;
  color: var(--accent);
}
.panel-close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.95rem;
  padding: 0.1rem 0.45rem;
}
.panel-close:hover {
  color: var(--text);
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.1rem 2rem;
}
.commentary-state {
  color: var(--muted);
  text-align: center;
  padding: 2rem 0;
}
.commentary-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.commentary-source {
  display: inline-block;
  font-size: 0.72rem;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
}
.toggle-all {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--muted);
  font-size: 0.75rem;
  padding: 0.1rem 0.55rem;
}
.toggle-all:hover {
  border-color: var(--accent);
  color: var(--accent);
}
/* 概要：v-html 输出 <p> 段落 */
.commentary-summary {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.9;
  margin: 0 0 1.2rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--line);
}
.commentary-summary p {
  margin: 0 0 0.55em;
}
.commentary-summary p:last-child {
  margin-bottom: 0;
}
.commentary-section {
  margin-bottom: 0.4rem;
}
/* 小节标题行 = 可点击的展开按钮 */
.commentary-heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.35rem 0.3rem;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text);
  cursor: pointer;
}
.commentary-heading:hover {
  background: var(--accent-soft);
}
.chevron {
  font-size: 0.7rem;
  color: var(--muted);
  transition: transform 0.18s ease;
  flex-shrink: 0;
}
.chevron.open {
  transform: rotate(90deg);
}
/* 小节标题：长标题换行完整显示（最多 2 行，超出省略；min-width:0 保证 flex 内可收缩） */
.heading-text {
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}
.commentary-ref {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 4px;
  padding: 0.05rem 0.4rem;
}
/* 小节正文：v-html 输出 <p> 段落（含 <sup> 上标与脚注段） */
.commentary-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.95;
  color: #3c4652;
  padding: 0.15rem 0.3rem 0.5rem;
}
.commentary-text p {
  margin: 0 0 0.6em;
}
.commentary-text p:last-child {
  margin-bottom: 0;
}
.commentary-text sup {
  font-size: 0.72em;
  color: var(--muted);
}
/* 脚注段：独立成段的小字说明 */
.commentary-text p.footnote {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.7;
  margin: 0.5em 0 0;
  padding-top: 0.4em;
  border-top: 1px dashed var(--line);
}
.commentary-summary p.footnote {
  font-size: 0.78rem;
  color: var(--muted);
  border: none;
  padding: 0;
  margin-top: 0.6em;
}
/* 展开/收起过渡（grid-rows 高度动画） */
.fold-wrap {
  display: grid;
  grid-template-rows: 1fr;
}
.fold-wrap > * {
  overflow: hidden;
}
.fold-enter-active,
.fold-leave-active {
  transition: grid-template-rows 0.22s ease, opacity 0.22s ease;
}
.fold-enter-from,
.fold-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* 窄屏（≤900px）：解经面板变为右侧覆盖层（不占布局宽度） */
@media (max-width: 900px) {
  .commentary-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 45;
    width: min(88vw, 24rem);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);
  }
}
</style>
