<script setup>
/**
 * PersonsPage — 圣经人物词条（/persons 列表 · /persons/:id 详情）
 * 数据：data/search/index.json（persons/timeline/books/periods）
 *      + data/theographic/persons.json（Easton 词典 + 亲属关系，详情按需懒加载）
 * 设计语言：现代出版风浅色 + 金棕学术点缀（与护教/教会史一致）
 *   - 探索视图：Hero → 搜索 + 时期/性别筛选 → 人物卡片网格（出现次数排序，分页加载）
 *   - 详情视图：人物头（中英名/强码/生卒）→ 生平速览 → 亲属关系 → 同名人物 → 词典 → 相关事件
 * 同名人物（如 7 位马利亚 G3137*）按强码后缀天然区分，事件经 ppl 强码精确归属。
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import DictView from '../../components/DictView.vue'
import {
  loadEntryIndex,
  loadTheoPersons,
  refLabel,
  refUrl,
  yearsLabel,
  yearLabel,
  buildPersonResolver,
} from '../../lib/bibleEntries.js'

const route = useRoute()
const router = useRouter()

/* ---------- 数据加载 ---------- */
const index = ref(null)
const loading = ref(false)
const error = ref('')
/** Theographic 增强（词典/亲属；详情视图首次进入时懒加载，一次拉全量） */
const theo = ref(null)
const theoError = ref('')

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

watch(
  () => route.params.id,
  async (id) => {
    if (id && !theo.value && !theoError.value) {
      try {
        theo.value = (await loadTheoPersons()).persons || {}
      } catch (e) {
        theoError.value = e.message
      }
    }
    scrollMainTop()
  },
  { immediate: true },
)

/* ---------- 派生数据 ---------- */
const persons = computed(() => index.value?.persons || [])
const periods = computed(() => index.value?.periods || [])
const books = computed(() => index.value?.books || [])
const timeline = computed(() => index.value?.timeline || [])
const resolver = computed(() => buildPersonResolver(persons.value))

/** 时期 id → 名称 */
const periodName = (id) => periods.value.find((p) => p.id === id)?.name || ''

/* ---------- 筛选与搜索（探索视图） ---------- */
const query = ref('')
const periodFilter = ref('')
const genderFilter = ref('')
const limit = ref(60)

const filteredPersons = computed(() => {
  let list = persons.value
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) =>
      [p.zh, p.en, p.s, ...(p.al || [])].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }
  if (periodFilter.value) list = list.filter((p) => (p.ps || []).includes(periodFilter.value))
  if (genderFilter.value) list = list.filter((p) => p.gender === genderFilter.value)
  return [...list].sort((a, b) => (b.n || 0) - (a.n || 0))
})

const shownPersons = computed(() => filteredPersons.value.slice(0, limit.value))
watch([query, periodFilter, genderFilter], () => {
  limit.value = 60
})

const stats = computed(() => ({
  persons: persons.value.length,
  withDict: 0,
}))

/* ---------- 详情视图 ---------- */
const personId = computed(() => (route.params.id ? decodeURIComponent(route.params.id) : ''))
const view = computed(() => (personId.value ? 'detail' : 'explore'))

const currentPerson = computed(() => resolver.value(personId.value) || null)

/** 人物强码两形态（id 无填充 / s 填充），事件参与匹配用 */
const personCodes = computed(() => {
  const p = currentPerson.value
  if (!p) return []
  return [...new Set([p.id.replace(/^person_/, ''), p.s].filter(Boolean))]
})

/** Theographic 记录（词典/亲属/生卒） */
const theoRec = computed(() => theo.value?.[personId.value] || null)

const relGroups = computed(() => {
  const rel = theoRec.value?.rel || {}
  const groups = []
  const resolveList = (vals) => (vals || []).map(resolver.value).filter(Boolean)
  if (rel.fa) {
    const r = resolver.value(rel.fa)
    if (r) groups.push({ label: '父亲', items: [r] })
  }
  if (rel.mo) {
    const r = resolver.value(rel.mo)
    if (r) groups.push({ label: '母亲', items: [r] })
  }
  if (rel.sp?.length) groups.push({ label: '配偶', items: resolveList(rel.sp) })
  if (rel.sb?.length) groups.push({ label: '兄弟姊妹', items: resolveList(rel.sb) })
  if (rel.ch?.length) groups.push({ label: '子女', items: resolveList(rel.ch) })
  return groups
})

