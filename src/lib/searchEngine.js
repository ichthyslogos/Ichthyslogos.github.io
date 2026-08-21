/**
 * searchEngine.js — 第一阶段检索引擎（纯数据，无 AI）
 *
 * 四路检索（对应架构文档 Query Analyzer）：
 *   1. parseReference   经文地址解析（约3:16 / 约翰福音 3:16 / John 3:16 / 诗23 …）
 *   2. searchEntities   实体检索（人物 / 地点 / 政权 / 事件 / 时期 / 注释源 / 主题 / 教会史）
 *   3. searchScripture  经文全文检索（多译本，在预归一化的匹配域上执行）
 *   4. 注释段落全文检索 scanCommentaryBook + snippet（直接扫描注释数据库原文件）
 *
 * 归一化策略：lowercase → 繁体转简体 → 折叠变音符。
 * 繁→简仅用于「匹配域」，结果展示永远使用源文本原文（数据准确性优先）；
 * 对照表由 OpenCC 字典机器生成（t2s-table.mjs），覆盖全部单字差异，绝不改变显示内容。
 */
import { T2S } from './t2s-table.mjs'
import { yearLabel, yearsLabel } from './bibleEntries.js'
export { yearLabel, yearsLabel }

/** 归一化（仅用于匹配域）：lowercase → 繁→简 → 折叠变音符与花式引号 */
export function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019'’`]/g, "'")
    .replace(/\s+/g, ' ')
    .split('')
    .map((c) => T2S.get(c) || c)
    .join('')
    .trim()
}

/* ============ 1. 经文地址解析 ============ */

/** 构建别名 → 书卷索引（打开面板时调用一次） */
export function buildBookLookup(books) {
  const map = new Map() // norm(alias) -> book
  const put = (alias, book) => {
    const k = norm(alias)
    if (!k || map.has(k)) return
    map.set(k, book)
  }
  for (const b of books) {
    put(b.zh, b)
    put(b.en, b)
    for (const a of b.ab || []) put(a, b)
    for (const a of b.ea || []) put(a, b)
    // 英文书名去空格形式（song of solomon → songofsolomon）
    put(b.en.replace(/\s+/g, ''), b)
  }
  // 别名按长度降序（「约翰福音」优先于「约」）
  const sortedAliases = [...map.keys()].sort((a, b) => b.length - a.length)
  return { map, sortedAliases }
}

/**
 * 地址解析：命中返回 { bookId, book, chapter, verse, label }，否则 null。
 * 支持：约3:16 / 约 3:16 / 约翰福音3:16 / 约翰福音 3 章 16 节 / John 3:16 /
 *       gen 3 16 / 诗23 / 43:3:16（书卷号:章:节）
 */
export function parseReference(query, lookup) {
  if (!query || !lookup) return null
  const q = query.trim()
  if (!q || q.length > 40) return null

  // 形式一：纯「书卷号:章[:节]」（43:3:16 / 43:3）
  let m = /^(\d{1,2})\s*[:：]\s*(\d{1,3})(?:\s*[:：.]\s*(\d{1,3}))?$/.exec(q)
  if (m) {
    const id = String(Number(m[1])).padStart(2, '0')
    const book = [...lookup.map.values()].find((b) => b.id === id)
    if (book && Number(m[2]) >= 1 && Number(m[2]) <= book.cc) {
      const verse = m[3] ? Number(m[3]) : 0
      return { bookId: book.id, book, chapter: Number(m[2]), verse, label: refLabel(book, Number(m[2]), verse) }
    }
  }

  // 形式二：书卷名（中文/英文/简称）+ 「章[:节]」或「N章N节」
  const nq = norm(q)
  for (const alias of lookup.sortedAliases) {
    if (!nq.startsWith(alias)) continue
    const book = lookup.map.get(alias)
    let rest = nq.slice(alias.length)
    if (!rest) {
      // 只有书卷名：跳转该卷第 1 章
      return { bookId: book.id, book, chapter: 1, verse: 0, label: refLabel(book, 1, 0) }
    }
    m = /^[\s:：.]*?(\d{1,3})(?:\s*章\s*(\d{1,3})?\s*(?:節|节)?|\s*[:：.]\s*(\d{1,3})|\s+(\d{1,3}))?\s*(?:[-–~]\s*\d{1,3})?\s*(?:章|节|節)?\s*$/.exec(rest)
    if (!m) return null
    const chapter = Number(m[1])
    if (chapter < 1 || chapter > book.cc) return null
    const verse = m[2] ? Number(m[2]) : m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : 0
    return { bookId: book.id, book, chapter, verse, label: refLabel(book, chapter, verse) }
  }
  return null
}

