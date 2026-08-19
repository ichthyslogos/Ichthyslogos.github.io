/**
 * build-search-index.mjs — 第一阶段搜索索引构建（纯数据检索，无 AI）
 *
 * 从现有运行时数据（public/data/**）只读抽取，生成统一搜索索引到 public/data/search/：
 *   index.json                    轻量实体索引（打开搜索面板即加载）
 *   scripture-{key}.json          全部译本全本节文本（用户输入后按需懒加载）
 *   commentary-{file}.json        注释段落索引（标题 + 文本摘录，按源懒加载）
 *
 * 数据来源与许可：
 *   经文    translations/*（STEP Bible / NIV 导入数据，含和合本/思高本/KJV/ASV/DRC 等）
 *   人物    commentary/notes/tipnr（STEP TIPNR, CC BY 4.0）：type Male/Female
 *   地点    同上 type=Place + place-coords.json（坐标）
 *   政权    geography/regions.json（Pleiades + STEP + DARE）：entity_type nation/region
 *   事件    geography/journeys.json（UBS MARBLE, CC BY-SA 4.0）
 *   时期    geography/periods.json（FISH 内部索引）
 *   注释段  commentary/fullCommentary/*（MH/Calvin/RWP/Abbott/Catena）
 *          + summary|interpretation/mhcc（MH 简明，按章总结/经文解释）
 *   主题    apologetics/topics/*.json（护教学专题，双语标题 + 标签）
 *   教会史  church-history/part1-5.json（章标题 + 时期名）
 *
 * 注释全文取舍（准确性优先）：源文件 73MB 全量入前端不可行；索引保留 heading 原文
 * 与 text 前 180 字符摘录（原样复制），命中后跳读经页看完整注释。正文中段关键词的
 * 覆盖留给第二阶段后端 FTS（见 docs/SEARCH.md）。
 *
 * 原则：源数据一律只读，本脚本不改写任何既有数据文件；索引条目文本原样复制保证准确。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../bible-books.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = path.join(root, 'public/data')
const OUT = path.join(DATA, 'search')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const exists = (p) => fs.existsSync(p)

/** 66 卷中文简称（地址解析用；单字「约」按最长匹配落到约翰福音） */
const ZH_ABBR = {
  '01': ['创'], '02': ['出'], '03': ['利'], '04': ['民'], '05': ['申'],
  '06': ['书'], '07': ['士'], '08': ['得'],
  '09': ['撒上'], '10': ['撒下'], '11': ['王上'], '12': ['王下'],
  '13': ['代上'], '14': ['代下'], '15': ['拉'], '16': ['尼'], '17': ['斯'],
  '18': ['伯'], '19': ['诗'], '20': ['箴'], '21': ['传'], '22': ['歌'],
  '23': ['赛'], '24': ['耶'], '25': ['哀'], '26': ['结'], '27': ['但'],
  '28': ['何'], '29': ['珥'], '30': ['摩'], '31': ['俄'], '32': ['拿'],
  '33': ['弥'], '34': ['鸿'], '35': ['哈'], '36': ['番'], '37': ['该'],
  '38': ['亚'], '39': ['玛'],
  '40': ['太'], '41': ['可'], '42': ['路'], '43': ['约'], '44': ['徒'],
  '45': ['罗'], '46': ['林前'], '47': ['林后'], '48': ['加'], '49': ['弗'],
  '50': ['腓'], '51': ['西'], '52': ['帖前'], '53': ['帖后'], '54': ['提前'],
  '55': ['提后'], '56': ['多'], '57': ['门'], '58': ['来'], '59': ['雅'],
  '60': ['彼前'], '61': ['彼后'], '62': ['约一'], '63': ['约二'], '64': ['约三'],
  '65': ['犹'], '66': ['启'],
}

