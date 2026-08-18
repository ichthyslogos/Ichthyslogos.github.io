<script setup>
/**
 * ApologeticsPage — 护教页面（帮助人理解基督信仰为何具有合理性）
 * 数据驱动：public/data/apologetics/content.json
 *   结构：topics[].sub_questions[].{ question, objection, responses: [{ title, summary, text, evidence }] }
 * 布局（设计语言：现代出版风浅色 + 金棕学术点缀）：
 *   - 探索视图：Hero（眉题/大标题/副题/CTA/统计）→ 搜索 → 主题卡片网格 → 相关问题直达
 *   - 主题视图：面包屑 + 主题头（中英标题/描述/标签）→ 两栏（左子问题列表 / 右：质疑 → 回应 → 证据 → 相关学习）
 *   - 移动端：探索网格单列；主题视图两段式（list/detail）
 * 版权合规：主题描述标记「《游子吟》全文归档」的内容为受版权保护全文，
 *   恢复展示时正文（text）不渲染，改以摘要 + 版权提示呈现（详见 markCopyright）。
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchApologetics, fetchApologeticsTopic } from '../../lib/data.js'
import EmptyState from '../../components/EmptyState.vue'
import SearchBar from '../../components/apologetics/SearchBar.vue'
import TopicCard from '../../components/apologetics/TopicCard.vue'
import QuestionCard from '../../components/apologetics/QuestionCard.vue'
import ResponseCard from '../../components/apologetics/ResponseCard.vue'

/** 索引（探索/搜索用，不含正文） */
const index = ref(null)
/** 主题完整数据缓存：topicId → 主题切片（按需加载） */
const topicsData = ref(new Map())
/** 主题切片加载中（进入主题时短暂显示） */
const topicLoading = ref(false)
const loading = ref(false)
const error = ref('')
/** 视图：explore=主题探索 / topic=主题详情 */
const view = ref('explore')
const activeTopicId = ref('')
const activeSQId = ref('')
const query = ref('')
/** 移动端视图（主题详情内）：list=子问题列表 / detail=详情 */
const mobileView = ref('list')

