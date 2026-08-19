<script setup>
/**
 * EventsPage — 圣经事件词条（/events 列表 · /events/:id 详情）
 * 数据：data/search/index.json 的 timeline（450 编年事件：zh/en 标题/年份/时长/
 *      首处经文/参与者强码 ppl；同名人物按强码精确归属）
 * 设计语言：与人物词条页一致（现代出版风浅色 + 金棕学术点缀）
 *   - 探索视图：Hero → 搜索（标题/参与者名）+ 时期筛选 → 时期分组事件列表（可折叠）
 *   - 详情视图：事件头（中英标题/年份）→ 速览 → 参与者（链到人物词条）→ 邻近事件
 * 时期归属：按年份锚点推导（早于首时期 → 太古；无年份 → 未定年）。
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import {
  loadEntryIndex,
  refLabel,
  refUrl,
  yearLabel,
  buildPersonResolver,
  eventPeriodId,
} from '../../lib/bibleEntries.js'

const route = useRoute()
const router = useRouter()

/* ---------- 数据加载 ---------- */
const index = ref(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    index.value = await loadEntryIndex()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

/* ---------- 派生数据 ---------- */
const timeline = computed(() => index.value?.timeline || [])
const periods = computed(() => index.value?.periods || [])
const books = computed(() => index.value?.books || [])
const persons = computed(() => index.value?.persons || [])
const resolver = computed(() => buildPersonResolver(persons.value))
const periodName = (id) => periods.value.find((p) => p.id === id)?.name || ''

/** 事件参与者解析（强码 → 人物记录；pplName 为无强码兜底名） */
const participantsOf = (e) => {
  const out = []
  for (const c of e.ppl || []) {
    const p = resolver.value(c)
    if (p) out.push({ kind: 'person', p })
  }
  for (const n of e.pplName || []) out.push({ kind: 'name', n })
  return out
}

/** 分组定义：太古 + 10 时期（按年份锚点升序）+ 未定年 */
const groups = computed(() => {
  const sorted = [...periods.value].sort((a, b) => a.year - b.year)
  const defs = [
    { id: 'primeval', name: '太古时期', era: '创造至列祖之前', year: null },
    ...sorted.map((p) => ({ id: p.id, name: p.name, era: p.era, year: p.year })),
    { id: 'undated', name: '未定年事件', era: '年份待考', year: null },
  ]
  return defs.map((d) => ({ ...d, events: [] }))
})

const periodOfEvent = (e) => eventPeriodId(e.y, periods.value)
const groupIdOfEvent = (e) => (e.y == null ? 'undated' : periodOfEvent(e))

/** 分组事件列表（组内年份升序，无年份居末） */
const grouped = computed(() => {
  const gs = groups.value.map((g) => ({ ...g, events: [] }))
  const byId = new Map(gs.map((g) => [g.id, g]))
  for (const e of timeline.value) {
    byId.get(groupIdOfEvent(e))?.events.push(e)
  }
  for (const g of gs) {
    g.events.sort((a, b) => {
      if (a.y == null && b.y == null) return 0
      if (a.y == null) return 1
      if (b.y == null) return -1
      return a.y - b.y
    })
  }
  return gs.filter((g) => g.events.length)
})

/* ---------- 筛选与搜索 ---------- */
const query = ref('')
const periodFilter = ref('')
/** 展开的组（默认全部展开；Set 存组 id） */
const expanded = ref(new Set())
watch(grouped, (gs) => {
  expanded.value = new Set(gs.map((g) => g.id))
}, { immediate: true })

/** 搜索命中：标题（中英）或参与者名 */
const eventMatches = (e, q) => {
  const hay = [e.z, e.t, ...participantsOf(e).map((x) => (x.kind === 'person' ? x.p.zh || x.p.en : x.n))]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  let gs = grouped.value
  if (periodFilter.value) gs = gs.filter((g) => g.id === periodFilter.value)
  if (!q) return gs
  return gs
    .map((g) => ({ ...g, events: g.events.filter((e) => eventMatches(e, q)) }))
    .filter((g) => g.events.length)
})

function toggleGroup(id) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
}

const stats = computed(() => ({ events: timeline.value.length }))

