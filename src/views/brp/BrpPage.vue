<script setup>
/**
 * BrpPage — 读经研究平台（brp）页面
 * 路由：/brp（默认）与 /brp/:bookId/:chapter，URL 与阅读位置同步
 * 布局：左栏书卷列表 | 主区（章节导航 + 经文正文 + 译本切换）
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchManifest,
  fetchBook,
  fetchStrong,
  resolveTranslation,
  resolveBook,
  clampChapter,
} from '../../lib/data.js'
import BookSidebar from '../../components/brp/BookSidebar.vue'
import ChapterTabs from '../../components/brp/ChapterTabs.vue'
import ScripturePanel from '../../components/brp/ScripturePanel.vue'
import CommentaryPanel from '../../components/brp/CommentaryPanel.vue'
import MapPanel from '../../components/brp/MapPanel.vue'

const route = useRoute()
const router = useRouter()

const manifest = ref(null)
const bookData = ref(null)
// 解经面板：桌面默认展开、窄屏默认收起（避免覆盖经文）
const panelOpen = ref(window.innerWidth > 900)
// 移动端侧栏抽屉开关（窄屏下书卷列表为抽屉形式）
const sidebarOpen = ref(false)
// 移动端沉浸阅读：隐藏头部（标题/章节标签）扩大阅读区；桌面端无意义但状态无害
const immersive = ref(false)
// 地图抽屉（与解经面板共用右侧栏/底部抽屉位置，互斥切换）：默认收起，由功能菜单打开
const mapOpen = ref(false)
// 解经面板地点跳转联动：focusName + focusSeq（序号递增保证同名重复跳转也重新定位）
const mapFocus = ref('')
const mapFocusSeq = ref(0)
// 经文高亮跳转联动：noteFocus + noteFocusSeq（背景注释词条定位）
const noteFocus = ref('')
const noteFocusSeq = ref(0)
// 译本下拉展开（受控组件，由本页统一管理以支持移动端互斥）
const menuOpen = ref(false)

/** 移动端判定（响应式 ref：窗口缩放即时更新，模板可直接绑定；三面板互斥仅窄屏生效） */
const isMobile = ref(window.innerWidth <= 900)

/** 开启任一其他抽屉时，先强制收起译本菜单（任何视口）；其余面板的互斥仅限移动端 */
function closeOthers(except) {
  if (except !== 'menu') menuOpen.value = false
  if (!isMobile.value) return
  if (except !== 'sidebar') sidebarOpen.value = false
  if (except !== 'commentary') panelOpen.value = false
  if (except !== 'map') mapOpen.value = false
}

/** 功能词条：调出解经/地图抽屉（桌面与移动端均互斥：同位置切换） */
function openTool(tool) {
  if (tool === 'map') {
    closeOthers('map')
    panelOpen.value = false
    mapOpen.value = true
    mapFocus.value = '' // 工具栏手动打开：不携带地点跳转焦点
  } else {
    closeOthers('commentary')
    mapOpen.value = false
    panelOpen.value = true
  }
}

/** 背景注释地点词条跳转：关闭解经面板 → 打开地图抽屉 → 定位高亮该地点 */
function onFocusPlace(name) {
  closeOthers('map')
  panelOpen.value = false
  mapOpen.value = true
  mapFocus.value = name
  mapFocusSeq.value++
}

/** 经文高亮文字点击：打开解经抽屉 → 背景注释层定位对应词条 */
function onOpenNote(note) {
  closeOthers('commentary')
  mapOpen.value = false
  panelOpen.value = true
  noteFocus.value = note?.name || ''
  noteFocusSeq.value++
}
const loading = ref(false)
const error = ref('')
/** 加载序号守卫：快速切换书卷/译本时丢弃过期响应（防旧数据覆盖新卷） */
let loadSeq = 0

onMounted(async () => {
  try {
    manifest.value = await fetchManifest()
    syncFromRoute()
  } catch (e) {
    error.value = e.message
  }
})

/** 当前译本（route.query.trans 优先，其次默认） */
const translation = computed(() =>
  manifest.value ? resolveTranslation(manifest.value, route.query.trans) : null,
)

/** 当前书卷（manifest 中的卷信息） */
const book = computed(() =>
  translation.value ? resolveBook(translation.value, route.params.bookId) : null,
)

