/**
 * build-prophecy.mjs — 从 scripture-journey 的 prophecies.ts 提取弥赛亚预言数据
 *
 * 读取 data-src/prophecy/source-prophecies.ts（fetch 自
 * github.com/systemslibrarian/scripture-journey 的 data/prophecies.ts，MIT，源自
 * J. Barton Payne《圣经预言百科全书》的弥赛亚预言→应验对），解析出：
 *   - 201 条预言记录（预言经文 / 应验经文 / 英文原文 / 释义 / 类别）
 *   - scholarshipMap（Payne / Edersheim / McDowell 学术注释，按 id）
 * 并为每条预言/应验经文从和合本（chiun，繁体）按 T2S 表转写为简体中文正文。
 *
 * 输出 data-src/prophecy/prophecies.json（自包含，含中文 titleZh/whyZh，
 * 由 zh-overlay 覆盖）；数据构建时再复制进 public/data/prophecy/。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { T2S } from '../../src/lib/t2s-table.mjs'
import { BOOKS } from '../bible-books.mjs'

/**
 * 圣经书卷中英文名 / 简写 → 书卷 id 映射（供英文出处（Gen 3:15 / Deut 18:15–18 …）
 * 转和合本书卷）。以 bible-books.mjs 的 srcName/en 为准，另补常用缩写。
 */
const BOOK_ALIAS = {
  gen: '01', ge: '01', genesis: '01',
  exod: '02', ex: '02', exodus: '02',
  lev: '03', le: '03', leviticus: '03',
  num: '04', nu: '04', numbers: '04',
  deut: '05', dt: '05', deuteronomy: '05', deu: '05',
  josh: '06', jos: '06', joshua: '06',
  judg: '07', jdg: '07', judges: '07', jud: '07',
  ruth: '08', ru: '08',
  '1sam': '09', '1samuel': '09', 'i samuel': '09', '1 samuel': '09', '1samuel': '09', 'samuel': '09',
  '2sam': '10', '2samuel': '10', 'ii samuel': '10', '2 samuel': '10', 'iisamuel': '10',
  '1kgs': '11', '1kings': '11', 'i kings': '11', '1 kings': '11', '1kin': '11',
  '2kgs': '12', '2kings': '12', 'ii kings': '12', '2 kings': '12', '2kin': '12',
  '1chr': '13', '1chronicles': '13', 'i chronicles': '13', '1 chronicles': '13', '1ch': '13',
  '2chr': '14', '2chronicles': '14', 'ii chronicles': '14', '2 chronicles': '14', '2ch': '14',
  ezra: '15', ezr: '15', ez: '15',
  neh: '16', nehemiah: '16',
  est: '17', esth: '17', esther: '17',
  job: '18', jb: '18',
  ps: '19', psa: '19', psalm: '19', psalms: '19', pslm: '19',
  prov: '20', pr: '20', proverbs: '20',
  eccl: '21', ec: '21', ecclesiastes: '21',
  song: '22', so: '22', 'song of solomon': '22', canticles: '22',
  isa: '23', is: '23', isaiah: '23',
  jer: '24', jr: '24', jeremiah: '24',
  lam: '25', la: '25', lamentations: '25',
  ezek: '26', ezk: '26', eze: '26', ezekiel: '26',
  dan: '27', dn: '27', daniel: '27',
  hos: '28', ho: '28', hosea: '28',
  joel: '29', jl: '29',
  amos: '30', am: '30',
  obad: '31', ob: '31', obadiah: '31',
  jonah: '32', jon: '32',
  mic: '33', mi: '33', micah: '33',
  nah: '34', na: '34', nahum: '34',
  hab: '35', hb: '35', habakkuk: '35',
  zeph: '36', zep: '36', zp: '36', zephaniah: '36',
  hag: '37', hg: '37', haggai: '37',
  zech: '38', zec: '38', zc: '38', zechariah: '38',
  mal: '39', ml: '39', malachi: '39',
  matt: '40', mt: '40', matthew: '40',
  mark: '41', mk: '41', mr: '41',
  luke: '42', lk: '42', lu: '42',
  john: '43', jn: '43', jh: '43',
  acts: '44', ac: '44',
  rom: '45', ro: '45', romans: '45',
  '1cor': '46', '1corinthians': '46', '1 corinthians': '46', '1co': '46',
  '2cor': '47', '2corinthians': '47', '2 corinthians': '47', '2co': '47',
  gal: '48', galatians: '48',
  eph: '49', ephesians: '49',
  phil: '50', philippians: '50', php: '50',
  col: '51', colossians: '51',
  '1thess': '52', '1thessalonians': '52', '1 th': '52', '1thes': '52',
  '2thess': '53', '2thessalonians': '53', '2 th': '53', '2thes': '53',
  '1tim': '54', '1timothy': '54', '1 ti': '54',
  '2tim': '55', '2timothy': '55', '2 ti': '55',
  titus: '56', tit: '56',
  phlm: '57', phm: '57', philemon: '57',
  heb: '58', hebrews: '58',
  james: '59', jas: '59', jm: '59',
  '1pet': '60', '1peter': '60', '1 pe': '60', '1ptr': '60',
  '2pet': '61', '2peter': '61', '2 pe': '61', '2ptr': '61',
  '1jn': '62', '1john': '62', '1 john': '62',
  '2jn': '63', '2john': '63', '2 john': '63',
  '3jn': '64', '3john': '64', '3 john': '64',
  jude: '65',
  rev: '66', revelation: '66', 'revelation of john': '66',
}
const BOOK_LIST = BOOKS