/** 常用英文缩写（OSIS 附近常见写法） */
const EN_ABBR = {
  '01': ['gen', 'ge', 'gn'], '02': ['ex', 'exod', 'exo'], '03': ['lev', 'lv', 'le'],
  '04': ['num', 'nu'], '05': ['deut', 'dt', 'de'], '06': ['josh', 'jos'],
  '07': ['judg', 'jdg', 'jud'], '08': ['ruth', 'ru', 'rth'],
  '09': ['1sam', '1sa', '1s'], '10': ['2sam', '2sa', '2s'],
  '11': ['1kgs', '1ki', '1kin', '1k'], '12': ['2kgs', '2ki', '2kin', '2k'],
  '13': ['1chr', '1ch', '1chron'], '14': ['2chr', '2ch', '2chron'],
  '15': ['ezra', 'ezr', 'ez'], '16': ['neh', 'ne'], '17': ['esth', 'est'],
  '18': ['job', 'jb'], '19': ['ps', 'psa', 'psalm', 'psm'],
  '20': ['prov', 'pr', 'pro'], '21': ['eccl', 'ecc', 'qoh'],
  '22': ['song', 'sos', 'songofsolomon', 'canticles'],
  '23': ['isa', 'is'], '24': ['jer', 'je'], '25': ['lam', 'la'],
  '26': ['ezek', 'eze', 'ezk', 'eze'], '27': ['dan', 'da'],
  '28': ['hos', 'ho'], '29': ['joel', 'joe'], '30': ['amos', 'am'],
  '31': ['obad', 'ob', 'obd'], '32': ['jonah', 'jon'],
  '33': ['mic', 'mi'], '34': ['nah', 'na'], '35': ['hab', 'hb'],
  '36': ['zeph', 'zep', 'zp'], '37': ['hag', 'hg'], '38': ['zech', 'zec', 'zch'],
  '39': ['mal', 'ml'],
  '40': ['matt', 'mt', 'mat'], '41': ['mark', 'mk', 'mr'], '42': ['luke', 'lk', 'lu'],
  '43': ['john', 'jn', 'joh', 'jn'], '44': ['acts', 'act', 'ac'],
  '45': ['rom', 'ro', 'rm'], '46': ['1cor', '1co'], '47': ['2cor', '2co'],
  '48': ['gal', 'ga'], '49': ['eph', 'ep'], '50': ['phil', 'php', 'pp'],
  '51': ['col'], '52': ['1thess', '1th'], '53': ['2thess', '2th'],
  '54': ['1tim', '1ti'], '55': ['2tim', '2ti'], '56': ['titus', 'tit', 'ti'],
  '57': ['phlm', 'phm', 'pm'], '58': ['heb', 'he'], '59': ['jas', 'jam'],
  '60': ['1pet', '1pe', '1pt'], '61': ['2pet', '2pe', '2pt'],
  '62': ['1john', '1jn', '1jo', '1joh'], '63': ['2john', '2jn', '2jo'],
  '64': ['3john', '3jn', '3jo'], '65': ['jude', 'jud', 'jd'],
  '66': ['rev', 're', 'rv', 'apoc'],
}

/** Strong 码归一化：H0175G → 基础码 H175 + 后缀 G；后缀区分大小写（TIPNR 用小写区分同名人物） */
function parseStrong(strong) {
  if (!strong) return { code: '', suffix: '' }
  const m = /^([HG])0*(\d+)([A-Za-z]*)$/.exec(strong)
  if (!m) return { code: strong, suffix: '' }
  return { code: m[1] + m[2], suffix: m[3] || '' }
}

/** 书卷 → 圣经时期映射（与 src/lib/data.js BOOK_PERIODS 保持一致；
 *  地点条目 ps 字段（出现的时期）供地图侧栏「时期地点」词条与中文地点搜索用） */
