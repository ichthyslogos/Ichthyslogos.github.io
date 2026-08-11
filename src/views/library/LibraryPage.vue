<script setup>
/**
 * LibraryPage — 图书馆（书架浏览 ↔ 书目详情）
 * 路由：/library（书架）与 /library/:bookId（详情），URL 即状态（可分享）
 * 布局：左栏分类筛选 + 主区（书目卡片网格 / 详情视图）
 * 数据：索引 content.json（分类+书目轻量条目）→ 详情 books/<id>.json 按需加载（data.js 缓存）
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchLibraryIndex, fetchLibraryBook } from '../../lib/data.js'
import EmptyState from '../../components/EmptyState.vue'
import BookCard from '../../components/library/BookCard.vue'
import BookDetail from '../../components/library/BookDetail.vue'

const route = useRoute()
const router = useRouter()

const index = ref(null)
const detail = ref(null) // 当前详情（缓存 Map 由 data.js 内部缓存，本页只存当前）
const loading = ref(false)
const error = ref('')

/** 当前分类筛选（route.query.cat） */
const activeCat = computed(() => route.query.cat || 'all')

/** 当前书目 id（/library/:bookId） */
const bookId = computed(() => route.params.bookId || '')

onMounted(async () => {
  try {
    index.value = await fetchLibraryIndex()
  } catch (e) {
    error.value = e.message
  }
})

/** 详情按需加载（含切换守卫：快速切换书目时丢弃过期响应） */
let detailSeq = 0
watch(
  bookId,
  async (id) => {
    if (!id) {
      detail.value = null
      return
    }
    const seq = ++detailSeq
    loading.value = true
    try {
      const d = await fetchLibraryBook(id)
      if (seq !== detailSeq) return
      detail.value = d
    } catch (e) {
      if (seq !== detailSeq) return
      error.value = e.message
    } finally {
      if (seq === detailSeq) loading.value = false
    }
  },
  { immediate: true },
)

/** 书架滚动容器回顶（.app-main 是全局滚动容器） */
function scrollTop() {
  document.querySelector('.app-main')?.scrollTo(0, 0)
}

function selectCat(cat) {
  router.push({ path: '/library', query: cat === 'all' ? {} : { cat } })
  scrollTop()
}

function openBook(id) {
  router.push(`/library/${id}`)
  scrollTop()
}

function backToShelf() {
  router.push({ path: '/library', query: route.query.cat ? { cat: route.query.cat } : {} })
  scrollTop()
}

/** 搜索关键字（书目卡片按 title/author/tags 过滤） */
const search = ref('')
const filteredBooks = computed(() => {
  const q = search.value.trim().toLowerCase()
  const cat = activeCat.value
  let books = index.value?.books || []
  if (cat !== 'all') books = books.filter((b) => b.category === cat)
  if (q) {
    books = books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        (b.tags || []).some((t) => t.toLowerCase().includes(q)),
    )
  }
  return books
})

const catCount = (id) => (index.value?.books || []).filter((b) => b.category === id).length
</script>

<template>
  <div class="library-page" v-if="index">
    <!-- 详情视图 -->
    <template v-if="bookId">
      <div v-if="error" class="lib-error">{{ error }}</div>
      <div v-else-if="loading" class="lib-state">加载中…</div>
      <BookDetail
        v-else-if="detail"
        :book="detail"
        @back="backToShelf"
      />
      <EmptyState v-else title="未找到该书" message="书目不存在或已被移除。" />
    </template>

    <!-- 书架视图 -->
    <template v-else>
      <div class="lib-shelf">
        <aside class="lib-side">
          <button
            class="cat-item"
            :class="{ active: activeCat === 'all' }"
            @click="selectCat('all')"
          >
            <span>全部书目</span><span class="cat-count">{{ index.books.length }}</span>
          </button>
          <button
            v-for="c in index.categories"
            :key="c.id"
            class="cat-item"
            :class="{ active: activeCat === c.id }"
            @click="selectCat(c.id)"
          >
            <span>{{ c.zh }}</span><span class="cat-count">{{ catCount(c.id) }}</span>
          </button>
        </aside>
        <main class="lib-main">
          <header class="lib-head">
            <h1 class="lib-title">图书馆</h1>
            <p class="lib-sub">经典文献资料库 · {{ index.books.length }} 部藏书</p>
            <input
              v-model="search"
              class="lib-search"
              type="search"
              placeholder="搜索书名 / 作者 / 标签…"
              aria-label="搜索书目"
            />
          </header>
          <div v-if="error" class="lib-error">{{ error }}</div>
          <div v-else-if="filteredBooks.length" class="book-grid">
            <BookCard
              v-for="b in filteredBooks"
              :key="b.id"
              :book="b"
              @open="openBook(b.id)"
            />
          </div>
          <EmptyState
            v-else
            title="没有匹配的书目"
            message="换个关键词或分类试试。"
          />
        </main>
      </div>
    </template>
  </div>
  <div v-else-if="error" class="lib-state">{{ error }}</div>
  <div v-else class="lib-state">数据加载中…</div>
</template>

<style scoped>
.library-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.lib-state,
.lib-error {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}
.lib-error {
  color: #b3413b;
}
/* 书架布局：左栏分类 + 主区 */
.lib-shelf {
  flex: 1;
  display: flex;
  min-height: 0;
}
.lib-side {
  width: 12.5rem;
  flex-shrink: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border-right: 1px solid var(--line);
  background: #fbfcfd;
  padding: 1rem 0;
}
.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.42rem 1.1rem;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.92rem;
  color: var(--text);
  cursor: pointer;
}
.cat-item:hover {
  background: var(--accent-soft);
}
.cat-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.cat-count {
  font-size: 0.72rem;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
.lib-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 1.2rem 1.4rem 3rem;
}
.lib-head {
  margin-bottom: 1.2rem;
}
.lib-title {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text);
}
.lib-sub {
  margin: 0.3rem 0 1rem;
  color: var(--muted);
  font-size: 0.9rem;
}
.lib-search {
  width: min(24rem, 100%);
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 0.92rem;
  background: #fff;
}
.lib-search:focus {
  outline: none;
  border-color: var(--accent);
}
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
  gap: 0.9rem;
}
/* 移动端：分类栏收为顶部横滑 chips */
@media (max-width: 900px) {
  .lib-shelf {
    flex-direction: column;
  }
  .lib-side {
    width: 100%;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--line);
    padding: 0.4rem 0.7rem;
    gap: 0.4rem;
  }
  .cat-item {
    width: auto;
    flex-shrink: 0;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: #fff;
    gap: 0.4rem;
  }
  .cat-item.active {
    border-color: var(--accent);
  }
  .lib-main {
    padding: 1rem 0.9rem 2.5rem;
  }
  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.7rem;
  }
}
</style>