const CATEGORY_ZH = {
  Lineage: '谱系',
  Identity: '身份',
  Ministry: '职事',
  Rejection: '弃绝',
  Passion: '受难',
  Resurrection: '复活',
  Kingdom: '国度',
}
const aliasToId = new Map(Object.entries(BOOK_ALIAS))

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '../..')
const SRC = join(SITE_ROOT, 'data-src', 'prophecy', 'source-prophecies.ts')
const CHIUN = join(SITE_ROOT, 'public', 'data', 'search', 'scripture-chiun.json')
const ZH_OVERLAY = join(__dirname, 'zh-overlay.json')
const OUT = join(SITE_ROOT, 'data-src', 'prophecy', 'prophecies.json')
const PUBLIC_OUT = join(SITE_ROOT, 'public', 'data', 'prophecy', 'prophecies.json')

const src = readFileSync(SRC, 'utf8')

/* ---------- 简易字符串安全读取 ---------- */
let pos = 0
function skipWs() {
  while (pos < src.length && /\s/.test(src[pos])) pos++
}
function peekSafe() {
  return src[pos]
}
/** 读取下一个双引号字符串（跳过转义），返回其内容并推进 pos */
function readString() {
  if (src[pos] !== '"') throw new Error(`expected string at ${pos}: ${src.slice(pos, pos + 20)}`)
  pos++ // 开引号
  let out = ''
  while (pos < src.length) {
    const c = src[pos]
    if (c === '\\') {
      const n = src[pos + 1]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === '"') out += '"'
      else if (n === "'") out += "'"
      else out += n
      pos += 2
      continue
    }
    if (c === '"') {
      pos++ // 闭引号
      return out
    }
    out += c
    pos++
  }
  throw new Error('unterminated string')
}
/** 读取一个数字或标识符标识的数字字面量 */
function readNumberOrIdent() {
  const m = /^[-+]?\d+/.exec(src.slice(pos))
  if (!m) throw new Error(`expected number at ${pos}: ${src.slice(pos, pos + 20)}`)
  pos += m[0].length
  return Number(m[0])
}
function readIdent() {
  const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(pos))
  if (!m) throw new Error(`expected identifier at ${pos}`)
  pos += m[0].length
  return m[0]
}
/** 读取函数调用的括号体（跳过嵌套与字符串），返回 token 化的顶层参数 */
function readCallArgs() {
  if (peekSafe() !== '(') throw new Error(`expected ( at ${pos}`)
  pos++
  const args = []
  let depth = 0
  let cur = ''
  const flush = () => {
    cur = cur.trim()
    if (cur) {
      args.push(cur)
      cur = ''
    }
  }
  // 进入一个函数调用结构（makeLesson / payne / edersheim / mcdowell）
  // 返回的是顶层（确切说 makeLesson 的左括号内、除嵌套括号与字符串外的逗号分隔片）
  // 我们用通用扫描：遇到 '(' depth++，遇到 ')' depth--，字符串跳过
  while (pos < src.length) {
    const c = src[pos]
    if (c === '"') {
      cur += readString()
      continue
    }
    if (c === '(') {
      depth++
      cur += c
      pos++
      continue
    }
    if (c === ')') {
      if (depth === 0) {
        pos++
        flush()
        return args
      }
      depth--
      cur += c
      pos++
      continue
    }
    if (c === ',' && depth === 0) {
      pos++
      flush()
      continue
    }
    if (c === '{' || c === '}') {
      // 对象字面量整体作为 args 中不可拆的部分：直接吞到匹配 }（含字符串）
      const brace = c
      cur += readBraceObject()
      continue
    }
    cur += c
    pos++
  }
  throw new Error('unterminated call args')
}
function readBraceObject() {
  // 已指向起始 '{'，吞掉整个对象（含嵌套与字符串）
  let out = src[pos]
  pos++
  let depth = 1
  while (pos < src.length) {
    const c = src[pos]
    if (c === '"') {
      out += readString()
      continue
    }
    if (c === '{') {
      depth++
      out += c
      pos++
      continue
    }
    if (c === '}') {
      depth--
      out += c
      pos++
      if (depth === 0) return out
      continue
    }
    out += c
    pos++
  }
  throw new Error('unterminated brace object')
}

