/**
 * import-theographic.mjs — 导入 Theographic Bible Metadata 人物/事件数据到 data-src
 *
 * 数据源（素材库只读）：
 *   素材/theographic/people.json   3067 人物（Airtable 导出：fields 含生卒年/关系/词典）
 *   素材/theographic/verses.json   31102 节（节级人物标注，用于同名消歧）
 *   素材/theographic/Events.csv    450 编年事件（标题/年份/OSIS 经文/参与者）
 * 许可：CC BY-SA 4.0（https://github.com/robertrouse/theographic-bible-metadata）
 *   生卒年为 Ussher 式传统编年（非考古学定年），词典文本来自 Easton's Bible Dictionary（公有领域）
 *
 * 匹配算法（TIPNR 人物 ← Theographic 人物，准确性优先）：
 *   阶段1 唯一名直配：TIPNR 唯一 + Theographic 唯一（归一化名 + displayTitle 词 + alsoCalled 别名）
 *   阶段2 节级首现消歧：TIPNR 首现「书:章:节」与 Theographic 首现节完全一致；
 *        多命中时优先 name 精确一致者（剔除别名渠道污染，如 Abram 的别名 Abraham）
 *   阶段3 主记录兜底：仅限唯一 publish + 名字精确一致 + verseCount≥100 且 ≥ 组内次大 3 倍
 *        （覆盖预言首现差异的顶级人物，如 Jesus TIPNR 首现赛 7:14 而 Theo 首现创 49:10）
 *   匹配冲突一律放弃（宁缺毋滥）
 *
 * 输出（data-src/theographic/）：
 *   persons.json   强码 → {by,dy,fa,mo,sp,ch,sb,vc,dict}（关系值为强码或英文名）
 *   events.json    450 事件 {id,t,y,dur,vs,ppl}
 *   content.meta.json  源登记
 *
 * 原则：素材库与 public/data 一律只读；本脚本只写 data-src/theographic/。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MAT = path.resolve(SITE_ROOT, '../素材/theographic')
const OUT = path.join(SITE_ROOT, 'data-src/theographic')
const DATA = path.join(SITE_ROOT, 'public/data')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const exists = (p) => fs.existsSync(p)

/* ---------- 1. TIPNR 人物（匹配目标；含首现「书:章:节」） ---------- */
const entriesIdx = readJson(path.join(DATA, 'brp/commentary/notes/tipnr/entries.json'))
const tipnrPersons = entriesIdx.entries.filter((e) => e.type === 'Male' || e.type === 'Female')

const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()

const tipnrByName = new Map()
for (const e of tipnrPersons) {
  const k = normName(e.name)
  if (!k) continue
  if (!tipnrByName.has(k)) tipnrByName.set(k, [])
  tipnrByName.get(k).push(e)
}

// TIPNR 首现（书:章:节）——强码归一化与 build-search-index 一致
const parseStrong = (strong) => {
  if (!strong) return { code: '', suffix: '' }
  const m = /^([HG])0*(\d+)([A-Za-z]*)$/.exec(strong)
  if (!m) return { code: strong, suffix: '' }
  return { code: m[1] + m[2], suffix: m[3] || '' }
}
const tipnrDir = path.join(DATA, 'brp/commentary/notes/tipnr')
const firstVerseOf = new Map() // 归一化强码 → [book, chapter, verse]
const versesOfTipnr = new Map() // 归一化强码 → Set('book:chapter:verse')（阶段4经文重合度用）
for (const f of fs.readdirSync(path.join(tipnrDir, 'books')).filter((x) => x.endsWith('.json')).sort()) {
  const bookId = f.replace(/\.json$/, '')
  const d = readJson(path.join(tipnrDir, 'books', f))
  for (const ch of d.chapters || []) {
    for (const e of ch.entries || []) {
      const { code, suffix } = parseStrong(e.strong)
      const key = code + suffix || e.name
      // 半节引用（如 "56b"）去掉字母后缀取节号；无法解析的丢弃
      const refs = (e.refs || []).map((r) => Number(String(r).replace(/[a-z]+$/i, ''))).filter(Boolean)
      if (!firstVerseOf.has(key)) firstVerseOf.set(key, [bookId, ch.chapter, refs.length ? Math.min(...refs) : 1])
      if (!versesOfTipnr.has(key)) versesOfTipnr.set(key, new Set())
      const set = versesOfTipnr.get(key)
      for (const r of refs) set.add(`${bookId}:${ch.chapter}:${r}`)
    }
  }
}