onMounted(async () => {
  loading.value = true
  try {
    index.value = await fetchApologetics()
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/** 探索视图用的主题元数据列表（来自索引；描述清洗「全文归档」字样为中性表达） */
const topics = computed(() => (index.value?.topics || []).map((t) => ({ ...t, description: cleanDesc(t.description) })))

/** 描述清洗：「《游子吟》第X章全文归档：」→「《游子吟》第X章 · 」 */
function cleanDesc(d) {
  return (d || '').replace(/(《游子吟》第[一二三四五六七八九十]+章)全文归档：/, '$1 · ')
}

/** 全站统计：主题 / 问题（索引驱动） */
const stats = computed(() => {
  const questions = topics.value.reduce((s, t) => s + (t.sqCount || 0), 0)
  return { topics: topics.value.length, questions }
})

/** 当前主题完整数据（已加载的切片；未加载时 null → 主题视图显示加载态）
 *  描述同样清洗「全文归档」字样 */
const currentTopic = computed(() => {
  const t = topicsData.value.get(activeTopicId.value) || null
  return t ? { ...t, description: cleanDesc(t.description) } : null
})
const currentSQ = computed(() => currentTopic.value?.sub_questions.find((q) => q.id === activeSQId.value) || null)

/** 分类展开状态（默认全展开；Set 存展开的分类 id） */
const expandedCats = ref(new Set())

/** 确保主题切片已加载（缓存命中直接返回；否则按需 fetch）；返回主题数据
 *  带竞态守卫：快速切换主题时丢弃过期响应，防止旧主题覆盖新主题的子问题选择 */
let topicSeq = 0
async function ensureTopic(id) {
  if (topicsData.value.has(id)) return topicsData.value.get(id)
  const seq = ++topicSeq
  topicLoading.value = true
  try {
    const t = await fetchApologeticsTopic(id)
    if (seq !== topicSeq) return null // 过期响应丢弃
    markCopyright(t)
    topicsData.value.set(id, t)
    // 数据到达后确保子问题有效
    if (!t.sub_questions.some((q) => q.id === activeSQId.value)) {
      activeSQId.value = t.sub_questions?.[0]?.id || ''
    }
    error.value = '' // 加载成功清除旧错误（否则一次失败后主题视图被错误占位顶掉）
    return t
  } catch (e) {
    if (seq === topicSeq) error.value = e.message
    return null
  } finally {
    if (seq === topicSeq) topicLoading.value = false
  }
}

/**
 * 版权合规标记：主题描述含「《游子吟》…全文归档」→ 该主题全部子命题正文
 * 为受版权保护全文（里程《游子吟》现代作品，不可公开展示全文）。
 * 运行时为每个子命题派生 copyrighted 标志（不改动数据源），
 * ResponseCard 据此隐藏全文、改显摘要与版权提示。
 */
function markCopyright(t) {
  const flagged = /全文归档/.test(t.description || '')
  for (const q of t.sub_questions || []) {
    q.copyrighted = flagged || /游子吟/.test(q.text || '')
  }
}

/** 切换分类展开/折叠 */
function toggleCat(catId) {
  const s = new Set(expandedCats.value)
  if (s.has(catId)) s.delete(catId)
  else s.add(catId)
  expandedCats.value = s
}

/** 搜索：主题级过滤（标题/描述/子问题轻量文本命中，索引驱动） */
const filteredTopics = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return topics.value
  return topics.value.filter((t) => {
    const hay = [t.title.zh, t.title.en, t.description, t.tags?.join(' '), t.searchText].filter(Boolean).join(' ')
    return hay.toLowerCase().includes(q)
  })
})

/** 搜索：子问题级命中（可直达，索引驱动） */
const searchMatches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const t of topics.value) {
    for (const sq of t.questions || []) {
      if ((sq.searchText || '').toLowerCase().includes(q)) out.push({ topic: t, sq })
    }
  }
  return out
})

/** 滚动主内容区（.app-main）到顶部——页面内滚动容器，window.scrollTo 无效 */
function scrollMainTop() {
  document.querySelector('.app-main')?.scrollTo(0, 0)
}

/** 子问题兜底：当前选中无效（含缓存命中路径）时回第一个，保证右侧详情栏有内容 */
function ensureSQ(t) {
  if (t && !(t.sub_questions || []).some((q) => q.id === activeSQId.value)) {
    activeSQId.value = t.sub_questions?.[0]?.id || ''
  }
}

/** 进入主题：加载切片（首次按需 fetch），默认第一个子命题，分类全部展开 */
async function openTopic(id) {
  activeTopicId.value = id
  activeSQId.value = ''
  mobileView.value = 'list'
  view.value = 'topic'
  error.value = '' // 进入主题即清除旧错误
  scrollMainTop()
  const t = await ensureTopic(id)
  ensureSQ(t) // 缓存命中路径 ensureTopic 提前返回，不会内部回填
  expandedCats.value = new Set((t?.categories || []).map((c) => c.id))
}

/** 从搜索结果直达子问题 */
async function openQuestion(topicId, sqId) {
  activeTopicId.value = topicId
  activeSQId.value = sqId
  mobileView.value = 'detail'
  view.value = 'topic'
  error.value = ''
  scrollMainTop()
  const t = await ensureTopic(topicId)
  ensureSQ(t)
  expandedCats.value = new Set((t?.categories || []).map((c) => c.id))
}

/** 选中子问题：移动端进入详情 */
function selectQuestion(id) {
  activeSQId.value = id
  mobileView.value = 'detail'
  if (window.innerWidth <= 900) scrollMainTop()
}

/** 返回探索视图 */
function backToExplore() {
  view.value = 'explore'
  error.value = '' // 清除主题加载错误，否则错误占位顶掉整个探索视图
  scrollMainTop()
}

