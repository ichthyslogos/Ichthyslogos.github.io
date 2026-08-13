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
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import {
  fetchCommentary,
  fetchCommentaryManifest,
  resolveCommentarySource,
  findCommentaryChapter,
  isCommentaryEnabled,
  displaySources,
  groupOfSource,
} from '../../lib/data.js'
import EmptyState from '../EmptyState.vue'
import CommentarySourceMenu from './CommentarySourceMenu.vue'
import { flowCommentary } from '../../lib/text.js'

const props = defineProps({
  open: { type: Boolean, default: true },
  book: { type: Object, default: null }, // manifest 中的书卷信息（含 bookId）
  chapter: { type: Number, default: 0 },
})
const emit = defineEmits(['toggle'])

const sources = ref([]) // 全量源（含语言组成员）
const sourceKey = ref('')
const sourceMenuOpen = ref(false)
const bookData = ref(null)
const loading = ref(false)

/** 源选择偏好持久化：localStorage('brp-commentary-source') */
const SOURCE_STORAGE = 'brp-commentary-source'

function pickSource(key) {
  // 语言组成员：选中时切到组默认语言（langs[0]），组内语言由语言标签切换
  const g = groupOfSource(key)
  sourceKey.value = g ? g.langs[0].key : key
  sourceMenuOpen.value = false
  localStorage.setItem(SOURCE_STORAGE, sourceKey.value)
}
/** 当前源的语言组（中英文同书源合并后，显示语言标签切换）；组主源缺失（如中文已关闭）时组失效，不显示标签 */
const langGroup = computed(() => {
  const g = groupOfSource(sourceKey.value)
  if (!g) return null
  return sources.value.some((s) => s.key === g.langs[0].key) ? g : null
})

/** 语言标签：当前语言名（如"中文"/"English"），点击切到组内下一语言 */
const langLabel = computed(() => {
  const g = langGroup.value
  if (!g) return ''
  return g.langs.find((l) => l.key === sourceKey.value)?.label || g.langs[0].label
})

function toggleLang() {
  const g = langGroup.value
  if (!g) return
  const idx = g.langs.findIndex((l) => l.key === sourceKey.value)
  const next = g.langs[(idx + 1) % g.langs.length]
  sourceKey.value = next.key
  localStorage.setItem(SOURCE_STORAGE, next.key)
}

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

// 首次挂载加载注释源清单；关闭面板时收起源菜单
watch(
  () => props.open,
  (v) => {
    if (v && !sources.value.length) loadSources()
    if (!v) sourceMenuOpen.value = false
  },
  { immediate: true },
)

async function loadSources() {
  try {
    const m = await fetchCommentaryManifest()
    sources.value = m.sources || []
    if (sources.value.length) {
      // 优先恢复用户上次选择的源（localStorage），否则第一个可用源；
      // 当前书卷不可用时自动回落到该卷可用的偏好源
      const saved = localStorage.getItem(SOURCE_STORAGE)
      const s = resolveCommentarySource(m, saved, props.book?.id)
      sourceKey.value = s.key
    }
  } catch {
    sources.value = []
  }
}

