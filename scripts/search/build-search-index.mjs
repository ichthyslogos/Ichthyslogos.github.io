/**
 * build-search-index.mjs — 第一阶段搜索索引构建（纯数据检索，无 AI）
 *
 * 从现有运行时数据（public/data/**）只读抽取，生成统一搜索索引到 public/data/search/：
 *   index.json                    轻量实体索引（打开搜索面板即加载）
 *   scripture-{key}.json          全部译本全本节文本（用户输入后按需懒加载）
 *   注释段落                      不预建索引；搜索时直接调用注释数据库原文件做全文检索
 *
 * 数据来源与许可：
 *   经文    translations/*（STEP Bible / NIV 导入数据，含和合本/KJV/NIV；思高本/法语/德语仅阅读不入搜索）
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
 * 注释段落：不预建截断索引。前端做全文检索时直接调用注释数据库原文件
 * （public/data/brp/commentary/<category>/<key>/<bookId>.json，见 SearchPanel.vue），
 * 本脚本仅为注释源挂上宗派分组元数据并统计段落总数，供实体分类与页脚计数展示。
 *
 * 原则：源数据一律只读，本脚本不改写任何既有数据文件；注释命中跳读经页看完整上下文。
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

/* ---------- 7. 注释源清单（去重 by key；聚合 category）+ 宗派分组元数据 ----------
 * 注释段落全文检索不预建截断索引：搜索时前端直接调用注释数据库原文件
 * （data/brp/commentary/<category>/<key>/<bookId>.json，见 SearchPanel.vue 注释段逻辑）。
 * 此处在 index.json 挂上源清单与宗派分组，供实体分类与前端「按宗派分组」使用。 */
const commManifest = readJson(path.join(DATA, 'brp/commentary/manifest.json'))
const commMap = new Map()
for (const s of commManifest.sources || []) {
  if (!commMap.has(s.key)) commMap.set(s.key, { k: s.key, name: s.name, lang: s.lang || '', cats: [s.category] })
  else commMap.get(s.key).cats.push(s.category)
}
// 宗派分组：马太亨利 / 马太亨利简明 / 其他注释源
const GROUP_MH = '马太亨利'
const GROUP_MHCC = '马太亨利简明'
const GROUP_OTHER = '其他注释源'
const sourceGroup = (k) => (k === 'matthew-henry-en' ? GROUP_MH : k === 'mhcc' ? GROUP_MHCC : GROUP_OTHER)
const commentaries = [...commMap.values()].map((c) => ({ ...c, group: sourceGroup(c.k) }))

// 进入注释段落全文检索的源（按宗派分组；跨 category/key 覆盖全部注释数据库原文件）
const FW_SEARCH_PAIRS = [
  { cat: 'fullCommentary', key: 'matthew-henry-en', group: GROUP_MH },
  { cat: 'summary', key: 'mhcc', group: GROUP_MHCC },
  { cat: 'interpretation', key: 'mhcc', group: GROUP_MHCC },
  { cat: 'fullCommentary', key: 'calvin', group: GROUP_OTHER },
  { cat: 'fullCommentary', key: 'rwp', group: GROUP_OTHER },
  { cat: 'fullCommentary', key: 'abbott', group: GROUP_OTHER },
  { cat: 'fullCommentary', key: 'catena', group: GROUP_OTHER },
]

/** 注释段落总数（供页脚计数；仅统计进入段落全文检索的源） */
function countCommentarySections() {
  let n = 0
  for (const { cat, key } of FW_SEARCH_PAIRS) {
    for (const src of commManifest.sources || []) {
      if (src.category !== cat || src.key !== key) continue
      for (const b of src.books || []) {
        const p = path.join(DATA, `brp/commentary/${cat}/${key}/${b}.json`)
        if (!exists(p)) continue
        const d = readJson(p)
        for (const ch of d.chapters || []) {
          n += (ch.sections || []).length
          if (ch.summary) n += 1
        }
      }
    }
  }
  return n
}