/** 滚动到探索区（不用 #锚点：与 hash 路由冲突会触发路由跳转导致空白页） */
function scrollToTopics() {
  document.getElementById('topics')?.scrollIntoView({ behavior: 'smooth' })
}

/** 相关学习：同主题其他子问题 */
const otherQuestions = computed(() => {
  const t = currentTopic.value
  if (!t) return []
  return (t.sub_questions || []).filter((q) => q.id !== activeSQId.value)
})
</script>

<template>
  <div class="apologetics">
    <div v-if="loading" class="page-state">内容加载中…</div>
    <EmptyState v-else-if="error" title="内容加载失败" :message="error" />

    <!-- ===== 探索视图：Hero + 搜索 + 主题网格 ===== -->
    <div v-else-if="view === 'explore'" class="explore">
      <section class="hero">
        <div class="hero-inner">
          <p class="hero-eyebrow">APOLOGETICS · 护教</p>
          <h1 class="hero-title">信仰的思考与回应</h1>
          <p class="hero-sub">Questions. Reason. Faith.</p>
          <p class="hero-desc">探索基督教面对的核心问题，从哲学、历史、科学与圣经寻找答案。</p>
          <div class="hero-actions">
            <a href="#topics" class="btn-explore" @click.prevent="scrollToTopics">开始探索 <span class="arr">→</span></a>
            <span v-if="stats.topics" class="hero-stats">{{ stats.topics }} 主题 · {{ stats.questions }} 问题</span>
          </div>
        </div>
      </section>

      <section class="explorer" id="topics">
        <header class="explorer-head">
          <h2 class="section-title">问题探索</h2>
          <p class="section-sub">选择一个主题，查看不同的质疑与回应</p>
        </header>

        <SearchBar v-model="query" />

        <!-- 搜索：子问题级命中直达 -->
        <div v-if="query.trim() && searchMatches.length" class="search-matches">
          <h3 class="sm-title">相关问题（{{ searchMatches.length }}）</h3>
          <button
            v-for="m in searchMatches.slice(0, 8)"
            :key="m.sq.id"
            class="sm-item"
            @click="openQuestion(m.topic.id, m.sq.id)"
          >
            <span class="sm-topic">{{ m.topic.title.zh }}</span>
            <span class="sm-q">{{ m.sq.question }}</span>
            <span class="sm-arrow">→</span>
          </button>
        </div>

        <!-- 主题卡片网格 -->
        <div v-if="filteredTopics.length" class="topic-grid">
          <TopicCard
            v-for="t in filteredTopics"
            :key="t.id"
            :topic="t"
            @select="openTopic"
          />
        </div>
        <EmptyState
          v-else-if="query.trim()"
          title="没有匹配的主题"
          message="换个关键词试试，例如「苦难」「复活」「圣经可靠吗」"
        />
      </section>
    </div>

    <!-- ===== 主题视图：面包屑 + 主题头 + 两栏（数据按需加载） ===== -->
    <div v-else-if="view === 'topic'" class="topic-view">
      <div v-if="!currentTopic" class="page-state">
        <template v-if="topicLoading">主题加载中…</template>
        <template v-else-if="error">
          <p class="state-msg">主题加载失败：{{ error }}</p>
          <button class="back-all" @click="backToExplore">← 返回全部主题</button>
        </template>
        <template v-else>内容加载中…</template>
      </div>
      <template v-else>
      <header class="topic-head">
        <button class="back-all" @click="backToExplore">← 全部主题</button>
        <div class="topic-head-main">
          <h1 class="topic-zh">{{ currentTopic.title.zh }}</h1>
          <span class="topic-en">{{ currentTopic.title.en }}</span>
        </div>
        <p class="topic-desc">{{ currentTopic.description }}</p>
        <div class="topic-tags">
          <span v-for="tag in currentTopic.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </header>

      <div class="layout">
        <!-- 左栏：子命题列表，按分类分组（可展开/折叠；移动端 list 视图显示） -->
        <aside class="question-list" :class="{ 'mobile-hidden': mobileView === 'detail' }">
          <div class="ql-title">子命题</div>
          <div v-for="cat in currentTopic.categories" :key="cat.id" class="question-group">
            <button class="cat-group" :class="{ collapsed: !expandedCats.has(cat.id) }" @click="toggleCat(cat.id)">
              <span class="cg-arrow" aria-hidden="true">▾</span>
              <span class="cg-title">{{ cat.title }}</span>
              <span class="cg-count">{{ cat.sub_questions.length }}</span>
            </button>
            <div v-show="expandedCats.has(cat.id)" class="cg-items">
              <QuestionCard
                v-for="(q, i) in cat.sub_questions.map((id) => currentTopic.sub_questions.find((x) => x.id === id)).filter(Boolean)"
                :key="q.id"
                :q="q"
                :index="i"
                :active="q.id === currentSQ?.id"
                @select="selectQuestion"
              />
            </div>
          </div>
        </aside>

        <!-- 右栏：质疑 → 回应 → 证据 → 相关学习（移动端 detail 视图显示） -->
        <section v-if="currentSQ" class="sq-detail" :class="{ 'mobile-hidden': mobileView === 'list' }">
          <button v-if="mobileView === 'detail'" class="back-questions" @click="mobileView = 'list'">← 全部问题</button>

          <h2 class="sq-question">{{ currentSQ.question }}</h2>

          <!-- 质疑（Objection） -->
          <div v-if="currentSQ.objection" class="objection">
            <span class="obj-label">质疑</span>
            <p class="obj-text">{{ currentSQ.objection }}</p>
          </div>

          <!-- 内容（子命题为最基层，question.json 即完整内容：标题/视角/核心思想/正文/证据；
               copyrighted 子命题为受版权保护全文，正文隐藏改显摘要+提示） -->
          <ResponseCard :r="currentSQ" :copyrighted="currentSQ.copyrighted" />

          <!-- 相关学习（Related Study） -->
          <div v-if="otherQuestions.length" class="related">
            <h3 class="related-title">继续探索</h3>
            <button
              v-for="q in otherQuestions"
              :key="q.id"
              class="related-item"
              @click="selectQuestion(q.id)"
            >→ {{ q.question }}</button>
            <RouterLink to="/brp" class="btn-brp">进入读经研究 →</RouterLink>
          </div>
        </section>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 页面级色调：全局 token（现代出版风浅色）+ 金棕学术点缀（护教特色） */
