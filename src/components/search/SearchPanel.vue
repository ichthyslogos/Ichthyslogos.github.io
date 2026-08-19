<script setup>
/**
 * SearchPanel — 全局搜索浮层（第一阶段：纯数据检索，无 AI）
 * 四路结果：地址跳转卡 → 实体分组（人物/地点/政权/事件/时期/注释源/主题/教会史）
 *   → 经文全文（多译本可切换，按语言懒加载）→ 注释段落（heading+摘录，按源懒加载）。
 * 移动端全屏、桌面居中；Esc / 遮罩 / 取消按钮关闭；输入法组合期间不触发检索。
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { searchOpen, closeSearch } from '../../lib/searchStore.js'
import {
  buildBookLookup,
  parseReference,
  searchEntities,
  searchScripture,
  countScripture,
  prepareScripture,
  searchCommentary,
  prepareCommentary,
  yearsLabel,
} from '../../lib/searchEngine.js'

const router = useRouter()

/* ---------- 索引加载（模块级缓存，多面板实例共享） ---------- */
let indexPromise = null
const scripturePromises = new Map() // transKey -> Promise
const commentaryPromises = new Map() // file -> Promise
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('data/search/index.json', { cache: 'no-store' }).then((r) => {
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
      fetch(`data/search/scripture-${key}.json`, { cache: 'no-store' })
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
function loadCommentary(file) {
  if (!commentaryPromises.has(file)) {
    commentaryPromises.set(
      file,
      fetch(`data/search/commentary-${file}.json`, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`${file} 注释索引加载失败 (${r.status})`)
          return r.json()
        })
        .catch((e) => {
          commentaryPromises.delete(file)
          throw e
        }),
    )
  }
  return commentaryPromises.get(file)
}

/* ---------- Theographic 人物详情（词典摘录 + 亲属名单；一次性懒加载） ---------- */
let theoPromise = null
function loadTheoPersons() {
  if (!theoPromise) {
    theoPromise = fetch('data/theographic/persons.json', { cache: 'no-store' })
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
const commentaryFiles = ref([]) // 已加载的注释索引文件
const commentaryLoading = ref(false)
const commentaryResults = ref([])
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

/** 可选译本列表（按语言分组展示） */
const transList = computed(() => index.value?.translations || [])
function autoTransKey() {
  const list = transList.value
  if (!list.length) return ''
  const want = isCjk.value ? 'zh' : 'latin'
  const preferred = isCjk.value ? 'chiun' : 'niv'
  return list.find((t) => t.key === preferred)?.key || list.find((t) => t.lang === want)?.key || list[0].key
}
const activeTrans = computed(() => transList.value.find((t) => t.key === transKey.value) || null)

/** 注释文件清单（来自 index.commentaries[].files，全量懒加载一次后缓存） */
const commFileDefs = computed(() =>
  (index.value?.commentaries || []).flatMap((c) => c.files || []),
)

/* ---------- 检索执行（防抖 + 组合输入保护） ---------- */
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 160)
})

