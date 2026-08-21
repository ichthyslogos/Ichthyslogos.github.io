<script setup>
/**
 * PropheciesPage — 圣经预言词条（/prophecies 列表 · /prophecies/:id 详情）
 * 数据：data/prophecy/prophecies.json（源自 scripture-journey，源自 J. Barton Payne
 *       《圣经预言百科全书》弥赛亚预言子集，含预言/应验经文中文正文、状态、学术注释）
 *      + data/search/index.json（books 书名表，用于英文出处解析与读经页深链）
 * 设计语言：现代出版风浅色 + 金棕学术点缀（与人物/事件词条一致）
 *   - 探索视图：Hero → 搜索 + 类别筛选 → 预言卡片网格（OT → NT 对照）
 *   - 详情视图：预言头 → 经文对照（预言→应验，各附中英正文）→ 解释 → 学术释义 → 深链读经页
 * 状态字段 only 保留（fulfilled/coming-soon），避免把神学解释误写成单纯事实。
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import { loadEntryIndex } from '../../lib/bibleEntries.js'
import { scrollMainTop } from '../../composables/useScroll.js'
import SearchInput from '../../components/common/SearchInput.vue'

const route = useRoute()
const router = useRouter()

/** 站点根路径（尊重 vite base；深层路由下相对 fetch 会解析错目录，统一用根路径） */
const ROOT = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

/* ---------- 数据加载 ---------- */
const prophecies = ref([])
const books = ref([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    const [pd, idx] = await Promise.all([
      fetch(`${ROOT}data/prophecy/prophecies.json`, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`预言数据加载失败 (${r.status})`)
        return r.json()
      }),
      loadEntryIndex(),
    ])
    prophecies.value = pd.prophecies || []
    books.value = idx.books || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
  scrollMainTop()
})

/* ---------- 书卷名映射（英文出处 → 读经页深链 / 中文书名） ---------- */
const BOOK_ALIAS = {
  ps: '诗篇', psalm: '诗篇', psalms: '诗篇',
  'song of solomon': '雅歌', song: '雅歌',
}
function bookMap() {
  const m = new Map() // norm(名字) -> { id, zh }
  const put = (name, id, zh) => {
    const k = name.toLowerCase().replace(/[\s-]/g, '')
    if (k && !m.has(k)) m.set(k, { id, zh })
  }
  for (const b of books.value) {
    put(b.en, b.id, b.zh)
    put(b.zh, b.id, b.zh)
    for (const a of b.ab || []) put(a, b.id, b.zh)
    for (const a of b.ea || []) put(a, b.id, b.zh)
    put(b.en.replace(/\s+/g, ''), b.id, b.zh)
  }
  for (const [k, zh] of Object.entries(BOOK_ALIAS)) {
    const id = [...m.values()].find((x) => x.zh === zh)?.id
    if (id) m.set(k.replace(/[\s-]/g, ''), { id, zh })
  }
  return m
}

/**
 * 解析英文出处字符串 → 深链列表。ref 形如 "Genesis 3:15" / "Ps 110:4" /
 * "Isa 9:1-2; Luke 1:32"。返回 [{ bookId, zh, chapter, verse, label, url }]
 */
function parseRefs(ref) {
  if (!ref) return []
  const map = bookMap()
  const out = []
  const segments = ref.split(/[;,；，]/)
  for (const seg of segments) {
    const s = seg.trim()
    const m = /^(.+?)\s+(\d{1,3})(?::(\d{1,3}))?[\s\u2013–—-]*(\d{1,3})?$/.exec(s)
    if (!m) continue
    const name = m[1].trim()
    const key = name.toLowerCase().replace(/[\s-]/g, '')
    const book = map.get(key) || map.get(name.toLowerCase().replace(/[\s-]/g, ''))
    if (!book) continue
    const chapter = Number(m[2])
    const verse = m[3] ? Number(m[3]) : 0
    const label = `${book.zh} ${chapter}${verse ? ':' + verse : ''}`
    const url = `/brp/${book.id}/${chapter}${verse ? `?v=${verse}` : ''}`
    if (!out.some((x) => x.label === label)) out.push({ bookId: book.id, zh: book.zh, chapter, verse, label, url })
  }
  return out
}

/* ---------- 探索视图 ---------- */
const query = ref('')
const catFilter = ref('')
const limit = ref(60)

const categories = computed(() => {
  const order = ['谱系', '身份', '职事', '受难', '弃绝', '复活', '国度']
  const seen = new Set()
  const list = []
  for (const c of order) {
    if (prophecies.value.some((p) => (p.categoryZh || p.category) === c)) { seen.add(c); list.push({ id: c, label: c, n: 0 }) }
  }
  for (let i = 0; i < prophecies.value.length; i++) {
    const c = prophecies.value[i].categoryZh || prophecies.value[i].category
    const it = list.find((x) => x.id === c)
    if (it) it.n++
  }
  return list
})