function refLabel(book, chapter, verse) {
  return `${book.zh} ${chapter}${verse ? ':' + verse : ''}`
}

/* ============ 2. 实体检索 ============ */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 单个实体打分（0 = 不命中）；wordRe 为查询词首匹配正则（调用方预编译一次） */
function scoreEntry(nq, wordRe, title, en, aliases) {
  let s = 0
  const nT = norm(title)
  const nE = en ? norm(en) : ''
  if (nT === nq) s = Math.max(s, 1000)
  else if (nT.startsWith(nq)) s = Math.max(s, 500)
  else if (nT.includes(nq)) s = Math.max(s, 200)
  if (nE) {
    if (nE === nq) s = Math.max(s, 950)
    else if (nE.startsWith(nq)) s = Math.max(s, 450)
    else if (wordRe.test(nE)) s = Math.max(s, 280) // 词首命中
    else if (nE.includes(nq)) s = Math.max(s, 120)
  }
  for (const a of aliases || []) {
    const nA = norm(a)
    if (!nA) continue
    if (nA === nq) s = Math.max(s, 900)
    else if (nA.startsWith(nq)) s = Math.max(s, 420)
    else if (nA.includes(nq)) s = Math.max(s, 180)
  }
  return s
}

/**
 * 实体检索：返回按分数排序的分组结果（每组 ≤ limit 条）
 * index 为 public/data/search/index.json 的解析结果
 */