.apologetics {
  flex: 1;
  background: var(--bg);
}

.page-state {
  text-align: center;
  padding: 4rem 0;
  color: var(--muted);
}

/* ===== Hero：浅暖底 + 金棕装饰线 ===== */
.hero {
  position: relative;
  background: linear-gradient(180deg, var(--gold-soft) 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--line-soft);
}
/* 左缘细十字线稿（低调装饰，非宗教渲染） */
.hero::before {
  content: '';
  position: absolute;
  left: 3rem;
  top: 2.6rem;
  width: 34px;
  height: 34px;
  border-left: 1px solid rgba(139, 115, 85, 0.45);
  border-top: 1px solid rgba(139, 115, 85, 0.45);
}
.hero::after {
  content: '';
  position: absolute;
  left: 3rem;
  top: 2.6rem;
  width: 0;
  height: 34px;
  border-left: 1px solid rgba(139, 115, 85, 0.45);
  transform: translateX(16px);
}
.hero-inner {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 4.6rem 2rem 4rem;
}
.hero-eyebrow {
  margin: 0 0 1.1rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.26em;
}
.hero-title {
  margin: 0;
  font-family: var(--serif);
  font-size: var(--fs-3xl);
  line-height: 1.18;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--text);
}
.hero-sub {
  margin: 1rem 0 0;
  font-size: var(--fs-sm);
  color: var(--gold);
  letter-spacing: 0.18em;
}
.hero-desc {
  margin: 1.1rem 0 0;
  max-width: 30rem;
  font-size: var(--fs-sm);
  line-height: 1.95;
  color: var(--muted);
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 1.4rem;
  margin-top: 2.1rem;
  flex-wrap: wrap;
}
.btn-explore {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--ink);
  color: #fff;
  text-decoration: none;
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: 0.62rem 1.6rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.btn-explore:hover {
  background: #000;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}
.btn-explore .arr {
  font-size: 1.05rem;
  line-height: 1;
}
.hero-stats {
  font-size: var(--fs-xs);
  color: #a2957e;
  letter-spacing: 0.05em;
}

/* ===== 探索区 ===== */
.explorer {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 2.8rem 2rem 4.5rem;
  scroll-margin-top: 1rem;
}
.explorer-head {
  margin-bottom: 1.3rem;
}
.section-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.7rem;
  font-weight: 600;
  color: var(--text);
}
.section-sub {
  margin: 0.4rem 0 0;
  font-size: var(--fs-sm);
  color: var(--muted);
}