let searchSeq = 0
async function runSearch() {
  if (composing) return
  const q = query.value.trim()
  if (!index.value || !q) {
    results.value = null
    refHit.value = null
    scriptureResults.value = []
    scriptureTotal.value = 0
    commentaryResults.value = []
    return
  }
  const seq = ++searchSeq
  // 实体检索（同步，内存索引）
  results.value = searchEntities(q, index.value, verseResultsOpen.value ? 20 : 8)
  // 经文地址解析
  refHit.value = parseReference(q, lookup.value)
  // 经文全文（按语言懒加载索引；英文 ≥2 字符，中文 ≥1 字）
  await ensureScripture()
  if (seq !== searchSeq) return
  if (scriptureData.value) {
    scriptureResults.value = searchScripture(q, scriptureData.value, { limit: verseResultsOpen.value ? 40 : 5 })
    scriptureTotal.value = countScripture(q, scriptureData.value)
  }
  // 注释段落（懒加载全部注释索引文件后检索；失败不阻塞）
  await ensureCommentary()
  if (seq !== searchSeq) return
  if (commentaryFiles.value.length) {
    const limit = verseResultsOpen.value ? 16 : 4
    const merged = []
    for (const d of commentaryFiles.value) {
      for (const hit of searchCommentary(q, d, { limit })) merged.push(hit)
    }
    merged.sort((a, b) => a.bookIndex - b.bookIndex || a.chapter - b.chapter)
    commentaryResults.value = merged.slice(0, verseResultsOpen.value ? 20 : 6)
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

/** 按需加载全部注释段落索引（一次性；7 文件 ~6MB，首次注释检索时加载） */
async function ensureCommentary() {
  if (commentaryFiles.value.length || commentaryLoading.value) return
  const q = query.value.trim()
  if (!isCjk.value && q.replace(/[^a-z0-9]/gi, '').length < 2) return
  commentaryLoading.value = true
  try {
    const list = await Promise.all(commFileDefs.value.map((f) => loadCommentary(f.file)))
    for (const d of list) prepareCommentary(d)
    commentaryFiles.value = list
  } catch {
    // 注释索引失败不阻塞其他检索
  } finally {
    commentaryLoading.value = false
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
    await nextTick()
    inputEl.value?.focus()
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
    refHit.value = null
    results.value = null
    scriptureResults.value = []
    scriptureTotal.value = 0
    verseResultsOpen.value = false
    transKey.value = ''
    scriptureData.value = null
    commentaryResults.value = []
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
function goTopic() {
  go('/apologetics')
}
function goHistory(h) {
  go(`/history/${h.part}/${h.no}`)
}
function goCommentarySec(s) {
  const b = index.value?.books?.[s.bookIndex]
  if (!b) return
  go(`/brp/${b.id}/${s.chapter}`)
}
function commSecAddr(s) {
  const b = index.value?.books?.[s.bookIndex]
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
    scriptureLoading.value ||
    commentaryLoading.value
  )
})

const GROUPS = computed(() => {
    const r = results.value
    if (!r) return []
    const defs = [
      { key: 'persons', icon: '👤', label: '人物', items: r.persons, act: togglePersonDetail, actIcon: 'ⓘ', actTitle: '词典与亲属' },
      { key: 'places', icon: '📍', label: '地点', items: r.places, act: goPlace, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'polities', icon: '🏛', label: '政权 / 区域', items: r.polities, act: goPolity, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'periods', icon: '⏳', label: '历史时期', items: r.periods, act: goPeriod, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'events', icon: '📜', label: '事件 / 旅程', items: r.events, act: goEvent, actIcon: '🗺', actTitle: '在地图中查看' },
      { key: 'timeline', icon: '⏱', label: '编年时间线', items: r.timeline, act: goTimeline, actIcon: '📖', actTitle: '查看该事件经文' },
      { key: 'topics', icon: '🧭', label: '主题专题', items: r.topics, act: goTopic, actIcon: '📄', actTitle: '查看专题' },
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
  <Teleport to="body">
    <Transition name="sp">
      <div v-if="searchOpen" class="sp-mask" @click.self="close">
        <div class="sp-panel" role="dialog" aria-modal="true" aria-label="全局搜索">
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
            <button class="sp-close" aria-label="关闭搜索" @click="close">取消</button>
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
                <li>🔎 经文全文：多译本可切换（和合本/思高本/NIV/KJV/ASV/DRC…，简繁互通）</li>
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
                      :class="{ open: g.key === 'persons' && expandedPerson === item.raw.id }"
                      :title="g.actTitle"
                      @click="g.act(item.raw)"
                    >
                      <span class="sp-item-main">
                        <strong class="sp-item-t" v-html="mark(item.title, query)"></strong>
                        <small v-if="item.sub" class="sp-item-sub" v-html="mark(item.sub, query)"></small>
                      </span>
                      <span class="sp-item-act" aria-hidden="true">{{ g.actIcon }}</span>
                    </button>
                    <div v-if="g.key === 'persons' && expandedPerson === item.raw.id" class="sp-pdetail">
                      <template v-if="personDetail">
                        <div v-if="personDetail.years || personDetail.appear || personDetail.firstRef" class="sp-pdetail-meta">
                          <span v-if="personDetail.years">{{ personDetail.years }}</span>
                          <span v-if="personDetail.appear">出现 {{ personDetail.appear }} 次</span>
                          <span v-if="personDetail.firstRef">首现 {{ personDetail.firstRef }}</span>
                        </div>
                        <div v-if="personDetail.relLines.length" class="sp-pdetail-rel">
                          <div v-for="(line, i) in personDetail.relLines" :key="i">{{ line }}</div>
                        </div>
                        <div v-if="personDetail.dict" class="sp-pdetail-dict">{{ personDetail.dict }}</div>
                        <div v-if="!personDetail.relLines.length && !personDetail.dict && !personDetail.years && !personDetail.firstRef" class="sp-pdetail-none">暂无词典与亲属数据</div>
                        <div class="sp-pdetail-acts">
                          <button v-if="personDetail.firstRaw?.first" class="sp-pdetail-btn" @click="goPerson(personDetail.firstRaw)">📖 首处经文{{ personDetail.firstRef ? `（${personDetail.firstRef}）` : '' }}</button>
                          <button class="sp-pdetail-btn" @click="goPersonPage(personDetail.firstRaw)">📄 人物词条</button>
                        </div>
                      </template>
                      <div v-else-if="theoError" class="sp-pdetail-none">详情数据加载失败</div>
                      <div v-else class="sp-pdetail-none">加载中…</div>
                      <div class="sp-pdetail-src">Easton 词典 · Theographic（传统编年）</div>
                    </div>
                  </li>
                </ul>
              </section>

              <!-- 3. 经文全文（多译本切换） -->
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
                  <ul class="sp-list">
                    <li v-for="(v, i) in scriptureResults" :key="i">
                      <button class="sp-item sp-verse" @click="goVerse(v)">
                        <span class="sp-item-main">
                          <strong class="sp-item-addr">{{ verseAddr(v) }}</strong>
                          <small class="sp-item-text" v-html="mark(v.text, query)"></small>
                        </span>
                      </button>
                    </li>
                  </ul>
                  <button v-if="scriptureTotal > scriptureResults.length" class="sp-more" @click="verseResultsOpen = true; runSearch()">
                    显示全部 {{ scriptureTotal }} 处
                  </button>
                </template>
                <div v-else-if="index && !scriptureLoading" class="sp-none">无经文命中</div>
              </section>

              <!-- 4. 注释段落（heading + 摘录；跳读经页看完整注释） -->
              <section class="sp-group">
                <h3 class="sp-group-h">
                  <span aria-hidden="true">📚</span>注释段落
                  <span class="sp-group-n" v-if="commentaryResults.length">{{ commentaryResults.length }}</span>
                </h3>
                <div v-if="commentaryLoading" class="sp-loading">正在加载注释索引…</div>
                <template v-else-if="commentaryResults.length">
                  <ul class="sp-list">
                    <li v-for="(s, i) in commentaryResults" :key="i">
                      <button class="sp-item sp-verse" @click="goCommentarySec(s)">
                        <span class="sp-item-main">
                          <strong class="sp-item-addr">{{ commSecAddr(s) }}</strong>
                          <small v-if="s.heading" class="sp-item-cmhead" v-html="mark(s.heading, query)"></small>
                          <small class="sp-item-text" v-html="mark(s.text, query)"></small>
                          <small class="sp-item-cmsrc">{{ s.name }}</small>
                        </span>
                      </button>
                    </li>
                  </ul>
                </template>
                <div v-else-if="index && !commentaryLoading" class="sp-none">无注释命中（仅检索标题与摘录，全文见读经页）</div>
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
              条 · 经文 {{ index.meta.counts.translations }} 译本 · 注释段 {{ index.meta.counts.commentarySections }}
            </span>
            <span>第一阶段 · 纯数据检索（无 AI）</span>
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
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
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
.sp-pdetail-dict {
  color: #55636f;
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

/* 底部状态 */
.sp-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  border-top: 1px solid #e8ecf1;
  color: #98a6b3;
  font-size: 11.5px;
  background: #fbfcfd;
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
