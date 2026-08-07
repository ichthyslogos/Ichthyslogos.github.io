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
const panelOpen = ref(true) // 解经面板默认展开（常驻经文右侧）
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
  navigate(bookId, 1)
}

function onSelectChapter(ch) {
  navigate(book.value.id, ch)
}

function onChangeTranslation(key) {
  // 译本切换后若当前书卷在新译本中不存在（如次经），resolveBook 自动回退第一卷
  navigate(book.value.id, chapter.value, key)
}

function onToggleCommentary() {
  panelOpen.value = !panelOpen.value
}
</script>

<template>
  <div class="brp-layout" v-if="manifest">
    <BookSidebar :translation="translation" :active-book-id="book && book.id" @select-book="onSelectBook" />
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
          :loading="loading"
          @change-translation="onChangeTranslation"
          @toggle-commentary="onToggleCommentary"
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
</style>