/* ---------- 定位 prophecies 数组并逐个解析 makeLesson ---------- */
function locateArray(marker) {
  const idx = src.indexOf(marker)
  if (idx < 0) throw new Error(`marker not found: ${marker}`)
  const eq = src.indexOf('=', idx)
  const open = src.indexOf('[', eq)
  pos = open + 1
}
const lessons = []
locateArray('export const prophecies:Lesson')
// 循环读取 makeLesson( ... ) 记录
outer: while (true) {
  skipWs()
  if (peekSafe() === undefined) break
  // 遇到 ] 结束
  if (peekSafe() === ']') break
  // 期望 makeLesson 标识符（也可能有注释/其他，防御性跳过非 "makeLesson" 前缀）
  if (!/makeLesson/.test(src.slice(pos, pos + 11))) {
    // 跳过当前 token 直到下一个逗号或任意单个字符，用于跳过属性名等
    pos++
    continue
  }
  pos += 'makeLesson'.length
  const args = readCallArgs()
  const lesson = parseLessonArgs(args)
  if (lesson) lessons.push(lesson)
  // 之后期待逗号或 ]，简单跳过
  skipWs()
  if (peekSafe() === ',') { pos++; continue }
  if (peekSafe() === ']') break
}

// 追加 prophecies.push(makeLesson(...)) 追加的记录（99+）
{
  const re = /prophecies\.push\(\s*makeLesson\s*\(/g
  re.lastIndex = pos
  let m
  while ((m = re.exec(src))) {
    pos = re.lastIndex - 1 // 指向 '('
    const args = readCallArgs()
    const lesson = parseLessonArgs(args)
    if (lesson) lessons.push(lesson)
    re.lastIndex = pos
  }
}
function tokenizeArg(argStr) {
  // argStr 可能是 "string" 或数字，或 scholarship 对象展开
  const a = argStr.trim()
  if (!a) return { type: 'multi' }
  if (a[0] === '"' || a[0] === "'") {
    // 反解字符串（我们 readCallArgs 已去掉引号并 unescape，直接返回）
    return { type: 'str', v: a }
  }
  if (/^[-+]?\d+$/.test(a)) return { type: 'num', v: Number(a) }
  return { type: 'multi', v: a }
}

function parseLessonArgs(args) {
  if (args.length < 9) return null
  const [id, slug, title, category, otRef, ntRef, otText, ntText, whyItMatters, statusArg, scholarshipArg] = args
  let status = 'active'
  if (statusArg && /coming-soon/.test(statusArg)) status = 'coming-soon'
  const scholarship = scholarshipArg ? parseScholarshipLiteral(scholarshipArg) : null
  return {
    id: Number(id.trim()),
    slug: slug.trim(),
    title: title.trim(),
    category: category.trim(),
    otRef: otRef.trim(),
    ntRef: ntRef.trim(),
    otText: otText.trim(),
    ntText: ntText.trim(),
    explanation: whyItMatters.trim(),
    status,
    scholarship,
  }
}

/**
 * 解析 scholarship 对象字面量片段，如
 *   "{ ...payne(23, "Isa 7:14", "..."), ...edersheim("..."), ...mcdowell(2, "Born of a Virgin", "...") }"
 * 由于 readBraceObject 已吞下对象并拼接原始文本（含引号），这里重新按状态机解析。
 */
function parseScholarshipLiteral(literal) {
  const out = {}
  // 在此字面量内提取 payne( ... ) / edersheim( ... ) / mcdowell( ... ) 的原始参数串
  const pairRe = /(payne|edersheim|mcdowell)\s*\(/g
  let m
  let idx = 0
  let s = literal
  while ((m = pairRe.exec(s))) {
    const name = m[1]
    const callPos = m.index + m[0].length
    // 在 callPos 处平衡扫描括号体
    let depth = 1
    let i = callPos
    let body = ''
    while (i < s.length) {
      const c = s[i]
      if (c === '"') {
        // 读字符串到 s，跳转义
        let j = i + 1
        let str = ''
        while (j < s.length) {
          const cc = s[j]
          if (cc === '\\') { str += (s[j + 1] || ''); j += 2; continue }
          if (cc === '"') break
          str += cc
          j++
        }
        body += '"' + str + '"'
        i = j + 1
        continue
      }
      if (c === '(') depth++
      if (c === ')') {
        depth--
        if (depth === 0) { body += ')'; i++; break }
      }
      body += c
      i++
    }
    parseScholarshipCall(name, body, out)
    pairRe.lastIndex = i
    idx = i
  }
  // 平铺形字段（部分条目使用 { scholarlyStrength, scholarsWhoList, scholarNote, ntUsage }）
  const strength = grabFlat(literal, 'scholarlyStrength')
  const scholars = grabFlatArray(literal, 'scholarsWhoList')
  const ntUsage = grabFlat(literal, 'ntUsage')
  const scholarNote = grabFlat(literal, 'scholarNote')
  if (strength) out.strength = strength
  if (scholars !== undefined && scholars !== null) out.scholars = scholars
  if (scholarNote) out.scholarNote = scholarNote
  if (ntUsage !== undefined) out.ntUsage = ntUsage
  return Object.keys(out).length ? out : null
}
/** 取对象字段的单值（字符串/标识符/null） */
function grabFlat(lit, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*`).exec(lit)
  if (!m) return undefined
  let s = lit.slice(m.index + m[0].length).trim()
  if (s.startsWith('null')) return null
  const q = s[0]
  if (q === '"' || q === "'") {
    let out = ''
    let j = 1
    while (j < s.length) {
      const c = s[j]
      if (c === '\\') { out += s[j + 1] || ''; j += 2; continue }
      if (c === q) break
      out += c
      j++
    }
    return out
  }
  const bm = /^[A-Za-z0-9_.\-: ]+/.exec(s)
  return bm ? bm[0].trim() : null
}
/** 取数组字段（如 scholarsWhoList: ['Payne','Edersheim']） */
function grabFlatArray(lit, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\[`).exec(lit)
  if (!m) return undefined
  let s = lit.slice(m.index + m[0].length)
  const items = []
  let out = ''
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ']') { if (out.trim()) items.push(out.trim().replace(/^['"]|['"]$/g, '')); break }
    if (c === ',') { if (out.trim()) items.push(out.trim().replace(/^['"]|['"]$/g, '')); out = ''; i++; continue }
    out += c
    i++
  }
  return items
}
function parseScholarshipCall(name, body, out) {
  // body 形如 "123, \"ref\", \"note\"" 或 "\"note\""（不含开头的 '('，仅含结尾 ')'）
  const parts = splitTopLevel(body.slice(0, -1))
  const strip = (x) => x.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"')
  if (name === 'payne') {
    out.payne = { encyclopediaNumber: Number(strip(parts[0])), reference: strip(parts[1]), note: parts[2] ? strip(parts[2]) : '' }
  } else if (name === 'edersheim') {
    out.edersheim = { note: parts[0] ? strip(parts[0]) : '' }
  } else if (name === 'mcdowell') {
    out.mcdowell = { prophecyNumber: Number(strip(parts[0])), title: strip(parts[1]), note: parts[2] ? strip(parts[2]) : '' }
  }
}
function splitTopLevel(body) {
  const parts = []
  let cur = ''
  let depth = 0
  let inStr = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '"') {
      inStr = !inStr
      cur += c
      continue
    }
    if (!inStr && c === '(') depth++
    if (!inStr && c === ')') depth--
    if (!inStr && c === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

/* ---------- 解析 scholarshipMap（按 id 补齐，优先级高于数组内内联） ---------- */
function parseScholarshipMap() {
  const idx = src.indexOf('const _scholarshipMap')
  if (idx < 0) return new Map()
  const map = new Map()
  const open = src.indexOf('{', idx)
  let p = open + 1
  // 解析 "id: { ... }" 键值对
  const re = /(\d+)\s*:\s*\{/g
  re.lastIndex = p
  let m
  while ((m = re.exec(src))) {
    const id = Number(m[1])
    // 在该对象起始处平衡扫描到匹配 }
    let s = m.index + m[0].length
    let depth = 1
    let body = ''
    while (s < src.length && depth > 0) {
      const c = src[s]
      if (c === '"') {
        const save = pos
        pos = s
        body += '"' + readString() + '"'
        s = pos
        pos = save
        continue
      }
      if (c === '{') depth++
      if (c === '}') { depth--; if (depth === 0) { s++; break } }
      body += c
      s++
    }
    re.lastIndex = s
    const parsed = parseScholarshipLiteral(body)
    if (parsed) map.set(id, parsed)
  }
  return map
}

/* ---------- 和合本简体中文正文 ---------- */
const chiun = JSON.parse(readFileSync(CHIUN, 'utf8'))
const bookIdAt = chiun.books // array of id
// 建立 bookId -> verse map
const verseByBook = new Map()
for (let bi = 0; bi < chiun.books.length; bi++) {
  verseByBook.set(chiun.books[bi], new Map())
}
for (const [bi, ch, v, text] of chiun.verses) {
  const bid = chiun.books[bi]
  if (!verseByBook.has(bid)) verseByBook.set(bid, new Map())
  verseByBook.get(bid).set(`${ch}:${v}`, text)
}
// srcName -> id 书名映射（用于英文出处解析）
const bookNameMap = new Map()
for (const b of BOOK_LIST) {
  bookNameMap.set(b.srcName.replace(/\s+/g, ' ').toLowerCase(), b.id)
  bookNameMap.set((b.en || b.srcName).toLowerCase(), b.id)
  for (const al of b.ab || []) bookNameMap.set(al.toLowerCase(), b.id)
}
function toSimple(t) {
  return (t || '')
    .split('')
    .map((c) => T2S.get(c) || c)
    .join('')
}
/**
 * 按英文出处取和合本简体中文。ref 形如 "Gen 3:15" / "Deut 18:15–18" / "Isa 9:1-2; Luke 1:32"
 * 返回 { text(简体，多节合并), warnings }
 */
function resolveChinese(ref) {
  const warnings = []
  const verses = []
  const segments = ref.split(/[;；]/)
  for (const seg of segments) {
    const r = parseUnitRef(seg.trim())
    if (!r) { warnings.push(`无法解析出处: "${seg.trim()}"`); continue }
    const { id, ch, vStart, vEnd } = r
    const bookVerses = verseByBook.get(id)
    if (!bookVerses) { warnings.push(`无书卷 ${id}`); continue }
    if (!vStart) { warnings.push(`${ref} 无节号`); continue }
    const end = vEnd || vStart
    for (let v = vStart; v <= end; v++) {
      const t = bookVerses.get(`${ch}:${v}`)
      verses.push(t !== undefined ? toSimple(t) : `〔缺 ${id} ${ch}:${v}〕`)
    }
  }
  return { text: verses.join('\n'), warnings }
}
function parseUnitRef(unit) {
  return parseUnitRefSimple(unit)
}
function parseUnitRefSimple(unit) {
  const s = unit.trim()
  // 形如 "Gen 3:15" | "Deut 18:15–18" | "2 Sam 7:12–13" | "Isa 9:1-2" | "Ps 110:4"
  const mm = /^(.+?)\s+(\d{1,3})(?::(\d{1,3}))?([\s\u2013–—-]*([\d\u2013–-]*))?$/.exec(s)
  if (!mm) return null
  let name = mm[1].trim().toLowerCase()
  name = name.replace(/\s+/g, ' ')
  // 形如 "2 samuel" / "1 john"：去掉序号前的空格使用带序号的别名键
  let id = aliasToId.get(name)
  if (!id) {
    const np = /^(\d)\s+(.+)$/.exec(name)
    if (np) id = aliasToId.get(`${np[1]}${np[2].replace(/\s+/g, '')}`) || aliasToId.get(name.replace(/\s+/g, ''))
    if (!id) id = aliasToId.get(name.replace(/\s+/g, ''))
  }
  if (!id) return null
  const ch = Number(mm[2])
  let vStart = mm[3] ? Number(mm[3]) : 0
  let vEnd = null
  const range = (mm[5] || '').trim()
  if (mm[3] && range) {
    // 范围书写（同章跨节）：Deut 18:15–18 / 7:12–13
    const r = /^[\s\u2013–—-]*(\d{1,3})\s*$/.exec(range)
    if (r) vEnd = Number(r[1])
  }
  return { id, ch, vStart, vEnd }
}

/* ---------- 主流程 ---------- */
const lessonsParsed = lessons
const scholarshipMap = parseScholarshipMap()
// 合并内联 scholarship 与 _scholarshipMap（map 为按 id 的学术注释，两者互补）
function mergeScholarship(l, mapVal) {
  const a = l.scholarship && typeof l.scholarship === 'object' ? l.scholarship : {}
  const b = mapVal || {}
  const merged = { ...a, ...b }
  for (const k of ['strength', 'scholars', 'scholarNote', 'ntUsage']) {
    if (b[k]) merged[k] = b[k]
  }
  return Object.keys(merged).length ? merged : null
}
function buildInterpretations(sch) {
  if (!sch) return { interpretations: [], strength: '', ntUsage: '' }
  const entries = []
  for (const name of ['payne', 'edersheim', 'mcdowell']) {
    if (sch[name]) entries.push({ tradition: name, ...sch[name] })
  }
  return {
    interpretations: entries,
    strength: sch.strength || '',
    ntUsage: sch.ntUsage || '',
  }
}
// 中文正文 + 中文标题/解释覆盖
let zhOverlay = {}
if (existsSync(ZH_OVERLAY)) zhOverlay = JSON.parse(readFileSync(ZH_OVERLAY, 'utf8'))
const records = lessonsParsed.map((l, i) => {
  const zh = zhOverlay[l.id] || {}
  const ot = resolveChinese(l.otRef)
  const nt = resolveChinese(l.ntRef)
  const sch = mergeScholarship(l, scholarshipMap.get(l.id))
  const { interpretations, strength, ntUsage } = buildInterpretations(sch)
  return {
    id: l.id,
    key: l.slug,
    title: l.title,
    titleZh: zh.titleZh || l.title,
    category: l.category,
    categoryZh: zh.categoryZh || CATEGORY_ZH[l.category] || l.category,
    otRef: l.otRef,
    ntRef: l.ntRef,
    otText: l.otText,
    otTextZh: ot.text,
    ntText: l.ntText,
    ntTextZh: nt.text,
    explanation: l.explanation,
    explanationZh: zh.explanationZh || '',
    status: l.status === 'coming-soon' ? 'coming-soon' : 'fulfilled',
    certainty: zh.certainty || 'high',
    strength,
    ntUsage,
    interpretations,
  }
})

const out = {
  meta: {
    source: 'systemslibrarian/scripture-journey (data/prophecies.ts)',
    derivedFrom: 'J. Barton Payne, Encyclopedia of Biblical Prophecy (Messianic subset)',
    license: 'MIT (dataset)',
    fetchedAt: '2026-08-20',
    count: records.length,
  },
  prophecies: records,
}
mkdirSync(dirname(OUT), { recursive: true })
mkdirSync(dirname(PUBLIC_OUT), { recursive: true })
const outJson = JSON.stringify(out, null, 2)
writeFileSync(OUT, outJson)
writeFileSync(PUBLIC_OUT, outJson)
console.log(`写好 ${records.length} 条预言 -> data-src 与 public/data`)
// 打印未覆盖中文标题的记录数与解析警告数，便于核对
const noZh = records.filter((r) => !r.titleZh)
console.log(`缺中文标题: ${noZh.length}`)
let warns = 0
for (const r of records) {
  warns += /〔缺/.test(r.otTextZh) ? 1 : 0
  warns += /〔缺/.test(r.ntTextZh) ? 1 : 0
}
console.log(`含缺文标记的中文正文行数: ${warns}`)