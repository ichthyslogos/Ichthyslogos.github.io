<script setup>
/**
 * StrongDictPage — 原文 Strong 词典（/strongs 列表 · /strongs/:code 详情）
 * 数据：data/brp/strongs-index.json（轻量列表/搜索）+ data/brp/strongs-dict.json（懒加载详情）
 *       源自 STEPBible TBESG/TBESH（STEPBible.org / Tyndale House, CC BY 4.0）
 * 链路：经文 → Strong 码 → 原文 lemma → 音译 → gloss → 定义
 * 设计语言：现代出版风浅色 + 金棕学术点缀（与人物/事件/预言词条一致）
 */
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import { scrollMainTop } from '../../composables/useScroll.js'

const route = useRoute()
const router = useRouter()

/** 站点根路径（尊重 vite base；深层路由下相对 fetch 会解析错目录，统一用根路径） */
const ROOT = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

/** 强码归一到 4 位数字键：H430→H0430 */
function normCode(c) {
  const m = /^(G|H)\s*(\d+)$/i.exec((c || '').trim())
  if (!m) return (c || '').trim().toUpperCase()
  return `${m[1].toUpperCase()}${m[2].padStart(4, '0')}`
}
const isDetail = computed(() => !!route.params.code)

/* ---------- 列表：加载轻量索引 ---------- */
const idx = ref(null)
const idxError = ref('')
const q = ref('')
const langFilter = ref('all') // all | H | G