/** 当前章号（越界钳制） */
const chapter = computed(() =>
  book.value ? clampChapter(book.value, route.params.chapter || 1) : 1,
)

/** 当前章的全部经文 */
const verses = computed(() => {
  const d = bookData.value
  if (!d) return []
  const ch = d.book.chapters.find((c) => c.chapter === chapter.value)
  return ch ? ch.verses : []
})

/* ---- 译本多选对照：按选择顺序，transOrder[0] 为主译本，其余为对照译本 ---- */
const transOrder = ref([])
const compareData = ref({}) // 对照译本 key → 整卷数据（data.js 缓存）
watch(
  translation,
  (t) => {
    if (!t) return
    if (!transOrder.value.length) transOrder.value = [t.key]
    else if (transOrder.value[0] !== t.key) transOrder.value = [t.key, ...transOrder.value.slice(1)]
  },
  { immediate: true },
)

/** 选主译本（单选）：替换 transOrder 首位并切换主译本取数；保持对照集、展开状态不变 */
function onSetPrimary(key) {
  clearGoto()
  const others = transOrder.value.slice(1).filter((k) => k !== key)
  transOrder.value = [key, ...others]
  navigate(book.value.id, chapter.value, key)
}

/** 切换对照译本（多选）；'__none__' 清空对照；主译本不变，不触发导航 */
function onToggleCompare(key) {
  clearGoto()
  const primary = transOrder.value[0]
  let comps = transOrder.value.slice(1)
  if (key === '__none__') {
    comps = []
  } else {
    if (key === primary) return // 互斥：主译不能作为对照
    comps = comps.includes(key) ? comps.filter((k) => k !== key) : [...comps, key]
  }
  transOrder.value = [primary, ...comps]
}

/** 对照译本数据拉取：只取照译本同卷同章，data.js 缓存复用；带序号守卫防快速切换错位 */
let cmpLoadSeq = 0
watch(
  () => [transOrder.value, book.value?.id, chapter.value],
  async () => {
    const seq = ++cmpLoadSeq
    const order = transOrder.value
    const others = order.slice(1)
    // 清掉已被取消的对照缓存
    const keep = {}
    for (const k of Object.keys(compareData.value)) if (others.includes(k)) keep[k] = compareData.value[k]
    compareData.value = keep
    if (!book.value) return
    for (const key of others) {
      try {
        const bd = await fetchBook(key, book.value.id)
        if (seq !== cmpLoadSeq) return
        if (!others.includes(key)) continue
        compareData.value = { ...compareData.value, [key]: bd }
      } catch (e) {
        /* 对照译本加载失败：静默跳过该对照（主译本不受影响） */
      }
    }
  },
  { immediate: true },
)

/** 对照译本表（主译本的对照列表）：{key, name, verses:{节:文本}} */
const compareTrans = computed(() => {
  const order = transOrder.value
  const out = []
  for (const key of order.slice(1)) {
    const t = manifest.value?.translations.find((x) => x.key === key)
    const bd = compareData.value[key]
    const versesMap = {}
    if (bd?.book) {
      const ch = bd.book.chapters.find((c) => c.chapter === chapter.value)
      for (const v of ch?.verses || []) versesMap[v.verse] = v.text
    }
    out.push({ key, name: t?.name || key, verses: versesMap })
  }
  return out
})

/* ---- 逐字原文（和合本简体 Strong）：仅在主译本为和合本简体时可用 ---- */
const strongOn = ref(false)
const strongBook = ref(null)
watch(
  () => [translation.value?.key, book.value?.id],
  async () => {
    strongBook.value = null
    if (translation.value?.key !== 'chisim') {
      strongOn.value = false
      return
    }
    try {
      strongBook.value = await fetchStrong(book.value.id)
    } catch (e) {
      strongBook.value = null
      strongOn.value = false
    }
  },
  { immediate: true },
)
const strongReady = computed(() => translation.value?.key === 'chisim')
/** 当前章每节 words 映射（未开启/非 chisim 时 null） */
const strongWords = computed(() => {
  if (!strongOn.value || !strongBook.value) return null
  const ch = strongBook.value.chapters?.find((c) => c.chapter === chapter.value)
  if (!ch) return null
  const m = {}
  for (const v of ch.verses) m[v.verse] = v.words
  return m
})
function onToggleStrong() {
  if (!strongReady.value) return
  strongOn.value = !strongOn.value
}