export function searchEntities(query, index, limit = 8) {
  const nq = norm(query)
  if (!nq) return null
  const wordRe = new RegExp(`(^|[\\s'\\-])${escapeRe(nq)}`)

  const run = (list, make, lim = limit) => {
    const out = []
    for (const raw of list) {
      const { title, en, aliases, sub } = make(raw)
      const score = scoreEntry(nq, wordRe, title, en, aliases)
      if (score > 0) out.push({ raw, score, title, en, aliases, sub })
    }
    out.sort((a, b) => b.score - a.score || (a.title || '').localeCompare(b.title || '', 'zh'))
    return out.slice(0, lim)
  }

  // 人物放宽上限：同名个体按 Strong 码后缀区分，需聚合完整集合再在面板聚成母/子词条
  const persons = run(
    index.persons,
    (p) => ({
      title: p.zh || p.en,
      en: p.en,
      aliases: p.al,
      sub: [
        p.zh && p.en !== p.zh ? p.en : '',
        yearsLabel(p.by, p.dy),
        p.rel ? `亲属 ${p.rel}` : '',
      ].filter(Boolean).join(' · '),
    }),
    Math.max(limit * 3, 40),
  )
  const places = run(index.places, (p) => ({
    title: p.zh || p.en, en: p.en, aliases: p.al, sub: p.zh && p.en !== p.zh ? p.en : '',
  }))
  const polities = run(index.polities, (p) => ({
    title: p.en, en: p.en, aliases: [], sub: p.t === 'nation' ? '政权 / 部族' : '历史区域',
  }))
  const events = run(index.events, (e) => ({
    title: e.en, en: e.en, aliases: [], sub: e.story || (e.type === 'travel' ? '旅程' : ''),
  }))
  const timeline = run(index.timeline || [], (t) => ({
    title: t.z || t.t, en: t.t, aliases: [], sub: t.y != null ? `${yearLabel(t.y)}${t.nv ? ` · ${t.nv} 节` : ''}` : '',
  }))
  const periods = run(index.periods, (p) => ({
    title: p.name, en: '', aliases: [], sub: p.era || '',
  }))
  const commentaries = run(index.commentaries, (c) => ({
    title: c.name, en: '', aliases: [], sub: c.n ? `注释源 · ${c.n} 段` : (c.cats || []).map(catLabel).join(' · '),
  }))
  const topics = run(index.topics || [], (t) => ({
    title: t.zh || t.en, en: t.en, aliases: [...(t.tags || []), ...(t.al || [])],
    sub: t.tags && t.tags.length ? t.tags.join(' · ') : '',
  }))
  const history = run(index.history || [], (h) => ({
    title: h.t, en: '', aliases: [], sub: h.period ? `${h.period} · 第${h.part}部` : `第${h.part}部`,
  }))
  // 预言：放宽上限，供「预言→人物」匹配使用完整命中集（不仅是预言组可见的前几条）
  const prophecyHits = run(index.prophecies || [], (p) => ({
    title: p.zh || p.en, en: p.en, aliases: [], sub: `${p.zcat || p.catZh || p.cat || ''} · ${p.ot} → ${p.nt}`,
  }), Math.max(limit * 3, 40))

  // 预言 ↔ 人物：命中的预言若关联到「同样命中的」人物，则挂到该人物词条下（可同时挂多人），
  // 并从「预言 / 应验」组原位移除；未关联任何命中人物者留在组内。
  const hitPersonCodes = new Set(persons.map((x) => x.raw.id))
  const personProphecies = {} // person id -> prophecy hit[]
  const propMoved = new Set() // 已位移到人物下的预言 id
  for (const ph of prophecyHits) {
    const matched = (ph.raw.people || []).filter((code) => hitPersonCodes.has(code))
    if (!matched.length) continue
    propMoved.add(ph.raw.id)
    for (const code of matched) {
      ;(personProphecies[code] = personProphecies[code] || []).push(ph)
    }
  }
  for (const k in personProphecies) personProphecies[k].sort((a, b) => b.score - a.score)
  const prophecies = prophecyHits.filter((ph) => !propMoved.has(ph.raw.id)).slice(0, limit)

  const total =
    persons.length + places.length + polities.length + events.length + periods.length + timeline.length +
    commentaries.length + topics.length + history.length + prophecies.length + Object.keys(personProphecies).length
  return { persons, places, polities, events, timeline, periods, commentaries, topics, history, prophecies, personProphecies, total }
}

const CAT_LABELS = { summary: '总结', interpretation: '经文解释', fullCommentary: '完整解经' }
const catLabel = (c) => CAT_LABELS[c] || c

/* ============ 3. 经文全文检索 ============ */

/**
 * 预处理经文索引：生成与 verses 对齐的归一化匹配域（一次性，缓存在返回对象上）。
 * data 为 scripture-*.json 的解析结果。
 */
export function prepareScripture(data) {
  if (data._norm) return data
  data._norm = { fields: data.verses.map(([, , , t]) => norm(t)) }
  return data
}

/**
 * 全文检索：返回 [{ bookIndex, chapter, verse, text }]（≤ limit 条，按书卷顺序）。
 * 中文 ≥1 字、拉丁 ≥2 字符才执行（避免单字母命中上万节）。
 */
export function searchScripture(query, data, { limit = 30 } = {}) {
  const nq = norm(query)
  if (!nq) return []
  if (/^[a-z0-9' ]+$/.test(nq) && nq.length < 2) return []
  if (!data._norm) prepareScripture(data)
  const out = []
  const fields = data._norm.fields
  const verses = data.verses
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].includes(nq)) {
      const [bi, c, v, t] = verses[i]
      out.push({ bookIndex: bi, chapter: c, verse: v, text: t })
      if (out.length >= limit) break
    }
  }
  return out
}