async function loadIndex() {
  try {
    const r = await fetch(`${ROOT}data/brp/strongs-index.json`, { cache: 'no-store' })
    if (!r.ok) throw new Error(`词典索引加载失败 (${r.status})`)
    idx.value = await r.json()
  } catch (e) {
    idxError.value = e.message
  }
  scrollMainTop()
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

function rowMatches(row, code, nq) {
  if (!nq) return true
  if (code.toLowerCase().includes(nq)) return true
  if (norm(row.lemma).includes(nq)) return true
  if (norm(row.translit).includes(nq)) return true
  if (norm(row.gloss).includes(nq)) return true
  return false
}

const rows = computed(() => {
  if (!idx.value) return []
  const nq = norm(q.value)
  let list = []
  for (const [code, row] of Object.entries(idx.value.items)) {
    if (langFilter.value !== 'all' && !code.startsWith(langFilter.value)) continue
    if (rowMatches(row, code, nq)) list.push({ code, ...row })
  }
  list.sort((a, b) => a.code.localeCompare(b.code))
  return list
})

const total = computed(() => idx.value?.count || 0)

/* ---------- 详情：懒加载全量词典 ---------- */
const detail = ref(null)
const cat = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
/** TFLSJ 高级希腊词典（Full LSJ）：仅希腊文词条，首次展开时按需懒加载 */
const lsj = ref(null)
const lsjLoading = ref(false)
const lsjOpen = ref(false)
let lsjFetched = false

async function loadDetail(code) {
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  lsj.value = null
  lsjLoading.value = false
  lsjOpen.value = false
  lsjFetched = false
  try {
    const r = await fetch(`${ROOT}data/brp/strongs-dict.json`, { cache: 'no-store' })
    if (!r.ok) throw new Error(`词典加载失败 (${r.status})`)
    const d = await r.json()
    const c = normCode(code)
    if (!d.items[c]) throw new Error(`未收录：${c}`)
    detail.value = d.items[c]
    cat.value = { isG: d.items[c].g === 1, isH: d.items[c].h === 1, hasG: !!d.items[c].g, hasH: !!d.items[c].h }
  } catch (e) {
    detailError.value = e.message
  } finally {
    detailLoading.value = false
  }
  scrollMainTop()
}

/** 展开 LSJ 面板时首次加载高级释义（16MB 文件，避免每个希腊词条都拉取） */
async function openLsj() {
  lsjOpen.value = true
  if (lsjFetched || lsjLoading.value || !detail.value?.g) return
  lsjFetched = true
  lsjLoading.value = true
  try {
    const lr = await fetch(`${ROOT}data/brp/strongs-lsj.json`, { cache: 'no-store' })
    if (lr.ok) {
      const ld = await lr.json()
      lsj.value = (ld.items && ld.items[normCode(route.params.code)]) || null
    }
  } catch {
    lsj.value = null
  } finally {
    lsjLoading.value = false
  }
}

watch(() => route.params.code, (code) => {
  if (code) loadDetail(code)
  else loadIndex()
}, { immediate: true })
</script>

<template>
  <main class="sp-page">
    <!-- ===================== 列表视图 ===================== -->
    <section v-if="!isDetail" class="sd-list">
      <header class="page-hero">
        <p class="hero-kicker">FISH · Original Language</p>
        <h1 class="hero-title">原文 Strong 词典</h1>
        <p class="hero-sub">经文 → Strong 码 → 原文词 → 音译 → 释义。收录希伯来文与希腊文简明词典（其中含定义 {{ total }} 词条），基于 STEPBible / Tyndale House 数据。</p>
      </header>

      <div class="sd-toolbar">
        <input
          v-model="q"
          class="sd-search"
          type="search"
          placeholder="搜索强码 / 原文词 / 音译 / 释义（如 H7225 / av / love）"
        />
        <div class="sd-filters" role="group" aria-label="语言筛选">
          <button class="chip" :class="{ on: langFilter === 'all' }" @click="langFilter = 'all'">全部</button>
          <button class="chip" :class="{ on: langFilter === 'H' }" @click="langFilter = 'H'">希伯来文</button>
          <button class="chip" :class="{ on: langFilter === 'G' }" @click="langFilter = 'G'">希腊文</button>
        </div>
      </div>

      <p v-if="idxError" class="sd-err">{{ idxError }}</p>
      <EmptyState v-else-if="!idx" message="正在加载词典…" />
      <template v-else>
        <p class="sd-count">共 {{ rows.length }} 词条<template v-if="q">（命中 {{ rows.length }} / {{ total }}）</template></p>
        <div v-if="!rows.length" class="sd-empty">
          <EmptyState message="没有匹配的原文词条" hint="换一个词或清除筛选试试" />
        </div>
        <ul v-else class="sd-grid">
          <li v-for="row in rows" :key="row.code">
            <RouterLink :to="`/strongs/${row.code}`" class="sd-card" :class="{ g: row.code.startsWith('G') }">
              <span class="sd-card-code">{{ row.code }}</span>
              <span class="sd-card-lemma">{{ row.lemma }}</span>
              <span class="sd-card-translit">{{ row.translit }}</span>
              <span class="sd-card-gloss">{{ row.gloss }}</span>
            </RouterLink>
          </li>
        </ul>
      </template>
    </section>

    <!-- ===================== 详情视图 ===================== -->
    <section v-else class="sd-detail">
      <header class="page-hero sd-detail-hero">
        <button class="sd-back" @click="router.push('/strongs')">← 返回词典</button>
        <p class="hero-kicker">
          原文 <strong>Strong</strong> 词条
          · <span v-if="cat">{{ cat.hasG && cat.hasH ? '希伯来文 / 希腊文' : cat.isG ? '希腊文' : '希伯来文' }}</span>
        </p>
        <h2 class="hero-title sd-detail-code">{{ detail ? detail.code : normCode(route.params.code) }}</h2>
        <p class="hero-sub">原文字形、音译与简明释义</p>
      </header>

      <p v-if="detailError" class="sd-err">{{ detailError }}</p>
      <EmptyState v-else-if="!detail" :message="detailLoading ? '正在加载词条…' : ''" />

      <div v-if="detail" class="sd-def">
        <div class="sd-head">
          <div class="sd-lemma-big" :style="{ direction: cat.isG ? 'ltr' : 'rtl', textAlign: cat.isG ? 'left' : 'right' }">{{ detail.lemma }}</div>
          <div class="sd-meta">
            <span class="sd-meta-code">{{ detail.code }}</span>
            <span class="sd-tag">{{ cat.isG ? '希腊文' : '希伯来文' }}</span>
            <span v-if="detail.pos" class="sd-tag sd-pos">{{ detail.pos }}</span>
          </div>
        </div>
        <div class="sd-row"><span class="sd-k">原文词</span><span class="sd-v">{{ detail.lemma }}</span></div>
        <div class="sd-row"><span class="sd-k">音译</span><span class="sd-v">{{ detail.translit }}</span></div>
        <div class="sd-row"><span class="sd-k">词性</span><span class="sd-v">{{ detail.pos || '—' }}</span></div>
        <div class="sd-row"><span class="sd-k">简释</span><span class="sd-v sd-gloss">{{ detail.gloss }}</span></div>
        <div class="sd-def-block">
          <h3>释义（翻译者简明词典）</h3>
          <p class="sd-def-text">{{ detail.def }}</p>
        </div>
        <div v-if="detail.strong_def" class="sd-def-block sd-strong">
          <h3>司特朗原版释义</h3>
          <p class="sd-def-text">{{ detail.strong_def }}</p>
          <p v-if="detail.derivation" class="sd-deriv">词源：{{ detail.derivation }}</p>
        </div>
        <div v-if="detail.g === 1" class="sd-def-block sd-strong">
          <button class="sd-lsj-toggle" type="button" @click="openLsj" :aria-expanded="lsjOpen">
            <span class="sd-lsj-t">高级希腊词典（Full LSJ）</span>
            <span v-if="!lsjOpen" class="sd-lsj-hint">点击展开原文释义</span>
            <span class="sd-lsj-chev" :class="{ on: lsjOpen }">▾</span>
          </button>
          <div v-if="lsjOpen" class="sd-lsj-body">
            <p v-if="lsjLoading" class="sd-lsj-state">加载高级释义…</p>
            <div v-else-if="lsj" class="sd-def-text sd-lsj-html" v-html="lsj.def"></div>
            <p v-else class="sd-lsj-state">该词条暂无 LSJ 高级释义</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.sd-list,
.sd-detail {
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
.hero-kicker {
  color: var(--gold, #8b7355);
  font-size: 0.78rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 0.6rem;
}
.hero-title {
  font-size: 2.1rem;
  font-weight: 800;
  color: #1d2430;
  margin: 0 0 0.5rem;
}
.hero-sub {
  color: #6a7486;
  font-size: 0.98rem;
  line-height: 1.7;
  max-width: 60ch;
}
.sd-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1.4rem 0 0.4rem;
}
.sd-search {
  flex: 1 1 320px;
  padding: 0.7rem 1rem;
  border: 1px solid var(--line, #e2e0db);
  border-radius: 10px;
  font-size: 0.95rem;
}
.sd-search:focus {
  outline: none;
  border-color: var(--gold, #8b7355);
  box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.12);
}
.sd-filters {
  display: flex;
  gap: 0.4rem;
}
.chip {
  padding: 0.42rem 0.95rem;
  border: 1px solid var(--line, #e2e0db);
  border-radius: 999px;
  background: #fff;
  color: #5a6572;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}
.chip.on {
  background: var(--gold, #8b7355);
  border-color: var(--gold, #8b7355);
  color: #fff;
}
.sd-count {
  color: #8a94a6;
  font-size: 0.82rem;
  margin: 0.8rem 0 1rem;
}
.sd-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.7rem;
}
.sd-card {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--line, #e6e4df);
  border-radius: 12px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.sd-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(29, 36, 48, 0.08);
  border-color: rgba(139, 115, 85, 0.4);
}
.sd-card-code {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--gold, #8b7355);
  letter-spacing: 0.05em;
}
.sd-card-lemma {
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 1.2rem;
  font-weight: 700;
  direction: rtl;
  text-align: right;
  color: #1d2430;
}
.sd-card.g .sd-card-lemma {
  direction: ltr;
  text-align: left;
}
.sd-card-translit {
  font-size: 0.82rem;
  color: #8a94a6;
}
.sd-card-gloss {
  font-size: 0.82rem;
  color: #5a6572;
}
.sd-empty {
  padding: 2rem 0;
}
.sd-err {
  color: #c0392b;
  font-size: 0.9rem;
}

/* 详情 */
.sd-back {
  background: none;
  border: none;
  color: var(--gold, #8b7355);
  font-size: 0.88rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
}
.sd-back:hover {
  text-decoration: underline;
}
.sd-detail-code {
  font-size: 1.6rem;
}
.sd-lemma-big {
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: #1d2430;
  direction: rtl;
  text-align: right;
}
.sd-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.sd-meta-code {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--gold, #8b7355);
  letter-spacing: 0.04em;
}
.sd-tag {
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--line, #e2e0db);
  border-radius: 999px;
  font-size: 0.76rem;
  color: #5a6572;
}
.sd-pos {
  background: #f4f1ec;
}
.sd-def {
  margin-top: 1.2rem;
  border: 1px solid var(--line, #e6e4df);
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
}
.sd-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.4rem 1.5rem;
  border-bottom: 1px solid var(--line, #eee);
  background: linear-gradient(180deg, #faf8f4, #fff);
}
.sd-row {
  display: flex;
  gap: 0.9rem;
  padding: 0.7rem 1.5rem;
  border-bottom: 1px solid var(--line, #f0efeb);
  font-size: 0.95rem;
}
.sd-k {
  flex: 0 0 64px;
  color: #98a2b3;
  font-size: 0.82rem;
  padding-top: 0.1rem;
}
.sd-v {
  color: #2a3446;
}
.sd-gloss {
  font-weight: 600;
  color: #1d2430;
}
.sd-def-block {
  padding: 1.2rem 1.5rem 1.5rem;
}
.sd-def-block h3 {
  font-size: 0.88rem;
  color: var(--gold, #8b7355);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0 0 0.6rem;
}
.sd-def-block p {
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 1.02rem;
  line-height: 1.85;
  color: #2a3446;
}
.sd-def-text {
  white-space: pre-line;
}
.sd-strong {
  margin-top: 1rem;
  padding-top: 0.6rem;
  border-top: 1px dashed rgba(139, 115, 85, 0.3);
}
.sd-deriv {
  margin: 0.5rem 0 0;
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 0.9rem;
  line-height: 1.7;
  color: #8a94a6;
}
.sd-def-block .sd-lsj-state {
  margin: 0;
  font-size: 0.9rem;
  color: #98a2b3;
}
/* 高级希腊词典（Full LSJ）功能展开项：复用 .sd-def-block/.sd-strong 边距与分隔线，与上方词典块统一 */
.sd-lsj-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0;
  margin: 0 0 0.6rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
}
.sd-lsj-t {
  font-size: 0.88rem;
  color: var(--gold, #8b7355);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}
.sd-lsj-hint {
  font-size: 0.78rem;
  color: #a8b0bd;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}
.sd-lsj-chev {
  margin-left: auto;
  color: var(--gold, #8b7355);
  font-size: 0.85rem;
  transition: transform 0.2s;
}
.sd-lsj-chev.on {
  transform: rotate(180deg);
}
.sd-lsj-body {
  padding: 0;
}
.sd-lsj-html {
  font-family: 'Times New Roman', 'Noto Serif', serif;
  font-size: 1.02rem;
  line-height: 1.85;
  color: #2a3446;
}
.sd-lsj-html strong {
  color: #1d2430;
  font-weight: 700;
}
.sd-lsj-html em {
  color: #5a6572;
}
.sd-lsj-html .lsj-ref {
  font-size: 0.82em;
  color: #a8b0bd;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .hero-title {
    font-size: 1.6rem;
  }
}
</style>