/** 从 URL 同步状态：URL 变化 → 重新拉取切片数据。
 * 带序号守卫：快速切换时旧响应直接丢弃。 */
async function load() {
  if (!translation.value || !book.value) return
  const seq = ++loadSeq
  loading.value = true
  error.value = '' // 成功路径清除历史错误
  try {
    const bd = await fetchBook(translation.value.key, book.value.id)
    if (seq !== loadSeq) return // 已有更新的加载请求，丢弃本次结果
    bookData.value = bd
  } catch (e) {
    if (seq !== loadSeq) return
    error.value = e.message
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

watch([translation, book], load)

// 路由变化（含外部链接/后退进入）时收起移动端侧栏/解经面板，避免残留遮挡；
// 译本菜单保持展开（多选体验），由用户手动关闭或开启其他抽屉时强关。
watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  },
)

function syncFromRoute() {
  if (!translation.value || !book.value) return
  // 书卷 ID 非法时 resolveBook 已回退到第一卷：把 URL 修正为实际显示的书卷
  if (book.value.id !== route.params.bookId) {
    navigate(book.value.id, 1)
    return
  }
  // 非法 ?trans（resolveTranslation 已回退默认译本）：URL 同步纠正，避免分享链接与实际译本不一致
  if (route.query.trans && route.query.trans !== translation.value.key) {
    router.replace({
      path: route.path,
      query: { ...route.query, trans: translation.value.key },
    })
  }
  // 章节越界/非数字：chapter 计算属性已钳制，需用原始路由参数比较，越界才修正 URL
  const rawCh = Number(route.params.chapter)
  const c = clampChapter(book.value, route.params.chapter || 1)
  if (rawCh !== c) navigate(book.value.id, c)
}

// 路由变化（SPA 内跳转/深链）时同样规范化 URL（挂载时由 onMounted 触发一次，此后由本 watch 兜底）
watch(
  () => route.fullPath,
  () => {
    if (manifest.value) syncFromRoute()
  },
)

/** 统一跳转：书卷/章节变化都走路由，保持 URL 可分享 */
function navigate(bookId, ch, trans) {
  router.push({
    path: `/brp/${bookId}/${ch}`,
    query: trans ? { trans } : route.query,
  })
}

function onSelectBook(bookId) {
  sidebarOpen.value = false // 移动端选择书卷后收起抽屉
  clearGoto() // 手动导航清除串珠返回
  navigate(bookId, 1)
}

function onSelectChapter(ch) {
  clearGoto()
  navigate(book.value.id, ch)
}

/** 串珠引用目标跳转（记录来源与目标节，用于返回与跳转后定位） */
const gotoFrom = ref(null) // { bookId, chapter, verse, targetId, targetCh, targetVs }
const showBack = ref(false)
/** 待滚动定位的经文（跳转目标或返回来源）；渲染就绪后定位，成功后清空 */
const pendingScroll = ref(null) // { bookId, ch, vsNum }

/** vs 字符串（"22-24"/"6,9"）→ 首个节号 */
const firstVerseOf = (vs) => Number(String(vs).match(/\d+/)?.[0])

/** 尝试滚动定位 pendingScroll；条件满足（目标章已渲染）则滚动、高亮并清空 */
function tryScroll() {
  const p = pendingScroll.value
  if (!p) return
  const onTarget = book.value?.id === p.bookId && chapter.value === p.ch
  if (!onTarget) {
    // 目标章不可达（章号越界被钳制）→ 放弃定位并清理，避免残留状态卡住后续滚动复位
    if (book.value?.id === p.bookId && clampChapter(book.value, p.ch) !== p.ch) {
      pendingScroll.value = null
    }
    return // 目标章节尚未加载（跨章跳转等待路由）
  }
  const sc = document.querySelector('.scripture-scroll')
  if (!sc) return
  const el = sc.querySelector(`[data-verse="${p.vsNum}"]`)
  if (!el) {
    // 经文已渲染完成仍找不到目标节（vs 越界等）→ 放弃定位并清理，同样防止残留状态卡住滚动复位
    if (verses.value.length && !loading.value) {
      pendingScroll.value = null
      sc.scrollTop = 0
    }
    return
  }
  const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8
  sc.scrollTop = Math.max(0, top)
  pendingScroll.value = null
  // 目标节高亮（金棕底 + 描边，2.2s 后自动消退；重复跳转会重置计时）
  el.classList.add('goto-highlight')
  if (el._hlTimer) clearTimeout(el._hlTimer)
  el._hlTimer = setTimeout(() => el.classList.remove('goto-highlight'), 2200)
}

