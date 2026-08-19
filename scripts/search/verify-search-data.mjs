/**
 * verify-search-data.mjs — 搜索索引数据准确性核验（全量比对，零采样）
 *
 * 1. scripture-*.json（全部译本）每节经文文本与源译本按卷文件逐字节比对（重建 → 深比较）
 * 2. index.json 书卷章数与 brp/manifest.json 比对
 * 3. 实体计数与源 TIPNR / regions / journeys / periods 数据比对
 * 4. 坐标抽查：places 中的 lat/lng 必须能在 place-coords.json 找到同值来源
 * 5. 注释段落索引：heading/text 摘录必须是源文件的逐字节前缀；段落数与源一致
 * 6. 主题 / 教会史条目数与源文件一致
 *
 * 用法：node scripts/search/verify-search-data.mjs
 * 原则：只读，不写任何文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../bible-books.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = path.join(root, 'public/data')
const SEARCH = path.join(DATA, 'search')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

let pass = 0
let fail = 0
function ok(cond, label, detail = '') {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${label}${detail ? '：' + detail : ''}`)
  }
}

/* ---------- 1. 经文索引全量比对（全部译本） ---------- */
const index = readJson(path.join(SEARCH, 'index.json'))
for (const t of index.translations) {
  const file = `scripture-${t.key}.json`
  const idx = readJson(path.join(SEARCH, file))
  const expected = []
  for (let i = 0; i < BOOKS.length; i++) {
    const p = path.join(DATA, `brp/translations/${t.key}/books/${BOOKS[i].id}.json`)
    if (!fs.existsSync(p)) continue
    const d = readJson(p)
    for (const ch of d.book.chapters || []) {
      for (const v of ch.verses || []) expected.push([i, ch.chapter, v.verse, v.text])
    }
  }
  const same =
    idx.verses.length === expected.length &&
    idx.verses.every((v, i) =>
      v[0] === expected[i][0] && v[1] === expected[i][1] && v[2] === expected[i][2] && v[3] === expected[i][3],
    )
  ok(same, `${file} 与源 ${t.key} 全量一致`,
    same ? '' : `索引 ${idx.verses.length} 节 vs 源 ${expected.length} 节`)
  ok(idx.count === expected.length, `${file} count 字段准确`)
  ok(idx.trans === t.key, `${file} 译本标识准确`)
}

/* ---------- 2. 书卷章数与 manifest 比对 ---------- */
const brpManifest = readJson(path.join(DATA, 'brp/manifest.json'))
const ccMap = new Map(
  brpManifest.translations.find((t) => t.key === 'chiun').books.map((b) => [b.id, b.chapterCount]),
)
ok(index.books.every((b) => b.cc === (ccMap.get(b.id) || 0)), 'books.cc 与 manifest 一致')
ok(index.books.length === 66, 'books 共 66 卷', `实际 ${index.books.length}`)

/* ---------- 3. 实体计数与源数据比对 ---------- */
const entriesIdx = readJson(path.join(DATA, 'brp/commentary/notes/tipnr/entries.json'))
/** 与 build-search-index.mjs 的 parseStrong 保持一致（含小写后缀） */
function parseStrong(strong) {
  if (!strong) return { code: '', suffix: '' }
  const m = /^([HG])0*(\d+)([A-Za-z]*)$/.exec(strong)
  if (!m) return { code: strong, suffix: '' }
  return { code: m[1] + m[2], suffix: m[3] || '' }
}
const srcPersonKeys = new Set()
const srcPlaceKeys = new Set()
for (const e of entriesIdx.entries) {
  if (e.type !== 'Male' && e.type !== 'Female' && e.type !== 'Place') continue
  const { code, suffix } = parseStrong(e.strong)
  ;(e.type === 'Place' ? srcPlaceKeys : srcPersonKeys).add(code + suffix || e.name)
}
ok(index.persons.length === srcPersonKeys.size, 'persons 数与 TIPNR 唯一 Strong 码一致',
  `索引 ${index.persons.length} vs 源 ${srcPersonKeys.size}`)
// places 为源子集（剔除零信息地点），只验证不虚增
const idxPlaceKeys = new Set(index.places.map((p) => p.id.replace(/^place_/, '')))
ok([...idxPlaceKeys].every((k) => srcPlaceKeys.has(k)), 'places 全部存在于 TIPNR 源（无虚构条目）')

const regions = readJson(path.join(DATA, 'geography/regions.json'))
ok(index.polities.length === regions.regions.filter((r) => r.location).length,
  'polities 数与 regions.json 一致')

const journeys = readJson(path.join(DATA, 'geography/journeys.json'))
ok(index.events.length === journeys.journeys.length, 'events 数与 journeys.json 一致')

const periodsData = readJson(path.join(DATA, 'geography/periods.json'))
ok(index.periods.length === periodsData.periods.length, 'periods 数与 periods.json 一致')

