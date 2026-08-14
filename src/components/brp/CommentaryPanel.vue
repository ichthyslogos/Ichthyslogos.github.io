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
  fetchNotes,
  findNotesChapter,
  sourcesOfCategory,
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

// —— 解经层结构 ——
// 术语约定：解经 = 对经文本身的解释（FISH 六层 + 多来源解经）；注释 = 作者/地点/背景等简要介绍（背景注释层 = TIPNR，不单列）。
// 总结层 = summary 栏目源（当前为 MHCC 概览段，一句话总结）；
// 「经文解释」层 = 同源简要版的逐节讲解（MHCC #N 段，前端折叠展示）；
// 背景注释层 = STEP TIPNR 专有名词（人名/地名/背景词条，按当前章列出，可展开文章级描述）；
// 其余层内容留空 → 「待整理…」占位；「完整解经」层 = 完整版多来源解经（按宗派分组：马太亨利/加尔文/RWP/Abbott/Catena）
const STUDY_LAYERS = [
  { key: 'summary', label: '总结' },
  { key: 'keyPoints', label: '要点' },
  { key: 'interpretation', label: '经文解释' },
  { key: 'theology', label: '神学意义' },
  { key: 'application', label: '应用' },
  { key: 'notes', label: '背景注释' },
  { key: 'fullCommentary', label: '完整解经' },
]

/** 前七层（字段型）；「完整解经」层由多来源解经（马太亨利/加尔文等）承载 */
const SIX_LAYERS = computed(() => STUDY_LAYERS.filter((l) => l.key !== 'fullCommentary'))

/** 解经层折叠状态：默认全部收起（点击标题展开；切换书卷/章节/打开抽屉时全部关闭） */
const openLayers = ref(new Set())

/** 当前查看的层（点击展开时滚动置顶，标题常驻顶部可一键收起） */
const activeLayer = ref('')

/** 正在阅读的节/词条（最小单元）：面板右上角「关闭」按钮据此显示，点击只关闭该项（展开层本身不算） */
/** 正在看 = 浏览器视口内正在显示的展开词条（滚动时实时切换；展开即显示） */
const activeItem = ref(null) // { kind: 'verse'|'note'|'section', idx, label }
/** 顶部「关闭」按钮显隐：视口内有正在显示的词条即显示 */
const itemCloseVisible = ref(false)

/** 节/词条 kind → 所在层 data-layer */
const LAYER_OF_KIND = { verse: 'interpretation', note: 'notes', section: 'fullCommentary' }

/** 收集全部展开的节/词条（带词条块元素 + 位置缓存，按位置排序） */
function collectExpanded() {
  const items = []
  for (const i of openVerses.value) {
    const sec = interpretationChapter.value?.sections?.[i]
    items.push({ kind: 'verse', idx: i, label: sec?.ref || '节' })
  }
  for (const i of openNotes.value) {
    const n = notesChapter.value?.entries?.[i]
    items.push({ kind: 'note', idx: i, label: n?.name || '词条' })
  }
  for (const i of expanded.value) {
    const sec = chapterData.value?.sections?.[i]
    items.push({ kind: 'section', idx: i, label: sec?.ref || sec?.heading || '节' })
  }
  const body = panelBodyEl.value
  const withEl = items
    .map((it) => {
      // 词条块 = 标题 + 内容整体（判断「正在看」用块，而非仅标题，滚动切换更灵敏）
      const toggle = body?.querySelector(`[data-layer="${LAYER_OF_KIND[it.kind]}"] [data-item-idx="${it.idx}"]`)
      const el = toggle?.closest('.study-verse, .note-entry, .commentary-section') || toggle
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { ...it, el, top: r.top, bottom: r.bottom }
    })
    .filter(Boolean)
  withEl.sort((a, b) => a.top - b.top)
  return withEl
}