function onGotoVerse(target) {
  gotoFrom.value = {
    bookId: book.value.id,
    chapter: chapter.value,
    verse: target.from ?? null, // 来源节（VerseItem 提供）
    targetId: target.id,
    targetCh: target.ch,
    targetVs: target.vs,
  }
  showBack.value = true
  pendingScroll.value = { bookId: target.id, ch: target.ch, vsNum: firstVerseOf(target.vs) }
  navigate(target.id, target.ch)
  // 同章跳转：路由不变，nextTick 后直接定位；跨章由下方 watch 兜底
  nextTick().then(tryScroll)
}

/** 路由/数据变化后的经文滚动：
 *  - 串珠跳转/返回（pendingScroll 存在）→ 定位到目标节
 *  - 普通导航（选书/选章）→ 滚回经文顶部，不保留跳转前阅读进度 */
watch([book, chapter, verses], () => {
  nextTick().then(() => {
    if (pendingScroll.value) {
      tryScroll()
      return
    }
    // URL ?v= 深链（全局搜索/外部链接）：定位到指定节并高亮
    const qv = Number(route.query.v)
    if (Number.isInteger(qv) && qv > 0 && verses.value.length) {
      pendingScroll.value = { bookId: book.value?.id, ch: chapter.value, vsNum: qv }
      tryScroll()
      return
    }
    const sc = document.querySelector('.scripture-scroll')
    if (sc) sc.scrollTop = 0
  })
})

/** 手动导航（选书/选章/切译本）清除串珠返回状态 */
function clearGoto() {
  gotoFrom.value = null
  showBack.value = false
  pendingScroll.value = null
}

/** 串珠跳转后返回来源位置（并定位到来源节） */
function onBackFromGoto() {
  const from = gotoFrom.value
  clearGoto()
  if (from) {
    pendingScroll.value = { bookId: from.bookId, ch: from.chapter, vsNum: from.verse }
    navigate(from.bookId, from.chapter)
    nextTick().then(tryScroll)
  }
}

/** 悬浮按钮显示文字：来源书卷名 */
const fromLabel = computed(() => {
  const f = gotoFrom.value
  if (!f) return ''
  const b = translation.value?.books.find((x) => x.id === f.bookId)
  return b ? `${b.zh} ${f.chapter} 章` : ''
})

/** 窗口跨移动端边界（≤900px）时：更新响应式判定，窄屏强制收起解经/地图覆盖层，避免遮挡经文 */
function onResize() {
  isMobile.value = window.innerWidth <= 900
  if (isMobile.value && panelOpen.value) panelOpen.value = false
  if (isMobile.value && mapOpen.value) mapOpen.value = false
}

