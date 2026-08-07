<script setup>
/**
 * BrpPage — 读经研究平台（brp）页面
 * 路由：/brp（默认）与 /brp/:bookId/:chapter，URL 与阅读位置同步
 * 布局：左栏书卷列表 | 主区（章节导航 + 经文正文 + 译本切换）
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchManifest,
  fetchBook,
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

/** 从 URL 同步状态：URL 变化 → 重新拉取切片数据 */
async function load() {
  if (!translation.value || !book.value) return
  loading.value = true
  try {
    bookData.value = await fetchBook(translation.value.key, book.value.id)
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
  navigate(bookId, 1)
}

function onSelectChapter(ch) {
  navigate(book.value.id, ch)
}

function onChangeTranslation(key) {
  menuOpen.value = false // 选择后收起下拉
  // 译本切换后若当前书卷在新译本中不存在（如次经），resolveBook 自动回退第一卷
  navigate(book.value.id, chapter.value, key)
}

/** 串珠引用目标跳转 */
function onGotoVerse(target) {
  navigate(target.id, target.ch)
}

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