const BOOK_PERIODS = {
  '01': 'abraham', '02': 'exodus', '03': 'exodus', '04': 'exodus', '05': 'exodus',
  '06': 'exodus', '07': 'exodus', '08': 'exodus', '09': 'david', '10': 'david',
  '11': 'david', '12': 'assyria', '13': 'david', '14': 'assyria', '15': 'persia',
  '16': 'persia', '17': 'persia', '18': 'abraham', '19': 'david', '20': 'david',
  '21': 'david', '22': 'david', '23': 'assyria', '24': 'babylon', '25': 'babylon',
  '26': 'babylon', '27': 'babylon', '28': 'assyria', '29': 'assyria', '30': 'assyria',
  '31': 'babylon', '32': 'assyria', '33': 'assyria', '34': 'assyria', '35': 'babylon',
  '36': 'assyria', '37': 'persia', '38': 'persia', '39': 'persia', '40': 'jesus',
  '41': 'jesus', '42': 'jesus', '43': 'jesus', '44': 'paul', '45': 'paul',
  '46': 'paul', '47': 'paul', '48': 'paul', '49': 'paul', '50': 'paul', '51': 'paul',
  '52': 'paul', '53': 'paul', '54': 'paul', '55': 'paul', '56': 'paul', '57': 'paul',
  '58': 'paul', '59': 'paul', '60': 'temple_fall', '61': 'temple_fall', '62': 'temple_fall',
  '63': 'temple_fall', '64': 'temple_fall', '65': 'temple_fall', '66': 'temple_fall',
}