/* ---------- 2. Theographic 人物（候选） ---------- */
const theoPeople = readJson(path.join(MAT, 'people.json'))

// 名字候选索引（name + displayTitle 词 + alsoCalled）
const theoByName = new Map()
const pushCand = (map, key, p) => {
  const k = normName(key)
  if (!k) return
  if (!map.has(k)) map.set(k, [])
  if (!map.get(k).includes(p)) map.get(k).push(p)
}
for (const p of theoPeople) {
  const f = p.fields
  pushCand(theoByName, f.name, p)
  // 多词 name 也入词键（"Herod Antipas" 可被 TIPNR "Herod" 名组检索）
  const nn = normName(f.name)
  if (nn.includes(' ')) for (const w of nn.split(' ')) pushCand(theoByName, w, p)
  if (f.displayTitle && normName(f.displayTitle) !== normName(f.name)) {
    // 整名短语键（TIPNR 的 Mary_Magdalene 等下划线名 → "mary magdalene"），词键仅作兜底
    pushCand(theoByName, f.displayTitle, p)
    for (const w of normName(f.displayTitle).split(/\s+/)) pushCand(theoByName, w, p)
  }
  for (const a of String(f.alsoCalled || '').split(',')) pushCand(theoByName, a, p)
}

/* ---------- 3. Theographic 人物首现（verses.json 节级标注） ---------- */
const OSIS_BOOK = {
  Gen: '01', Exod: '02', Lev: '03', Num: '04', Deut: '05', Josh: '06', Judg: '07', Ruth: '08',
  '1Sam': '09', '2Sam': '10', '1Kgs': '11', '2Kgs': '12', '1Chr': '13', '2Chr': '14', Ezra: '15',
  Neh: '16', Esth: '17', Job: '18', Ps: '19', Prov: '20', Eccl: '21', Song: '22', Isa: '23',
  Jer: '24', Lam: '25', Ezek: '26', Dan: '27', Hos: '28', Joel: '29', Amos: '30', Obad: '31',
  Jonah: '32', Mic: '33', Nah: '34', Hab: '35', Zeph: '36', Hag: '37', Zech: '38', Mal: '39',
  Matt: '40', Mark: '41', Luke: '42', John: '43', Acts: '44', Rom: '45', '1Cor': '46',
  '2Cor': '47', Gal: '48', Eph: '49', Phil: '50', Col: '51', '1Thess': '52', '2Thess': '53',
  '1Tim': '54', '2Tim': '55', Titus: '56', Phlm: '57', Heb: '58', Jas: '59', '1Pet': '60',
  '2Pet': '61', '1John': '62', '2John': '63', '3John': '64', Jude: '65', Rev: '66',
}
const verses = readJson(path.join(MAT, 'verses.json'))
const personFirst = new Map() // theo record ID → [book, chapter, verse]
const versesOfTheo = new Map() // theo record ID → Set('book:chapter:verse')（阶段4经文重合度用）
for (const v of [...verses].sort((a, b) => String(a.fields.verseID).localeCompare(String(b.fields.verseID)))) {
  const m = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/.exec(v.fields.osisRef)
  if (!m || !OSIS_BOOK[m[1]]) continue
  const pos = [OSIS_BOOK[m[1]], Number(m[2]), Number(m[3])]
  for (const pid of v.fields.people || []) {
    if (!personFirst.has(pid)) personFirst.set(pid, pos)
    if (!versesOfTheo.has(pid)) versesOfTheo.set(pid, new Set())
    versesOfTheo.get(pid).add(`${OSIS_BOOK[m[1]]}:${Number(m[2])}:${Number(m[3])}`)
  }
}

/* ---------- 4. 三阶段匹配 ---------- */
const matchOf = new Map() // TIPNR entry → theo record
const theoUsed = new Set()
let st1 = 0, st2 = 0, st3 = 0, fail = 0, noCand = 0