/** 同名人物：强码去后缀相同 + 显示名相同（如 7 位马利亚互列，杜绝事件混淆） */
const sameNamePersons = computed(() => {
  const p = currentPerson.value
  if (!p) return []
  const base = p.s.replace(/[A-Z]$/, '')
  return persons.value.filter(
    (x) =>
      x !== p &&
      x.s.replace(/[A-Z]$/, '') === base &&
      (x.zh === p.zh || x.en === p.en),
  )
})

/** 相关事件：参与者强码命中（时间升序） */
const personEvents = computed(() => {
  const codes = personCodes.value
  if (!codes.length) return []
  return timeline.value
    .filter((e) => (e.ppl || []).some((c) => codes.includes(c)))
    .sort((a, b) => (a.y ?? 99999) - (b.y ?? 99999))
})

/** 词典文本：清掉 markdown 链接语法，纯文本呈现 */
const dictText = computed(() => {
  const d = theoRec.value?.dict || ''
  return d.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
})

const facts = computed(() => {
  const p = currentPerson.value
  if (!p) return null
  return {
    years: yearsLabel(p.by ?? theoRec.value?.by, p.dy ?? theoRec.value?.dy),
    appear: p.n || theoRec.value?.vc || 0,
    firstLabel: refLabel(p.first, books.value),
    firstUrl: refUrl(p.first),
    gender: p.gender === 'Male' ? '男' : p.gender === 'Female' ? '女' : '',
    periodNames: (p.ps || []).map(periodName).filter(Boolean),
  }
})

/* ---------- 导航 ---------- */
function personCode(p) {
  return p.id.replace(/^person_/, '')
}
function openPerson(p) {
  router.push(`/persons/${encodeURIComponent(personCode(p))}`)
}
function backToExplore() {
  router.push('/persons')
}
function scrollMainTop() {
  document.querySelector('.app-main')?.scrollTo(0, 0)
}
/** 滚动到人物列表区（不用 #锚点跳转：与 hash 路由冲突） */
function scrollToList() {
  document.getElementById('list')?.scrollIntoView({ behavior: 'smooth' })
}
function loadMore() {
  limit.value += 60
}
</script>