/** 按视口顶部线重算「正在看」：顶部线穿过的词条块；无穿过则取上方最近（刚看完的） */
function computeActive() {
  const items = collectExpanded()
  const body = panelBodyEl.value
  if (!items.length || !body) {
    activeItem.value = null
    return null
  }
  const bodyRect = body.getBoundingClientRect()
  if (bodyRect.height <= 0) {
    // 面板隐藏（v-show=false）时不做判断
    activeItem.value = null
    return null
  }
  const bodyTop = bodyRect.top
  const probe = bodyTop + 4 // 视口顶部线（略下移，避免贴边误差）
  const crossing = items.find((it) => it.top <= probe && it.bottom > probe)
  let current
  if (crossing) {
    current = crossing
  } else {
    // 顶部线未穿过任何块（如滚动到层间隙）：取上方最近的（刚看完的）；没有则取第一个
    const above = items.filter((it) => it.bottom <= probe)
    current = above.length ? above[above.length - 1] : items[0]
  }
  activeItem.value = { kind: current.kind, idx: current.idx, label: current.label }
  return current
}

/** 滚动监听：实时跟随视口顶部正在显示的词条（按钮对应变化） */
function onPanelScroll() {
  itemCloseVisible.value = !!computeActive()
}

/** 收起/关闭后：重算视口内正在显示的词条 */
function refreshItemClose() {
  itemCloseVisible.value = !!computeActive()
}

/** 层 key → 显示名 */
function layerLabel(key) {
  return STUDY_LAYERS.find((l) => l.key === key)?.label || key
}

/** 只关闭正在看的节/词条；关闭后自动切到视口内下一个正在显示的 */
function closeItem() {
  const it = activeItem.value
  if (!it) return
  if (it.kind === 'verse') {
    const s = new Set(openVerses.value)
    s.delete(it.idx)
    openVerses.value = s
  } else if (it.kind === 'note') {
    const s = new Set(openNotes.value)
    s.delete(it.idx)
    openNotes.value = s
  } else {
    const s = new Set(expanded.value)
    s.delete(it.idx)
    expanded.value = s
  }
  refreshItemClose()
}

function toggleLayer(key) {
  const opening = !openLayers.value.has(key)
  const s = new Set(openLayers.value)
  opening ? s.add(key) : s.delete(key)
  openLayers.value = s
  // 展开层不跳转：保持当前阅读位置（切换书卷/章节时才从头显示）
  if (opening) activeLayer.value = key
}

/** 经文解释层（简要版分节讲解）内的逐节展开状态（默认收起）；展开的节记为正在阅读项 */
const openVerses = ref(new Set())

function toggleVerse(i) {
  const opening = !openVerses.value.has(i)
  const s = new Set(openVerses.value)
  opening ? s.add(i) : s.delete(i)
  openVerses.value = s
  if (opening) {
    // 展开的节 = 正在看：右上角立即显示其关闭按钮（滚动时按视口实时切换）
    const sec = interpretationChapter.value?.sections?.[i]
    activeItem.value = { kind: 'verse', idx: i, label: sec?.ref || '节' }
    itemCloseVisible.value = true
  } else {
    refreshItemClose()
  }
}

// —— 总结 / 经文解释层数据（简要版源按栏目拆分，当前均为 MHCC）——
// 总结层 = summary 切片（每章 summary 一句话总结）；
// 经文解释层 = interpretation 切片（每章 sections 逐节讲解，前端折叠展示）
// 来源选择与完整解经层同款（CommentarySourceMenu；当前各一个源，多源时自动可切）
const conciseManifest = ref(null) // 注释源清单缓存（各栏目共用）
const summaryData = ref(null) // 总结源整卷数据
const summaryError = ref('')
const interpretationData = ref(null) // 经文解释源整卷数据
const interpretationError = ref('')
const studyChapter = computed(() => {
  if (!summaryData.value) return null
  return findCommentaryChapter(summaryData.value, props.chapter)
})
const interpretationChapter = computed(() => {
  if (!interpretationData.value) return null
  return findCommentaryChapter(interpretationData.value, props.chapter)
})

/** 总结层源（category='summary'）+ 源选择状态 */
const summarySources = computed(() => displaySources(sourcesOfCategory(conciseManifest.value, 'summary')))
const summaryKey = ref('')
const summaryMenuOpen = ref(false)
function pickSummarySource(key) {
  summaryKey.value = key
  summaryMenuOpen.value = false
}