// 多词专名组先处理（如 "mary magdalene" 先认领记录，"mary" 组再消歧时已排除该记录）
const groupKeys = [...tipnrByName.keys()].sort(
  (a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length,
)
for (const name of groupKeys) {
  const tpList = tipnrByName.get(name)
  const cands = theoByName.get(name) || []
  if (!cands.length) { noCand += tpList.length; continue }

  if (cands.length === 1 && tpList.length === 1) {
    matchOf.set(tpList[0], cands[0])
    theoUsed.add(cands[0].id)
    st1++
    continue
  }

  const stage3 = []
  for (const t of tpList) {
    const { code, suffix } = parseStrong(t.strong)
    const key = code + suffix || t.name
    const tf = firstVerseOf.get(key)
    if (!tf) { fail++; continue }
    const hits = cands.filter((c) => {
      const cf = personFirst.get(c.id)
      return cf && cf[0] === tf[0] && cf[1] === tf[1] && cf[2] === tf[2]
    })
    if (hits.length === 0) { stage3.push({ t, key }); continue }
    const exact = hits.filter((c) => normName(c.fields.name) === name)
    const pick = hits.length === 1 ? hits[0]
      : exact.length === 1 ? exact[0]
      : hits.filter((c) => !theoUsed.has(c.id)).length === 1 ? hits.find((c) => !theoUsed.has(c.id))
      : null
    if (pick && !theoUsed.has(pick.id)) {
      matchOf.set(t, pick)
      theoUsed.add(pick.id)
      st2++
    } else fail++
  }

  for (const { t, key } of stage3) {
    const exactNamed = (c) => normName(c.fields.name) === name || normName(c.fields.displayTitle) === name
    const pubs = cands.filter((c) => c.fields.status === 'publish' && exactNamed(c) && !theoUsed.has(c.id))
    if (pubs.length !== 1) { fail++; continue }
    const main = pubs[0]
    const mainVc = Number(main.fields.verseCount) || 0
    const othersMax = Math.max(0, ...cands.filter((c) => c !== main).map((c) => Number(c.fields.verseCount) || 0))
    if (mainVc >= 100 && mainVc >= othersMax * 3) {
      matchOf.set(t, main)
      theoUsed.add(main.id)
      st3++
    } else fail++
  }
}

/* ---------- 4.5 阶段4：经文重合度兜底 ----------
   首现节不同的同名人物（如 John the Apostle：TIPNR 首现太 10:2、Theo 首现太 4:21），
   用双方全部经文的节级重合度判定：要求同名或复合名（"Herod Antipas" 对 TIPNR "Herod"）、
   重合率 ≥0.5 且 ≥ 次优 1.5 倍。按经文数降序处理（大人物先认领，避免小记录误占）。 */
let st4 = 0
/** 候选是否承载该 TIPNR 名：name 精确一致；或 displayTitle 以该名开头（Herod Antipas）；
 *  或 ≤3 词的标题以该名收尾（John Mark）——排除 "Joseph (Mary's Husband)" 这类居中词污染 */
const carriesName = (c, name) => {
  if (normName(c.fields.name) === name) return true
  const t = normName(c.fields.displayTitle)
  if (!t) return false
  if (t === name || t.startsWith(name + ' ')) return true
  const words = t.split(' ')
  return words.length <= 3 && words[words.length - 1] === name
}
const unmatchedBySize = tipnrPersons
  .filter((t) => !matchOf.has(t))
  .map((t) => {
    const { code, suffix } = parseStrong(t.strong)
    const key = code + suffix || t.name
    return { t, key, size: versesOfTipnr.get(key)?.size || 0 }
  })
  .filter((x) => x.size >= 2)
  .sort((a, b) => b.size - a.size)
for (const { t, key, size } of unmatchedBySize) {
  const tv = versesOfTipnr.get(key)
  const name = normName(t.name)
  let best = null, bestScore = 0, secondScore = 0
  for (const c of theoByName.get(name) || []) {
    if (theoUsed.has(c.id) || !carriesName(c, name)) continue
    const cv = versesOfTheo.get(c.id)
    if (!cv || cv.size < 2) continue
    let inter = 0
    for (const v of tv) if (cv.has(v)) inter++
    const score = inter / Math.min(size, cv.size)
    if (score > bestScore) { secondScore = bestScore; bestScore = score; best = c }
    else if (score > secondScore) secondScore = score
  }
  if (best && bestScore >= 0.5 && bestScore >= secondScore * 1.5) {
    matchOf.set(t, best)
    theoUsed.add(best.id)
    st4++
  }
}

/* ---------- 5. 生成人物增强数据 ---------- */
// theo record → 强码（反向映射；关系引用时优先存强码便于前端联动）
const strongOfTheo = new Map() // theo record ID → 归一化强码
for (const [t, c] of matchOf) {
  const { code, suffix } = parseStrong(t.strong)
  strongOfTheo.set(c.id, code + suffix || t.name)
}
const theoById = new Map(theoPeople.map((p) => [p.id, p]))

/** 关系引用 → 强码或英文名（未匹配 TIPNR 的关系人用 displayTitle 英文） */
const relRef = (recIds) => {
  const out = []
  for (const id of recIds || []) {
    const s = strongOfTheo.get(id)
    if (s) { out.push(s); continue }
    const p = theoById.get(id)
    if (p) out.push(String(p.fields.displayTitle || p.fields.name))
  }
  return out
}

const dictClip = (raw) => {
  // 清洗 Airtable CSV 导出残留的公式前缀（'= 公式标记，如保罗 G3972G 词条开头），
  // 正文保持源词典完整内容（不再截断，人物页展示全词条）
  return String(Array.isArray(raw) ? raw.join(' ') : raw || '')
    .replace(/^'=/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const personsOut = {}
let withYears = 0, withRel = 0, withDict = 0
for (const [t, c] of matchOf) {
  const { code, suffix } = parseStrong(t.strong)
  const key = code + suffix || t.name
  const f = c.fields
  const rec = {}
  const by = f.birthYear === undefined ? null : Number(f.birthYear)
  const dy = f.deathYear === undefined ? null : Number(f.deathYear)
  if (Number.isFinite(by)) rec.by = by
  if (Number.isFinite(dy)) rec.dy = dy
  if (rec.by !== undefined || rec.dy !== undefined) withYears++
  const rel = {}
  const fa = relRef(f.father), mo = relRef(f.mother), sp = relRef(f.partners),
    ch = relRef(f.children), sb = relRef(f.siblings)
  if (fa.length) rel.fa = fa[0]
  if (mo.length) rel.mo = mo[0]
  if (sp.length) rel.sp = sp
  if (ch.length) rel.ch = ch
  if (sb.length) rel.sb = sb
  if (Object.keys(rel).length) { rec.rel = rel; withRel++ }
  const vc = Number(f.verseCount)
  if (Number.isFinite(vc) && vc > 0) rec.vc = vc
  const dict = dictClip(f.dictText || f.dictionaryText)
  if (dict) { rec.dict = dict; withDict++ }
  if (Object.keys(rec).length) personsOut[key] = rec
}

/* ---------- 6. 编年事件（Events.csv） ---------- */
// personLookup（name_id 形态）→ theo record id：事件参与者的精确记录索引
// （同名人物如 Mary 有 6 条独立记录，personLookup 唯一区分——绝不能按名字聚合）
const theoByLookup = new Map()
for (const p of theoPeople) {
  const lk = String(p.fields.personLookup || '').trim()
  if (lk) theoByLookup.set(lk, p.id)
}
/** 事件参与者 → 强码：matched theo record 返回强码（与 persons.json 键一致，
 *  前端人物页据此精确反查"这个人"的事件，同名不混淆）；未匹配返回 null */
const pplStrong = (token) => {
  const recId = theoByLookup.get(token)
  if (!recId) return null
  return strongOfTheo.get(recId) || null
}
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

const eventsText = fs.readFileSync(path.join(MAT, 'Events.csv'), 'utf8').replace(/^\uFEFF/, '')
const eventLines = eventsText.split('\n').filter((l) => l.trim())
const eventHeader = parseCsvLine(eventLines[0])
const eIdx = Object.fromEntries(eventHeader.map((h, i) => [h.trim(), i]))

// 标题中文映射（键 = 原文标题；采用和合本标准译名）
const titleZhRaw = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'event-titles-zh.json'), 'utf8'))
const titleZh = new Map(Object.entries(titleZhRaw).filter(([k]) => !k.startsWith('_')))

