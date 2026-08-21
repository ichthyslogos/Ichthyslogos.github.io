<script setup>
/**
 * SearchPanel — 全局搜索浮层（第一阶段：纯数据检索，无 AI）
 * 四路结果：地址跳转卡 → 实体分组（人物/地点/政权/事件/时期/注释源/主题/教会史）
 *   → 经文全文（多译本可切换，按语言懒加载）→ 注释段落（全文检索注释数据库原文件，按宗派分组）。
 * 移动端全屏、桌面居中；Esc / 遮罩 / 取消按钮关闭；输入法组合期间不触发检索。
 */
import { ref, computed, watch, nextTick, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import DictView from '../DictView.vue'
import { searchOpen, searchInitialQuery, closeSearch } from '../../lib/searchStore.js'
import { fetchCommentary, fetchCommentaryManifest } from '../../lib/data.js'
import {
  buildBookLookup,
  parseReference,
  searchEntities,
  searchScripture,
  countScripture,
  prepareScripture,
  scanCommentaryBook,
  searchStrongs,
  searchApologetics,
  snippet,
  norm,
  yearLabel,
  yearsLabel,
} from '../../lib/searchEngine.js'

const router = useRouter()

/** 站点根路径（尊重 vite base；深层路由下相对 fetch 会解析错目录，统一用根路径） */
const ROOT = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

/* 页面模式：独立结果页（非浮层）。page=true 时组件在 /search 页内联渲染（复用同一套
 * 检索逻辑），initialQuery 提供初始查询词；overlay（默认）保留全局横浮层体验。 */
const props = defineProps({
  page: { type: Boolean, default: false },
  initialQuery: { type: String, default: '' },
})

/* 页面模式：挂载即加载索引并按 initialQuery 检索（浮层模式在打开时才加载） */
onMounted(async () => {
  if (!props.page) return
  if (!index.value && !loadError.value) {
    try {
      const idx = await loadIndex()
      index.value = idx
      lookup.value = buildBookLookup(idx.books)
    } catch (e) {
      loadError.value = e.message
    }
  }
  if (props.initialQuery) query.value = props.initialQuery // 触发 watch(query) → 检索
})

/* 页面模式：路由 query 变化（组件已挂载）时同步搜索词并重新检索 */
watch(
  () => props.initialQuery,
  (v) => {
    if (props.page && v !== query.value) query.value = v
  },
)

/* ---------- 索引加载（模块级缓存，多面板实例共享） ---------- */
let indexPromise = null
const scripturePromises = new Map() // transKey -> Promise
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${ROOT}data/search/index.json`, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`索引加载失败 (${r.status})`)
      return r.json()
    })
  }
  return indexPromise
}
function loadScripture(key) {
  if (!scripturePromises.has(key)) {
    scripturePromises.set(
      key,
      fetch(`${ROOT}data/search/scripture-${key}.json`, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`${key} 索引加载失败 (${r.status})`)
          return r.json()
        })
        .catch((e) => {
          scripturePromises.delete(key)
          throw e
        }),
    )
  }
  return scripturePromises.get(key)
}

/* ---------- Strong 原文词典 / 护教问答全文（懒加载，模块级缓存） ---------- */
let strongsPromise = null
let apolPromise = null
function loadStrongs() {
  if (!strongsPromise) {
    strongsPromise = fetch(`${ROOT}data/brp/strongs-index.json`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`Strong 词典加载失败 (${r.status})`)
        return r.json()
      })
      .catch((e) => {
        strongsPromise = null
        throw e
      })
  }
  return strongsPromise
}
function loadApologetics() {
  if (!apolPromise) {
    apolPromise = fetch(`${ROOT}data/search/apologetics-search.json`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`护教问答加载失败 (${r.status})`)
        return r.json()
      })
      .catch((e) => {
        apolPromise = null
        throw e
      })
  }
  return apolPromise
}

/* ---------- Theographic 人物详情（词典摘录 + 亲属名单；一次性懒加载） ---------- */
let theoPromise = null
function loadTheoPersons() {
  if (!theoPromise) {
    theoPromise = fetch(`${ROOT}data/theographic/persons.json`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`theographic 数据加载失败 (${r.status})`)
        return r.json()
      })
      .catch((e) => {
        theoPromise = null
        throw e
      })
  }
  return theoPromise
}

/* ---------- 状态 ---------- */
const query = ref('')
const index = ref(null)
const loadError = ref('')
const lookup = ref(null)
const results = ref(null) // searchEntities 结果
const scriptureData = ref(null) // 当前译本的经文索引
const scriptureLoading = ref(false)
const scriptureResults = ref([])
const scriptureTotal = ref(0)
const verseResultsOpen = ref(false) // 全文组展开（默认收起只显示前几条）
const transKey = ref('') // 经文全文译本（空 = 按语言自动）
const commentaryResults = ref([]) // 注释段落命中（按宗派 group 聚合成组）
const commentaryLoading = ref(false)
const commentaryLoadingLabel = ref('') // 当前正在全文检索的宗派（渐进加载提示）
const expandedCommGroups = reactive(new Set()) // 注释组内「显示全部」展开的宗派
const strongsResults = ref([]) // Strong 原文词典命中
const strongsLoading = ref(false)
const apolResults = ref([]) // 护教问答命中
const apolLoading = ref(false)
const inputEl = ref(null)

/* ---------- 人物详情展开（Theographic 增强：词典 + 亲属） ---------- */
const expandedPerson = ref('') // 展开的人物 id（person_H175）
const theoPersons = ref(null) // 懒加载的增强数据（strongKey → 记录）
const theoError = ref('')

/** 强码 → 实体显示名（中文名优先） */
let personNameMap = null
function personNameOf(key) {
  if (!personNameMap) {
    personNameMap = new Map((index.value?.persons || []).map((p) => [p.id.replace(/^person_/, ''), p.zh || p.en]))
  }
  return personNameMap.get(key) || key
}

async function togglePersonDetail(p) {
  if (expandedPerson.value === p.id) {
    expandedPerson.value = ''
    return
  }
  expandedPerson.value = p.id
  if (!theoPersons.value && !theoError.value) {
    try {
      theoPersons.value = (await loadTheoPersons()).persons || {}
    } catch (e) {
      theoError.value = e.message
    }
  }
}

/** 当前展开人物的详情（词典 + 亲属名单 + 生卒年 + 首处经文；关系值为强码或英文名） */
const expandedRawPerson = computed(() =>
  (results.value?.persons || []).find((p) => p.raw.id === expandedPerson.value)?.raw || null,
)
const personDetail = computed(() => {
  if (!expandedPerson.value || !theoPersons.value) return null
  const key = expandedPerson.value.replace(/^person_/, '')
  const t = theoPersons.value[key]
  const raw = expandedRawPerson.value
  if (!t && !raw) return null
  const rel = t?.rel || {}
  const relLines = []
  if (rel.fa) relLines.push(['父亲', [rel.fa]])
  if (rel.mo) relLines.push(['母亲', [rel.mo]])
  if (rel.sp?.length) relLines.push(['配偶', rel.sp])
  if (rel.ch?.length) relLines.push(['子女', rel.ch.slice(0, 12)])
  if (rel.sb?.length) relLines.push(['兄弟姊妹', rel.sb.slice(0, 12)])
  const by = raw?.by ?? t?.by ?? null
  const dy = raw?.dy ?? t?.dy ?? null
  return {
    dict: t?.dict || '',
    relLines: relLines.map(([label, vals]) => `${label}：${vals.map(personNameOf).join('、')}`),
    years: yearsLabel(by, dy),
    appear: raw?.n || t?.vc || 0,
    firstRef: firstRefLabel(raw?.first),
    firstRaw: raw,
  }
})

/** 书:章:节 → 中文名显示（如 43:3:16 → 约翰福音 3:16） */
function firstRefLabel(first) {
  if (!first) return ''
  const [bookId, ch, vs] = String(first).split(':')
  const b = (index.value?.books || []).find((x) => x.id === bookId)
  if (!b) return ''
  return `${b.zh} ${ch}${vs ? ':' + vs : ''}`
}

let debounceTimer = 0
let composing = false

/** query 是否含 CJK（决定全文索引默认译本语言） */
const isCjk = computed(() => /[\u4e00-\u9fff]/.test(query.value))

/** 可选译本列表（和合本简体优先于和合本繁体，其余保持原序） */
const transList = computed(() => {
  const list = index.value?.translations || []
  const rank = { chisim: 0, chiun: 1, chisb: 2 }
  return [...list].sort((a, b) => (rank[a.key] ?? 9) - (rank[b.key] ?? 9))
})
function autoTransKey() {
  const list = transList.value
  if (!list.length) return ''
  const want = isCjk.value ? 'zh' : 'latin'
  const preferred = isCjk.value ? 'chisim' : 'niv'
  return list.find((t) => t.key === preferred)?.key || list.find((t) => t.lang === want)?.key || list[0].key
}
const activeTrans = computed(() => transList.value.find((t) => t.key === transKey.value) || null)

/** 注释段落全文检索源清单（按宗派分组展示顺序）；书籍覆盖范围取注释数据库 manifest */
const COMMENTARY_SEARCH_GROUPS = [
  { group: '马太亨利', pairs: [['fullCommentary', 'matthew-henry-en']] },
  { group: '马太亨利简明', pairs: [['summary', 'mhcc'], ['interpretation', 'mhcc']] },
  {
    group: '其他注释源',
    pairs: [
      ['fullCommentary', 'calvin'],
      ['fullCommentary', 'rwp'],
      ['fullCommentary', 'abbott'],
      ['fullCommentary', 'catena'],
    ],
  },
]

/* 宗派分组（展示顺序）与注解源显示名 */
const GROUP_ORDER = ['马太亨利', '马太亨利简明', '其他注释源']
const SRC_LABEL = {
  'fullCommentary|matthew-henry-en': '马太亨利 · 全书本',
  'summary|mhcc': '马太亨利简明 · 总结',
  'interpretation|mhcc': '马太亨利简明 · 经文解释',
  'fullCommentary|calvin': '加尔文',
  'fullCommentary|rwp': '罗伯逊（RWP）',
  'fullCommentary|abbott': '阿博特（Abbott）',
  'fullCommentary|catena': '经文汇编（Catena）',
}
function commSrcName(s) {
  return SRC_LABEL[`${s.cat}|${s.key}`] || s.key
}

/** 解析注释全文检索计划（manifest 源清单 → 逐宗派的 (category, key, 覆盖书卷)），一次解析后缓存 */
let commentaryPlan = null
async function resolveCommentaryPlan() {
  if (commentaryPlan) return commentaryPlan
  const m = await fetchCommentaryManifest()
  const plan = COMMENTARY_SEARCH_GROUPS.map((g) => ({
    group: g.group,
    sources: g.pairs
      .map(([cat, key]) => {
        const src = (m.sources || []).find((s) => s.category === cat && s.key === key)
        return src ? { cat, key, books: src.books || [] } : null
      })
      .filter(Boolean),
  })).filter((g) => g.sources.length)
  commentaryPlan = plan
  return plan
}

/* 注释结果按宗派分组（每组成默认收起只列前几条，可逐个「显示全部」展开） */
const COMM_GROUP_SHOW = 6
const commentaryGroups = computed(() => {
  const g = new Map()
  for (const s of commentaryResults.value) {
    const k = s.group && GROUP_ORDER.includes(s.group) ? s.group : GROUP_ORDER[GROUP_ORDER.length - 1]
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(s)
  }
  const ordered = GROUP_ORDER.filter((k) => g.has(k))
  for (const k of g.keys()) if (!ordered.includes(k)) ordered.push(k)
  return ordered.map((k) => {
    const all = g.get(k)
    const shown = expandedCommGroups.has(k) ? all.length : Math.min(COMM_GROUP_SHOW, all.length)
    return { group: k, items: all.slice(0, shown), total: all.length, expanded: shown >= all.length }
  })
})
function toggleCommGroup(k) {
  expandedCommGroups.has(k) ? expandedCommGroups.delete(k) : expandedCommGroups.add(k)
}
/** 经文全文组展开/收起（展开时显示全部命中，收起回到前几条），再触发一次检索刷新 */
function toggleScripture() {
  verseResultsOpen.value = !verseResultsOpen.value
  runSearch()
}

/* ---------- 检索执行（防抖 + 组合输入保护） ---------- */
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 160)
})

let searchSeq = 0
/** 清空全部检索结果与加载态（空查询/关闭面板时调用；索引缓存保留以便快速重搜） */
function clearResults() {
  refHit.value = null
  results.value = null
  scriptureResults.value = []
  scriptureTotal.value = 0
  commentaryResults.value = []
  strongsResults.value = []
  strongsLoading.value = false
  apolResults.value = []
  apolLoading.value = false
}
async function runSearch() {
  if (composing) return
  const q = query.value.trim()
  if (!index.value || !q) {
    clearResults()
    return
  }
  const seq = ++searchSeq
  // 实体检索（同步，内存索引）
  results.value = searchEntities(q, index.value, verseResultsOpen.value ? 20 : 8)
  // 经文地址解析
  refHit.value = parseReference(q, lookup.value)
  // Strong 原文词典 / 护教问答全文（懒加载；与经文全文并行，失败不阻塞）
  runStrongsAndApol()
  // 经文全文（按语言懒加载索引；英文 ≥2 字符，中文 ≥1 字）
  await ensureScripture()
  if (seq !== searchSeq) return
  if (scriptureData.value) {
    scriptureTotal.value = countScripture(q, scriptureData.value)
    scriptureResults.value = searchScripture(q, scriptureData.value, { limit: verseResultsOpen.value ? scriptureTotal.value : 5 })
  }
  // 注释段落（全文检索注释数据库原文件，按宗派分组渐进加载；失败不阻塞）
  runCommentary()
}

/** Strong 原文词典 + 护教问答全文检索（懒加载数据；seq 过期结果丢弃，失败不阻塞） */
async function runStrongsAndApol() {
  const q = query.value.trim()
  const seq = searchSeq
  const counts = index.value?.meta?.counts || {}
  if (counts.strongs > 0) {
    strongsLoading.value = true
    try {
      const d = await loadStrongs()
      if (seq !== searchSeq) return
      strongsResults.value = searchStrongs(q, d)
    } catch {
      if (seq === searchSeq) strongsResults.value = []
    } finally {
      if (seq === searchSeq) strongsLoading.value = false
    }
  }
  if (counts.apolQuestions > 0) {
    apolLoading.value = true
    try {
      const d = await loadApologetics()
      if (seq !== searchSeq) return
      apolResults.value = searchApologetics(q, d)
    } catch {
      if (seq === searchSeq) apolResults.value = []
    } finally {
      if (seq === searchSeq) apolLoading.value = false
    }
  }
}

const refHit = ref(null)

/** 按需加载当前译本全文索引（只加载一次，模块级缓存；拉丁单字符不触发） */
async function ensureScripture() {
  const q = query.value.trim()
  if (!transKey.value) transKey.value = autoTransKey()
  const key = transKey.value
  if (!key) return
  if (scriptureData.value?._key === key) return
  if (!isCjk.value && q.replace(/[^a-z0-9]/gi, '').length < 2) {
    scriptureData.value = null
    scriptureResults.value = []
    scriptureTotal.value = 0
    return
  }
  scriptureLoading.value = true
  try {
    const d = await loadScripture(key)
    prepareScripture(d)
    d._key = key
    scriptureData.value = d
  } catch {
    scriptureData.value = null
  } finally {
    scriptureLoading.value = false
  }
}

/** 并发限制：避免一次性向服务器发起上百个注释请求（连接池耗尽 → ERR_ABORTED / ERR_CONNECTION_RESET） */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

/** 注释段落全文检索：直接调用注释数据库原文件（data/brp/commentary/<cat>/<key>/<bookId>.json），
 * 按宗派分组渐进加载（每组加载完即追加显示）。命中项含 group/key/cat 供分组与来源标注。
 * 命中文本仅存命中项（heading + 摘录），完整注释跳读经页查看。 */
async function runCommentary() {
  const q = query.value.trim()
  const nq = norm(q)
  // 中文 ≥1 字、拉丁 ≥2 字符才执行（避免单字母命中海量段落）
  if (!nq || (!isCjk.value && q.replace(/[^a-z0-9]/gi, '').length < 2)) {
    commentaryResults.value = []
    commentaryLoading.value = false
    commentaryLoadingLabel.value = ''
    return
  }
  let plan
  try {
    plan = await resolveCommentaryPlan()
  } catch {
    commentaryLoading.value = false
    return
  }
  const seq = searchSeq
  if (seq !== searchSeq) return
  commentaryResults.value = []
  expandedCommGroups.clear()
  commentaryLoading.value = true
  try {
    for (const g of plan) {
      if (seq !== searchSeq) return
      commentaryLoadingLabel.value = g.group
      const groupHits = []
      for (const s of g.sources) {
        if (seq !== searchSeq) return
        // 同源全部覆盖书卷按批次拉取（注释数据库原文件；fetchCommentary 内部有内存缓存）
        const datas = await mapLimit(s.books, 6, (bookId) => fetchCommentary(s.key, bookId, s.cat).catch(() => null))
        if (seq !== searchSeq) return
        for (const data of datas) {
          if (!data || !data.chapters) continue
          const hits = scanCommentaryBook(data, nq, q)
          for (const h of hits) { h.group = g.group; h.key = s.key; h.cat = s.cat }
          groupHits.push(...hits)
        }
      }
      if (groupHits.length) {
        commentaryResults.value = commentaryResults.value.concat(groupHits)
        await nextTick()
      }
    }
  } finally {
    if (seq === searchSeq) {
      commentaryLoading.value = false
      commentaryLoadingLabel.value = ''
    }
  }
}

/** 译本切换：清空当前全文数据，重跑检索 */
function pickTrans(key) {
  transKey.value = key
  scriptureData.value = null
  scriptureResults.value = []
  scriptureTotal.value = 0
  runSearch()
}

/* ---------- 面板开关 ---------- */
watch(searchOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    // 消费首页/入口预填的关键词（一次性：读取后清空）
    if (searchInitialQuery.value) {
      query.value = searchInitialQuery.value
      searchInitialQuery.value = ''
    }
    await nextTick()
    inputEl.value?.focus()
    if (index.value && query.value.trim()) {
      // 索引已在内存：直接按（预填）关键词检索
      runSearch()
    }
    if (!index.value && !loadError.value) {
      try {
        const idx = await loadIndex()
        index.value = idx
        lookup.value = buildBookLookup(idx.books)
        if (query.value.trim()) runSearch()
      } catch (e) {
        loadError.value = e.message
      }
    }
  } else {
    clearTimeout(debounceTimer)
    // 关闭即清空搜索数据（下次打开回到空态；索引缓存保留以便快速重搜）
    query.value = ''
    clearResults()
    verseResultsOpen.value = false
    transKey.value = ''
    scriptureData.value = null
    commentaryLoadingLabel.value = ''
    expandedCommGroups.clear()
    expandedPerson.value = ''
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  clearTimeout(debounceTimer)
})

/* ---------- 键盘：Esc 关闭 ---------- */
function onKeydown(e) {
  if (e.key === 'Escape' && searchOpen.value) closeSearch()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function close() {
  closeSearch()
}

/** 页面模式：回到首页 */
function goHome() {
  router.push('/')
}

/* ---------- 跳转 ---------- */
function go(path) {
  close()
  router.push(path)
}
function goRef(hit) {
  go(`/brp/${hit.bookId}/${hit.chapter}${hit.verse ? `?v=${hit.verse}` : ''}`)
}
function goPerson(p) {
  // first = 书:章:节（含节号）→ ?v= 深链高亮该节
  const [bookId, ch, vs] = (p.first || '01:1').split(':')
  go(`/brp/${bookId}/${ch || 1}${vs ? `?v=${vs}` : ''}`)
}
/** 人物词条页（/persons/:id；id = 归一化强码） */
function goPersonPage(p) {
  if (!p?.id) return
  go(`/persons/${encodeURIComponent(p.id.replace(/^person_/, ''))}`)
}
function goPlace(p) {
  if (p.lat != null && p.lng != null) {
    go(`/map?focus=${encodeURIComponent(p.en)}&fl=${encodeURIComponent(p.zh || p.en)}`)
  } else {
    goPerson(p)
  }
}
function goPolity(p) {
  go(p.ps && p.ps.length ? `/map?period=${p.ps[0]}` : '/map')
}
function goEvent(e) {
  go(e.p ? `/map?period=${e.p}` : '/map')
}
function goTimeline(t) {
  if (!t.first) return go('/brp')
  const [bookId, ch, vs] = t.first.split(':')
  go(`/brp/${bookId}/${ch || 1}${vs ? `?v=${vs}` : ''}`)
}
function goPeriod(p) {
  go(`/map?period=${p.id}`)
}
function goCommentary() {
  go('/brp')
}
/** Strong 词典词条页 */
function goStrong(s) {
  go(`/strongs/${encodeURIComponent(s.code)}`)
}
/** 护教专题：深链到该主题论证图 */
function goApol(a) {
  go(`/apologetics?topic=${encodeURIComponent(a.topicId)}`)
}
function goHistory(h) {
  go(`/history/${h.part}/${h.no}`)
}
function goProphecy(p) {
  go(`/prophecies/${encodeURIComponent(p.raw.id)}`)
}
function goCommentarySec(s) {
  const b = (index.value?.books || []).find((x) => x.id === s.bookId)
  if (!b) return
  go(`/brp/${b.id}/${s.chapter}${s.ref ? `?v=${String(s.ref).split(',')[0]}` : ''}`)
}
function commSecAddr(s) {
  const b = (index.value?.books || []).find((x) => x.id === s.bookId)
  if (!b) return ''
  return `${b.zh} ${s.chapter}${s.ref ? `:${s.ref}` : ''}`
}

function goVerse(v) {
  const b = index.value?.books?.[v.bookIndex]
  if (!b) return
  go(`/brp/${b.id}/${v.chapter}?v=${v.verse}`)
}
function verseAddr(v) {
  const b = index.value?.books?.[v.bookIndex]
  if (!b) return ''
  // 章节名与译本语言统一：中文译本显示中文书名，拉丁译本显示英文书名
  const name = activeTrans.value?.lang === 'zh' ? b.zh : b.en
  return `${name} ${v.chapter}:${v.verse}`
}

/* ---------- 渲染辅助 ---------- */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** 命中高亮：仅当原文（未归一化）小写包含查询串时标记，绝不改变文本内容 */
function mark(text, q) {
  const t = String(text ?? '')
  const lower = t.toLowerCase()
  const needle = q.trim().toLowerCase()
  if (!needle) return esc(t)
  const i = lower.indexOf(needle)
  if (i < 0) return esc(t)
  return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + needle.length)) + '</mark>' + esc(t.slice(i + needle.length))
}

const hasResults = computed(() => {
  const r = results.value
  return !!(
    refHit.value ||
    (r && r.total > 0) ||
    scriptureResults.value.length ||
    commentaryResults.value.length ||
    strongsResults.value.length ||
    apolResults.value.length ||
    scriptureLoading.value ||
    commentaryLoading.value ||
    strongsLoading.value ||
    apolLoading.value
  )
})

/* ---------- 人物：每个同名者独立成母词条；别称常显（无需展开）；历史时期作子词条 ---------- */
function firstLabel(first) {
  if (!first) return ''
  const [bid, ch, v] = first.split(':')
  const b = (index.value?.books || []).find((x) => x.id === bid)
  return `${b ? b.zh || b.en : bid} ${ch}${v ? ':' + v : ''}`
}
/** 时期 id → 显示名（亚伯拉罕时期 / 耶稣时期 / 保罗宣教时期 …） */
function periodName(key) {
  const found = (index.value?.periods || []).find((p) => p.id === key)
  return found ? found.name : key
}
/** 每个同名人都是独立母词条：人名 + 别名（常显）+ 区分信息（子词条：历史时期） */
const personRows = computed(() => {
  const list = results.value?.persons || []
  const pProph = results.value?.personProphecies || {}
  return list.map((item) => {
    const raw = item.raw
    return {
      id: raw.id,
      title: item.title,
      en: raw.en,
      zh: raw.zh,
      bio: raw.b,
      aliases: raw.al || [],
      periods: (raw.ps || []).map((k) => ({ id: k, name: periodName(k) })),
      timeline: timelineOf(raw.s),
      tlShowAll: personTimelineOpen.has(raw.id),
      props: pProph[raw.id] || [],
      propsShowAll: personProphecyOpen.has(raw.id),
      first: raw.first,
      sub: [
        raw.zh && raw.en !== raw.zh ? raw.en : '',
        raw.b ? (raw.b.length > 36 ? raw.b.slice(0, 36) + '…' : raw.b) : '',
        yearsLabel(raw.by, raw.dy),
        raw.n ? `${raw.n} 处` : '',
        raw.first ? `首现 ${firstLabel(raw.first)}` : '',
      ].filter(Boolean).join(' · '),
    }
  })
})
const personTotalCount = computed(() => personRows.value.length)
/** 前往该历史时期地图 */
function goPeriodKey(p) {
  go(`/map?period=${encodeURIComponent(p.id)}`)
}

/* ---------- 编年时间线 ↔ 人物匹配：事件 ppl(强码) → 人物 s(强码) ---------- */
const TL_SHOW = 4
const PROPH_SHOW = 4
const personTimelineOpen = reactive(new Set()) // 展开「显示全部」时间线的人物 id
const personProphecyOpen = reactive(new Set()) // 展开「显示全部」相关预言的人物 id
let timelineIndex = null // normStrong(code) -> 事件[]
/** Strong 码去前导零（H0121G → H121G），人物 s 与事件 ppl 格式对齐 */
function normStrong(c) {
  const m = String(c || '').trim().match(/^([A-Za-z]+)(\d+)(.*)$/)
  return m ? m[1] + String(Number(m[2])) + m[3] : String(c || '').trim()
}
function buildTimelineIndex() {
  if (timelineIndex) return timelineIndex
  const idx = new Map()
  for (const ev of index.value?.timeline || []) {
    for (const code of ev.ppl || []) {
      const k = normStrong(code)
      if (!k) continue
      if (!idx.has(k)) idx.set(k, [])
      idx.get(k).push(ev)
    }
  }
  timelineIndex = idx
  return idx
}
function timelineOf(s) {
  return (buildTimelineIndex().get(normStrong(s)) || [])
    .slice()
    .sort((a, b) => (a.y || 0) - (b.y || 0))
}
function togglePersonTimeline(pg) {
  personTimelineOpen.has(pg.id) ? personTimelineOpen.delete(pg.id) : personTimelineOpen.add(pg.id)
}
function togglePersonProphecies(pg) {
  personProphecyOpen.has(pg.id) ? personProphecyOpen.delete(pg.id) : personProphecyOpen.add(pg.id)
}

const GROUPS = computed(() => {
    const r = results.value
    if (!r) return []
    const defs = [
      { key: 'places', icon: '📍', label: '地点', items: r.places, act: goPlace, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'polities', icon: '🏛', label: '政权 / 区域', items: r.polities, act: goPolity, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'periods', icon: '⏳', label: '历史时期', items: r.periods, act: goPeriod, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'events', icon: '📜', label: '事件 / 旅程', items: r.events, act: goEvent, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'prophecies', icon: '🔯', label: '预言 / 应验', items: r.prophecies, act: goProphecy, actIcon: '🔍', actTitle: '查看预言' },
      { key: 'history', icon: '⛪', label: '教会历史', items: r.history, act: goHistory, actIcon: '📄', actTitle: '阅读该章' },
      { key: 'commentaries', icon: '📚', label: '注释源', items: r.commentaries, act: goCommentary, actIcon: '📖', actTitle: '前往读经页' },
    ]
    return defs.filter((d) => d.items.length > 0)
  })

const QUICK = [
  { t: '约3:16', q: '约3:16' },
  { t: '亚伯拉罕', q: '亚伯拉罕' },
  { t: '耶路撒冷', q: '耶路撒冷' },
  { t: '出埃及', q: '出埃及' },
  { t: 'Love', q: 'love' },
]
function quick(q) {
  query.value = q
}

/* 输入法组合保护 */
function onCompositionStart() {
  composing = true
}
function onCompositionEnd() {
  composing = false
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 160)
}
</script>

<template>
  <Teleport to="body" :disabled="page">
    <Transition name="sp" :css="!page">
      <div
        v-if="page || searchOpen"
        :class="page ? 'srch-page' : 'sp-mask'"
        @click.self="!page && close()"
      >
        <div
          class="sp-panel"
          :class="page ? 'sp-panel--page' : ''"
          :role="page ? undefined : 'dialog'"
          :aria-modal="page ? undefined : 'true'"
          :aria-label="page ? undefined : '全局搜索'"
        >
          <header class="sp-head">
            <span class="sp-ico" aria-hidden="true">🔍</span>
            <input
              ref="inputEl"
              v-model="query"
              class="sp-input"
              type="text"
              inputmode="search"
              enterkeyhint="search"
              autocomplete="off"
              spellcheck="false"
              placeholder="经文地址、人物、地点、政权、时期、事件…"
              aria-label="搜索"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
              @keydown.enter.prevent="runSearch"
            />
            <button v-if="query" class="sp-clear" aria-label="清空" @click="query = ''">
              <span aria-hidden="true">×</span>
            </button>
            <button v-if="page" class="sp-close" aria-label="回到首页" @click="goHome">回到首页</button>
            <button v-else class="sp-close" aria-label="关闭搜索" @click="close">取消</button>
          </header>

          <div class="sp-body">
            <div v-if="loadError" class="sp-error">索引加载失败：{{ loadError }}</div>

            <!-- 空态：快捷示例 + 能力说明 -->
            <div v-else-if="!query.trim()" class="sp-empty">
              <div class="sp-quick">
                <button v-for="qk in QUICK" :key="qk.q" class="sp-chip" @click="quick(qk.q)">{{ qk.t }}</button>
              </div>
              <ul class="sp-tips">
                <li>📖 输入经文地址直达：<code>约3:16</code> / <code>约翰福音 3 章 16 节</code> / <code>John 3:16</code></li>
                <li>👤 实体检索：人物 / 地点 / 政权 / 时期 / 事件 / 主题 / 教会史（TIPNR · Pleiades · MARBLE）</li>
                <li>🔎 经文全文：多译本可切换（和合本/和合本简/思高本/NIV/KJV/ASV/DRC…，简繁互通）</li>
                <li>📖 原文词典：Strong 希腊文 lemma / 转写 / 英文 gloss / 强码（如 <code>G2316</code> / <code>theos</code>）</li>
                <li>🧭 护教论证：主题 + 子问题全文检索，直接呈现完整逻辑链条（命题 → 质疑 → 回应 → 证据，如 <code>进化论</code> / <code>正典</code>）</li>
                <li>📚 注释段落：Matthew Henry / Calvin / RWP / Abbott / Catena / MH 简明</li>
              </ul>
            </div>

            <template v-else>
              <!-- 1. 地址跳转卡 -->
              <button v-if="refHit" class="sp-refcard" @click="goRef(refHit)">
                <span class="sp-ref-ico" aria-hidden="true">📖</span>
                <span class="sp-ref-main">
                  <strong v-html="mark(refHit.label, query)"></strong>
                  <small>前往{{ refHit.book.zh }}{{ refHit.verse ? ` ${refHit.chapter}:${refHit.verse}` : ` 第 ${refHit.chapter} 章` }}</small>
                </span>
                <span class="sp-ref-go" aria-hidden="true">→</span>
              </button>

              <!-- 2a. 人物（每个同名者独立为母词条；别称常显无需展开；历史时期作子词条） -->
              <section v-if="personRows.length" class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">👤</span>人物
                  <span class="sp-group-n">{{ personTotalCount }}</span>
                </h3>
                <ul class="sp-list">
                  <li v-for="pg in personRows" :key="pg.id">
                    <button class="sp-item" :class="{ open: expandedPerson === pg.id }" @click="togglePersonDetail(pg)">
                      <span class="sp-item-main">
                        <strong class="sp-item-t" v-html="mark(pg.title, query)"></strong>
                        <small v-if="pg.sub" class="sp-item-sub" v-html="mark(pg.sub, query)"></small>
                      </span>
                      <span class="sp-item-act" aria-hidden="true">ⓘ</span>
                    </button>

                    <!-- 别称：无需展开即可看见 -->
                    <div v-if="pg.aliases.length" class="sp-pmeta">
                      <span class="sp-pmeta-k">别称</span>
                      <span v-for="a in pg.aliases" :key="a" class="sp-pmeta-chip" v-html="mark(a, query)"></span>
                    </div>

                    <!-- 历史时期：子词条（点击前往该时期地图） -->
                    <div v-if="pg.periods.length" class="sp-pmeta">
                      <span class="sp-pmeta-k">时期</span>
                      <button
                        v-for="pd in pg.periods"
                        :key="pd.id"
                        class="sp-pmeta-chip sp-pmeta-link"
                        @click="goPeriodKey(pd)"
                      >{{ pd.name }}</button>
                    </div>

                    <!-- 展开介绍：紧跟人物下方第一个位置（时间线/相关预言之前） -->
                    <div v-if="expandedPerson === pg.id" class="sp-pdetail">
                      <template v-if="personDetail">
                        <div v-if="personDetail.years || personDetail.appear || personDetail.firstRef" class="sp-pdetail-meta">
                          <span v-if="personDetail.years">{{ personDetail.years }}</span>
                          <span v-if="personDetail.appear">出现 {{ personDetail.appear }} 次</span>
                          <span v-if="personDetail.firstRef">首现 {{ personDetail.firstRef }}</span>
                        </div>
                        <div v-if="personDetail.relLines.length" class="sp-pdetail-rel">
                          <div v-for="(line, i) in personDetail.relLines" :key="i">{{ line }}</div>
                        </div>
                        <DictView v-if="personDetail.dict" :text="personDetail.dict" />
                        <div
                          v-if="!personDetail.relLines.length && !personDetail.dict && !personDetail.years && !personDetail.firstRef"
                          class="sp-pdetail-none"
                        >暂无词典与亲属数据</div>
                        <div class="sp-pdetail-acts">
                          <button v-if="personDetail.firstRaw?.first" class="sp-pdetail-btn" @click="goPerson(personDetail.firstRaw)">📖 首处经文{{ personDetail.firstRef ? `（${personDetail.firstRef}）` : '' }}</button>
                          <button class="sp-pdetail-btn" @click="goPersonPage(personDetail.firstRaw)">📄 人物词条</button>
                        </div>
                      </template>
                      <div v-else-if="theoError" class="sp-pdetail-none">详情数据加载失败</div>
                      <div v-else class="sp-pdetail-none">加载中…</div>
                      <div class="sp-pdetail-src">Easton 词典 · Theographic（传统编年）</div>
                    </div>

                    <!-- 编年时间线：与人物匹配的相关事件（点击前往经文） -->
                    <template v-if="pg.timeline.length">
                      <div class="sp-pmeta sp-pperiod">
                        <span class="sp-pmeta-k">编年时间线</span>
                        <span class="sp-pmeta-count">{{ pg.timeline.length }} 条</span>
                      </div>
                      <ul class="sp-tlist">
                        <li
                          v-for="tl in (pg.tlShowAll ? pg.timeline : pg.timeline.slice(0, TL_SHOW))"
                          :key="tl.id"
                        >
                          <button class="sp-tl-item" @click="goTimeline(tl)">
                            <span class="sp-tl-z" v-html="mark(tl.z, query)"></span>
                            <span class="sp-tl-y">{{ yearLabel(tl.y) }}</span>
                          </button>
                        </li>
                      </ul>
                      <button
                        v-if="pg.timeline.length > TL_SHOW"
                        class="sp-more"
                        @click="togglePersonTimeline(pg)"
                      >{{ pg.tlShowAll ? '收起' : `显示全部 ${pg.timeline.length} 条` }}</button>
                    </template>

                    <!-- 相关预言：命中的预言挂到对应人物下（并从「预言 / 应验」组原位移除） -->
                    <template v-if="pg.props.length">
                      <div class="sp-pmeta sp-pperiod">
                        <span class="sp-pmeta-k">相关预言</span>
                        <span class="sp-pmeta-count">{{ pg.props.length }} 条</span>
                      </div>
                      <ul class="sp-tlist">
                        <li
                          v-for="ph in (pg.propsShowAll ? pg.props : pg.props.slice(0, PROPH_SHOW))"
                          :key="ph.raw.id"
                        >
                          <button class="sp-tl-item" @click="goProphecy(ph)">
                            <span class="sp-tl-z" v-html="mark(ph.title, query)"></span>
                            <span class="sp-tl-y" v-if="ph.raw.ot">{{ ph.raw.ot }}</span>
                          </button>
                        </li>
                      </ul>
                      <button
                        v-if="pg.props.length > PROPH_SHOW"
                        class="sp-more"
                        @click="togglePersonProphecies(pg)"
                      >{{ pg.propsShowAll ? '收起' : `显示全部 ${pg.props.length} 条` }}</button>
                    </template>
                    </li>
                  </ul>
                </section>

              <!-- 2. 实体分组 -->
              <section v-for="g in GROUPS" :key="g.key" class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">{{ g.icon }}</span>{{ g.label }}
                  <span class="sp-group-n">{{ g.items.length }}</span>
                </h3>
                <ul class="sp-list">
                  <li v-for="item in g.items" :key="item.raw.id">
                    <button
                      class="sp-item"
                      :title="g.actTitle"
                      @click="g.act(item.raw)"
                    >
                      <span class="sp-item-main">
                        <strong class="sp-item-t" v-html="mark(item.title, query)"></strong>
                        <small v-if="item.sub" class="sp-item-sub" v-html="mark(item.sub, query)"></small>
                      </span>
                      <span class="sp-item-act" aria-hidden="true">{{ g.actIcon }}</span>
                    </button>
                  </li>
                </ul>
              </section>

              <!-- 2b. 原文词典（Strong：希腊文 lemma / 转写 / 英文 gloss / 强码） -->
              <section class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">📖</span>原文词典
                  <span class="sp-group-n" v-if="strongsResults.length">{{ strongsResults.length }}</span>
                </h3>
                <div v-if="strongsLoading" class="sp-loading">正在加载 Strong 原文词典…</div>
                <template v-else-if="strongsResults.length">
                  <ul class="sp-list">
                    <li v-for="s in strongsResults" :key="s.code">
                      <button class="sp-item" title="查看词典" @click="goStrong(s)">
                        <span class="sp-item-main">
                          <strong class="sp-item-t">
                            <span class="sp-strong-code">{{ s.code }}</span>
                            <span class="sp-strong-lemma" v-html="mark(s.lemma, query)"></span>
                            <span v-if="s.translit" class="sp-strong-translit" v-html="mark(s.translit, query)"></span>
                          </strong>
                          <small v-if="s.gloss" class="sp-item-sub" v-html="mark(s.gloss, query)"></small>
                        </span>
                        <span class="sp-item-act" aria-hidden="true">🔍</span>
                      </button>
                    </li>
                  </ul>
                </template>
                <div v-else-if="index && !strongsLoading" class="sp-none">无原文词典命中</div>
              </section>

              <!-- 3. 护教论证（主题 + 子问题全文合并；护教页同款逻辑链条可视化） -->
              <section class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">🧭</span>护教论证
                  <span class="sp-group-n" v-if="apolResults.length">{{ apolResults.length }}</span>
                </h3>
                <div v-if="apolLoading" class="sp-loading">正在检索护教论证图谱…</div>
                <template v-else-if="apolResults.length">
                  <ul class="sp-list">
                    <li v-for="(a, i) in apolResults" :key="a.topicId + i">
                      <button class="sp-item sp-apol" title="打开该主题论证图谱" @click="goApol(a)">
                        <span class="sp-item-main">
                          <span class="sp-apol-topic">
                            <span class="sp-apol-topic-t" v-html="mark(a.topicZh, query)"></span>
                            <span v-if="a.topicEn" class="sp-apol-topic-en" v-html="mark(a.topicEn, query)"></span>
                            <span v-if="a.tags?.length" class="sp-apol-tags">{{ a.tags.join(' · ') }}</span>
                          </span>
                          <span v-if="a.chain" class="sp-apol-chain">
                            <!-- 命题 -->
                            <span class="apol-node n-claim">
                              <span class="apol-chip c-claim">命题</span>
                              <span class="apol-node-text" v-html="mark(a.chain.question || a.topicZh, query)"></span>
                            </span>
                            <!-- 质疑 -->
                            <template v-if="a.chain.objection">
                              <span class="apol-edge refutes"><span class="apol-edge-line"></span><span class="apol-edge-label">反驳</span></span>
                              <span class="apol-node n-objection">
                                <span class="apol-chip c-objection">质疑</span>
                                <span class="apol-node-text" v-html="mark(a.chain.objection, query)"></span>
                              </span>
                            </template>
                            <!-- 回应 -->
                            <template v-if="a.chain.summary || a.chain.text">
                              <span class="apol-edge responds"><span class="apol-edge-line"></span><span class="apol-edge-label">回应</span></span>
                              <span class="apol-node n-response">
                                <span class="apol-chip c-response">回应</span>
                                <span class="apol-node-text" v-html="mark(a.chain.summary || a.chain.text, query)"></span>
                              </span>
                            </template>
                            <!-- 证据 -->
                            <template v-if="a.chain.evidence.length">
                              <span class="apol-edge evidences"><span class="apol-edge-line"></span><span class="apol-edge-label">提供证据</span></span>
                              <span v-for="(e, j) in a.chain.evidence.slice(0, 3)" :key="j" class="apol-node n-evidence">
                                <span class="apol-chip c-evidence">{{ e.label }}</span>
                                <span class="apol-node-text">
                                  <span class="apol-ref" v-html="mark(e.ref, query)"></span>
                                  <template v-if="e.note"> — <span v-html="mark(e.note, query)"></span></template>
                                </span>
                              </span>
                            </template>
                          </span>
                        </span>
                        <span class="sp-item-act" aria-hidden="true">🧭</span>
                      </button>
                    </li>
                  </ul>
                </template>
                <div v-else-if="index && !apolLoading" class="sp-none">无护教论证命中</div>
              </section>

              <!-- 3b. 经文全文（多译本切换） -->
              <section class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">🔎</span>经文全文
                  <span class="sp-group-n" v-if="scriptureTotal">{{ scriptureTotal }}</span>
                </h3>
                <!-- 译本切换条（横向滚动；移动端不溢出） -->
                <div v-if="transList.length > 1" class="sp-trans" role="group" aria-label="选择译本">
                  <button
                    v-for="t in transList"
                    :key="t.key"
                    :class="{ active: t.key === transKey }"
                    @click="pickTrans(t.key)"
                  >{{ t.name }}</button>
                </div>
                <div v-if="scriptureLoading" class="sp-loading">正在加载{{ activeTrans?.name || '' }}全文索引…</div>
                <template v-else-if="scriptureResults.length">
                  <ul class="sp-list" :class="{ 'sp-open': verseResultsOpen }">
                    <li v-for="(v, i) in scriptureResults" :key="i">
                      <button class="sp-item sp-verse" @click="goVerse(v)">
                        <span class="sp-item-main">
                          <strong class="sp-item-addr">{{ verseAddr(v) }}</strong>
                          <small class="sp-item-text" v-html="mark(v.text, query)"></small>
                        </span>
                      </button>
                    </li>
                  </ul>
                  <button
                    v-if="scriptureResults.length && (verseResultsOpen || scriptureTotal > scriptureResults.length)"
                    class="sp-more"
                    @click="toggleScripture()"
                  >
                    {{ verseResultsOpen ? '收起' : `显示全部 ${scriptureTotal} 处` }}
                  </button>
                </template>
                <div v-else-if="index && !scriptureLoading" class="sp-none">无经文命中</div>
              </section>

              <!-- 4. 注释段落（按宗派分组；heading + 摘录，跳读经页看完整注释） -->
              <section class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">📚</span>注释段落
                  <span class="sp-group-n" v-if="commentaryResults.length">{{ commentaryResults.length }}</span>
                </h3>
                <div v-if="commentaryLoading" class="sp-loading">正在全文检索注释数据库[{{ commentaryLoadingLabel || '…' }}]…</div>
                <template v-else-if="commentaryResults.length">
                  <div v-for="cg in commentaryGroups" :key="cg.group" class="sp-cmg">
                    <h4 class="sp-cmg-h" @click="toggleCommGroup(cg.group)">
                      <span class="sp-cmg-caret">{{ cg.expanded ? '▾' : '▸' }}</span>{{ cg.group }}<span class="sp-group-n">{{ cg.total }}</span>
                    </h4>
                    <ul class="sp-list" :class="{ 'sp-open': cg.expanded }">
                      <li v-for="(s, i) in cg.items" :key="cg.group + i">
                        <button class="sp-item sp-verse" @click="goCommentarySec(s)">
                          <span class="sp-item-main">
                            <strong class="sp-item-addr">{{ commSecAddr(s) }}</strong>
                            <small v-if="s.heading" class="sp-item-cmhead" v-html="mark(s.heading, query)"></small>
                            <small class="sp-item-text" v-html="mark(s.snippet || s.text, query)"></small>
                            <small class="sp-item-cmsrc">{{ commSrcName(s) }}</small>
                          </span>
                        </button>
                      </li>
                    </ul>
                    <button
                      v-if="cg.items.length && (cg.expanded || cg.total > cg.items.length)"
                      class="sp-more"
                      @click="toggleCommGroup(cg.group)"
                    >{{ cg.expanded ? '收起' : `显示全部 ${cg.total} 条` }}</button>
                  </div>
                </template>
                <div v-else-if="index && !commentaryLoading" class="sp-none">无注释命中（全文检索马太亨利、马太亨利简明及加尔文/罗伯逊/阿博特/金链等源）</div>
              </section>

              <!-- 无任何结果 -->
              <div v-if="index && !hasResults" class="sp-none">
                没有找到「{{ query }}」相关内容<br />
                <small>试试经文地址（如 约3:16）或换个关键词</small>
              </div>
            </template>
          </div>

          <footer class="sp-foot">
            <span v-if="index">
              实体
              {{
                index.meta.counts.persons +
                index.meta.counts.places +
                index.meta.counts.polities +
                index.meta.counts.events +
                index.meta.counts.periods +
                (index.meta.counts.timeline || 0) +
                (index.meta.counts.topics || 0) +
                (index.meta.counts.history || 0)
              }}
              条 · 经文 {{ index.meta.counts.translations }} 译本 · 注释段 {{ index.meta.counts.commentarySections }} ·
              原文词典 {{ index.meta.counts.strongs || 0 }} · 护教论证 {{ index.meta.counts.apolQuestions || 0 }}
            </span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sp-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(15, 20, 28, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 16px 16px;
}
.sp-panel {
  width: 100%;
  max-width: 720px;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

/* 头部输入区 */
.sp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #e8ecf1;
  background: #fff;
}
.sp-ico {
  font-size: 18px;
  opacity: 0.6;
}
.sp-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  font-size: 16px; /* ≥16px 防 iOS 聚焦缩放 */
  line-height: 1.5;
  color: #1c2733;
  background: transparent;
}
.sp-input::placeholder {
  color: #9aa7b4;
}
.sp-clear {
  flex: none;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #eef2f6;
  color: #5a6b7c;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.sp-close {
  flex: none;
  border: none;
  background: none;
  color: #4a6fa5;
  font-size: 15px;
  padding: 8px 6px;
  cursor: pointer;
}

/* 结果区 */
.sp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 0 16px;
}

.sp-error {
  margin: 20px 16px;
  padding: 12px 16px;
  background: #fdeeee;
  color: #a33;
  border-radius: 10px;
  font-size: 14px;
}

/* 空态 */
.sp-empty {
  padding: 20px 18px 8px;
}
.sp-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
.sp-chip {
  border: 1px solid #d8e0e8;
  background: #f6f8fa;
  color: #35507a;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 14px;
  cursor: pointer;
}
.sp-chip:active {
  background: #e9f0f8;
}
.sp-tips {
  list-style: none;
  margin: 0;
  padding: 0;
  color: #67788a;
  font-size: 13px;
  line-height: 2;
}
.sp-tips code {
  background: #f0f3f7;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 12px;
}

/* 地址跳转卡 */
.sp-refcard {
  display: flex;
  align-items: center;
  gap: 12px;
  width: calc(100% - 24px);
  margin: 10px 12px 4px;
  padding: 12px 14px;
  border: 1px solid #cfe0f5;
  background: linear-gradient(135deg, #f3f8ff, #eef4fd);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
}
.sp-ref-ico {
  font-size: 20px;
}
.sp-ref-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp-ref-main strong {
  font-size: 16px;
  color: #1f3a66;
}
.sp-ref-main small {
  color: #6b7f95;
  font-size: 12.5px;
}
.sp-ref-go {
  color: #4a6fa5;
  font-size: 18px;
}

/* 分组 */
.sp-group {
  margin-top: 10px;
}
.sp-group-h {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 18px 6px;
  font-size: 13px;
  font-weight: 600;
  color: #51617a;
}
.sp-cmg {
  margin: 2px 0 8px;
}
.sp-cmg-h {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 5px 18px 4px;
  font-size: 12px;
  font-weight: 700;
  color: #3d5a80;
  background: #f2f6fb;
  border-left: 3px solid #7aa2c7;
  cursor: pointer;
  user-select: none;
}
.sp-cmg-caret {
  font-size: 10px;
  color: #7aa2c7;
}
.sp-group-n {
  background: #eef2f6;
  color: #67788a;
  border-radius: 999px;
  font-size: 11.5px;
  padding: 1px 8px;
  font-weight: 500;
}
.sp-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.sp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 18px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  min-height: 48px; /* 移动端触控目标 */
}
.sp-item:hover {
  background: #f5f8fb;
}
.sp-item:active {
  background: #edf2f7;
}
.sp-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp-item-t {
  font-size: 15px;
  color: #1c2733;
  font-weight: 600;
}
.sp-item-sub {
  font-size: 12.5px;
  color: #7b8a99;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-item-act {
  flex: none;
  font-size: 16px;
  opacity: 0.55;
  margin-left: 10px;
}
/* 原文词典词条：强码 / 希腊文 lemma / 拉丁转写 */
.sp-strong-code {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #4a6fa5;
  border-radius: 4px;
  padding: 1px 6px;
  margin-right: 6px;
  vertical-align: 1px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.sp-strong-lemma {
  font-size: 15px;
  color: #1c2733;
  font-weight: 600;
  margin-right: 8px;
}
.sp-strong-translit {
  font-size: 13px;
  color: #7b8a99;
  font-style: italic;
}
/* 护教论证：主题头 + 迷你逻辑链（护教页同款节点卡片 + 关系连线） */
.sp-apol-topic {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  margin-bottom: 0.5rem;
}
.sp-apol-topic-t {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}
.sp-apol-topic-en {
  font-size: 0.72rem;
  color: #a7adb6;
  letter-spacing: 0.03em;
}
.sp-apol-tags {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: 999px;
  padding: 0.06rem 0.55rem;
}
.sp-apol-chain {
  display: flex;
  flex-direction: column;
}
.apol-node {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  line-height: 1.6;
  border: 1.5px solid;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.apol-node.n-claim { background: #fff; border-color: #c9d6ea; }
.apol-node.n-objection { background: #fdf7f5; border-color: #e4bdb3; }
.apol-node.n-response { background: #fff; border-color: #bfd6c8; }
.apol-node.n-evidence { background: #faf8fd; border-color: #d8cfe6; }
.apol-chip {
  flex: none;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff;
  border-radius: 999px;
  padding: 0.08rem 0.5rem;
  margin-top: 0.14rem;
}
.apol-chip.c-claim { background: #2f5d9e; }
.apol-chip.c-objection { background: #b3452e; }
.apol-chip.c-response { background: #2f6f4f; }
.apol-chip.c-evidence { background: #7a5f9e; }
.apol-node-text {
  min-width: 0;
  color: #55636f;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.apol-node.n-objection .apol-node-text { color: #7a4a3c; font-style: italic; }
.apol-ref { font-weight: 700; color: #2c4a7c; }
/* 关系连线（竖线 + 关系标签，颜色与护教图谱关系一致） */
.apol-edge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 22px;
  margin-left: 14px;
}
.apol-edge-line {
  width: 2px;
  height: 100%;
  background: #d8d2c6;
  border-radius: 1px;
}
.apol-edge-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
.apol-edge.refutes .apol-edge-line { background: #b3452e; }
.apol-edge.refutes .apol-edge-label { color: #b3452e; }
.apol-edge.responds .apol-edge-line { background: #2f5d9e; }
.apol-edge.responds .apol-edge-label { color: #2f5d9e; }
.apol-edge.evidences .apol-edge-line { background: #7a5f9e; }
.apol-edge.evidences .apol-edge-label { color: #7a5f9e; }
/* 人物别称 / 历史时期（母词条常显元信息；时期为可点击子词条） */
.sp-pmeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 8px;
  padding: 5px 14px 7px;
  margin-top: -2px;
  font-size: 12px;
}
.sp-pmeta-k {
  flex: none;
  color: #8b98a5;
  font-weight: 600;
}
.sp-pmeta-chip {
  display: inline-block;
  padding: 1px 9px;
  background: #eef3fa;
  border: 1px solid #d9e4f0;
  border-radius: 999px;
  color: #3d5a80;
  line-height: 1.6;
}
.sp-pmeta-link {
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.sp-pmeta-link:hover {
  background: #e0e9f5;
  border-color: #4a6fa5;
}
/* 人物编年时间线（与人物匹配的事件列表） */
.sp-pperiod {
  margin-top: 3px;
  padding-top: 6px;
  border-top: 1px dashed #e3e9f0;
}
.sp-pmeta-count {
  color: #9aa7b3;
  font-size: 11px;
}
.sp-tlist {
  list-style: none;
  margin: 0;
  padding: 0 14px 8px;
}
.sp-tl-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 3px 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: #3d5a80;
}
.sp-tl-item:hover .sp-tl-z {
  color: #1f3c68;
  text-decoration: underline;
}
.sp-tl-z {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.5;
}
.sp-tl-y {
  flex: none;
  font-size: 11.5px;
  color: #9aa7b3;
}
.sp-tl-item + .sp-tl-item {
  border-top: 1px solid #eef2f7;
}
/* 人物条目展开态：浅金底提示 */
.sp-item.open {
  background: #f7f4ec;
}
/* 人物详情展开区 */
.sp-pdetail {
  margin: 0 10px 10px;
  padding: 10px 12px;
  background: #f7f9fb;
  border-radius: 8px;
  font-size: 12.5px;
  color: #4a5a68;
  line-height: 1.6;
}
.sp-pdetail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #2c4a7c;
  font-weight: 600;
}
.sp-pdetail-rel {
  margin-bottom: 6px;
  color: #2c4a7c;
}
.sp-pdetail-none {
  color: #8b98a5;
}
.sp-pdetail-acts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.sp-pdetail-btn {
  border: 1px solid #cfe0f5;
  background: #fff;
  color: #2c4a7c;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.sp-pdetail-btn:hover {
  background: #e9f0f8;
  border-color: #4a6fa5;
}
.sp-pdetail-src {
  margin-top: 6px;
  font-size: 11px;
  color: #9aa7b3;
}
.sp-item-addr {
  font-size: 13.5px;
  color: #2c4a7c;
  font-weight: 600;
}
.sp-item-text {
  font-size: 13px;
  color: #55636f;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
/* 注释段落条目：heading 主色、来源弱化 */
.sp-item-cmhead {
  font-size: 13px;
  color: #2c4a7c;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sp-item-cmsrc {
  font-size: 11.5px;
  color: #98a6b3;
}
/* 展开态：经文/注释正文不截断，不再锁成小滚动盒——结果随 .sp-body 整页滚动，
   使空白处与非展开内容处均可滚轮滑动页面主体 */
.sp-list.sp-open .sp-item-text {
  -webkit-line-clamp: unset;
  -webkit-box-orient: vertical;
  overflow: visible;
}
.sp-list.sp-open .sp-item-cmhead {
  white-space: normal;
  text-overflow: clip;
}
/* 译本切换条 */
.sp-trans {
  display: flex;
  gap: 6px;
  padding: 4px 18px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.sp-trans::-webkit-scrollbar {
  display: none;
}
.sp-trans button {
  flex: none;
  border: 1px solid #d8e0e8;
  background: #f6f8fa;
  color: #51617a;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}
.sp-trans button.active {
  background: #e9f0f8;
  border-color: #4a6fa5;
  color: #2c4a7c;
  font-weight: 600;
}
:deep(mark) {
  background: #ffe9a8;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.sp-more {
  display: block;
  width: calc(100% - 36px);
  margin: 8px 18px 0;
  padding: 10px;
  border: 1px dashed #c4d2e0;
  border-radius: 10px;
  background: #f8fafc;
  color: #4a6fa5;
  font-size: 13.5px;
  cursor: pointer;
}
.sp-loading,
.sp-none {
  padding: 14px 18px;
  color: #8b99a8;
  font-size: 13.5px;
  text-align: center;
  line-height: 1.8;
}

/* 底部数据统计：始终处于正常文档流（flex:none，非吸顶/覆盖），滚动到最底部才能看到，
   不遮挡上方任何结果 */
.sp-foot {
  flex: none;
  padding: 10px 18px 16px;
  color: #98a6b3;
  font-size: 11.5px;
  line-height: 1.6;
  text-align: center;
}

/* ---------- 页面模式：独立结果页（非浮层） ---------- */
.srch-page {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 0 0;
  overflow: hidden; /* 整页不滚，由内部 .sp-body 滚动（搜索框固定顶部） */
  background: #fff;
}
.srch-page .sp-panel {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  max-height: none;
  border-radius: 0;
  box-shadow: none;
  background: #fff;
  flex: 1;
  min-height: 0;
}
.srch-page .sp-head {
  border-bottom: 1px solid #eef1f5;
}
.srch-page .sp-input {
  font-size: 1.05rem;
}
.srch-page .sp-body {
  overflow-y: auto; /* 结果区可滚动；顶部搜索条固定不动 */
}

/* 移动端：全屏面板 */
@media (max-width: 640px) {
  .sp-mask {
    padding: 0;
    align-items: stretch;
  }
  .sp-panel {
    max-width: none;
    max-height: none;
    height: 100%;
    border-radius: 0;
  }
  .sp-head {
    padding: 10px 12px;
    /* 适配 iOS 安全区 */
    padding-top: calc(10px + env(safe-area-inset-top));
  }
  .sp-close {
    padding: 10px 8px;
  }
  .sp-item {
    padding: 12px 16px;
  }
  .sp-foot {
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
  }
}

/* 过渡 */
.sp-enter-active,
.sp-leave-active {
  transition: opacity 0.16s ease;
}
.sp-enter-active .sp-panel,
.sp-leave-active .sp-panel {
  transition: transform 0.18s ease;
}
.sp-enter-from,
.sp-leave-to {
  opacity: 0;
}
.sp-enter-from .sp-panel,
.sp-leave-to .sp-panel {
  transform: translateY(-12px) scale(0.99);
}
</style>