/** 全文命中总数（用于「共 N 处」提示；31k 节扫描 <10ms） */
export function countScripture(query, data) {
  const nq = norm(query)
  if (!nq) return 0
  if (/^[a-z0-9' ]+$/.test(nq) && nq.length < 2) return 0
  if (!data._norm) prepareScripture(data)
  let n = 0
  for (const f of data._norm.fields) if (f.includes(nq)) n++
  return n
}

/* ============ 4. 注释段落全文检索（直接调用注释数据库原文件） ============ */

/**
 * 命中前后文摘录：围绕原始查询串（忽略大小写）取一段窗口，两端补省略号；
 * 原文中定位不到时回退到文本开头。
 */
export function snippet(text, rawQ, width = 60) {
  const t = String(text || '')
  if (!t) return ''
  if (t.length <= width) return t
  const low = t.toLowerCase()
  const n = String(rawQ || '').trim().toLowerCase()
  let i = n ? low.indexOf(n) : -1
  if (i < 0) i = 0
  const start = Math.max(0, i - Math.floor(width / 2))
  const end = Math.min(t.length, start + width)
  return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '')
}

/**
 * 全文扫描一卷注释原文件（public/data/brp/commentary/<category>/<key>/<bookId>.json）。
 * 逐章 summary 与 sections（heading + text）做归一化子串匹配，返回命中列表列表
 * [{ bookId, chapter, ref, heading, text, snippet }]；
 * 归一化匹配域缓存到对象上，后续同词重搜零成本。
 */
export function scanCommentaryBook(bookData, nq, rawQ = '') {
  if (!bookData._scan) {
    bookData._scan = []
    for (const ch of bookData.chapters || []) {
      if (ch.summary) {
        bookData._scan.push({ chapter: ch.chapter, ref: '', heading: '', text: ch.summary, field: norm(ch.summary) })
      }
      for (const s of ch.sections || []) {
        const h = s.heading || ''
        const t = s.text || ''
        if (!t && !h) continue
        bookData._scan.push({ chapter: ch.chapter, ref: s.ref, heading: h, text: t, field: norm(`${h} ${t}`) })
      }
    }
  }
  const hits = []
  for (const e of bookData._scan) {
    if (e.field.includes(nq)) {
      hits.push({
        bookId: bookData.bookId, chapter: e.chapter, ref: e.ref || '',
        heading: e.heading, text: e.text, snippet: snippet(e.text, rawQ, 220),
      })
    }
  }
  return hits
}

/* ============ 5. Strong 原文词典检索 ============ */

/**
 * 预处理 Strong 词典索引：一次性归一化全部条目（lemma/translit/gloss/code），
 * 缓存在返回对象上，后续同词重搜零成本。
 * data 为 brp/strongs-index.json 的解析结果（{ count, items: { code: {lemma,translit,pos,gloss} } }）。
 */
function prepareStrongs(data) {
  if (data._norm) return data
  const arr = []
  for (const code of Object.keys(data.items || {})) {
    const e = data.items[code]
    arr.push({
      code,
      nCode: norm(code),
      nLemma: norm(e.lemma),
      nTranslit: norm(e.translit),
      nGloss: norm(e.gloss),
      lemma: e.lemma,
      translit: e.translit,
      pos: e.pos || '',
      gloss: e.gloss,
    })
  }
  data._norm = arr
  return data
}

/**
 * Strong 词典检索：跨希腊文 lemma / 拉丁转写 translit / 英文 gloss / 强码 code 匹配。
 * 返回 [{ code, lemma, translit, pos, gloss, score }]（≤ limit 条，按分数降序）。
 */
export function searchStrongs(query, data, { limit = 20 } = {}) {
  const nq = norm(query)
  if (!nq) return []
  if (/^[a-z0-9]+$/.test(nq) && nq.length < 2) return []
  if (!data._norm) prepareStrongs(data)
  const wordRe = new RegExp(`(^|[\\s'\\-])${escapeRe(nq)}`)
  const out = []
  for (const e of data._norm) {
    let s = 0
    if (e.nCode === nq) s = Math.max(s, 1200)
    else if (e.nCode.startsWith(nq)) s = Math.max(s, 600)
    else if (e.nCode.includes(nq)) s = Math.max(s, 300)
    if (e.nLemma === nq) s = Math.max(s, 1000)
    else if (e.nLemma.startsWith(nq)) s = Math.max(s, 500)
    else if (e.nLemma.includes(nq)) s = Math.max(s, 200)
    if (e.nTranslit === nq) s = Math.max(s, 950)
    else if (e.nTranslit.startsWith(nq)) s = Math.max(s, 450)
    else if (e.nTranslit.includes(nq)) s = Math.max(s, 180)
    if (e.nGloss === nq) s = Math.max(s, 900)
    else if (wordRe.test(e.nGloss)) s = Math.max(s, 400) // 词首命中
    else if (e.nGloss.includes(nq)) s = Math.max(s, 150)
    if (s > 0) out.push({ code: e.code, lemma: e.lemma, translit: e.translit, pos: e.pos, gloss: e.gloss, score: s })
  }
  out.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
  return out.slice(0, limit)
}

/* ============ 6. 护教问答全文检索 ============ */

/**
 * 护教论证检索：主题级聚合。跨主题标题/标签 + 子问题 question/objection/summary/text/evidence 匹配。
 * data 为 apologetics-search.json 的解析结果（子问题级条目数组，含完整逻辑链条字段）。
 * 返回主题级结果 [{ topicId, topicZh, topicEn, tags, score, chain }]（≤ limit 条，按分数降序）；
 * chain 为得分最高的子问题完整链条 { qid, question, objection, summary, text, evidence }。
 */
export function searchApologetics(query, data, { limit = 20 } = {}) {
  const nq = norm(query)
  if (!nq) return []
  if (/^[a-z0-9' ]+$/.test(nq) && nq.length < 2) return []
  // 标题匹配域剥离书名号等 CJK 标点，避免「《圣经》」与「圣经」无法互中
  const stripPunct = (s) => (s || '').replace(/[《》「」『』【】〈〉（）()]/g, '')
  const nqTitle = norm(stripPunct(query)) // 标题匹配用（查询词同样剥离标点）
  // 按主题聚合子问题：主题级得分 = max(标题/标签命中, 各子问题内容命中)；保留最佳匹配链条
  const byTopic = new Map()
  for (const item of data || []) {
    const nT = norm(`${stripPunct(item.topicZh)} ${stripPunct(item.topicEn)} ${(item.tags || []).join(' ')}`)
    const nQ = norm(item.question)
    const nObj = norm(item.objection)
    const nSum = norm(item.summary)
    const nText = norm(item.text)
    const nEv = norm((item.evidence || []).map((e) => `${e.ref} ${e.note}`).join(' '))
    let s = 0
    if (nT === nqTitle) s = Math.max(s, 1100)
    else if (nT.startsWith(nqTitle)) s = Math.max(s, 550)
    else if (nT.includes(nqTitle)) s = Math.max(s, 300)
    if (nQ === nq) s = Math.max(s, 1000)
    else if (nQ.startsWith(nq)) s = Math.max(s, 500)
    else if (nQ.includes(nq)) s = Math.max(s, 250)
    if (nObj.includes(nq)) s = Math.max(s, 220)
    if (nSum.includes(nq)) s = Math.max(s, 200)
    if (nText.includes(nq)) s = Math.max(s, 120)
    if (nEv.includes(nq)) s = Math.max(s, 160)
    if (!s) continue
    let t = byTopic.get(item.topicId)
    if (!t) {
      t = {
        topicId: item.topicId,
        topicZh: item.topicZh,
        topicEn: item.topicEn,
        tags: item.tags || [],
        score: 0,
        chain: null,
      }
      byTopic.set(item.topicId, t)
    }
    if (s > t.score) {
      t.score = s
      t.chain = {
        qid: item.qid,
        question: item.question,
        objection: item.objection,
        summary: item.summary,
        text: item.text,
        evidence: item.evidence || [],
      }
    }
  }
  const out = [...byTopic.values()].sort((a, b) => b.score - a.score || String(a.topicZh).localeCompare(String(b.topicZh), 'zh'))
  return out.slice(0, limit)
}
