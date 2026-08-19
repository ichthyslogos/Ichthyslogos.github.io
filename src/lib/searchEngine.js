/**
 * searchEngine.js — 第一阶段检索引擎（纯数据，无 AI）
 *
 * 四路检索（对应架构文档 Query Analyzer）：
 *   1. parseReference   经文地址解析（约3:16 / 约翰福音 3:16 / John 3:16 / 诗23 …）
 *   2. searchEntities   实体检索（人物 / 地点 / 政权 / 事件 / 时期 / 注释源 / 主题 / 教会史）
 *   3. searchScripture  经文全文检索（多译本，在预归一化的匹配域上执行）
 *   4. searchCommentary 注释段落检索（heading + 摘录文本，懒加载后执行）
 *
 * 归一化策略：lowercase → 繁体转简体 → 折叠变音符。
 * 繁→简仅用于「匹配域」，结果展示永远使用源文本原文（数据准确性优先）；
 * 对照表由 OpenCC 字典机器生成（t2s-table.mjs），覆盖全部单字差异，绝不改变显示内容。
 */
import { T2S } from './t2s-table.mjs'

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

export function refLabel(book, chapter, verse) {
  return `${book.zh} ${chapter}${verse ? ':' + verse : ''}`
}

/* ============ 2. 实体检索 ============ */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 单个实体打分（0 = 不命中） */
function scoreEntry(nq, title, en, aliases) {
  let s = 0
  const nT = norm(title)
  const nE = en ? norm(en) : ''
  if (nT === nq) s = Math.max(s, 1000)
  else if (nT.startsWith(nq)) s = Math.max(s, 500)
  else if (nT.includes(nq)) s = Math.max(s, 200)
  if (nE) {
    if (nE === nq) s = Math.max(s, 950)
    else if (nE.startsWith(nq)) s = Math.max(s, 450)
    else if (new RegExp(`(^|[\\s'\\-])${escapeRe(nq)}`).test(nE)) s = Math.max(s, 280) // 词首命中
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

  const run = (list, make) => {
    const out = []
    for (const raw of list) {
      const { title, en, aliases, sub } = make(raw)
      const score = scoreEntry(nq, title, en, aliases)
      if (score > 0) out.push({ raw, score, title, en, aliases, sub })
    }
    out.sort((a, b) => b.score - a.score || (a.title || '').localeCompare(b.title || '', 'zh'))
    return out.slice(0, limit)
  }

  const persons = run(index.persons, (p) => ({
    title: p.zh || p.en,
    en: p.en,
    aliases: p.al,
    sub: [
      p.zh && p.en !== p.zh ? p.en : '',
      yearsLabel(p.by, p.dy),
      p.rel ? `亲属 ${p.rel}` : '',
    ].filter(Boolean).join(' · '),
  }))
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

  const total =
    persons.length + places.length + polities.length + events.length + periods.length + timeline.length +
    commentaries.length + topics.length + history.length
  return { persons, places, polities, events, timeline, periods, commentaries, topics, history, total }
}

/** 年份显示：负数 → 前 N 年（传统编年，非考古学定年） */
export function yearLabel(y) {
  if (y == null) return ''
  return y < 0 ? `约前 ${Math.abs(y)} 年` : `约公元 ${y} 年`
}

/** 人物生卒年显示：如「约前1997–前1821」 */
export function yearsLabel(by, dy) {
  if (by == null && dy == null) return ''
  const f = (y) => (y < 0 ? `前${Math.abs(y)}` : `${y}`)
  if (by != null && dy != null) return `约 ${f(by)}–${f(dy)}`
  if (by != null) return `约 ${f(by)} 生`
  return `约 ${f(dy)} 卒`
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

/* ============ 4. 注释段落检索（heading + 摘录；懒加载文件执行） ============ */

/**
 * 预处理注释索引：生成归一化匹配域（heading + text 拼接，一次性缓存在文件对象上）。
 * data 为 commentary-*.json 的解析结果；books 为 index.json 的 books（书名解析用）。
 */
export function prepareCommentary(data) {
  if (data._norm) return data
  data._norm = data.secs.map(([, , , h, t]) => norm(`${h}\n${t}`))
  return data
}

/**
 * 注释段落检索：匹配 heading 与摘录文本，返回 ≤ limit 条
 * [{ file, name, secIndex, bookIndex, chapter, ref, heading, text }]（按书卷顺序）。
 * 中文 ≥1 字、拉丁 ≥2 字符才执行。
 */
export function searchCommentary(query, data, { limit = 8 } = {}) {
  const nq = norm(query)
  if (!nq) return []
  if (/^[a-z0-9' ]+$/.test(nq) && nq.length < 2) return []
  if (!data._norm) prepareCommentary(data)
  const out = []
  const fields = data._norm
  const secs = data.secs
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].includes(nq)) {
      const [bi, ch, ref, heading, text] = secs[i]
      out.push({ name: data.name, bookIndex: bi, chapter: ch, ref, heading, text })
      if (out.length >= limit) break
    }
  }
  return out
}
