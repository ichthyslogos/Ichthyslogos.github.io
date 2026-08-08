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

const route = useRoute()
const router = useRouter()

const manifest = ref(null)
const bookData = ref(null)
/** Strong 逐词标注（仅和合本简体 chiuns 有数据，其余译本为 null） */
const strongData = ref(null)
// 解经面板：桌面默认展开、窄屏默认收起（避免覆盖经文）
const panelOpen = ref(window.innerWidth > 900)
// 移动端侧栏抽屉开关（窄屏下书卷列表为抽屉形式）
const sidebarOpen = ref(false)
// 译本下拉展开（受控组件，由本页统一管理以支持移动端互斥）
const menuOpen = ref(false)

/** 移动端判定（三面板互斥仅窄屏生效，桌面三栏共存） */
const isMobile = () => window.innerWidth <= 900

/** 移动端互斥：打开任一面板时先关闭其他两个 */
function closeOthers(except) {
  if (!isMobile()) return
  if (except !== 'sidebar') sidebarOpen.value = false
  if (except !== 'menu') menuOpen.value = false
  if (except !== 'commentary') panelOpen.value = false
}
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    manifest.value = await fetchManifest()
    syncFromRoute()
    // URL 本就合法时 syncFromRoute 不会触发导航，需手动拉取一次
    if (!bookData.value) await load()
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

/** 从 URL 同步状态：URL 变化 → 重新拉取切片数据（Strong 标注仅和合本简体有） */
async function load() {
  if (!translation.value || !book.value) return
  loading.value = true
  try {
    bookData.value = await fetchBook(translation.value.key, book.value.id)
    strongData.value =
      translation.value.key === 'chiuns' ? await fetchStrong(book.value.id) : null
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch([translation, book], load)

// 路由变化（含外部链接/后退进入）时收起移动端面板，避免残留遮挡
watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
    menuOpen.value = false
  },
)

function syncFromRoute() {
  if (!translation.value || !book.value) return
  // 书卷 ID 非法时 resolveBook 已回退到第一卷：把 URL 修正为实际显示的书卷
  if (book.value.id !== route.params.bookId) {
    navigate(book.value.id, 1)
    return
  }
  const c = clampChapter(book.value, route.params.chapter || 1)
  if (c !== chapter.value) navigate(book.value.id, c)
}

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

function onChangeTranslation(key) {
  menuOpen.value = false // 选择后收起下拉
  clearGoto()
  // 译本切换后若当前书卷在新译本中不存在（如次经），resolveBook 自动回退第一卷
  navigate(book.value.id, chapter.value, key)
}

/** 串珠引用目标跳转（记录来源与目标节，用于返回与跳转后定位） */
const gotoFrom = ref(null) // { bookId, chapter, verse, targetId, targetCh }
const showBack = ref(false)
/** 本次串珠跳转是否已滚动定位到目标经文（只执行一次） */
let scrolledForGoto = false

function onGotoVerse(target) {
  gotoFrom.value = {
    bookId: book.value.id,
    chapter: chapter.value,
    verse: target.vs,
    targetId: target.id,
    targetCh: target.ch,
  }
  showBack.value = true
  scrolledForGoto = false
  navigate(target.id, target.ch)
}

/** 串珠跳转后：章节渲染完成，把目标经文滚动到经文区顶部优先展示 */
watch([book, chapter, verses], async () => {
  const f = gotoFrom.value
  if (!f?.verse || scrolledForGoto) return
  if (book.value?.id !== f.targetId || chapter.value !== f.targetCh) return // 尚未到达目标章节
  await nextTick()
  const sc = document.querySelector('.scripture-scroll')
  const el = sc?.querySelector(`[data-verse="${f.verse}"]`)
  if (sc && el) {
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8
    sc.scrollTop = Math.max(0, top)
    scrolledForGoto = true
  }
})

/** 手动导航（选书/选章/切译本）清除串珠返回状态 */
function clearGoto() {
  gotoFrom.value = null
  showBack.value = false
  scrolledForGoto = false
}

/** 串珠跳转后返回来源位置 */
function onBackFromGoto() {
  const from = gotoFrom.value
  clearGoto()
  if (from) navigate(from.bookId, from.chapter)
}

/** 悬浮按钮显示文字：来源书卷名 */
const fromLabel = computed(() => {
  const f = gotoFrom.value
  if (!f) return ''
  const b = translation.value?.books.find((x) => x.id === f.bookId)
  return b ? `${b.zh} ${f.chapter} 章` : ''
})

/** 窗口跨移动端边界（≤900px）时：窄屏强制收起解经覆盖层，避免遮挡经文 */
function onResize() {
  if (isMobile() && panelOpen.value) panelOpen.value = false
}

window.addEventListener('resize', onResize)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

function onToggleCommentary() {
  closeOthers('commentary')
  panelOpen.value = !panelOpen.value
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
    <BookSidebar
      :translation="translation"
      :active-book-id="book && book.id"
      @select-book="onSelectBook"
      @close="sidebarOpen = false"
    />
    <section class="brp-main">
      <div v-if="error" class="brp-error">{{ error }}</div>
      <template v-else-if="book">
        <ChapterTabs :chapter-count="book.chapterCount" :current="chapter" @select-chapter="onSelectChapter" />
        <ScripturePanel
          :book="book"
          :chapter="chapter"
          :verses="verses"
          :translations="manifest.translations"
          :active-key="translation.key"
          :menu-open="menuOpen"
          :loading="loading"
          :strong="strongData"
          @change-translation="onChangeTranslation"
          @toggle-commentary="onToggleCommentary"
          @toggle-sidebar="onToggleSidebar"
          @toggle-menu="onToggleMenu"
          @goto-verse="onGotoVerse"
        />
      </template>
    </section>
    <CommentaryPanel
      :open="panelOpen"
      :book="book"
      :chapter="chapter"
      @toggle="onToggleCommentary"
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
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  cursor: pointer;
  white-space: nowrap;
}
.back-fab:hover {
  filter: brightness(1.08);
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
}
</style>
