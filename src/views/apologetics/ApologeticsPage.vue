<script setup>
/**
 * ApologeticsPage — 护教页面（回应当今世界对基督教信仰的挑战）
 * 数据驱动：public/data/apologetics/content.json
 *   结构：categories[].topics[].{ question, answers: [{ source, text }] }——同一话题支持多个回答（不同视角）
 * 布局（为大量内容设计，风格对齐首页现代黑白极简）：
 *   - 桌面（>900px）：全宽两栏——左栏话题列表（当前分类，可滚），右栏内容区（选中话题的问题 + 全部回答，直接阅读）
 *   - 移动端：两段式——先话题列表，点击话题进入详情（带"返回话题"按钮）
 */
import { ref, computed, watch, onMounted } from 'vue'
import { fetchApologetics } from '../../lib/data.js'
import EmptyState from '../../components/EmptyState.vue'

const content = ref(null)
const loading = ref(false)
const error = ref('')
const activeCat = ref('')
const activeTopic = ref('')
/** 移动端视图：list=话题列表 / detail=话题详情（仅窄屏生效） */
const mobileView = ref('list')

onMounted(async () => {
  loading.value = true
  try {
    content.value = await fetchApologetics()
    const cats = content.value?.categories || []
    activeCat.value = cats[0]?.id || ''
    activeTopic.value = cats[0]?.topics?.[0]?.id || ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

const categories = computed(() => content.value?.categories || [])

/** 数据统计：类 / 问 / 答 数量（页头右侧） */
const stats = computed(() => {
  const cats = categories.value
  const topics = cats.reduce((s, c) => s + (c.topics?.length || 0), 0)
  const answers = cats.reduce(
    (s, c) => s + (c.topics?.reduce((x, t) => x + (t.answers?.length || 0), 0) || 0),
    0,
  )
  return { cats: cats.length, topics, answers }
})

/** 当前分类（找不到时回退第一个） */
const currentCat = computed(() => {
  const cats = categories.value
  return cats.find((c) => c.id === activeCat.value) || cats[0] || null
})

/** 当前话题（找不到时回退该分类第一个话题） */
const currentTopic = computed(() => {
  const cat = currentCat.value
  if (!cat) return null
  return cat.topics.find((t) => t.id === activeTopic.value) || cat.topics[0] || null
})

const catCount = (id) => {
  const c = categories.value.find((x) => x.id === id)
  return c?.topics?.length || 0
}

/** 切换分类：重置到该分类第一个话题，移动端回到列表 */
function selectCat(id) {
  activeCat.value = id
  const cat = categories.value.find((c) => c.id === id)
  activeTopic.value = cat?.topics?.[0]?.id || ''
  mobileView.value = 'list'
}

/** 选中话题：移动端进入详情 */
function selectTopic(id) {
  activeTopic.value = id
  mobileView.value = 'detail'
}

// 数据到达时确保 topic 有效（防御：内容更新后 id 变化）
watch(currentCat, (cat) => {
  if (cat && !cat.topics.some((t) => t.id === activeTopic.value)) {
    activeTopic.value = cat.topics?.[0]?.id || ''
  }
})
</script>

<template>
  <div class="apologetics">
    <!-- 页头：左衬线大标题 + 副题 / 右数据统计（非对称，同首页 hero） -->
    <header class="page-head">
      <div class="head-left">
        <h1 class="page-title">护教</h1>
        <p class="page-sub">回应当今世界对基督教信仰的挑战——以敬畏的心，回答各人</p>
      </div>
      <p v-if="stats.topics" class="head-stats">{{ stats.cats }} 类 · {{ stats.topics }} 问 · {{ stats.answers }} 答</p>
    </header>

    <div v-if="loading" class="page-state">内容加载中…</div>
    <EmptyState v-else-if="error" title="内容加载失败" :message="error" />
    <template v-else-if="categories.length">
      <!-- 分类导航：文字式 tabs（激活项黑色下划线） -->
      <nav class="cat-tabs" aria-label="护教分类">
        <button
          v-for="c in categories"
          :key="c.id"
          class="cat-tab"
          :class="{ active: c.id === currentCat?.id }"
          @click="selectCat(c.id)"
        >
          {{ c.title }}
          <span class="cat-count">{{ catCount(c.id) }}</span>
        </button>
      </nav>

      <!-- 两栏：左话题列表 + 右内容区（移动端两段式切换） -->
      <div v-if="currentCat" class="layout">
        <!-- 移动端：详情视图顶部返回按钮 -->
        <button
          v-if="mobileView === 'detail'"
          class="back-topics"
          @click="mobileView = 'list'"
        >← 全部话题</button>

        <!-- 左栏：当前分类的话题列表（移动端 list 视图显示） -->
        <aside
          class="topic-list"
          :class="{ 'mobile-hidden': mobileView === 'detail' }"
        >
          <div class="topic-list-title">{{ currentCat.title }}</div>
          <button
            v-for="t in currentCat.topics"
            :key="t.id"
            class="topic-item"
            :class="{ active: t.id === currentTopic?.id }"
            @click="selectTopic(t.id)"
          >
            <span class="topic-text">{{ t.question }}</span>
            <span class="topic-count">{{ t.answers.length }} 答</span>
          </button>
        </aside>

        <!-- 右栏：选中话题的问题与全部回答（移动端 detail 视图显示） -->
        <section
          v-if="currentTopic"
          class="topic-detail"
          :class="{ 'mobile-hidden': mobileView === 'list' }"
        >
          <h2 class="topic-question">{{ currentTopic.question }}</h2>
          <div v-if="currentTopic.answers.length" class="answers">
            <article
              v-for="(a, i) in currentTopic.answers"
              :key="i"
              class="answer-card"
            >
              <span v-if="a.source" class="answer-source">{{ a.source }}</span>
              <p class="answer-text">{{ a.text }}</p>
            </article>
          </div>
          <EmptyState v-else title="回答整理中" message="该话题的回答正在整理，敬请期待。" />
        </section>
      </div>
    </template>
    <EmptyState v-else title="内容整理中" message="护教内容正在整理，敬请期待。" />
  </div>
</template>

<style scoped>
.apologetics {
  flex: 1;
  background: #fff;
}

/* ===== 页头：非对称两列（左标题/右统计），全宽 padding，同首页 hero 语言 ===== */
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 3.2rem 6rem 2rem;
}
.page-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 3.2rem;
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: #101010;
}
.page-sub {
  margin: 0.8rem 0 0;
  font-size: 0.92rem;
  color: #8a8a8a;
  letter-spacing: 0.02em;
}
.head-stats {
  margin: 0 0 0.3rem;
  font-size: 0.82rem;
  color: #9a9a9a;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.page-state {
  text-align: center;
  padding: 4rem 0;
  color: #9a9a9a;
}

/* ===== 分类导航：文字式 tabs，激活项黑色下划线 ===== */
.cat-tabs {
  display: flex;
  gap: 0.2rem;
  padding: 0.6rem 6rem 0;
  border-bottom: 1px solid #ececec;
  overflow-x: auto;
  scrollbar-gutter: stable;
}
.cat-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1.1rem;
  border: none;
  background: transparent;
  color: #8a8a8a;
  font-size: 0.95rem;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease;
}
.cat-tab:hover {
  color: #101010;
}
.cat-tab.active {
  color: #101010;
  font-weight: 600;
}
.cat-tab::after {
  content: '';
  position: absolute;
  left: 1.1rem;
  right: 1.1rem;
  bottom: -1px;
  height: 2px;
  background: transparent;
  transition: background 0.15s ease;
}
.cat-tab.active::after {
  background: #101010;
}
.cat-count {
  font-size: 0.7rem;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

/* ===== 两栏布局：全宽（左右 padding），无盒子边框 ===== */
.layout {
  display: flex;
  align-items: flex-start;
  gap: 3.5rem;
  padding: 2.2rem 6rem 4rem;
}

/* 左栏：话题列表（极简：白底 + 悬停浅灰，激活黑底白字） */
.topic-list {
  width: 19rem;
  flex-shrink: 0;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-bottom: 0.8rem;
}
.topic-list-title {
  padding: 0.25rem 0.8rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #b0b0b0;
  letter-spacing: 0.16em;
}
.topic-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.72rem 0.8rem;
  border-radius: 6px;
  font-size: 0.92rem;
  color: #3a3f47;
  cursor: pointer;
  line-height: 1.55;
  transition: background 0.15s ease, color 0.15s ease;
}
.topic-item:hover {
  background: #f5f5f5;
}
.topic-item.active {
  background: #101010;
  color: #fff;
  font-weight: 600;
}
.topic-text {
  flex: 1;
  min-width: 0;
}
.topic-count {
  flex-shrink: 0;
  font-size: 0.7rem;
  opacity: 0.6;
  margin-top: 0.18rem;
  white-space: nowrap;
}

