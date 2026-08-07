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
} from '../../lib/data.js'
import EmptyState from '../EmptyState.vue'

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

const chapterData = computed(() => findCommentaryChapter(bookData.value, props.chapter))
const sourceName = computed(() => sources.value.find((s) => s.key === sourceKey.value)?.name || '')
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
        <div v-if="sourceName" class="commentary-source">{{ sourceName }}</div>
        <p v-if="chapterData.summary" class="commentary-summary">{{ chapterData.summary }}</p>
        <div v-for="(s, i) in chapterData.sections" :key="i" class="commentary-section">
          <div v-if="s.heading" class="commentary-heading">
            <span v-if="s.ref" class="commentary-ref">{{ s.ref }}</span>
            {{ s.heading }}
          </div>
          <div v-else-if="s.ref" class="commentary-heading">
            <span class="commentary-ref">{{ s.ref }}</span>
          </div>
          <p class="commentary-text">{{ s.text }}</p>
        </div>
      </template>
      <EmptyState
        v-else-if="!loading"
        title="本卷暂无注释"
        message="当前书卷/章节尚未收录马太亨利注释（部分书卷素材缺失，详见 docs/COMMENTARY.md）。"
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
.commentary-source {
  display: inline-block;
  font-size: 0.72rem;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  margin-bottom: 0.6rem;
}
.commentary-summary {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.9;
  margin: 0 0 1.2rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--line);
  white-space: pre-line;
}
.commentary-section {
  margin-bottom: 1.1rem;
}
.commentary-heading {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.92rem;
  margin-bottom: 0.3rem;
  color: var(--text);
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
.commentary-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.95;
  color: #3c4652;
  white-space: pre-line;
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