/* ---------- 8. 主题专题（apologetics/topics，双语标题 + 标签 + 问题） ---------- */
const topicsDir = path.join(DATA, 'apologetics/topics')
const topics = []
const apolSearch = [] // 护教全文检索（子问题级，懒加载文件）
/** 证据类别显示名（与 ArgumentGraph 保持一致） */
const EVIDENCE_LABEL = { bible: '圣经', philosophy: '哲学', history: '历史', science: '科学', theology: '神学', ethics: '伦理', literature: '文献' }
if (exists(topicsDir)) {
  for (const f of fs.readdirSync(topicsDir).filter((x) => x.endsWith('.json')).sort()) {
    const t = readJson(path.join(topicsDir, f))
    const title = t.title || {}
    const qTitles = (t.sub_questions || []).map((q) => q.title?.zh || q.title?.en || '').filter(Boolean)
    const topicId = t.id || f.replace(/\.json$/, '')
    topics.push({
      id: topicId,
      zh: title.zh || '',
      en: title.en || '',
      tags: t.tags || [],
      d: clip(t.description || '', 120),
      al: qTitles.slice(0, 12),
      q: (t.sub_questions || []).length,
    })
    // 子问题全文 → 护教全文检索条目（question/objection/summary/text/evidence 均可命中；
    // 结果携带完整逻辑链条：命题 → 质疑 → 回应 → 证据）
    let added = 0
    for (const q of t.sub_questions || []) {
      const question = q.question || q.title?.zh || ''
      const objection = q.objection || ''
      const summary = q.summary || ''
      const text = q.text || ''
      if (!question && !objection && !summary && !text) continue
      // 证据扁平化（类别 + 引用 + 注释；供搜索结果展示完整链条）
      const evidence = []
      for (const [cat, items] of Object.entries(q.evidence || {})) {
        for (const it of items || []) {
          if (!it || (!it.ref && !it.note)) continue
          evidence.push({ cat, label: EVIDENCE_LABEL[cat] || cat, ref: it.ref || '', note: it.note || '' })
        }
      }
      apolSearch.push({
        topicId,
        topicZh: title.zh || '',
        topicEn: title.en || '',
        tags: t.tags || [],
        qid: q.id || '',
        question,
        objection,
        summary,
        text,
        evidence,
      })
      added++
    }
    // 无子问题内容的主题：补一条仅标题/标签可命中的条目（保证主题名搜索仍能命中）
    if (!added) {
      apolSearch.push({
        topicId,
        topicZh: title.zh || '',
        topicEn: title.en || '',
        tags: t.tags || [],
        qid: '',
        question: title.zh || title.en || '',
        objection: '',
        summary: clip(t.description || '', 160),
        text: '',
        evidence: [],
      })
    }
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

/* ---------- 9a. 预言（弥赛亚预言 → 应验；data/prophecy/prophecies.json） ----------
 * 全局搜索把预言作为一级实体（标题中英/类别/出处），命中跳 /prophecies/:key。
 * people：预言文本中提到的相关人物 id（供搜索结果里「预言→人物」匹配，把预言挂到
 * 对应人物词条下并从预言组原位移除；一条预言可关联多个人）。 */
const prophecies = []
const prophecyPath = path.join(DATA, 'prophecy/prophecies.json')
const reEn = new Map()
const reZh = new Map()
const MAX_PEOPLE = 40
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
if (exists(prophecyPath)) {
  const pd = readJson(prophecyPath)
  prophecyPeople(pd, persons)
  for (const p of pd.prophecies || []) {
    prophecies.push({
      id: p.key,
      zh: p.titleZh || p.title,
      en: p.title,
      cat: p.category,
      catZh: p.categoryZh || p.category,
      ot: p.otRef,
      nt: p.ntRef,
      st: p.status || 'fulfilled',
      people: p.__people,
    })
  }
}

/** 为每条预言预计算相关人物 id（人名在中文/英文预言文本中的提及）。
 * 中名人名 ≥2 字、英名人名 ≥3 字母且以词边界出现；结果原地写到 p.__people
 * （存在则写入索引 people 字段，SearchPanel 据此把命中的预言挂到人物下）。 */
function prophecyPeople(pd, personList) {
  const tokens = [] // [personId, kind, name]
  for (const pr of personList) {
    const pushName = (name, kind) => {
      const s = String(name || '').trim()
      if (!s) return
      if (kind === 'en') {
        if (s.length < 3) return
        reEn.set(s.toLowerCase(), pr.id)
      } else {
        if (s.length < 2) return
        reZh.set(s.toLowerCase(), pr.id)
      }
    }
    pushName(pr.en, 'en')
    pushName(pr.zh, 'zh')
    for (const a of pr.al || []) pushName(a, /[\u4e00-\u9fff]/.test(a) ? 'zh' : 'en')
  }
  for (const p of pd.prophecies || []) {
    const plain = (strs, en) =>
      strs.map((s) => (s ? String(s) : '')).join(' ').toLowerCase().replace(/[\u2018\u2019'’`]/g, "'")
    const enText = plain(
      [p.title, p.titleZh, p.otText, p.ntText, p.explanation, ...(p.interpretations || []).map((i) => i.note)],
      true,
    )
    const zhText = plain(
      [p.titleZh, p.title, p.otTextZh, p.ntTextZh, p.explanationZh, ...(p.interpretations || []).map((i) => i.note)],
      false,
    )
    const found = new Set()
    for (const [name, id] of reEn) {
      if (!enText) break
      if (found.size >= MAX_PEOPLE) break
      if (new RegExp(`(?<![a-z])${escRe(name)}(?![a-z])`).test(enText)) found.add(id)
    }
    for (const [name, id] of reZh) {
      if (found.size >= MAX_PEOPLE) break
      if (zhText && zhText.includes(name)) found.add(id)
    }
    if (found.size) p.__people = [...found]
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

// 护教全文检索（懒加载文件；子问题级条目，question/objection/summary/text 全文可命中）
fs.writeFileSync(path.join(OUT, 'apologetics-search.json'), JSON.stringify(apolSearch))
console.log(`apologetics-search.json: ${apolSearch.length} 条子问题全文`)

// Strong 词典条目数（轻量索引仍由 brp/strongs-index.json 提供，搜索时懒加载）
const strongsIdxPath = path.join(DATA, 'brp/strongs-index.json')
const strongsCount = exists(strongsIdxPath) ? readJson(strongsIdxPath).count || 0 : 0

// 全部译本全文索引（每译本一个懒加载文件）
// 仅白名单译本进入搜索系统：思高本/法语/德语仅阅读，暂不录入搜索索引
const SCRIPTURE_SEARCH_KEYS = ['chiun', 'chisim', 'niv', 'kjv']
const translations = []
for (const t of brpManifest.translations || []) {
  if (!SCRIPTURE_SEARCH_KEYS.includes(t.key)) {
    console.log(`跳过 scripture-${t.key}.json（不入搜索系统）`)
    continue
  }
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
      commentaries: 'commentary/fullCommentary + mhcc（全文检索直接调用注释数据库原文件）',
      topics: 'apologetics/topics（护教学专题）',
      apolSearch: 'apologetics/topics（护教子问题全文，apologetics-search.json 懒加载）',
      strongs: 'brp/strongs-index.json（Strong 原文词典，搜索时懒加载）',
      history: 'church-history part1-5（教会史章节）',
      prophecies: 'scripture-journey / Payne 弥赛亚预言（data/prophecy/prophecies.json）',
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
      commentarySections: countCommentarySections(),
      topics: topics.length,
      apolQuestions: apolSearch.length,
      strongs: strongsCount,
      history: history.length,
      prophecies: prophecies.length,
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
  prophecies,
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))

// 轻量人物映射（strong 码 → 人物{shortId, zh, en}），供读经页背景注释按 TIPNR strong
// 把人物词条链接到 /persons/:id；避免读经页加载整个 index.json。
const personsMap = {}
for (const p of persons) {
  if (!p.s) continue
  personsMap[p.s] = { id: p.id.replace(/^person_/, ''), zh: p.zh || '', en: p.en || '' }
}
fs.writeFileSync(path.join(OUT, 'persons-map.json'), JSON.stringify(personsMap))
console.log(`persons-map.json: ${Object.keys(personsMap).length} 人写盘`)

const kb = (p) => (fs.statSync(path.join(OUT, p)).size / 1024).toFixed(1)
console.log('index.json:')
for (const [k, v] of Object.entries(index.meta.counts)) console.log(`  ${k.padEnd(13)} ${v}`)
console.log(`体积: index.json ${kb('index.json')}KB`)