/** 经文解释层源（category='interpretation'）+ 源选择状态 */
const interpretationSources = computed(() => displaySources(sourcesOfCategory(conciseManifest.value, 'interpretation')))
const interpretationKey = ref('')
const interpretationMenuOpen = ref(false)
function pickInterpretationSource(key) {
  interpretationKey.value = key
  interpretationMenuOpen.value = false
}

/** 上次加载的书卷（换卷判定用；immediate 时 oldValue 为 undefined，解构会抛错，故用模块级变量） */
let concisePrevBookId = null
let conciseSeq = 0
watch(
  () => [props.book?.id, props.chapter, props.open],
  async ([bookId]) => {
    // 换卷立即清空旧卷数据，避免新章号在旧卷数据中误匹配（串章）
    if (bookId !== concisePrevBookId) {
      concisePrevBookId = bookId
      summaryData.value = null
      interpretationData.value = null
    }
    if (!bookId || !props.open) return
    const seq = ++conciseSeq
    try {
      const m = conciseManifest.value || (await fetchCommentaryManifest())
      const summary = sourcesOfCategory(m, 'summary')[0]
      const interp = sourcesOfCategory(m, 'interpretation')[0]
      if (!summary || !interp) {
        summaryData.value = null
        interpretationData.value = null
        return
      }
      summaryKey.value = summary.key
      interpretationKey.value = interp.key
      // 两栏同源不同切片：并发加载
      const [sd, id] = await Promise.all([
        fetchCommentary(summaryKey.value, bookId, 'summary'),
        fetchCommentary(interpretationKey.value, bookId, 'interpretation'),
      ])
      if (seq !== conciseSeq) return
      summaryData.value = sd
      interpretationData.value = id
      summaryError.value = ''
      interpretationError.value = ''
    } catch (e) {
      if (seq !== conciseSeq) return
      summaryData.value = null
      interpretationData.value = null
      summaryError.value = String(e?.message || e)
      interpretationError.value = String(e?.message || e)
    }
  },
  { immediate: true },
)

// —— 背景注释层数据（STEP TIPNR 专有名词：人名/地名/背景词条，按当前章）——
const notesData = ref(null) // 当前卷注释数据
const notesError = ref('')
/** 背景注释来源（标注用，同完整解经层显示来源；当前仅 tipnr 一个源） */
const notesSource = computed(() => sourcesOfCategory(conciseManifest.value, 'notes')[0] || null)
/** 当前章背景注释（无数据返回 null → 「本章暂无背景注释」） */
const notesChapter = computed(() => findNotesChapter(notesData.value, props.chapter))
/** 词条展开状态：Set<索引>，默认收起；展开的词条记为正在阅读项 */
const openNotes = ref(new Set())
function toggleNote(i) {
  const opening = !openNotes.value.has(i)
  const s = new Set(openNotes.value)
  opening ? s.add(i) : s.delete(i)
  openNotes.value = s
  if (opening) {
    const n = notesChapter.value?.entries?.[i]
    activeItem.value = { kind: 'note', idx: i, label: n?.name || '词条' }
    itemCloseVisible.value = true
  } else {
    refreshItemClose()
  }
}

let notesPrevBookId = null
let notesSeq = 0
watch(
  () => [props.book?.id, props.chapter, props.open],
  async ([bookId]) => {
    // 换卷立即清空旧卷数据，避免新章号在旧卷数据中误匹配（串章）
    if (bookId !== notesPrevBookId) {
      notesPrevBookId = bookId
      notesData.value = null
    }
    if (!bookId || !props.open) return
    const seq = ++notesSeq
    try {
      const data = await fetchNotes(bookId)
      if (seq !== notesSeq) return
      notesData.value = data
      notesError.value = ''
    } catch (e) {
      if (seq !== notesSeq) return
      notesData.value = null
      notesError.value = String(e?.message || e)
    }
  },
  { immediate: true },
)

/** 源选择偏好持久化：localStorage('brp-commentary-source') */
const SOURCE_STORAGE = 'brp-commentary-source'