const filtered = computed(() => {
  let list = prophecies.value
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p) =>
      [p.titleZh, p.title, p.categoryZh, p.category, p.otRef, p.ntRef, p.explanationZh, p.explanation]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }
  if (catFilter.value) list = list.filter((p) => (p.categoryZh || p.category) === catFilter.value)
  return [...list].sort((a, b) => a.id - b.id)
})

const shown = computed(() => filtered.value.slice(0, limit.value))
watch([query, catFilter], () => { limit.value = 60 })

const stats = computed(() => ({ total: prophecies.value.length }))

/* ---------- 详情视图 ---------- */
const propId = computed(() => (route.params.id ? decodeURIComponent(route.params.id) : ''))
const view = computed(() => (propId.value ? 'detail' : 'explore'))

const current = computed(() => prophecies.value.find((p) => p.key === propId.value) || null)

const detail = computed(() => {
  const p = current.value
  if (!p) return null
  const ot = { refs: parseRefs(p.otRef), text: p.otText, textZh: p.otTextZh }
  const nt = { refs: parseRefs(p.ntRef), text: p.ntText, textZh: p.ntTextZh }
  return {
    titleZh: p.titleZh || p.title,
    titleEn: p.title,
    category: p.categoryZh || p.category,
    status: p.status,
    certainty: p.certainty,
    strength: p.strength,
    ot, nt,
    explanationZh: p.explanationZh || '',
    explanation: p.explanation,
    interpretations: p.interpretations || [],
    refsZh: [...ot.refs, ...nt.refs].filter((r, i, a) => a.findIndex((x) => x.label === r.label) === i),
  }
})

const TRADITION_LABEL = { payne: 'Payne', edersheim: 'Edersheim', mcdowell: 'McDowell' }
const STATUS_LABEL = { fulfilled: '已应验', 'coming-soon': '待应验' }

/* ---------- 导航 ---------- */
function open(p) {
  router.push(`/prophecies/${encodeURIComponent(p.key)}`)
}
function backToList() {
  router.push('/prophecies')
}
function loadMore() {
  limit.value += 60
}
</script>