<template>
  <div class="persons-page">
    <div v-if="loading" class="page-state">词条加载中…</div>
    <EmptyState v-else-if="error" title="词条加载失败" :message="error" />

    <!-- ===== 探索视图：Hero + 筛选 + 人物网格 ===== -->
    <div v-else-if="view === 'explore'" class="explore">
      <section class="explorer" id="list">
        <header class="explorer-head">
          <h2 class="section-title">人物探索</h2>
          <p class="section-sub">搜索名字或强码（如「保罗」「G3972」「Mary」），或按时期筛选</p>
        </header>

        <div class="search-bar">
          <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            v-model="query"
            class="search-input"
            type="text"
            placeholder="搜索人物，如「大卫」「摩西」「Paul」"
          />
          <button v-if="query" class="search-clear" aria-label="清空搜索" @click="query = ''">✕</button>
        </div>

        <div class="filters">
          <div class="chip-row">
            <button class="chip" :class="{ on: !periodFilter }" @click="periodFilter = ''">全部时期</button>
            <button
              v-for="p in periods"
              :key="p.id"
              class="chip"
              :class="{ on: periodFilter === p.id }"
              @click="periodFilter = periodFilter === p.id ? '' : p.id"
            >{{ p.name }}</button>
          </div>
          <div class="chip-row">
            <button class="chip" :class="{ on: !genderFilter }" @click="genderFilter = ''">全部性别</button>
            <button class="chip" :class="{ on: genderFilter === 'Male' }" @click="genderFilter = genderFilter === 'Male' ? '' : 'Male'">男</button>
            <button class="chip" :class="{ on: genderFilter === 'Female' }" @click="genderFilter = genderFilter === 'Female' ? '' : 'Female'">女</button>
          </div>
        </div>

        <p v-if="filteredPersons.length" class="result-count">共 {{ filteredPersons.length }} 位人物</p>

        <div v-if="shownPersons.length" class="person-grid">
          <button v-for="p in shownPersons" :key="p.id" class="person-card" @click="openPerson(p)">
            <div class="pc-head">
              <span class="pc-zh">{{ p.zh || p.en }}</span>
              <span class="pc-code">{{ p.s }}</span>
            </div>
            <span class="pc-en">{{ p.en }}</span>
            <p v-if="p.b" class="pc-brief">{{ p.b }}</p>
            <div class="pc-foot">
              <span class="pc-n">出现 {{ p.n || 0 }} 次</span>
              <span v-if="(p.ps || []).length" class="pc-period">{{ periodName(p.ps[0]) }}</span>
            </div>
          </button>
        </div>
        <EmptyState
          v-else
          title="没有匹配的人物"
          message="换个关键词试试，如「亚伯拉罕」「耶稣」「约翰」"
        />
        <button v-if="filteredPersons.length > limit" class="btn-more" @click="loadMore">
          显示更多（{{ shownPersons.length }} / {{ filteredPersons.length }}）
        </button>
      </section>
    </div>

    <!-- ===== 详情视图：人物头 + 生平/亲属/同名/词典/事件 ===== -->
    <div v-else-if="view === 'detail'" class="detail">
      <div v-if="!currentPerson" class="page-state">
        <p class="state-msg">未找到该人物（{{ personId }}）</p>
        <button class="back-all" @click="backToExplore">← 返回全部人物</button>
      </div>
      <template v-else>
        <header class="person-head">
          <button class="back-all" @click="backToExplore">← 全部人物</button>
          <div class="person-head-main">
            <h1 class="person-zh">{{ currentPerson.zh || currentPerson.en }}</h1>
            <span class="person-en">{{ currentPerson.en }}</span>
            <span class="person-code-chip">{{ currentPerson.s }}</span>
            <span v-if="facts.gender" class="person-gender">{{ facts.gender }}</span>
          </div>
          <p v-if="currentPerson.b" class="person-brief">{{ currentPerson.b }}</p>
          <div v-if="currentPerson.al?.length" class="person-aliases">
            <span class="pa-label">别名</span>
            <span v-for="a in currentPerson.al" :key="a" class="pa-item">{{ a }}</span>
          </div>
        </header>

        <div class="detail-body">
          <!-- 生平速览 -->
          <section class="dsection">
            <h2 class="ds-title">生平速览</h2>
            <div class="facts">
              <div v-if="facts.years" class="fact">
                <span class="fact-k">生卒</span>
                <span class="fact-v">{{ facts.years }}</span>
              </div>
              <div class="fact">
                <span class="fact-k">出现</span>
                <span class="fact-v">{{ facts.appear }} 次</span>
              </div>
              <div v-if="facts.firstLabel" class="fact">
                <span class="fact-k">首处经文</span>
                <RouterLink class="fact-link" :to="facts.firstUrl">{{ facts.firstLabel }} →</RouterLink>
              </div>
            </div>
            <div v-if="facts.periodNames.length" class="period-tags">
              <span v-for="n in facts.periodNames" :key="n" class="ptag">{{ n }}</span>
            </div>
          </section>

          <!-- 亲属关系 -->
          <section v-if="relGroups.length" class="dsection">
            <h2 class="ds-title">亲属关系</h2>
            <div v-for="g in relGroups" :key="g.label" class="rel-group">
              <span class="rel-label">{{ g.label }}</span>
              <div class="rel-items">
                <button v-for="r in g.items" :key="r.id" class="rel-chip" @click="openPerson(r)">
                  {{ r.zh || r.en }}<span class="rel-n" v-if="r.n">（{{ r.n }}）</span>
                </button>
              </div>
            </div>
          </section>

          <!-- 同名人物（强码后缀区分；事件按强码精确归属，互不混淆） -->
          <section v-if="sameNamePersons.length" class="dsection">
            <h2 class="ds-title">同名人物</h2>
            <p class="ds-note">圣经中有 {{ sameNamePersons.length + 1 }} 位「{{ currentPerson.zh || currentPerson.en }}」，以强码后缀区分，各自的事件与亲属独立。</p>
            <div class="rel-items">
              <button v-for="s in sameNamePersons" :key="s.id" class="rel-chip" @click="openPerson(s)">
                {{ s.zh || s.en }} · {{ s.s }}<span class="rel-n" v-if="s.n">（{{ s.n }}）</span>
              </button>
            </div>
          </section>

          <!-- 词典 -->
          <section v-if="dictText" class="dsection">
            <h2 class="ds-title">词典 <span class="ds-src">Easton's Illustrated Dictionary</span></h2>
            <DictView :text="dictText" />
          </section>

          <!-- 相关事件 -->
          <section v-if="personEvents.length" class="dsection">
            <h2 class="ds-title">相关事件（{{ personEvents.length }}）</h2>
            <div class="event-list">
              <RouterLink
                v-for="e in personEvents"
                :key="e.id"
                :to="`/events/${e.id.replace(/^t/, '')}`"
                class="event-row"
              >
                <span class="ev-year">{{ e.y != null ? yearLabel(e.y) : '—' }}</span>
                <span class="ev-title">{{ e.z || e.t }}</span>
                <span class="ev-en">{{ e.t }}</span>
                <span class="ev-arrow">→</span>
              </RouterLink>
            </div>
          </section>

          <section v-if="!relGroups.length && !dictText && !personEvents.length && !theo" class="dsection">
            <p class="ds-note" v-if="!theoError">词典数据加载中…</p>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default { name: 'PersonsPage' }