function pickSource(key) {
  // 语言组成员：组主源（langs[0]）可用时切到主条目（组内语言由语言标签切换）；
  // 主源缺失（如中文马太亨利已关闭）时组失效，直接用所选源本身
  const g = groupOfSource(key)
  sourceKey.value = g && sources.value.some((s) => s.key === g.langs[0].key) ? g.langs[0].key : key
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

/** 小节展开状态：Set<索引>，默认全部收起；展开的小节记为正在阅读项 */
const expanded = ref(new Set())

function toggleSection(i) {
  const opening = !expanded.value.has(i)
  const s = new Set(expanded.value)
  opening ? s.add(i) : s.delete(i)
  expanded.value = s
  if (opening) {
    const sec = chapterData.value?.sections?.[i]
    activeItem.value = { kind: 'section', idx: i, label: sec?.ref || sec?.heading || '节' }
    itemCloseVisible.value = true
  } else {
    refreshItemClose()
  }
}

const allExpanded = computed(
  () => !!chapterData.value && chapterData.value.sections.every((_, i) => expanded.value.has(i)),
)

function toggleAll() {
  if (!chapterData.value) return
  expanded.value = allExpanded.value ? new Set() : new Set(chapterData.value.sections.map((_, i) => i))
}

// 切换书卷/章节：所有展开项全部关闭 + 面板回到顶部（不保留上次进度）
watch(
  () => [props.book?.id, props.chapter],
  () => {
    expanded.value = new Set()
    openVerses.value = new Set()
    openNotes.value = new Set()
    openLayers.value = new Set()
    activeLayer.value = ''
    activeItem.value = null
    itemCloseVisible.value = false
    if (panelBodyEl.value) panelBodyEl.value.scrollTop = 0
  },
)

// 打开抽屉时同样全部收起（保持初始为标题列表）
watch(
  () => props.open,
  (v) => {
    if (!v) return
    openVerses.value = new Set()
    openNotes.value = new Set()
    openLayers.value = new Set()
    activeLayer.value = ''
    activeItem.value = null
    itemCloseVisible.value = false
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

/** 完整解经层源列表：按栏目过滤（fullCommentary），总结/经文解释/背景注释不进入完整解经层菜单 */
const fullSources = computed(() => sourcesOfCategory(conciseManifest.value, 'fullCommentary'))

async function loadSources() {
  try {
    const m = await fetchCommentaryManifest()
    conciseManifest.value = m
    sources.value = m.sources || []
    const list = fullSources.value // 完整解经层只从完整版源中选择
    if (list.length) {
      // 优先恢复用户上次选择的源（localStorage），否则第一个可用源；
      // 当前书卷不可用时自动回落到该卷可用的偏好源
      const saved = localStorage.getItem(SOURCE_STORAGE)
      const s = resolveCommentarySource({ sources: list }, saved, props.book?.id)
      sourceKey.value = s.key
    }
  } catch {
    sources.value = []
  }
}

// 书卷变化：当前源若无此卷注释，自动回落到该卷可用的源（resolveCommentarySource 保证）；
// 404（源无此卷数据）与数据缺失（返回 null）都触发回退。
/** 序号守卫：快速切换书卷/章节/源时丢弃过期响应 */
let loadPrevBookId = null
let loadSeq = 0
watch(
  () => [props.book?.id, props.chapter, sourceKey.value],
  async ([bookId]) => {
    // 换卷立即清空旧卷数据，避免新章号在旧卷数据中误匹配（串章）
    if (bookId !== loadPrevBookId) {
      loadPrevBookId = bookId
      bookData.value = null
    }
    if (!bookId || !sourceKey.value) return
    const seq = ++loadSeq
    loading.value = true
    try {
      const data = await fetchCommentary(sourceKey.value, bookId)
      if (seq !== loadSeq) return // 已有更新的请求
      if (data === null && fullSources.value.length) {
        // 该书卷在当前源不可用：回落到可用源（偏好链优先）
        const s = resolveCommentarySource(
          { sources: fullSources.value },
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
      if (fullSources.value.length) {
        const s = resolveCommentarySource(
          { sources: fullSources.value },
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
/** 面板滚动容器（「正在看」词条判断与回顶共用，避免高频滚动时全局查询） */
const panelBodyEl = ref(null)
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

const panelStyle = computed(() => {
  const s = {}
  if (panelWidth.value) s.width = panelWidth.value + 'px'
  // 抽屉高度只对移动端底部抽屉生效（桌面 flex 高度自适应，不受影响）
  if (sheetH.value && window.matchMedia('(max-width: 900px)').matches) s.height = sheetH.value + 'px'
  return s
})

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

// 恢复用户上次拖拽的宽度/抽屉高度；窗口尺寸变化（旋转/缩放）时重新限制
onMounted(() => {
  const saved = Number(localStorage.getItem(RESIZE_STORAGE))
  if (saved) panelWidth.value = clampWidth(saved)
  const savedH = Number(localStorage.getItem(SHEET_STORAGE))
  if (savedH) sheetH.value = clampSheetHeight(savedH)
  window.addEventListener('resize', onWindowResize)
})
onUnmounted(() => window.removeEventListener('resize', onWindowResize))
function onWindowResize() {
  if (panelWidth.value) panelWidth.value = clampWidth(panelWidth.value)
  if (sheetH.value) sheetH.value = clampSheetHeight(sheetH.value)
}

// —— 移动端底部抽屉（Bottom Sheet，PLAN.md §7）：顶部抓柄上下拖拽调整高度——
// 桌面保持右侧 Drawer + 左边缘水平调宽；移动端改为底部抽屉，抓柄垂直调高（40vh~92vh）
const SHEET_STORAGE = 'brp-commentary-sheet-height'
const sheetH = ref(null) // null = 默认高度（CSS 70vh）
const sheetDragging = ref(false)
let sheetStartY = 0
let sheetStartH = 0

/** 抽屉高度限制：40vh~92vh（给经文留出可见空间） */
function clampSheetHeight(h) {
  const vh = window.innerHeight
  return Math.min(Math.max(Math.round(h), Math.round(vh * 0.4)), Math.round(vh * 0.92))
}

function startSheetResize(e) {
  e.preventDefault()
  sheetDragging.value = true
  sheetStartY = e.clientY
  sheetStartH = sheetH.value ?? rootEl.value?.getBoundingClientRect().height ?? Math.round(window.innerHeight * 0.7)
  document.body.classList.add('resizing-panel')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

function onSheetResizeMove(e) {
  if (!sheetDragging.value) return
  const dy = sheetStartY - e.clientY // 向上拖（dy>0）抽屉变高
  sheetH.value = clampSheetHeight(sheetStartH + dy)
}

function endSheetResize() {
  if (!sheetDragging.value) return
  sheetDragging.value = false
  document.body.classList.remove('resizing-panel')
  if (sheetH.value) localStorage.setItem(SHEET_STORAGE, String(sheetH.value))
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
    <!-- 移动端底部抽屉抓柄（桌面隐藏）：上下拖拽调整抽屉高度 -->
    <div
      class="sheet-grabber"
      :class="{ dragging: sheetDragging }"
      role="separator"
      aria-orientation="horizontal"
      aria-label="拖动调整解经抽屉高度"
      @pointerdown="startSheetResize"
      @pointermove="onSheetResizeMove"
      @pointerup="endSheetResize"
      @pointercancel="endSheetResize"
    ></div>
    <header class="panel-head">
      <h2 class="panel-title">
        <span class="panel-title-label">解经</span>
        <span v-if="book" class="panel-title-ref">{{ book.zh }} · 第 {{ chapter }} 章</span>
      </h2>
      <div class="panel-head-actions">
        <!-- 关闭正在阅读的节/词条：仅向下滑动且阅读项滚出顶部时显示 -->
        <button
          v-if="itemCloseVisible"
          class="panel-item-close"
          @click="closeItem"
          :title="'关闭正在阅读的『' + (activeItem && activeItem.label) + '』'"
        >
          <span class="rc-x" aria-hidden="true">✕</span>
          <span>关闭 · {{ activeItem && activeItem.label }}</span>
        </button>
        <button class="panel-close" @click="emit('toggle')" aria-label="收起解经面板">✕</button>
      </div>
    </header>
    <div ref="panelBodyEl" class="panel-body" @scroll.passive="onPanelScroll">
      <!-- 分层结构化解经（默认展开，可逐层折叠；点击展开的层滚动置顶；切换书卷回到顶部） -->
      <div class="study-body">
        <div
          v-for="layer in SIX_LAYERS"
          :key="layer.key"
          class="study-layer"
          :data-layer="layer.key"
          :class="{ active: activeLayer === layer.key && openLayers.has(layer.key) }"
        >
          <button
            class="study-layer-toggle"
            :aria-expanded="openLayers.has(layer.key)"
            @click="toggleLayer(layer.key)"
          >
            <span class="chevron" :class="{ open: openLayers.has(layer.key) }" aria-hidden="true">▸</span>
            <span class="study-layer-title">{{ layer.label }}</span>
          </button>
          <div v-if="openLayers.has(layer.key)" class="study-layer-content">
            <template v-if="layer.key === 'summary'">
              <!-- 来源选择（与完整解经层同款；当前单源 mhcc） -->
              <div v-if="summarySources.length" class="source-row summary-source-row">
                <CommentarySourceMenu
                  :sources="summarySources"
                  :active-key="summaryKey"
                  :open="summaryMenuOpen"
                  :book-id="book && book.id"
                  @toggle="summaryMenuOpen = !summaryMenuOpen"
                  @select="pickSummarySource"
                />
              </div>
              <p v-if="studyChapter && studyChapter.summary" class="study-text">{{ studyChapter.summary }}</p>
              <p v-else class="study-placeholder">待整理…<template v-if="summaryError">（{{ summaryError }}）</template></p>
            </template>
            <template v-else-if="layer.key === 'keyPoints'">
              <ul v-if="studyChapter && studyChapter.keyPoints && studyChapter.keyPoints.length" class="study-keypoints">
                <li v-for="(p, i) in studyChapter.keyPoints" :key="i">{{ p }}</li>
              </ul>
              <p v-else class="study-placeholder">待整理…</p>
            </template>
            <!-- 经文解释层 = 简要版（MHCC）分节讲解：逐节折叠，每节单独展开 -->
            <template v-else-if="layer.key === 'interpretation'">
              <!-- 来源选择（与完整解经层同款；当前单源 mhcc） -->
              <div v-if="interpretationSources.length" class="source-row summary-source-row">
                <CommentarySourceMenu
                  :sources="interpretationSources"
                  :active-key="interpretationKey"
                  :open="interpretationMenuOpen"
                  :book-id="book && book.id"
                  @toggle="interpretationMenuOpen = !interpretationMenuOpen"
                  @select="pickInterpretationSource"
                />
              </div>
              <template v-if="interpretationChapter && interpretationChapter.sections && interpretationChapter.sections.length">
                <div v-for="(s, i) in interpretationChapter.sections" :key="i" class="study-verse">
                  <button
                    class="study-verse-toggle"
                    :data-item-idx="i"
                    :aria-expanded="openVerses.has(i)"
                    @click="toggleVerse(i)"
                  >
                    <span class="chevron" :class="{ open: openVerses.has(i) }" aria-hidden="true">▸</span>
                    <span class="commentary-ref">{{ s.ref || '解经' }}</span>
                  </button>
                  <div v-if="openVerses.has(i)" class="study-verse-content">
                    <p class="commentary-text">{{ s.text }}</p>
                  </div>
                </div>
              </template>
              <p v-else class="study-placeholder">待整理…</p>
            </template>
            <!-- 背景注释层 = STEP TIPNR 专有名词（人名/地名/背景），按当前章列出词条，可展开文章级描述 -->
            <template v-else-if="layer.key === 'notes'">
              <!-- 来源标注（同完整解经层显示来源；当前仅 TIPNR 一个源） -->
              <p v-if="notesSource" class="notes-source"><span class="notes-source-tag">{{ notesSource.name }}</span></p>
              <template v-if="notesChapter && notesChapter.entries && notesChapter.entries.length">
                <div v-for="(n, i) in notesChapter.entries" :key="i" class="note-entry">
                  <button
                    class="note-toggle"
                    :data-item-idx="i"
                    :aria-expanded="openNotes.has(i)"
                    @click="toggleNote(i)"
                  >
                    <span class="chevron" :class="{ open: openNotes.has(i) }" aria-hidden="true">▸</span>
                    <span class="note-name">{{ n.name }}</span>
                    <span v-if="n.type" class="note-type">{{ n.type }}</span>
                  </button>
                  <div v-if="openNotes.has(i)" class="note-content">
                    <p v-if="n.short" class="note-short">{{ n.short }}</p>
                    <p v-if="n.article" class="note-article">{{ n.article }}</p>
                    <p v-else-if="n.brief" class="note-article">{{ n.brief }}</p>
                    <p v-if="n.refs && n.refs.length" class="note-refs">本章出现：第 {{ n.refs.join('、') }} 节</p>
                  </div>
                </div>
              </template>
              <p v-else class="study-placeholder">本章暂无背景注释<template v-if="notesError">（{{ notesError }}）</template></p>
            </template>
            <p v-else-if="studyChapter && studyChapter[layer.key]" class="study-text">{{ studyChapter[layer.key] }}</p>
            <p v-else class="study-placeholder">待整理…</p>
          </div>
        </div>
      </div>
      <!-- 完整解经层 = 完整版多来源解经（按宗派分组：马太亨利/加尔文/RWP/Abbott/Catena，即解经正文），可折叠 -->
      <div
        class="study-layer full-commentary-layer"
        :data-layer="'fullCommentary'"
        :class="{ active: activeLayer === 'fullCommentary' && openLayers.has('fullCommentary') }"
      >
        <button
          class="study-layer-toggle"
          :aria-expanded="openLayers.has('fullCommentary')"
          @click="toggleLayer('fullCommentary')"
        >
          <span class="chevron" :class="{ open: openLayers.has('fullCommentary') }" aria-hidden="true">▸</span>
          <span class="study-layer-title">完整解经</span>
        </button>
        <div v-if="openLayers.has('fullCommentary')" class="study-layer-content">
        <!-- 源选择器常驻（空状态/加载中也可见）：当前源无此卷解经时可切换其他源 -->
        <div v-if="sources.length" class="commentary-top">
        <div class="source-row">
          <CommentarySourceMenu
            :sources="displaySources(fullSources)"
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
            :data-item-idx="i"
            :aria-expanded="expanded.has(i)"
            :title="s.heading || '注释'"
            @click="toggleSection(i)"
          >
            <span class="chevron" :class="{ open: expanded.has(i) }" aria-hidden="true">▸</span>
            <span v-if="s.ref" class="commentary-ref">{{ s.ref }}</span>
            <span v-if="s.heading" class="heading-text">{{ s.heading }}</span>
            <span v-if="!s.ref && !s.heading" class="heading-text">解经</span>
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
        :title="bookDisabled ? '该卷解经暂时关闭' : '本卷暂无解经资料'"
        :message="bookDisabled
          ? '当前书卷的解经暂未开放，敬请期待。'
          : '本卷解经资料尚未收录，正在陆续整理中。'"
      />
        </div>
      </div>
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
  gap: 0.5rem;
  padding: 0.8rem 1rem 0.7rem;
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(180deg, rgba(139, 115, 85, 0.06), transparent);
}
.panel-title {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
}
.panel-title-label {
  font-family: var(--serif);
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.panel-title-ref {
  font-size: 0.82rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.panel-item-close {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--gold);
  border-radius: 999px;
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.14rem 0.65rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.panel-item-close:hover {
  background: var(--gold);
  color: #fff;
}
.rc-x {
  font-size: 0.7rem;
  line-height: 1;
}
.panel-close {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 0.9rem;
  width: 1.7rem;
  height: 1.7rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  flex-shrink: 0;
  cursor: pointer;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.panel-close:hover {
  color: var(--gold);
  background: var(--gold-soft);
  border-color: var(--gold-soft);
}
/* 完整解经层（多来源解经：马太亨利/加尔文等）：与各层同款卡片，上方虚线分隔 */
.full-commentary-layer {
  margin-top: 0.6rem;
  border-top: 1px dashed var(--line);
}
/* 解经层：卡片式分组（金棕左线 + 浅底 + 圆角），展开的层（active）金色描边高亮 */
.study-body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.study-layer {
  border: 1px solid var(--line-soft);
  border-left: 3px solid var(--gold);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.study-layer.active {
  border-color: var(--gold-soft);
  box-shadow: 0 2px 10px rgba(139, 115, 85, 0.14);
}
/* 层标题 = 可点击折叠按钮（与注释小节同款交互） */
.study-layer-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  border: none;
  background: linear-gradient(180deg, rgba(139, 115, 85, 0.05), rgba(139, 115, 85, 0.02));
  padding: 0.6rem 0.85rem;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.study-layer-toggle:hover {
  background: var(--gold-soft);
}
.study-layer-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.05em;
}
/* 层内容（展开区） */
.study-layer-content {
  padding: 0.35rem 0.95rem 0.95rem;
}
.study-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.9;
  color: #3c4652;
  white-space: pre-line;
}
/* 总结/经文解释层的来源选择行（与完整解经层同款胶囊按钮） */
.summary-source-row {
  margin: 0.35rem 0 0.55rem;
}
.study-keypoints {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.93rem;
  line-height: 1.9;
  color: #3c4652;
}
.study-placeholder {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
  font-style: italic;
}
/* 折叠指示：旋转动画（150-300ms 微交互） */
.chevron {
  display: inline-block;
  color: var(--gold);
  font-size: 0.72rem;
  line-height: 1;
  flex-shrink: 0;
  transition: transform 0.2s var(--ease);
}
.chevron.open {
  transform: rotate(90deg);
}
/* MHCC 逐节（经文解释层内）：与完整解经/注释小节同款折叠 */
.study-verse {
  margin: 0.2rem 0;
}
.study-verse-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.3rem 0.4rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.study-verse-toggle:hover {
  background: var(--gold-soft);
}
.study-verse-content {
  padding: 0.1rem 0.4rem 0.5rem;
}
/* 背景注释（TIPNR 词条）：来源标注 + 同款折叠样式，词条名 + 类型徽章 */
.notes-source {
  margin: 0.3rem 0 0.2rem;
}
.notes-source-tag {
  display: inline-block;
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  white-space: nowrap;
}
.note-entry {
  margin: 0.2rem 0;
}
.note-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.3rem 0.4rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.note-toggle:hover {
  background: var(--gold-soft);
}
.note-name {
  font-weight: 600;
  color: var(--ink);
}
.note-type {
  font-size: 0.7rem;
  color: var(--gold);
  border: 1px solid var(--gold-soft);
  border-radius: 999px;
  padding: 0 0.45rem;
  line-height: 1.35;
  background: rgba(139, 115, 85, 0.05);
}
.note-content {
  padding: 0.15rem 0.4rem 0.5rem 1.6rem;
}
.note-short {
  color: var(--ink);
  margin: 0.15rem 0;
}
.note-article {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0.3rem 0 0;
  white-space: pre-line;
}
.note-refs {
  color: var(--gold);
  font-size: 0.8rem;
  margin: 0.35rem 0 0;
}
.study-empty {
  color: var(--muted);
  text-align: center;
  padding: 2rem 0;
  font-size: 0.95rem;
}
.panel-body {
  position: relative; /* 滚动定位基准（层置顶 scrollTo 用 offsetTop） */
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

/* 移动端底部抽屉抓柄（桌面隐藏）：横条提示 + 上下拖拽调高 */
.sheet-grabber {
  display: none;
}

/* 窄屏（≤900px）：解经抽屉变为底部 Bottom Sheet（PLAN.md §7），抓柄上下拖拽调整高度 */
@media (max-width: 900px) {
  .commentary-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    z-index: 45;
    width: 100%;
    max-width: none;
    height: 70vh;
    border-left: none;
    border-top: 1px solid var(--line-soft);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
  }
  /* 桌面水平调宽手柄在移动端隐藏（改用底部抓柄） */
  .resize-handle {
    display: none;
  }
  .sheet-grabber {
    display: block;
    position: relative;
    flex-shrink: 0;
    height: 20px;
    cursor: ns-resize;
    touch-action: none;
    background: transparent;
  }
  .sheet-grabber::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 8px;
    width: 44px;
    height: 4px;
    transform: translateX(-50%);
    border-radius: 2px;
    background: var(--line);
    transition: background var(--dur) var(--ease);
  }
  .sheet-grabber:hover::after,
  .sheet-grabber.dragging::after {
    background: var(--gold);
  }
}
</style>
