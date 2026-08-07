<script setup>
/**
 * ApologeticsPage — 护教页面（回应当今世界对基督教信仰的挑战）
 * 数据驱动：public/data/apologetics/content.json（分类 + 问题 + 回应，带缓存）
 * 交互：分类 chips 切换（横向可滚）→ 当前分类下问题手风琴（可单问展开/收起、全部展开）
 * 布局：Home 式单列，页面在 .app-main 内滚动
 */
import { ref, computed, watch, onMounted } from 'vue'
import { fetchApologetics } from '../../lib/data.js'
import EmptyState from '../../components/EmptyState.vue'

const content = ref(null)
const loading = ref(false)
const error = ref('')
const activeCat = ref('')

onMounted(async () => {
  loading.value = true
  try {
    content.value = await fetchApologetics()
    const cats = content.value?.categories || []
    activeCat.value = cats[0]?.id || ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const categories = computed(() => content.value?.categories || [])

/** 当前分类（找不到时回退第一个） */
const currentCat = computed(() => {
  const cats = categories.value
  return cats.find((c) => c.id === activeCat.value) || cats[0] || null
})

/** 当前分类的问题数统计（chips 上显示） */
const catCount = (id) => {
  const c = categories.value.find((x) => x.id === id)
  return c?.questions?.length || 0
}

/** 手风琴展开状态：Set<问题索引>，默认全部收起 */
const expanded = ref(new Set())

function toggleQuestion(i) {
  const s = new Set(expanded.value)
  s.has(i) ? s.delete(i) : s.add(i)
  expanded.value = s
}

const allExpanded = computed(
  () => !!currentCat.value && currentCat.value.questions.every((_, i) => expanded.value.has(i)),
)

function toggleAll() {
  const cat = currentCat.value
  if (!cat) return
  expanded.value = allExpanded.value
    ? new Set()
    : new Set(cat.questions.map((_, i) => i))
}

// 切换分类时重置展开状态
watch(activeCat, () => {
  expanded.value = new Set()
})
</script>

<template>
  <div class="apologetics">
    <header class="page-head">
      <h1 class="page-title">护教</h1>
      <p class="page-sub">回应当今世界对基督教信仰的挑战——以敬畏的心，回答各人</p>
    </header>

    <div v-if="loading" class="page-state">内容加载中…</div>
    <EmptyState v-else-if="error" title="内容加载失败" :message="error" />
    <template v-else-if="categories.length">
      <!-- 分类导航：横向可滚 chips -->
      <nav class="cat-tabs" aria-label="护教分类">
        <button
          v-for="c in categories"
          :key="c.id"
          class="cat-tab"
          :class="{ active: c.id === currentCat?.id }"
          @click="activeCat = c.id"
        >
          {{ c.title }}
          <span class="cat-count">{{ catCount(c.id) }}</span>
        </button>
      </nav>

      <!-- 当前分类问题手风琴 -->
      <section v-if="currentCat" class="q-list">
        <div class="q-head">
          <h2 class="q-cat-title">{{ currentCat.title }}</h2>
          <button
            v-if="currentCat.questions.length"
            class="toggle-all"
            @click="toggleAll"
          >
            {{ allExpanded ? '全部收起' : '全部展开' }}
          </button>
        </div>

        <div v-for="(q, i) in currentCat.questions" :key="q.id" class="q-item">
          <button
            class="q-question"
            :aria-expanded="expanded.has(i)"
            @click="toggleQuestion(i)"
          >
            <span class="chevron" :class="{ open: expanded.has(i) }" aria-hidden="true">▸</span>
            <span class="q-text">{{ q.question }}</span>
          </button>
          <Transition name="fold">
            <div v-if="expanded.has(i)" class="fold-wrap">
              <p class="q-answer">{{ q.answer }}</p>
            </div>
          </Transition>
        </div>
      </section>
    </template>
    <EmptyState v-else title="内容整理中" message="护教内容正在整理，敬请期待。" />
  </div>
</template>

<style scoped>
.apologetics {
  flex: 1;
  background: #fff;
  padding: 3rem 2rem 4rem;
}

/* 页头：衬线大标题 + 副题 */
.page-head {
  max-width: 52rem;
  margin: 0 auto 2rem;
}
.page-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.6rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #101010;
}
.page-sub {
  margin: 0.6rem 0 0;
  font-size: 0.95rem;
  color: #777;
}
.page-state {
  text-align: center;
  padding: 3rem 0;
  color: var(--muted);
}

/* 分类 chips：横向可滚 */
.cat-tabs {
  display: flex;
  gap: 0.55rem;
  max-width: 52rem;
  margin: 0 auto 2.2rem;
  padding-bottom: 0.4rem;
  overflow-x: auto;
  scrollbar-gutter: stable;
}
.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 1rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: #555;
  font-size: 0.88rem;
  white-space: nowrap;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.cat-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.cat-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.cat-count {
  font-size: 0.72rem;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

/* 问题列表 */
.q-list {
  max-width: 52rem;
  margin: 0 auto;
}
.q-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.9rem;
}
.q-cat-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #101010;
}
.toggle-all {
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--muted);
  font-size: 0.78rem;
  padding: 0.15rem 0.6rem;
}
.toggle-all:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 问题行：可点击展开按钮 */
.q-item {
  border-bottom: 1px solid var(--line);
}
.q-question {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 1rem 0.4rem;
  font-size: 1rem;
  font-weight: 600;
  color: #26303b;
  cursor: pointer;
  line-height: 1.6;
}
.q-question:hover {
  color: var(--accent);
}
.chevron {
  font-size: 0.75rem;
  color: var(--muted);
  transition: transform 0.18s ease;
  margin-top: 0.28rem;
  flex-shrink: 0;
}
.chevron.open {
  transform: rotate(90deg);
}
.q-text {
  flex: 1;
  min-width: 0;
}

/* 回应内容：grid-rows 高度过渡（同注释面板折叠动画） */
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
.q-answer {
  margin: 0;
  padding: 0 0.4rem 1.3rem 1.35rem;
  font-size: 0.95rem;
  line-height: 2;
  color: #3c4652;
  white-space: pre-line;
}

/* 窄屏适配 */
@media (max-width: 600px) {
  .apologetics {
    padding: 2rem 1.2rem 3rem;
  }
  .page-title {
    font-size: 2.1rem;
  }
  .q-answer {
    font-size: 0.92rem;
  }
}
</style>