window.addEventListener('resize', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

function onToggleCommentary() {
  closeOthers('commentary')
  panelOpen.value = !panelOpen.value
}

/** 地图抽屉 ✕ 关闭 */
function onToggleMap() {
  closeOthers('map')
  mapOpen.value = !mapOpen.value
}

function onToggleSidebar() {
  closeOthers('sidebar')
  sidebarOpen.value = !sidebarOpen.value
}

function onToggleMenu() {
  closeOthers('menu')
  menuOpen.value = !menuOpen.value
}
</script>

<template>
  <div class="brp-layout" :class="{ 'sidebar-open': sidebarOpen }" v-if="manifest">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false"></div>
    <!-- 沉浸阅读退出按钮（移动端）：悬浮右上角，点击恢复头部标题/章节标签 -->
    <button
      v-if="immersive && isMobile"
      class="immersive-exit"
      aria-label="退出沉浸阅读，显示头部"
      @click="immersive = false"
    >⤡</button>
    <BookSidebar
      :translation="translation"
      :active-book-id="book && book.id"
      @select-book="onSelectBook"
      @close="sidebarOpen = false"
    />
    <section class="brp-main">
      <div v-if="error" class="brp-error">{{ error }}</div>
      <template v-else-if="book">
        <!-- 移动端沉浸阅读：隐藏头部（标题/章节标签）后章节条一同收起，退出按钮为悬浮键 -->
        <ChapterTabs v-show="!immersive || !isMobile" :chapter-count="book.chapterCount" :current="chapter" @select-chapter="onSelectChapter" />
        <ScripturePanel
          :book="book"
          :chapter="chapter"
          :verses="verses"
          :translations="manifest.translations"
          :active-key="translation.key"
          :compare-keys="transOrder.slice(1)"
          :compare-trans="compareTrans"
          :strong-ready="strongReady"
          :strong-on="strongOn"
          :strong-of="strongWords"
          :menu-open="menuOpen"
          :loading="loading"
          :immersive="immersive"
          @set-primary="onSetPrimary"
          @toggle-compare="onToggleCompare"
          @toggle-strong="onToggleStrong"
          @toggle-sidebar="onToggleSidebar"
          @toggle-menu="onToggleMenu"
          @goto-verse="onGotoVerse"
          @toggle-immersive="immersive = !immersive"
          @open-tool="openTool"
          @open-note="onOpenNote"
        />
      </template>
    </section>
    <CommentaryPanel
      :open="panelOpen"
      :book="book"
      :chapter="chapter"
      :focus-note-name="noteFocus"
      :focus-note-seq="noteFocusSeq"
      @toggle="onToggleCommentary"
      @focus-place="onFocusPlace"
    />
    <MapPanel
      :open="mapOpen"
      :book="book"
      :chapter="chapter"
      :focus-name="mapFocus"
      :focus-seq="mapFocusSeq"
      @toggle="onToggleMap"
    />
    <!-- 串珠跳转后的悬浮返回按钮：屏幕正下方居中，常驻直到用户操作（点击返回/手动导航） -->
    <Transition name="fab">
      <button
        v-if="showBack && gotoFrom"
        class="back-fab"
        @click="onBackFromGoto"
        aria-label="返回跳转前位置"
      >← 返回{{ fromLabel ? ' ' + fromLabel : '' }}</button>
    </Transition>
  </div>
  <div v-else-if="error" class="brp-loading">{{ error }}</div>
  <div v-else class="brp-loading">数据加载中…</div>
</template>

<style scoped>
.brp-layout {
  flex: 1;
  display: flex;
  min-height: 0;
}
.brp-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--panel);
}
/* 串珠返回悬浮按钮：屏幕正下方居中，最顶层 */
.back-fab {
  position: fixed;
  left: 50%;
  bottom: 2.2rem;
  transform: translateX(-50%);
  z-index: 100;
  padding: 0.6rem 1.4rem;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.back-fab:hover {
  background: #000;
  transform: translateX(-50%) translateY(-1px);
}
.fab-enter-active,
.fab-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fab-enter-from,
.fab-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
.brp-loading,
.brp-error {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}
.brp-error {
  color: #b3413b;
}
/* 移动端遮罩（仅侧栏抽屉打开时显示） */
.sidebar-backdrop {
  display: none;
}

/* 沉浸阅读退出按钮：悬浮右上角，移动端沉浸时显示（头部隐藏后唯一的恢复入口）。
   定位在全局导航栏（AppHeader，z-index:100）下方：此前 top:0.6rem 落在导航栏
   区域内且层级更低，按钮被完全遮挡，导致"隐藏后无还原按钮" */
.immersive-exit {
  position: fixed;
  top: calc(60px + 0.6rem);
  right: 0.6rem;
  z-index: 60;
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  color: var(--text);
  font-size: 1.15rem;
  line-height: 1;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
  cursor: pointer;
}
.immersive-exit:hover {
  color: var(--gold);
  border-color: var(--gold);
}

/* 窄屏（≤900px）：侧栏变抽屉、解经面板变覆盖层 */
@media (max-width: 900px) {
  .book-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 40;
    width: min(80vw, 16rem);
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    background: #fbfcfd;
    box-shadow: 8px 0 24px rgba(20, 28, 38, 0.18);
  }
  .brp-layout.sidebar-open .book-sidebar {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(20, 28, 38, 0.35);
    z-index: 39;
  }
  /* 更窄屏（≤600px）全局导航栏高 54px：退出按钮贴其下方 */
  @media (max-width: 600px) {
    .immersive-exit {
      top: calc(54px + 0.5rem);
    }
  }
}
</style>