const eventsOut = []
const untranslated = []
for (const line of eventLines.slice(1)) {
  const c = parseCsvLine(line)
  const title = (c[eIdx['title']] || '').trim()
  if (!title) continue
  const yRaw = Number(c[eIdx['startDate']])
  const versesRef = (c[eIdx['verses']] || '').split(',').map((s) => s.trim()).filter(Boolean)
  // OSIS 地址 → [书, 章, 节]（取前 6 节 + 首节，供跳转与展示）
  const vs = []
  for (const ref of versesRef) {
    const m = /^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/.exec(ref)
    if (!m || !OSIS_BOOK[m[1]]) continue
    vs.push(`${OSIS_BOOK[m[1]]}:${Number(m[2])}:${Number(m[3])}`)
  }
  const pplRaw = (c[eIdx['participants']] || '').split(',').map((s) => s.trim()).filter(Boolean)
  // 参与者强码化：personLookup → 强码（人物页精确反查事件）；未匹配记录保留
  // displayTitle 英文名（构建端无强码可映射，前端按原样展示）
  const ppl = []
  const pplName = [] // 未匹配参与者的英文名（详情展示兜底）
  for (const token of pplRaw) {
    const s = pplStrong(token)
    if (s) {
      ppl.push(s)
      continue
    }
    const rec = theoById.get(theoByLookup.get(token) || '')
    const name = rec ? String(rec.fields.displayTitle || rec.fields.name || '') : token
    pplName.push(name || token)
  }
  const zh = titleZh.get(title)
  if (!zh) untranslated.push(title)
  eventsOut.push({
    id: c[eIdx['eventID']] || String(eventsOut.length + 1),
    t: title,
    ...(zh ? { zh } : {}),
    ...(Number.isFinite(yRaw) ? { y: yRaw } : {}),
    ...(c[eIdx['duration']] ? { dur: c[eIdx['duration']] } : {}),
    ...(vs.length ? { vs: vs.slice(0, 6), first: vs[0], nv: vs.length } : {}),
    ...(ppl.length ? { ppl } : {}),
    ...(pplName.length ? { pplName } : {}),
  })
}