/* ---------- 4. 坐标抽查（全量） ---------- */
const placeCoords = readJson(path.join(DATA, 'brp/commentary/notes/tipnr/place-coords.json')).coords
const coordKey = (name) => name.toLowerCase().replace(/[\s'’-]/g, '')
const coordPool = Object.entries(placeCoords)
const badCoords = []
for (const p of index.places) {
  if (p.lat == null || p.lng == null) continue
  const found = coordPool.some(
    ([, c]) => c.lat === p.lat && c.lng === p.lng,
  )
  if (!found) badCoords.push(p.en)
}
ok(badCoords.length === 0, 'places 坐标全部来自 place-coords.json', badCoords.slice(0, 5).join(', '))

/* ---------- 5. 展示文本未被繁简转换污染 ---------- */
const chiun = readJson(path.join(SEARCH, 'scripture-chiun.json'))
const j316 = chiun.verses.find((v) => v[0] === 42 && v[1] === 3 && v[2] === 16)
ok(!!j316 && j316[3].includes('神愛世人'), '约翰福音 3:16 保留繁体原文（神愛世人）')

/* ---------- 6. 注释段落索引：摘录必须逐字节来自源文件 ---------- */
// 每个注释源文件重建「定位键 → 源文本」池，再逐条验证索引摘录为其前缀
function verifyCommentary(file, srcDir, extract) {
  const idx = readJson(path.join(SEARCH, `commentary-${file}.json`))
  const pool = new Map() // `${bookId}|${chapter}|${ref}` -> { heading, text }
  for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith('.json')).sort()) {
    const d = readJson(path.join(srcDir, f))
    for (const item of extract(d)) {
      pool.set(`${item.bookId}|${item.chapter}|${item.ref}`, item)
    }
  }
  let bad = 0
  let missing = 0
  for (const [bi, ch, ref, heading, text] of idx.secs) {
    const bookId = BOOKS[bi]?.id
    const src = pool.get(`${bookId}|${ch}|${ref}`)
    if (!src) {
      missing++
      continue
    }
    if ((heading && heading !== src.heading) || !src.text.startsWith(text.replace(/…$/, ''))) bad++
  }
  ok(missing === 0, `commentary-${file}.json 定位键全部存在于源`, `缺失 ${missing}`)
  ok(bad === 0, `commentary-${file}.json heading/摘录与源逐字节一致`, `不一致 ${bad}`)
  ok(idx.secs.length === pool.size, `commentary-${file}.json 段落数与源一致`,
    `索引 ${idx.secs.length} vs 源 ${pool.size}`)
}

for (const src of ['matthew-henry-en', 'calvin', 'rwp', 'abbott', 'catena']) {
  const dir = path.join(DATA, `brp/commentary/fullCommentary/${src}`)
  if (!fs.existsSync(dir)) continue
  verifyCommentary(src, dir, (d) =>
    (d.chapters || []).flatMap((c) =>
      (c.sections || []).map((s) => ({ bookId: d.bookId, chapter: c.chapter, ref: s.ref || '', heading: s.heading || '', text: s.text || '' })),
    ),
  )
}
verifyCommentary('mhcc-summary', path.join(DATA, 'brp/commentary/summary/mhcc'), (d) =>
  (d.chapters || []).map((c) => ({ bookId: d.bookId, chapter: c.chapter, ref: '', heading: '', text: c.summary || '' })),
)
verifyCommentary('mhcc-interpretation', path.join(DATA, 'brp/commentary/interpretation/mhcc'), (d) =>
  (d.chapters || []).flatMap((c) =>
    (c.sections || []).map((s) => ({ bookId: d.bookId, chapter: c.chapter, ref: s.ref || '', heading: '', text: s.text || '' })),
  ),
)

/* ---------- 7. 主题 / 教会史条目与源文件一致 ---------- */
const topicFiles = fs.readdirSync(path.join(DATA, 'apologetics/topics')).filter((x) => x.endsWith('.json'))
ok(index.topics.length === topicFiles.length, 'topics 数与护教学专题文件数一致',
  `索引 ${index.topics.length} vs 源 ${topicFiles.length}`)
for (const f of topicFiles) {
  const t = readJson(path.join(DATA, 'apologetics/topics', f))
  const hit = index.topics.find((x) => x.id === (t.id || f.replace(/\.json$/, '')))
  ok(!!hit && (hit.zh === (t.title?.zh || '') && hit.en === (t.title?.en || '')),
    `主题「${t.title?.zh || f}」标题与源一致`)
}

let histSrc = 0
for (let p = 1; p <= 5; p++) {
  const pf = path.join(DATA, `church-history/part${p}.json`)
  if (!fs.existsSync(pf)) continue
  histSrc += 1 + (readJson(pf).chapters || []).length // 部导论 + 各章
}
ok(index.history.length === histSrc, 'history 条目数与教会史源一致（含各部导论）',
  `索引 ${index.history.length} vs 源 ${histSrc}`)

console.log(`\n核验完成：${pass} 通过，${fail} 失败`)
process.exit(fail ? 1 : 0)