/* 搜索结果：子问题直达 */
.search-matches {
  margin-top: 1.4rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.sm-title {
  margin: 0;
  padding: 0.6rem 1rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  background: var(--gold-soft);
  letter-spacing: 0.1em;
}
.sm-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  border: none;
  border-top: 1px solid var(--line-soft);
  background: var(--panel);
  padding: 0.7rem 1rem;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text);
  transition: background var(--dur) var(--ease);
}
.sm-item:hover {
  background: var(--gold-soft);
}
.sm-topic {
  flex-shrink: 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.55rem;
}
.sm-q {
  flex: 1;
  min-width: 0;
}
.sm-arrow {
  flex-shrink: 0;
  color: var(--gold);
}

/* 主题网格 */
.topic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
  margin-top: 1.6rem;
}

/* ===== 主题视图（全宽 padding：两栏阅读需要横向空间，正文行宽才舒适） ===== */
.topic-head {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 2.2rem 2rem 1.6rem;
}
.back-all {
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-sm);
  padding: 0.32rem 1.05rem;
  margin-bottom: 1.2rem;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.back-all:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.topic-head-main {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}
.topic-zh {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.4rem;
  font-weight: 600;
  color: var(--text);
}
.topic-en {
  font-size: 1rem;
  color: #a7adb6;
  letter-spacing: 0.04em;
}
.topic-desc {
  margin: 0.8rem 0 0;
  max-width: 36rem;
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--muted);
}
.topic-tags {
  display: flex;
  gap: 0.45rem;
  margin-top: 0.9rem;
  flex-wrap: wrap;
}
.tag {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.16rem 0.7rem;
}

/* 两栏布局 */
.layout {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 1.4rem 2rem 4.5rem;
  display: flex;
  align-items: flex-start;
  gap: 2.6rem;
  border-top: 1px solid var(--line-soft);
}

/* 左栏：子问题列表 */
.question-list {
  width: 21rem;
  flex-shrink: 0;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0.9rem 0.5rem 0.9rem 0;
}
.ql-title {
  padding: 0.2rem 0.8rem 0.75rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: #a7adb6;
  letter-spacing: 0.16em;
}

/* 分类分组：分类头（可展开/折叠） */
.question-group {
  margin-bottom: 0.3rem;
}
.cat-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.5rem 0.8rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.cat-group:hover {
  background: var(--gold-soft);
}
.cg-arrow {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--gold);
  transition: transform 0.18s ease;
}
.cat-group.collapsed .cg-arrow {
  transform: rotate(-90deg);
}
.cg-title {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.04em;
}
.cg-count {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: #a7adb6;
  font-variant-numeric: tabular-nums;
}
.cg-items {
  padding-left: 0.15rem;
}