</script>

<style scoped>
.persons-page {
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

/* 筛选 chips */
.filters {
  margin-top: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
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
.result-count {
  margin: 1.2rem 0 0;
  font-size: var(--fs-xs);
  color: #a7adb6;
  letter-spacing: 0.05em;
}

/* 人物网格 */
.person-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 1.1rem;
}
.person-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  padding: 0.95rem 1.05rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.person-card:hover {
  border-color: var(--gold);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.pc-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
}
.pc-zh {
  font-family: var(--serif);
  font-size: 1.12rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-code {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
}
.pc-en {
  font-size: 0.78rem;
  color: #a7adb6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.pc-brief {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.4em;
}
.pc-foot {
  margin-top: auto;
  padding-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  font-size: 0.72rem;
  color: #a7adb6;
}
.pc-n {
  font-variant-numeric: tabular-nums;
}
.pc-period {
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-more {
  display: block;
  margin: 1.6rem auto 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-sm);
  padding: 0.5rem 1.6rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.btn-more:hover {
  border-color: var(--gold);
  color: var(--gold);
}

/* ===== 详情视图 ===== */
.person-head {
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
.person-head-main {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}
.person-zh {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.4rem;
  font-weight: 600;
  color: var(--text);
}
.person-en {
  font-size: 1rem;
  color: #a7adb6;
  letter-spacing: 0.04em;
}
.person-code-chip {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.6rem;
  letter-spacing: 0.04em;
}
.person-gender {
  font-size: 0.72rem;
  color: var(--muted);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.6rem;
}
.person-brief {
  margin: 0.8rem 0 0;
  max-width: 36rem;
  font-size: var(--fs-sm);
  line-height: 1.8;
  color: var(--muted);
}
.person-aliases {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.9rem;
  flex-wrap: wrap;
}
.pa-label {
  font-size: var(--fs-xs);
  color: #a7adb6;
}
.pa-item {
  font-size: 0.78rem;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.7rem;
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
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
}
.ds-src {
  font-size: 0.72rem;
  font-weight: 400;
  color: #a7adb6;
  letter-spacing: 0.04em;
}
.ds-note {
  margin: -0.4rem 0 0.9rem;
  font-size: 0.85rem;
  line-height: 1.8;
  color: var(--muted);
}

/* 生平速览 */
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
  min-width: 9rem;
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
.period-tags {
  display: flex;
  gap: 0.45rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}
.ptag {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.16rem 0.7rem;
}

/* 亲属关系 / 同名人物 */
.rel-group {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  padding: 0.6rem 0;
}
.rel-group + .rel-group {
  border-top: 1px solid var(--line-soft);
}
.rel-label {
  flex-shrink: 0;
  width: 4.5rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--muted);
  padding-top: 0.28rem;
  letter-spacing: 0.04em;
}
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
.rel-n {
  color: #a7adb6;
  font-size: 0.75rem;
}

/* 相关事件 */
.event-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.event-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.65rem 1.1rem;
  background: var(--panel);
  color: var(--text);
  text-decoration: none;
  transition: background var(--dur) var(--ease);
}
.event-row + .event-row {
  border-top: 1px solid var(--line-soft);
}
.event-row:hover {
  background: var(--gold-soft);
  text-decoration: none;
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

/* ===== 响应式 ===== */
@media (max-width: 1100px) {
  .person-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 900px) {
  .explorer {
    padding: 2.2rem 1.5rem 3rem;
  }
  .person-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.8rem;
  }
  .person-head {
    padding: 1.7rem 1.5rem 1.2rem;
  }
  .person-zh {
    font-size: 1.9rem;
  }
  .detail-body {
    padding: 1.2rem 1.5rem 3rem;
  }
  .facts {
    gap: 0.7rem;
  }
  .fact {
    min-width: 8rem;
    padding: 0.6rem 0.9rem;
  }
  .ev-en {
    display: none;
  }
}
@media (max-width: 600px) {
  .person-grid {
    grid-template-columns: 1fr;
  }
  .rel-label {
    width: 4rem;
  }
}
</style>