/* 右栏：话题详情 */
.topic-detail {
  flex: 1;
  min-width: 0;
}
.topic-question {
  margin: 0.1rem 0 1.6rem;
  font-size: 1.55rem;
  line-height: 1.5;
  font-weight: 700;
  color: #101010;
  padding: 0 0 1.1rem 1.1rem;
  border-left: 3px solid #101010;
}

/* 回答列表：无盒子卡片，来源徽章 + 正文，回答间细分隔线 */
.answers {
  display: flex;
  flex-direction: column;
}
.answer-card {
  padding: 1.7rem 0;
  border-bottom: 1px solid #f0f0f0;
}
.answer-card:last-child {
  border-bottom: none;
}
.answer-source {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #101010;
  border: 1px solid #e2e2e2;
  border-radius: 5px;
  padding: 0.16rem 0.6rem;
  margin-bottom: 0.95rem;
  letter-spacing: 0.05em;
}
.answer-text {
  margin: 0;
  font-size: 0.97rem;
  line-height: 2.05;
  color: #3a3f47;
  white-space: pre-line;
}

/* 移动端返回按钮（仅详情视图显示） */
.back-topics {
  display: none;
}

/* 中间宽度（平板）：压缩左右 padding，保证右栏可读 */
@media (max-width: 1024px) {
  .page-head {
    padding: 2.6rem 2.5rem 1.6rem;
  }
  .cat-tabs {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
  }
  .layout {
    gap: 2.5rem;
    padding: 2rem 2.5rem 3.5rem;
  }
}