/* 右栏：子问题详情 */
.sq-detail {
  flex: 1;
  min-width: 0;
}
.sq-question {
  margin: 0 0 1.4rem;
  font-size: 1.6rem;
  line-height: 1.5;
  font-weight: 700;
  color: var(--text);
  padding: 0 0 1.1rem 1.1rem;
  border-left: 3px solid var(--gold);
}

/* 质疑卡 */
.objection {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  background: var(--gold-soft);
  border: 1px solid var(--line);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius-sm);
  padding: 0.95rem 1.2rem;
  margin-bottom: 1.8rem;
}
.obj-label {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: var(--ink);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.6rem;
  margin-top: 0.1rem;
}
.obj-text {
  margin: 0;
  font-size: 0.93rem;
  line-height: 1.85;
  color: #6b7683;
  font-style: italic;
}

/* 回应列表 */
.responses-label {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: #a7adb6;
  letter-spacing: 0.14em;
  margin-bottom: 0.3rem;
}

/* 相关学习 */
.related {
  margin-top: 2.2rem;
  padding-top: 1.6rem;
  border-top: 1px solid var(--line-soft);
}
.related-title {
  margin: 0 0 0.8rem;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.12em;
}
.related-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.55rem 0;
  font-size: 0.92rem;
  color: var(--text);
  cursor: pointer;
  transition: color var(--dur) var(--ease);
}
.related-item:hover {
  color: var(--gold);
}
.btn-brp {
  display: inline-block;
  margin-top: 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  border: 1px solid var(--text);
  border-radius: var(--radius-pill);
  padding: 0.45rem 1.3rem;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.btn-brp:hover {
  background: var(--text);
  color: #fff;
  text-decoration: none;
}

/* 移动端返回按钮（仅详情视图显示） */
.back-questions {
  display: none;
}

/* ===== 中间宽度 ===== */
@media (max-width: 1100px) {
  .topic-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ===== 窄屏（≤900px）：网格单列 + 两段式 ===== */
@media (max-width: 900px) {
  .hero::before,
  .hero::after {
    left: 1.4rem;
    top: 2.2rem;
  }
  .hero-inner {
    padding: 3.4rem 1.5rem 3rem;
  }
  .hero-title {
    font-size: 2.3rem;
  }
  .hero-sub {
    font-size: 0.9rem;
  }
  .hero-desc {
    font-size: 0.9rem;
  }
  .explorer {
    padding: 2.2rem 1.5rem 3rem;
  }
  .section-title {
    font-size: 1.45rem;
  }
  .topic-grid {
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }
  .topic-head {
    padding: 1.7rem 1.5rem 1.2rem;
  }
  .topic-zh {
    font-size: 1.9rem;
  }
  .layout {
    display: block;
    padding: 1.2rem 1.5rem 3rem;
  }
  .question-list {
    width: 100%;
    max-height: none;
    padding: 0.8rem 0 0.5rem;
  }
  .ql-title {
    padding: 0.1rem 0.15rem 0.7rem;
    font-size: 0.78rem;
  }
  .question-item {
    border-bottom: 1px solid var(--line-soft);
    border-radius: 0;
    padding: 0.95rem 0.15rem;
  }
  .question-item.active {
    background: transparent;
    color: var(--text);
  }
  .question-item.active .q-num {
    color: var(--gold);
  }
  .question-item.active .q-count {
    color: var(--muted);
  }
  .back-questions {
    display: inline-block;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--panel);
    color: var(--text);
    font-size: var(--fs-sm);
    padding: 0.32rem 1rem;
    margin-bottom: 1.1rem;
  }
  .sq-question {
    font-size: 1.25rem;
    padding: 0 0 0.9rem 0.9rem;
  }
  .objection {
    padding: 0.85rem 1rem;
  }
  .response-card {
    padding: 1.4rem 0;
  }
  /* 两段互斥：detail 视图隐藏列表，list 视图隐藏详情 */
  .mobile-hidden {
    display: none !important;
  }
}
</style>
