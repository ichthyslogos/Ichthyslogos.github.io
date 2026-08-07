<script setup>
/**
 * ApologeticsPage — 护教页面（回应当今世界对基督教信仰的挑战）
 * 数据驱动：public/data/apologetics/content.json
 *   结构：categories[].topics[].{ question, answers: [{ source, text }] }——同一话题支持多个回答（不同视角）
 * 布局（为大量内容设计）：
 *   - 桌面（>900px）：两栏——左栏话题列表（当前分类，可滚），右栏内容区（选中话题的问题 + 全部回答，直接阅读）
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
  padding: 2.5rem 2rem 4rem;
}

/* 页头：衬线大标题 + 副题 */
.page-head {
  max-width: 68rem;
  margin: 0 auto 1.6rem;
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
  max-width: 68rem;
  margin: 0 auto 1.4rem;
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

/* 两栏布局 */
.layout {
  max-width: 68rem;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 2rem;
}

/* 左栏：话题列表 */
.topic-list {
  width: 19rem;
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fbfcfd;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0.6rem;
}
.topic-list-title {
  padding: 0.4rem 0.7rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
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
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  font-size: 0.92rem;
  color: #37404b;
  cursor: pointer;
  line-height: 1.55;
}
.topic-item:hover {
  background: var(--accent-soft);
}
.topic-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.topic-text {
  flex: 1;
  min-width: 0;
}
.topic-count {
  flex-shrink: 0;
  font-size: 0.72rem;
  opacity: 0.7;
  margin-top: 0.18rem;
  white-space: nowrap;
}

/* 右栏：话题详情 */
.topic-detail {
  flex: 1;
  min-width: 0;
}
.topic-question {
  margin: 0 0 1.4rem;
  font-size: 1.45rem;
  line-height: 1.55;
  font-weight: 700;
  color: #101010;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

/* 回答卡片：来源徽章 + 正文 */
.answers {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}
.answer-card {
  background: #fbfcfd;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1.2rem 1.4rem 1.4rem;
}
.answer-source {
  display: inline-block;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 0.12rem 0.7rem;
  margin-bottom: 0.8rem;
}
.answer-text {
  margin: 0;
  font-size: 0.96rem;
  line-height: 2.05;
  color: #37404b;
  white-space: pre-line;
}

/* 移动端返回按钮（仅详情视图显示） */
.back-topics {
  display: none;
}

/* 窄屏（≤900px）：两段式——列表/详情互斥切换 */
@media (max-width: 900px) {
  .apologetics {
    padding: 1.8rem 1.2rem 3rem;
  }
  .layout {
    display: block;
  }
  .topic-list {
    width: 100%;
    max-height: none;
    border: none;
    background: #fff;
    padding: 0;
  }
  .topic-list-title {
    padding: 0.2rem 0.2rem 0.6rem;
    font-size: 0.85rem;
  }
  .topic-item {
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    padding: 0.85rem 0.2rem;
  }
  .topic-item.active {
    background: transparent;
    color: var(--accent);
  }
  .back-topics {
    display: inline-block;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--accent);
    font-size: 0.88rem;
    padding: 0.35rem 1rem;
    margin-bottom: 1rem;
  }
  .topic-detail {
    padding-top: 0.2rem;
  }
  .topic-question {
    font-size: 1.2rem;
  }
  .answer-card {
    padding: 1rem 1.1rem 1.2rem;
  }
  .answer-text {
    font-size: 0.93rem;
  }
  /* 两段互斥：detail 视图隐藏列表，list 视图隐藏详情 */
  .mobile-hidden {
    display: none !important;
  }
}
</style>