/* ---------- 详情视图 ---------- */
const eventId = computed(() => (route.params.id ? String(route.params.id) : ''))
const view = computed(() => (eventId.value ? 'detail' : 'explore'))
const currentEvent = computed(() => timeline.value.find((e) => e.id === 't' + eventId.value) || null)

const facts = computed(() => {
  const e = currentEvent.value
  if (!e) return null
  const pid = periodOfEvent(e)
  return {
    year: e.y != null ? yearLabel(e.y) + ' 年' : '',
    dur: e.dur || '',
    period: pid === 'primeval' ? '太古时期' : periodName(pid),
    firstLabel: refLabel(e.first, books.value),
    firstUrl: refUrl(e.first),
    verses: e.nv || 0,
  }
})

/** 邻近事件：全时间线按年份排序后取前后各 3 */
const nearbyEvents = computed(() => {
  const e = currentEvent.value
  if (!e) return []
  const sorted = [...timeline.value].sort((a, b) => {
    if (a.y == null) return 1
    if (b.y == null) return -1
    return a.y - b.y
  })
  const i = sorted.indexOf(e)
  if (i < 0) return []
  return sorted.slice(Math.max(0, i - 3), i).concat(sorted.slice(i + 1, i + 4))
})

/* ---------- 导航 ---------- */
watch(
  () => route.params.id,
  () => {
    document.querySelector('.app-main')?.scrollTo(0, 0)
  },
)
function openEvent(e) {
  router.push(`/events/${e.id.replace(/^t/, '')}`)
}
function openPerson(p) {
  router.push(`/persons/${encodeURIComponent(p.id.replace(/^person_/, ''))}`)
}
function backToExplore() {
  router.push('/events')
}
function scrollToList() {
  document.getElementById('list')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="events-page">
    <div v-if="loading" class="page-state">词条加载中…</div>
    <EmptyState v-else-if="error" title="词条加载失败" :message="error" />

    <!-- ===== 探索视图：Hero + 筛选 + 时期分组事件列表 ===== -->
    <div v-else-if="view === 'explore'" class="explore">
      <section class="hero">
        <div class="hero-inner">
          <p class="hero-eyebrow">BIBLE ENTRIES · 圣经词条</p>
          <h1 class="hero-title">圣经事件</h1>
          <p class="hero-sub">Events of the Bible</p>
          <p class="hero-desc">编年事件数据库：从创造到初代教会，按时期分组，关联参与者与经文。</p>
          <div class="hero-actions">
            <a href="#list" class="btn-explore" @click.prevent="scrollToList">开始浏览 <span class="arr">→</span></a>
            <span v-if="stats.events" class="hero-stats">{{ stats.events }} 个事件</span>
          </div>
        </div>
      </section>

      <section class="explorer" id="list">
        <header class="explorer-head">
          <h2 class="section-title">事件探索</h2>
          <p class="section-sub">按时期分组的时间线，可搜索标题或参与者（如「保罗」「出埃及」）</p>
        </header>

        <div class="search-bar">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input v-model="query" class="search-input" type="text" placeholder="搜索事件或参与者，如「出生」「大卫」「保罗」" />
          <button v-if="query" class="search-clear" aria-label="清空搜索" @click="query = ''">✕</button>
        </div>

        <div class="filters">
          <div class="chip-row">
            <button class="chip" :class="{ on: !periodFilter }" @click="periodFilter = ''">全部时期</button>
            <button
              v-for="g in grouped"
              :key="g.id"
              class="chip"
              :class="{ on: periodFilter === g.id }"
              @click="periodFilter = periodFilter === g.id ? '' : g.id"
            >{{ g.name }}</button>
          </div>
        </div>

        <div v-if="filteredGroups.length" class="group-list">
          <div v-for="g in filteredGroups" :key="g.id" class="event-group">
            <button class="eg-head" @click="toggleGroup(g.id)">
              <span class="eg-arrow" :class="{ closed: !expanded.has(g.id) }">▾</span>
              <span class="eg-name">{{ g.name }}</span>
              <span class="eg-era">{{ g.era }}</span>
              <span class="eg-count">{{ g.events.length }}</span>
            </button>
            <div v-show="expanded.has(g.id)" class="eg-items">
              <button v-for="e in g.events" :key="e.id" class="event-row" @click="openEvent(e)">
                <span class="ev-year">{{ e.y != null ? yearLabel(e.y) : '—' }}</span>
                <span class="ev-title">{{ e.z || e.t }}</span>
                <span class="ev-en">{{ e.t }}</span>
                <span class="ev-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
        <EmptyState v-else title="没有匹配的事件" message="换个关键词试试，如「出生」「战争」「约」" />
      </section>
    </div>

    <!-- ===== 详情视图 ===== -->
    <div v-else-if="view === 'detail'" class="detail">
      <div v-if="!currentEvent" class="page-state">
        <p class="state-msg">未找到该事件（{{ eventId }}）</p>
        <button class="back-all" @click="backToExplore">← 返回全部事件</button>
      </div>
      <template v-else>
        <header class="event-head">
          <button class="back-all" @click="backToExplore">← 全部事件</button>
          <div class="event-head-main">
            <h1 class="event-zh">{{ currentEvent.z || currentEvent.t }}</h1>
            <span v-if="currentEvent.y != null" class="event-year-chip">{{ yearLabel(currentEvent.y) }} 年</span>
            <span v-if="currentEvent.dur" class="event-dur-chip">{{ currentEvent.dur }}</span>
          </div>
          <p class="event-en">{{ currentEvent.t }}</p>
        </header>

        <div class="detail-body">
          <!-- 速览 -->
          <section class="dsection">
            <h2 class="ds-title">事件速览</h2>
            <div class="facts">
              <div v-if="facts.year" class="fact">
                <span class="fact-k">年份</span>
                <span class="fact-v">{{ facts.year }}</span>
              </div>
              <div v-if="facts.dur" class="fact">
                <span class="fact-k">时长</span>
                <span class="fact-v">{{ facts.dur }}</span>
              </div>
              <div v-if="facts.period" class="fact">
                <span class="fact-k">时期</span>
                <span class="fact-v">{{ facts.period }}</span>
              </div>
              <div v-if="facts.firstLabel" class="fact">
                <span class="fact-k">首处经文</span>
                <RouterLink class="fact-link" :to="facts.firstUrl">{{ facts.firstLabel }} →</RouterLink>
              </div>
              <div v-if="facts.verses" class="fact">
                <span class="fact-k">相关经文</span>
                <span class="fact-v">{{ facts.verses }} 节</span>
              </div>
            </div>
          </section>

          <!-- 参与者 -->
          <section v-if="participantsOf(currentEvent).length" class="dsection">
            <h2 class="ds-title">参与者（{{ participantsOf(currentEvent).length }}）</h2>
            <div class="rel-items">
              <template v-for="(pt, i) in participantsOf(currentEvent)" :key="i">
                <button v-if="pt.kind === 'person'" class="rel-chip" @click="openPerson(pt.p)">
                  {{ pt.p.zh || pt.p.en }}<span class="rel-code">· {{ pt.p.s }}</span>
                </button>
                <span v-else class="rel-chip plain">{{ pt.n }}</span>
              </template>
            </div>
          </section>

          <!-- 邻近事件 -->
          <section v-if="nearbyEvents.length" class="dsection">
            <h2 class="ds-title">邻近事件</h2>
            <div class="event-list">
              <button v-for="e in nearbyEvents" :key="e.id" class="event-row" @click="openEvent(e)">
                <span class="ev-year">{{ e.y != null ? yearLabel(e.y) : '—' }}</span>
                <span class="ev-title">{{ e.z || e.t }}</span>
                <span class="ev-en">{{ e.t }}</span>
                <span class="ev-arrow">→</span>
              </button>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.events-page {
  flex: 1;
  background: var(--bg);
}
.page-state {
  text-align: center;
  padding: 4rem 0;
  color: var(--muted);
}
.state-msg {
  margin: 0 0 1rem;
}

/* ===== Hero（与人物页一致） ===== */
.hero {
  position: relative;
  background: linear-gradient(180deg, var(--gold-soft) 0%, var(--bg) 100%);
  border-bottom: 1px solid var(--line-soft);
}
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
.arr {
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
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 34rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  padding: 0.5rem 1rem;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.search-bar:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.12);
}
.search-icon {
  flex-shrink: 0;
  color: var(--muted);
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.92rem;
  color: var(--text);
}
.search-input::placeholder {
  color: #a7adb6;
}
.search-clear {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #a7adb6;
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-pill);
}
.search-clear:hover {
  color: var(--text);
  background: var(--line-soft);
}
.filters {
  margin-top: 1.2rem;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.chip {
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--muted);
  font-size: 0.8rem;
  padding: 0.24rem 0.85rem;
  cursor: pointer;
  transition: all var(--dur) var(--ease);
}
.chip:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.chip.on {
  background: var(--gold-soft);
  border-color: var(--gold);
  color: var(--gold);
  font-weight: 600;
}