/* ---------- 7. 写出 data-src ---------- */
fs.mkdirSync(OUT, { recursive: true })

const SOURCE_META = {
  key: 'theographic',
  name: 'Theographic Bible Metadata',
  lang: 'en',
  license: 'CC BY-SA 4.0',
  url: 'https://github.com/robertrouse/theographic-bible-metadata',
  note: '生卒年与事件年份为 Ussher 式传统编年（非考古学定年）；人物词典摘录来自 Easton\'s Bible Dictionary（公有领域）',
}

fs.writeFileSync(path.join(OUT, 'persons.json'), JSON.stringify({
  source: SOURCE_META,
  chronology: 'traditional (Ussher-style)',
  persons: personsOut,
}))
fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify({
  source: SOURCE_META,
  chronology: 'traditional (Ussher-style)',
  events: eventsOut,
}))
fs.writeFileSync(path.join(OUT, 'content.meta.json'), JSON.stringify({
  source: SOURCE_META,
  files: ['persons.json', 'events.json'],
  importedAt: new Date().toISOString(),
  matchStats: {
    tipnrPersons: tipnrPersons.length,
    matched: st1 + st2 + st3 + st4,
    stage1UniqueName: st1,
    stage2FirstVerse: st2,
    stage3MainRecord: st3,
    stage4VerseOverlap: st4,
    ambiguousGiveUp: fail,
    noCandidate: noCand,
  },
}))

console.log(`匹配: ${st1}（唯一名） + ${st2}（节级首现） + ${st3}（主记录兜底） + ${st4}（经文重合） = ${st1 + st2 + st3 + st4} / ${tipnrPersons.length}`)
console.log(`放弃: 消歧失败 ${fail} · 无候选 ${noCand}`)
console.log(`人物增强: 生卒年 ${withYears} · 关系 ${withRel} · 词典 ${withDict}`)
console.log(`事件: ${eventsOut.length} 条（含年份 ${eventsOut.filter((e) => e.y !== undefined).length} · 中文标题 ${eventsOut.length - untranslated.length}）`)
if (untranslated.length) console.warn(`未翻译标题 ${untranslated.length} 条: ${untranslated.slice(0, 5).join(' / ')}${untranslated.length > 5 ? ' …' : ''}`)
console.log(`输出 -> data-src/theographic/`)