<template>
  <div class="prop-page">
    <div v-if="loading" class="page-state">预言词条加载中…</div>
    <EmptyState v-else-if="error" title="预言数据加载失败" :message="error" />

    <!-- ===== 探索视图 ===== -->
    <div v-else-if="view === 'explore'" class="explore">
      <section class="explorer" id="list">
        <header class="explorer-head">
          <h2 class="section-title">预言探索</h2>
          <p class="section-sub">搜索标题或出处（如「童女怀孕」「伯利恒」「Isa 7:14」），或按类别筛选</p>
        </header>

        <SearchInput v-model="query" placeholder="搜索弥赛亚预言，如「受苦的仆人」「复活」「Kingdom」" />

        <div class="filters">
          <div class="chip-row">
            <button class="chip" :class="{ on: !catFilter }" @click="catFilter = ''">全部分类</button>
            <button
              v-for="c in categories"
              :key="c.id"
              class="chip"
              :class="{ on: catFilter === c.id }"
              @click="catFilter = catFilter === c.id ? '' : c.id"
            >{{ c.label }}<span class="chip-n">{{ c.n }}</span></button>
          </div>
        </div>

        <p v-if="filtered.length" class="result-count">共 {{ filtered.length }} 条弥赛亚预言</p>

        <div v-if="shown.length" class="prop-grid">
          <button v-for="p in shown" :key="p.id" class="prop-card" @click="open(p)">
            <div class="pc-head">
              <span class="pc-zh">{{ p.titleZh || p.title }}</span>
              <span class="pc-cat">{{ p.categoryZh || p.category }}</span>
            </div>
            <span class="pc-en">{{ p.title }}</span>
            <div class="pc-refs">
              <span class="pc-ot">{{ p.otRef }}</span>
              <span class="pc-arrow">→</span>
              <span class="pc-nt">{{ p.ntRef }}</span>
            </div>
            <div class="pc-foot">
              <span class="pc-n">#{{ p.id }}</span>
              <span class="pc-status">{{ STATUS_LABEL[p.status] || p.status }}</span>
            </div>
          </button>
        </div>
        <EmptyState
          v-else
          title="没有匹配的预言"
          message="换个关键词试试，如「童女怀孕」「国度」「大卫」"
        />
        <button v-if="filtered.length > limit" class="btn-more" @click="loadMore">
          显示更多（{{ shown.length }} / {{ filtered.length }}）
        </button>
      </section>
    </div>

    <!-- ===== 详情视图 ===== -->
    <div v-else-if="view === 'detail'" class="detail">
      <div v-if="!current" class="page-state">
        <p class="state-msg">未找到该预言（{{ propId }}）</p>
        <button class="back-all" @click="backToList">← 返回全部预言</button>
      </div>
      <template v-else>
        <header class="prop-head">
          <button class="back-all" @click="backToList">← 全部预言</button>
          <div class="prop-head-main">
            <h1 class="prop-zh">{{ detail.titleZh }}</h1>
            <span class="prop-en">{{ detail.titleEn }}</span>
          </div>
          <div class="prop-meta">
            <span class="prop-chip cat">{{ detail.category }}</span>
            <span class="prop-chip status">{{ detail.status }}</span>
            <span class="prop-chip" v-if="detail.certainty">把握：{{ detail.certainty }}</span>
          </div>
        </header>

        <div class="detail-body">
          <!-- 预言 → 应验 对照 -->
          <section class="dsection">
            <h2 class="ds-title">预言 → 应验</h2>
            <div class="pair">
              <div class="passage ot">
                <div class="psg-head">
                  <span class="psg-tag">预言经文</span>
                  <span class="psg-ref">{{ detail.ot.refs.length ? detail.ot.refs.map(r => r.label).join('；') : detail.ot.refs.length }}</span>
                </div>
                <template v-if="detail.ot.refs.length">
                  <RouterLink v-for="r in detail.ot.refs" :key="r.url" :to="r.url" class="psg-link">
                    {{ r.label }} <span class="psg-open">读经 →</span>
                  </RouterLink>
                </template>
                <p class="psg-zh">{{ detail.ot.textZh }}</p>
                <p class="psg-en">{{ detail.ot.text }}</p>
              </div>
              <div class="pair-arrow">→</div>
              <div class="passage nt">
                <div class="psg-head">
                  <span class="psg-tag">应验经文</span>
                  <span class="psg-ref">{{ detail.nt.refs.length ? detail.nt.refs.map(r => r.label).join('；') : '' }}</span>
                </div>
                <template v-if="detail.nt.refs.length">
                  <RouterLink v-for="r in detail.nt.refs" :key="r.url" :to="r.url" class="psg-link">
                    {{ r.label }} <span class="psg-open">读经 →</span>
                  </RouterLink>
                </template>
                <p class="psg-zh">{{ detail.nt.textZh }}</p>
                <p class="psg-en">{{ detail.nt.text }}</p>
              </div>
            </div>
            <!-- 相关读经深链 -->
            <div class="ref-chips">
              <RouterLink v-for="r in detail.refsZh" :key="r.url" :to="r.url" class="ref-chip">
                {{ r.label }}
              </RouterLink>
            </div>
          </section>

          <!-- 解释 -->
          <section v-if="detail.explanationZh || detail.explanation" class="dsection">
            <h2 class="ds-title">为什么指向基督 <span class="ds-src">Why It Matters</span></h2>
            <p v-if="detail.explanationZh" class="ds-paragraph">{{ detail.explanationZh }}</p>
            <p class="ds-paragraph en">{{ detail.explanation }}</p>
          </section>

          <!-- 学术释义 -->
          <section v-if="detail.interpretations.length" class="dsection">
            <h2 class="ds-title">学术释义 <span class="ds-src">Scholarship</span></h2>
            <div v-for="it in detail.interpretations" :key="it.tradition" class="interp">
              <div class="interp-head">
                <span class="interp-trad">{{ TRADITION_LABEL[it.tradition] || it.tradition }}</span>
                <span v-if="it.encyclopediaNumber != null" class="interp-num">#{{ it.encyclopediaNumber }}</span>
                <span v-if="it.reference" class="interp-ref">{{ it.reference }}</span>
              </div>
              <p v-if="it.note" class="interp-note">{{ it.note }}</p>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.prop-page {
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
.explorer-head { margin-bottom: 1.3rem; }
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
.filters { margin-top: 1.2rem; display: flex; flex-direction: column; gap: 0.55rem; }
.chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
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
.chip:hover { border-color: var(--gold); color: var(--gold); }
.chip.on {
  background: var(--gold-soft);
  border-color: var(--gold);
  color: var(--gold);
  font-weight: 600;
}
.chip-n { margin-left: 0.3rem; font-size: 0.7em; opacity: 0.8; }
.result-count {
  margin: 1.2rem 0 0;
  font-size: var(--fs-xs);
  color: #a7adb6;
  letter-spacing: 0.05em;
}

/* 预言网格 */
.prop-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1.1rem;
}
.prop-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  padding: 0.95rem 1.05rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.prop-card:hover {
  border-color: var(--gold);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.pc-head { display: flex; align-items: baseline; gap: 0.5rem; width: 100%; }
.pc-zh {
  font-family: var(--serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-cat {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--gold);
  border: 1px solid rgba(139, 115, 85, 0.3);
  border-radius: var(--radius-pill);
  padding: 0.08rem 0.55rem;
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
.pc-refs {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  margin-top: 0.25rem;
  font-size: 0.76rem;
  color: var(--muted);
}
.pc-ot { font-variant-numeric: tabular-nums; }
.pc-arrow { color: var(--gold); flex-shrink: 0; }
.pc-nt {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.pc-n { font-variant-numeric: tabular-nums; }
.pc-status { margin-left: auto; color: var(--gold); }
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
.btn-more:hover { border-color: var(--gold); color: var(--gold); }

/* ===== 详情视图 ===== */
.prop-head {
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
.back-all:hover { border-color: var(--gold); color: var(--gold); }
.prop-head-main { display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
.prop-zh {
  margin: 0;
  font-family: var(--serif);
  font-size: 2.4rem;
  font-weight: 600;
  color: var(--text);
}
.prop-en { font-size: 1rem; color: #a7adb6; letter-spacing: 0.04em; }
.prop-meta { display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap; }
.prop-chip {
  font-size: 0.72rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.7rem;
  color: var(--muted);
}
.prop-chip.cat { color: var(--gold); border-color: rgba(139, 115, 85, 0.35); font-weight: 600; }
.prop-chip.status { color: var(--gold); background: var(--gold-soft); border-color: transparent; }

.detail-body {
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 1.2rem 2rem 4.5rem;
  border-top: 1px solid var(--line-soft);
}
.dsection { margin-bottom: 2.6rem; }
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
.ds-src { font-size: 0.72rem; font-weight: 400; color: #a7adb6; letter-spacing: 0.04em; }

/* 预言 → 应验 对照 */
.pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1rem;
  align-items: stretch;
}
.pair-arrow {
  display: flex;
  align-items: center;
  color: var(--gold);
  font-size: 1.3rem;
}
.passage {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  padding: 1.1rem 1.2rem;
}
.passage.ot { border-color: rgba(139, 115, 85, 0.35); }
.passage.nt { border-color: rgba(102, 157, 128, 0.4); }
.psg-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.7rem;
}
.psg-tag {
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: var(--gold);
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.7rem;
  letter-spacing: 0.05em;
}
.passage.nt .psg-tag { background: #4f8a72; }
.psg-ref { font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.psg-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gold);
  text-decoration: none;
  margin-right: 0.8rem;
}
.psg-link:hover { text-decoration: underline; }
.psg-open { font-size: 0.72rem; color: var(--muted); }
.psg-zh {
  margin: 0.7rem 0 0;
  font-size: 0.98rem;
  line-height: 2;
  color: var(--text);
  white-space: pre-line;
}
.psg-en {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  line-height: 1.75;
  color: #a7adb6;
  font-style: italic;
  white-space: pre-line;
}
.ref-chips { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 1rem; }
.ref-chip {
  font-size: 0.8rem;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  padding: 0.22rem 0.8rem;
  text-decoration: none;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ref-chip:hover { border-color: var(--gold); color: var(--gold); background: var(--gold-soft); }

/* 解释 */
.ds-paragraph {
  margin: 0 0 0.9rem;
  font-size: 0.95rem;
  line-height: 2;
  color: var(--text);
}
.ds-paragraph.en {
  font-size: 0.85rem;
  color: #a7adb6;
  font-style: italic;
}

/* 学术释义 */
.interp {
  border-left: 3px solid var(--gold);
  background: var(--panel);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  padding: 0.7rem 1.1rem;
  margin-bottom: 0.7rem;
}
.interp-head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
.interp-trad { font-size: 0.8rem; font-weight: 700; color: var(--gold); }
.interp-num, .interp-ref { font-size: 0.75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
.interp-note {
  margin: 0.4rem 0 0;
  font-size: 0.88rem;
  line-height: 1.8;
  color: var(--text);
}

/* ===== 响应式 ===== */
@media (max-width: 1000px) {
  .prop-grid { grid-template-columns: repeat(2, 1fr); }
  .pair { grid-template-columns: 1fr; }
  .pair-arrow { transform: rotate(90deg); justify-content: center; }
}
@media (max-width: 900px) {
  .explorer { padding: 2.2rem 1.5rem 3rem; }
  .prop-head { padding: 1.7rem 1.5rem 1.2rem; }
  .prop-zh { font-size: 1.9rem; }
  .detail-body { padding: 1.2rem 1.5rem 3rem; }
}
@media (max-width: 600px) {
  .prop-grid { grid-template-columns: 1fr; }
}
</style>