/** brief 文本截断（索引轻量化；完整四级描述仍在按卷数据中） */
const clip = (s, n = 110) => {
  if (!s) return ''
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/* ---------- 1. 书卷表（manifest 提供准确章数） ---------- */
const brpManifest = readJson(path.join(DATA, 'brp/manifest.json'))
const transChiun = brpManifest.translations.find((t) => t.key === 'chiun')
const transNiv = brpManifest.translations.find((t) => t.key === 'niv')
const ccMap = new Map((transChiun || transNiv).books.map((b) => [b.id, b.chapterCount]))

const books = BOOKS.map((b) => ({
  id: b.id,
  zh: b.zh,
  en: b.en,
  g: b.group,
  cc: ccMap.get(b.id) || 0,
  ab: ZH_ABBR[b.id] || [],
  ea: [...new Set(EN_ABBR[b.id] || [])],
}))

/* ---------- 2. TIPNR 实体（人物 / 地点） ---------- */
const tipnrDir = path.join(DATA, 'brp/commentary/notes/tipnr')
const entriesIdx = readJson(path.join(tipnrDir, 'entries.json'))
const zhNames = readJson(path.join(tipnrDir, 'zh-names.json'))
const nameVariants = readJson(path.join(tipnrDir, 'name-variants.json'))
const placeCoords = readJson(path.join(tipnrDir, 'place-coords.json')).coords

/** strong 基础码 → 中文名（含后缀优先：H5653G 先于 H5653） */
function zhOf(strong) {
  const { code, suffix } = parseStrong(strong)
  if (zhNames[code + suffix] !== undefined) return zhNames[code + suffix]
  return zhNames[code] || ''
}

const coordKey = (name) => name.toLowerCase().replace(/[\s'’-]/g, '')

// 条目聚合容器：strong 归一化码 → 实体（跨书卷合并出现信息）
const entMap = new Map()
for (const e of entriesIdx.entries) {
  if (e.type !== 'Male' && e.type !== 'Female' && e.type !== 'Place') continue
  const { code, suffix } = parseStrong(e.strong)
  const key = code + suffix || e.name
  if (!entMap.has(key)) {
    const isPlace = e.type === 'Place'
    const coord = isPlace ? placeCoords[coordKey(e.name)] || placeCoords[e.name] : null
    const variants = nameVariants[e.name] || []
    entMap.set(key, {
      id: (isPlace ? 'place_' : 'person_') + (code + suffix || e.name),
      zh: zhOf(e.strong),
      en: e.name,
      s: e.strong || '',
      b: '',
      al: variants.filter(Boolean),
      first: '',
      n: 0,
      psSet: new Set(), // 出现时期（书卷 → BOOK_PERIODS；地点条目输出 ps）
      ...(isPlace
        ? { lat: coord?.lat ?? null, lng: coord?.lng ?? null, cat: coord?.cat || '' }
        : { gender: e.type }),
    })
  }
}

// 按卷扫描出现（first = 最早书:章:节 含节号，供跳转高亮 ?v=；n = 出现总次数；
// psSet = 出现时期集合（地点输出 ps，地图侧栏「时期地点」词条用））
const bookFiles = fs.readdirSync(path.join(tipnrDir, 'books')).filter((f) => f.endsWith('.json'))
for (const f of bookFiles.sort()) {
  const bookId = f.replace(/\.json$/, '')
  const d = readJson(path.join(tipnrDir, 'books', f))
  for (const ch of d.chapters || []) {
    for (const e of ch.entries || []) {
      const { code, suffix } = parseStrong(e.strong)
      const ent = entMap.get(code + suffix || e.name)
      if (!ent) continue
      ent.n += (e.refs || []).length
      const period = BOOK_PERIODS[bookId]
      if (period) ent.psSet.add(period)
      if (!ent.first) {
        const refs = (e.refs || []).map(Number).filter(Boolean)
        ent.first = `${bookId}:${ch.chapter}${refs.length ? ':' + Math.min(...refs) : ''}`
      }
      if (!ent.b) ent.b = clip(e.briefest || e.brief || '')
    }
  }
}

const persons = []
const places = []
for (const ent of entMap.values()) {
  const ps = ent.psSet.size ? [...ent.psSet] : undefined
  if (ps) ent.ps = ps
  delete ent.psSet
  if (ent.id.startsWith('place_')) {
    if (ent.lat === null && ent.lng === null && !ent.first) continue // 无任何信息的地点跳过
    places.push(ent)
  } else {
    persons.push(ent)
  }
}

/* ---------- 3a. Theographic 人物增强（生卒年/关系数；年份为 Ussher 传统编年） ---------- */
const theoPath = path.join(DATA, 'theographic/persons.json')
let theoPersons = {}
if (exists(theoPath)) {
  theoPersons = readJson(theoPath).persons || {}
  let withYears = 0, withRel = 0
  for (const p of persons) {
    const key = p.id.replace(/^person_/, '')
    const t = theoPersons[key]
    if (!t) continue
    if (t.by !== undefined || t.dy !== undefined) { p.by = t.by ?? null; p.dy = t.dy ?? null; withYears++ }
    if (t.rel) {
      p.rel = (t.rel.fa ? 1 : 0) + (t.rel.mo ? 1 : 0) + (t.rel.sp || []).length +
        (t.rel.ch || []).length + (t.rel.sb || []).length
      if (p.rel > 0) withRel++
    }
  }
  console.log(`theographic 增强: 生卒年 ${withYears} · 关系 ${withRel} / ${persons.length} 人物`)
}

/* ---------- 3. 政权 / 历史区域（regions.json） ---------- */
const regions = readJson(path.join(DATA, 'geography/regions.json'))
const polities = regions.regions
  .filter((r) => r.location)
  .map((r) => ({
    id: r.id,
    en: r.en,
    zh: r.zh || '',
    t: r.entity_type === 'nation' ? 'nation' : 'region',
    from: r.from ?? null,
    to: r.to ?? null,
    ps: r.periods || [],
    lat: r.location.lat,
    lng: r.location.lng,
  }))

/* ---------- 4. 事件（旅程；periods.journey_ids 反查时期） ---------- */
const periodsData = readJson(path.join(DATA, 'geography/periods.json'))
const journeyPeriod = new Map()
for (const p of periodsData.periods) {
  for (const jid of p.journey_ids || []) journeyPeriod.set(jid, p.id)
}
const journeys = readJson(path.join(DATA, 'geography/journeys.json'))
const events = journeys.journeys.map((j) => ({
  id: j.id,
  en: j.name,
  story: j.story?.name || '',
  type: j.type || '',
  d: clip(j.description || '', 120),
  p: journeyPeriod.get(j.id) || '',
  stops: (j.stops || []).length,
}))

/* ---------- 5. 时期（periods.json 原样轻量化） ---------- */
const periods = periodsData.periods.map((p) => ({
  id: p.id,
  name: p.name,
  era: p.era || '',
  year: p.year ?? null,
  d: clip(p.desc || '', 120),
  journeys: (p.journey_ids || []).length,
}))

/* ---------- 5a. 编年时间线（Theographic Events；Ussher 传统编年，中文/英文标题） ---------- */
const theoEventsPath = path.join(DATA, 'theographic/events.json')
const timeline = []
if (exists(theoEventsPath)) {
  for (const e of readJson(theoEventsPath).events || []) {
    timeline.push({
      id: `t${e.id}`,
      t: e.t,
      ...(e.zh ? { z: e.zh } : {}),
      y: e.y ?? null,
      dur: e.dur || '',
      first: e.first || '',
      nv: e.nv || 0,
      // 参与者强码数组（import-theographic 已 personLookup → 强码精确映射，
      // 同名人物不混淆；人物页/事件页据此互相反查）
      ...(e.ppl?.length ? { ppl: e.ppl } : {}),
      ...(e.pplName?.length ? { pplName: e.pplName } : {}),
    })
  }
  timeline.sort((a, b) => (a.y ?? 99999) - (b.y ?? 99999) || String(a.id).localeCompare(String(b.id), 'en'))
}

/* ---------- 7. 注释源清单（去重 by key；category 聚合）+ 段落索引文件 ---------- */
const commManifest = readJson(path.join(DATA, 'brp/commentary/manifest.json'))
const commMap = new Map()
for (const s of commManifest.sources || []) {
  if (!commMap.has(s.key)) {
    commMap.set(s.key, { k: s.key, name: s.name, lang: s.lang || '', cats: [s.category] })
  } else {
    commMap.get(s.key).cats.push(s.category)
  }
}
const commentaries = [...commMap.values()]

/**
 * 注释段落索引：每个源一个懒加载文件 commentary-{file}.json。
 * 条目 [bookIdx, chapter, ref, heading, 摘录]（text 取前 180 字符，原样复制）。
 * file 命名：fullCommentary 源用源 key；mhcc 两类用 mhcc-summary / mhcc-interpretation。
 */
const COMM_TEXT_CLIP = 180
const commFiles = [] // { file, k, name, cats, secs } → 写入 index.commentaries
const bookIdxById = new Map(books.map((b, i) => [b.id, i]))

function buildCommentaryFile(file, k, name, cats, iterSections) {
  const secs = []
  for (const { bookId, chapter, ref, heading, text } of iterSections()) {
    const bi = bookIdxById.get(bookId)
    if (bi === undefined) continue // 66 卷外（如次经注释）暂不入索引
    secs.push([bi, chapter, ref || '', heading || '', clip(text, COMM_TEXT_CLIP)])
  }
  fs.writeFileSync(path.join(OUT, `commentary-${file}.json`), JSON.stringify({ k, name, books: books.map((b) => b.id), secs }))
  commFiles.push({ file, k, name, cats, n: secs.length })
  console.log(`commentary-${file}.json: ${secs.length} 段`)
}

// 7a. fullCommentary 五源（sections 带 heading）
const FULL_SOURCES = ['matthew-henry-en', 'calvin', 'rwp', 'abbott', 'catena']
for (const src of FULL_SOURCES) {
  const dir = path.join(DATA, `brp/commentary/fullCommentary/${src}`)
  if (!exists(dir)) continue
  const iter = function* () {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const d = readJson(path.join(dir, f))
      for (const ch of d.chapters || []) {
        for (const s of ch.sections || []) {
          yield { bookId: d.bookId || f.replace(/\.json$/, ''), chapter: ch.chapter, ref: s.ref, heading: s.heading, text: s.text }
        }
      }
    }
  }
  buildCommentaryFile(src, src, src, ['fullCommentary'], iter)
}

// 7b. MH 简明中文注释：summary（按章总结）/ interpretation（按段经文解释）
const mhccDir = (cat) => path.join(DATA, `brp/commentary/${cat}/mhcc`)
if (exists(mhccDir('summary'))) {
  const iter = function* () {
    for (const f of fs.readdirSync(mhccDir('summary')).filter((x) => x.endsWith('.json')).sort()) {
      const d = readJson(path.join(mhccDir('summary'), f))
      for (const ch of d.chapters || []) {
        yield { bookId: d.bookId || f.replace(/\.json$/, ''), chapter: ch.chapter, ref: '', heading: '', text: ch.summary }
      }
    }
  }
  buildCommentaryFile('mhcc-summary', 'mhcc', '马太亨利简明（总结）', ['summary'], iter)
}
if (exists(mhccDir('interpretation'))) {
  const iter = function* () {
    for (const f of fs.readdirSync(mhccDir('interpretation')).filter((x) => x.endsWith('.json')).sort()) {
      const d = readJson(path.join(mhccDir('interpretation'), f))
      for (const ch of d.chapters || []) {
        for (const s of ch.sections || []) {
          yield { bookId: d.bookId || f.replace(/\.json$/, ''), chapter: ch.chapter, ref: s.ref, heading: '', text: s.text }
        }
      }
    }
  }
  buildCommentaryFile('mhcc-interpretation', 'mhcc', '马太亨利简明（经文解释）', ['interpretation'], iter)
}

// 注释条目挂上段落文件信息（面板按需懒加载 + 计数展示）
for (const c of commentaries) {
  const files = commFiles.filter((f) => f.k === c.k)
  c.files = files.map((f) => ({ file: f.file, name: f.name, cats: f.cats, n: f.n }))
  c.n = files.reduce((s, f) => s + f.n, 0)
}

/* ---------- 8. 主题专题（apologetics/topics，双语标题 + 标签 + 问题） ---------- */
const topicsDir = path.join(DATA, 'apologetics/topics')
const topics = []
if (exists(topicsDir)) {
  for (const f of fs.readdirSync(topicsDir).filter((x) => x.endsWith('.json')).sort()) {
    const t = readJson(path.join(topicsDir, f))
    const title = t.title || {}
    const qTitles = (t.sub_questions || []).map((q) => q.title?.zh || q.title?.en || '').filter(Boolean)
    topics.push({
      id: t.id || f.replace(/\.json$/, ''),
      zh: title.zh || '',
      en: title.en || '',
      tags: t.tags || [],
      d: clip(t.description || '', 120),
      al: qTitles.slice(0, 12),
      q: (t.sub_questions || []).length,
    })
  }
}

/* ---------- 9. 教会史章节（part1-5 章标题 + 时期；跳 /history/:part/:no） ---------- */
const chDir = path.join(DATA, 'church-history')
const history = []
for (let p = 1; p <= 5; p++) {
  const pf = path.join(chDir, `part${p}.json`)
  if (!exists(pf)) continue
  const part = readJson(pf)
  history.push({ id: `p${p}intro`, part: p, no: 'intro', t: part.title || `第${p}部`, period: part.period || '' })
  for (const c of part.chapters || []) {
    history.push({ id: `p${p}c${c.no}`, part: p, no: String(c.no), t: c.title || '', period: part.period || '' })
  }
}

/* ---------- 10. 经文全文索引（全部译本；紧凑数组 [bookIdx, chapter, verse, text]） ---------- */
function buildScripture(transKey) {
  const trans = brpManifest.translations.find((t) => t.key === transKey)
  if (!trans) return null
  const arr = []
  let count = 0
  let probe = '' // 首个非空节文本，用于语言探测
  for (let i = 0; i < books.length; i++) {
    const p = path.join(DATA, `brp/translations/${transKey}/books/${books[i].id}.json`)
    if (!exists(p)) continue
    const d = readJson(p)
    for (const ch of d.book.chapters || []) {
      for (const v of ch.verses || []) {
        arr.push([i, ch.chapter, v.verse, v.text])
        if (!probe && v.text) probe = v.text
        count++
      }
    }
  }
  return { trans, count, verses: arr, lang: /[\u4e00-\u9fff]/.test(probe) ? 'zh' : 'latin' }
}

/* ---------- 输出 ---------- */
fs.mkdirSync(OUT, { recursive: true })

// 全部译本全文索引（每译本一个懒加载文件）
const translations = []
for (const t of brpManifest.translations || []) {
  const s = buildScripture(t.key)
  if (!s || !s.count) {
    console.log(`跳过 scripture-${t.key}.json（无数据）`)
    continue
  }
  fs.writeFileSync(
    path.join(OUT, `scripture-${t.key}.json`),
    JSON.stringify({ trans: t.key, books: books.map((b) => b.id), count: s.count, verses: s.verses }),
  )
  console.log(`scripture-${t.key}.json: ${s.count} 节（${t.name}）`)
  translations.push({ key: t.key, name: t.name, lang: s.lang, verses: s.count })
}

const index = {
  meta: {
    version: 2,
    builtAt: new Date().toISOString(),
    phase: 1,
    note: '第一阶段纯数据检索索引；源数据只读，文本原样复制',
    sources: {
      scripture: 'STEP Bible（translations）',
      persons: 'STEP TIPNR CC BY 4.0（commentary/notes/tipnr）',
      places: 'STEP TIPNR CC BY 4.0 + place-coords',
      polities: 'Pleiades + STEP + DARE（geography/regions.json）',
      events: 'UBS MARBLE CC BY-SA 4.0（geography/journeys.json）',
      periods: 'FISH 时期索引（geography/periods.json）',
      personExtra: 'Theographic Bible Metadata CC BY-SA 4.0（theographic/persons.json；生卒年/关系/词典，Ussher 传统编年）',
      timeline: 'Theographic Bible Metadata CC BY-SA 4.0（theographic/events.json；编年事件，Ussher 传统编年）',
      commentaries: 'commentary/fullCommentary + mhcc（段落索引懒加载）',
      topics: 'apologetics/topics（护教学专题）',
      history: 'church-history part1-5（教会史章节）',
    },
    counts: {
      books: books.length,
      persons: persons.length,
      personsWithYears: persons.filter((p) => p.by !== undefined).length,
      personsWithRel: persons.filter((p) => p.rel).length,
      places: places.length,
      polities: polities.length,
      events: events.length,
      periods: periods.length,
      timeline: timeline.length,
      commentaries: commentaries.length,
      commentarySections: commFiles.reduce((s, f) => s + f.n, 0),
      topics: topics.length,
      history: history.length,
      translations: translations.length,
      scriptureVerses: translations.reduce((s, t) => s + t.verses, 0),
    },
  },
  books,
  translations,
  persons,
  places,
  polities,
  events,
  periods,
  timeline,
  commentaries,
  topics,
  history,
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))

const kb = (p) => (fs.statSync(path.join(OUT, p)).size / 1024).toFixed(1)
console.log('index.json:')
for (const [k, v] of Object.entries(index.meta.counts)) console.log(`  ${k.padEnd(13)} ${v}`)
console.log(`体积: index.json ${kb('index.json')}KB`)