// 书卷变化：当前源若无此卷注释，自动回落到该卷可用的源（resolveCommentarySource 保证）；
// 404（源无此卷数据）与数据缺失（返回 null）都触发回退。
/** 序号守卫：快速切换书卷/章节/源时丢弃过期响应 */
let loadSeq = 0
watch(
  () => [props.book?.id, props.chapter, sourceKey.value],
  async ([bookId]) => {
    if (!bookId || !sourceKey.value) return
    const seq = ++loadSeq
    loading.value = true
    try {
      const data = await fetchCommentary(sourceKey.value, bookId)
      if (seq !== loadSeq) return // 已有更新的请求
      if (data === null && sources.value.length) {
        // 该书卷在当前源不可用：回落到可用源（偏好链优先）
        const s = resolveCommentarySource(
          { sources: sources.value },
          localStorage.getItem(SOURCE_STORAGE),
          bookId,
        )
        if (s.key !== sourceKey.value) {
          sourceKey.value = s.key
          return // watch 重新触发加载
        }
      }
      bookData.value = data
    } catch {
      if (seq !== loadSeq) return
      // 404（该源无此卷）也回退可用源，避免面板永远"本卷暂无注释"
      if (sources.value.length) {
        const s = resolveCommentarySource(
          { sources: sources.value },
          localStorage.getItem(SOURCE_STORAGE),
          bookId,
        )
        if (s.key !== sourceKey.value) {
          sourceKey.value = s.key
          return
        }
      }
      bookData.value = null // 该卷无注释
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  },
)

const chapterData = computed(() => {
  const c = findCommentaryChapter(bookData.value, props.chapter)
  if (!c) return null
  // 最简排版：除数据空行分段外，其余换行一律合并（见 src/lib/text.js）
  return {
    ...c,
    summary: flowCommentary(c.summary),
    sections: c.sections.map((s) => ({ ...s, text: flowCommentary(s.text) })),
  }
})
const bookDisabled = computed(() => !!props.book && !isCommentaryEnabled(props.book.id))

// —— 拖拽调宽：面板左边缘手柄，按住左右拖动改变面板宽度（桌面分栏 / 移动端覆盖层通用）——
const RESIZE_STORAGE = 'brp-commentary-panel-width'
const rootEl = ref(null)
const panelWidth = ref(null) // null = 默认宽度（CSS）
const dragging = ref(false)
let resizeStartX = 0
let resizeStartW = 0

/** 宽度限制：移动端 55vw~100vw，桌面 18rem~62vw（给经文留出空间） */
function clampWidth(w) {
  const mobile = window.matchMedia('(max-width: 900px)').matches
  const min = mobile ? Math.round(window.innerWidth * 0.55) : 288
  const max = mobile ? window.innerWidth : Math.round(window.innerWidth * 0.62)
  return Math.min(Math.max(Math.round(w), min), max)
}

const panelStyle = computed(() => (panelWidth.value ? { width: panelWidth.value + 'px' } : null))

function startResize(e) {
  e.preventDefault()
  dragging.value = true
  resizeStartX = e.clientX
  resizeStartW = panelWidth.value ?? rootEl.value?.getBoundingClientRect().width ?? 0
  document.body.classList.add('resizing-panel')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function onResizeMove(e) {
  if (!dragging.value) return
  const dx = resizeStartX - e.clientX // 向左拖动（dx>0）面板变宽
  panelWidth.value = clampWidth(resizeStartW + dx)
}

function endResize() {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('resizing-panel')
  if (panelWidth.value) localStorage.setItem(RESIZE_STORAGE, String(panelWidth.value))
}

// 恢复用户上次拖拽的宽度；窗口尺寸变化（旋转/缩放）时重新限制
onMounted(() => {
  const saved = Number(localStorage.getItem(RESIZE_STORAGE))
  if (saved) panelWidth.value = clampWidth(saved)
  window.addEventListener('resize', onWindowResize)
})
onUnmounted(() => window.removeEventListener('resize', onWindowResize))
function onWindowResize() {
  if (panelWidth.value) panelWidth.value = clampWidth(panelWidth.value)
}
</script>

<template>
  <aside
    ref="rootEl"
    v-show="open"
    class="commentary-panel"
    :style="panelStyle"
    aria-label="解经"
  >
    <div
      class="resize-handle"
      :class="{ dragging }"
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整解经面板宽度"
      @pointerdown="startResize"
      @pointermove="onResizeMove"
      @pointerup="endResize"
      @pointercancel="endResize"
    ></div>
    <header class="panel-head">
      <h2 class="panel-title">
        解经<template v-if="book"> · {{ book.zh }} 第 {{ chapter }} 章</template>
      </h2>
      <button class="panel-close" @click="emit('toggle')" aria-label="收起解经面板">✕</button>
    </header>
    <div class="panel-body">
      <!-- 源选择器常驻（空状态/加载中也可见）：当前源无此卷注释时可切换其他源 -->
      <div v-if="sources.length" class="commentary-top">
        <div class="source-row">
          <CommentarySourceMenu
            :sources="displaySources(sources)"
            :active-key="sourceKey"
            :open="sourceMenuOpen"
            :book-id="book && book.id"
            @toggle="sourceMenuOpen = !sourceMenuOpen"
            @select="pickSource"
          />
          <!-- 语言标签：中英文同书源合并后，在此切换语言（如马太亨利 中文/English） -->
          <button
            v-if="langGroup"
            class="lang-tag"
            :title="'切换语言（' + langLabel + '）'"
            @click="toggleLang"
          >
            {{ langLabel }}
          </button>
        </div>
        <button
          v-if="chapterData && chapterData.sections.length"
          class="toggle-all"
          @click="toggleAll"
        >
          {{ allExpanded ? '全部收起' : '全部展开' }}
        </button>
      </div>
      <div v-if="loading" class="commentary-state">注释加载中…</div>
      <template v-else-if="chapterData">
        <p v-if="chapterData.summary" class="commentary-summary">{{ chapterData.summary }}</p>
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
              <p class="commentary-text">{{ s.text }}</p>
            </div>
          </Transition>
        </div>
      </template>
      <EmptyState
        v-else-if="!loading"
        :title="bookDisabled ? '该卷注释暂时关闭' : '本卷暂无注释'"
        :message="bookDisabled
          ? '当前书卷的注释暂未开放，敬请期待。'
          : '本卷注释尚未收录，正在陆续整理中。'"
      />
    </div>
  </aside>
</template>

<style scoped>
.commentary-panel {
  position: relative;
  width: min(24rem, 34vw);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line-soft);
  background: var(--panel);
}
/* 拖拽手柄：面板左边缘细条，按住左右拖动调整宽度 */
.resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 2;
  touch-action: none;
  background: transparent;
}
.resize-handle::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 50%;
  width: 2px;
  height: 2.1rem;
  transform: translateY(-50%);
  border-radius: 1px;
  background: var(--line);
  opacity: 0;
  transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease);
}
.resize-handle:hover::after,
.resize-handle.dragging::after {
  opacity: 1;
  background: var(--gold);
}
:global(.resizing-panel) {
  user-select: none;
  cursor: col-resize;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel);
}
.panel-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--gold);
  letter-spacing: 0.04em;
}
.panel-close {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.95rem;
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-sm);
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.panel-close:hover {
  color: var(--text);
  background: var(--line-soft);
}
.panel-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
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
/* 源选择 + 语言标签同行（版本选择按钮旁） */
.source-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}
/* 语言标签：版本选择按钮旁的小胶囊，点击切换组内语言 */
.lang-tag {
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.lang-tag:hover {
  background: var(--accent);
  color: #fff;
}
.toggle-all {
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--muted);
  font-size: 0.75rem;
  padding: 0.12rem 0.6rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.toggle-all:hover {
  border-color: var(--gold);
  color: var(--gold);
}
/* 章概要：金棕左边线导语 */
.commentary-summary {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.9;
  margin: 0 0 1.2rem;
  padding: 0.15rem 0 0.8rem 0.85rem;
  border-left: 3px solid var(--gold);
  white-space: pre-line;
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
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--text);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.commentary-heading:hover {
  background: var(--gold-soft);
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
/* 经节范围徽章：金棕 */
.commentary-ref {
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-sm);
  padding: 0.05rem 0.45rem;
}
.commentary-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.95;
  color: #3c4652;
  white-space: pre-line;
  padding: 0.15rem 0.3rem 0.5rem;
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