/* 时期分组 */
.group-list {
  margin-top: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.event-group {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  overflow: hidden;
}
.eg-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  border: none;
  background: var(--gold-soft);
  padding: 0.6rem 1.1rem;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.eg-head:hover {
  background: rgba(139, 115, 85, 0.14);
}
.eg-arrow {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--gold);
  transition: transform 0.18s ease;
}
.eg-arrow.closed {
  transform: rotate(-90deg);
}
.eg-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.03em;
}
.eg-era {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  color: #a2957e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.eg-count {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}

/* 事件行（探索/邻近共用） */
.eg-items {
  display: flex;
  flex-direction: column;
}
.event-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  text-align: left;
  border: none;
  padding: 0.62rem 1.1rem;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.event-row + .event-row {
  border-top: 1px solid var(--line-soft);
}
.event-row:hover {
  background: var(--gold-soft);
}
.ev-year {
  flex-shrink: 0;
  width: 4.2rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.ev-title {
  flex-shrink: 0;
  font-size: 0.92rem;
  font-weight: 600;
}
.ev-en {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  color: #a7adb6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ev-arrow {
  flex-shrink: 0;
  color: var(--gold);
  font-size: 0.85rem;
}

/* ===== 详情视图 ===== */
.event-head {
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
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.back-all:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.event-head-main {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}
.event-zh {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.2rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}
.event-year-chip {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--gold);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.7rem;
  font-variant-numeric: tabular-nums;
}
.event-dur-chip {
  font-size: 0.72rem;
  color: var(--muted);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.7rem;
}
.event-en {
  margin: 0.7rem 0 0;
  font-size: 1rem;
  color: #a7adb6;
  letter-spacing: 0.03em;
}

/* 详情主体 */
.detail-body {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 1.2rem 2rem 4.5rem;
  border-top: 1px solid var(--line-soft);
}
.dsection {
  margin-bottom: 2.4rem;
}
.ds-title {
  margin: 0 0 1rem;
  font-family: var(--serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text);
}

/* 速览（与人物页一致） */
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.fact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  padding: 0.7rem 1.2rem;
  min-width: 8.5rem;
}
.fact-k {
  font-size: 0.72rem;
  color: #a7adb6;
  letter-spacing: 0.08em;
}
.fact-v {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.fact-link {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gold);
  text-decoration: none;
  transition: color var(--dur) var(--ease);
}
.fact-link:hover {
  color: var(--text);
  text-decoration: underline;
}

/* 参与者 */
.rel-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.rel-chip {
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.24rem 0.9rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.rel-chip:hover {
  border-color: var(--gold);
  color: var(--gold);
  background: var(--gold-soft);
}
.rel-chip.plain {
  cursor: default;
  color: var(--muted);
}
.rel-chip.plain:hover {
  border-color: var(--line);
  color: var(--muted);
  background: var(--panel);
}
.rel-code {
  color: #a7adb6;
  font-size: 0.72rem;
  margin-left: 0.25rem;
}

/* 邻近事件列表 */
.event-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.event-list .event-row {
  background: var(--panel);
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .hero::before {
    left: 1.4rem;
    top: 2.2rem;
  }
  .hero-inner {
    padding: 3.4rem 1.5rem 3rem;
  }
  .hero-title {
    font-size: 2.3rem;
  }
  .explorer {
    padding: 2.2rem 1.5rem 3rem;
  }
  .event-head {
    padding: 1.7rem 1.5rem 1.2rem;
  }
  .event-zh {
    font-size: 1.75rem;
  }
  .detail-body {
    padding: 1.2rem 1.5rem 3rem;
  }
  .facts {
    gap: 0.7rem;
  }
  .fact {
    min-width: 7.5rem;
    padding: 0.6rem 0.9rem;
  }
  .ev-en {
    display: none;
  }
}
</style>