/* 窄屏（≤900px）：两段式——列表/详情互斥切换 */
@media (max-width: 900px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
    padding: 2.4rem 1.5rem 1.4rem;
  }
  .page-title {
    font-size: 2.4rem;
  }
  .head-stats {
    margin: 0.2rem 0 0;
  }
  .cat-tabs {
    padding: 0.5rem 1.5rem 0;
  }
  .cat-tab {
    padding: 0.65rem 0.85rem;
    font-size: 0.92rem;
  }
  .layout {
    display: block;
    padding: 1.6rem 1.5rem 3rem;
  }
  .topic-list {
    width: 100%;
    max-height: none;
    padding-bottom: 0.5rem;
  }
  .topic-list-title {
    padding: 0.15rem 0.15rem 0.7rem;
    font-size: 0.78rem;
  }
  .topic-item {
    border-bottom: 1px solid #f2f2f2;
    border-radius: 0;
    padding: 0.95rem 0.15rem;
  }
  .topic-item.active {
    background: transparent;
    color: #101010;
  }
  .topic-item.active .topic-count {
    opacity: 0.9;
  }
  .back-topics {
    display: inline-block;
    border: 1px solid #ddd;
    border-radius: 999px;
    background: #fff;
    color: #101010;
    font-size: 0.88rem;
    padding: 0.35rem 1.05rem;
    margin-bottom: 1.1rem;
  }
  .topic-detail {
    padding-top: 0.3rem;
  }
  .topic-question {
    font-size: 1.2rem;
    padding: 0 0 0.9rem 0.9rem;
  }
  .answer-card {
    padding: 1.4rem 0;
  }
  .answer-text {
    font-size: 0.94rem;
  }
  /* 两段互斥：detail 视图隐藏列表，list 视图隐藏详情 */
  .mobile-hidden {
    display: none !important;
  }
}
</style>
