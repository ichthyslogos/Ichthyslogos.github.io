<script setup>
/**
 * LibraryPage — 图书馆（书架浏览 ↔ 书目详情）
 * 路由：/library（书架）与 /library/:bookId（详情），URL 即状态（可分享）
 * 布局：左栏分类筛选 + 主区（书目卡片网格 / 详情视图）
 * 数据：索引 content.json（分类+书目轻量条目）→ 详情 books/<id>.json 按需加载（data.js 缓存）
 */
import { ref, computed, watch, nextTick, onMounted } from 'vue'
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

/** 藏书总数（空书架判定：无任何藏书时显示「筹备中」空态） */
const totalBooks = computed(() => index.value?.books?.length || 0)

/** 分类栏容器（移动端横滑 chips：点击分类后自动将选中项滚动居中） */
const libSide = ref(null)
watch(
  activeCat,
  () => {
    const side = libSide.value
    if (!side || window.innerWidth > 900) return // 桌面为竖向列表，无需居中
    nextTick(() => {
      const el = side.querySelector('.cat-item.active')
      if (!el) return
      const target = el.offsetLeft - side.offsetLeft - (side.clientWidth - el.offsetWidth) / 2
      side.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    })
  },
  { immediate: true },
)
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
        <aside ref="libSide" class="lib-side">
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
            <p class="lib-eyebrow">LIBRARY · 图书馆</p>
            <h1 class="lib-title">图书馆</h1>
            <p class="lib-sub">经典文献资料库 · {{ index.books.length }} 部藏书</p>
            <div class="lib-search-wrap">
              <svg class="lib-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <input
                v-model="search"
                class="lib-search"
                type="search"
                placeholder="搜索书名 / 作者 / 标签…"
                aria-label="搜索书目"
              />
            </div>
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
          <!-- 空态：无藏书（筹备中）与无匹配（换关键词）分开呈现 -->
          <div v-else-if="totalBooks === 0" class="lib-empty">
            <div class="lib-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h3 class="lib-empty-title">书架筹备中</h3>
            <p class="lib-empty-desc">经典文献正在陆续入库，敬请期待。</p>
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
  background: var(--bg);
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
  width: 13rem;
  flex-shrink: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border-right: 1px solid var(--line-soft);
  background: var(--panel);
  padding: 1rem 0.7rem;
}
.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.9rem;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 0.92rem;
  color: var(--text);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.cat-item:hover {
  background: var(--accent-soft);
}
.cat-item.active {
  background: var(--ink);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
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
  padding: 2.4rem 2.5rem 3rem;
}
.lib-head {
  margin-bottom: 1.6rem;
  max-width: 66rem;
}
/* 眉题 + 衬线标题（与首页/护教 hero 语言一致） */
.lib-eyebrow {
  margin: 0 0 0.7rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.24em;
}
.lib-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.3rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--text);
}
.lib-sub {
  margin: 0.5rem 0 1.3rem;
  color: var(--muted);
  font-size: 0.92rem;
}
/* 搜索：胶囊 + 放大镜图标 */
.lib-search-wrap {
  position: relative;
  width: min(24rem, 100%);
}
.lib-search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.lib-search {
  width: 100%;
  padding: 0.55rem 1rem 0.55rem 2.4rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  font-size: 0.92rem;
  background: var(--panel);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.lib-search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(47, 93, 158, 0.12);
}
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
  gap: 1.1rem;
  max-width: 66rem;
}
/* 空书架（筹备中） */
.lib-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 4.5rem 1.5rem;
  text-align: center;
}
.lib-empty-icon {
  width: 3.6rem;
  height: 3.6rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--gold-soft);
  color: var(--gold);
  margin-bottom: 0.4rem;
}
.lib-empty-icon svg {
  width: 1.7rem;
  height: 1.7rem;
}
.lib-empty-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text);
}
.lib-empty-desc {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--muted);
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
    border-bottom: 1px solid var(--line-soft);
    padding: 0.45rem 0.8rem;
    gap: 0.4rem;
  }
  .cat-item {
    width: auto;
    flex-shrink: 0;
    padding: 0.35rem 0.8rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line);
    background: var(--panel);
    gap: 0.4rem;
  }
  .cat-item.active {
    border-color: var(--ink);
  }
  .lib-main {
    padding: 1.6rem 1.1rem 2.5rem;
  }
  .lib-title {
    font-size: 1.9rem;
  }
  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.8rem;
  }
}
</style>
