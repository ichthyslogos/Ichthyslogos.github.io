/**
 * import-ubs-journeys.mjs — UBS MARBLE 圣经旅程导入（素材只读 → data-src/geography/normalized）
 *
 * 素材：素材/geography/raw/ubs_marble/GeoJsonRoutes/*.geojson（179 条路线）
 *       metadata.csv（故事分组：storyId \t storyName \t mapId \t imageFilename）
 *
 * 源文件形态（实测）：
 *   - 多数为单 Feature（LineString）；203/204/205 等为 FeatureCollection（多段旅程，逐段并入）
 *   - 文件名不规则："100.geojson"（无名称）、"107a. Rehoboam to Shechem"（字母后缀）、
 *     "112.Zerah the Ethiopian"（数字后无空格）、"199a. ... ..geojson"（双点）、同号异名（199b ×2）
 *   - metadata image 名如 "199a. Paul to Arabia and back to Damascus..jpg"（与文件名同规则）
 *
 * 产出（data-src/geography/normalized/）：
 *   journeys.json   { journeys: [{ id, name, type, story, confidence, stops, segments }] }
 *   geometries.json { geometries: { geometry_id: [[lng,lat],...] } }（几何与业务分离）
 *
 * 模型（GEOGRAPHY.md §29）：stops 由路线 Douglas-Peucker 保留点推导（容差 0.05°），
 * 名称留空（UBS 源无停靠点名）、confidence 默认 0.9；type 由名称关键词启发式归类（§13）。
 *
 * 用法：node scripts/geography/import-ubs-journeys.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAW = (p) => fileURLToPath(new URL(`../../../素材/geography/raw/ubs_marble/${p}`, import.meta.url))
const OUT = (p) => fileURLToPath(new URL(`../../data-src/geography/normalized/${p}`, import.meta.url))

const ROUTES = RAW('GeoJsonRoutes/')
const META = RAW('metadata.csv')

/* ---------- 故事映射（metadata.csv，不规则格式容错） ----------
 * 每行：storyId \t storyName \t mapId \t imageFilename
 * image 名解析：^(\d+)([a-z]?)(?:\.\s*(.+?))?\.(?:jpg|png)$
 * 按 {number|letter} 精确关联旅程文件；同号多文件时用名称相似度消歧 */
const metaLines = readFileSync(META, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
const storyByFile = new Map() // "107a" → [{ name, story }]
const imageRe = /^(\d+)([a-z]?)(?:\.\s*(.+?))?\.(?:jpg|png|jpeg)$/i
for (const line of metaLines) {
  const [, storyName, , img] = line.split('\t')
  if (!img || !storyName) continue
  const m = img.trim().match(imageRe)
  if (!m) continue
  const key = `${parseInt(m[1], 10)}${m[2] || ''}`
  const name = (m[3] || '').trim().replace(/\.+$/, '').trim()
  if (!storyByFile.has(key)) storyByFile.set(key, [])
  storyByFile.get(key).push({ name, story: storyName.trim() })
}

/* ---------- 旅程类型启发式（GEOGRAPHY.md §13 Journey Type） ---------- */
function journeyType(name, story) {
  const t = `${name} ${story || ''}`.toLowerCase()
  if (/missionary|seven churches|apostle|paul|barnabas|silas|timothy/.test(t)) return 'missionary_journey'
  if (/exile|babylonian|captivity/.test(t)) return 'exile'
  if (/campaign|battle|invasion|war|sack|siege|rebellion|conquest/.test(t)) return 'military_campaign'
  if (/exodus|wilderness|wandering|desert journey|spies/.test(t)) return 'migration'
  if (/fled|flees|flight|escape/.test(t)) return 'flight'
  if (/pilgrimage/.test(t)) return 'pilgrimage'
  if (/sea|voyage|ship|sailed|sail/.test(t)) return 'sea_voyage'
  if (/return/.test(t)) return 'return_journey'
  if (/ministry|preaching|teach|heal/.test(t)) return 'ministry'
  return 'travel'
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')

/* ---------- Douglas-Peucker（停靠点推导） ---------- */
function dpKeep(pts, tol) {
  const n = pts.length
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack = [[0, n - 1]]
  const distToSeg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
  }
  while (stack.length) {
    const [s, e] = stack.pop()
    if (e - s < 2) continue
    let maxD = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = distToSeg(pts[i], pts[s], pts[e])
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  const out = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push({ idx: i, pt: pts[i] })
  return out
}

/* ---------- 主流程 ---------- */
const fileRe = /^(\d+)([a-z]?)(?:\.\s*(.+?))?\.geojson$/i
const files = readdirSync(ROUTES).filter((f) => f.toLowerCase().endsWith('.geojson')).sort()
const journeys = []
const geometries = {}
const idSeen = new Set()
let noStory = 0

for (const file of files) {
  const m = file.match(fileRe)
  if (!m) {
    console.warn(`[ubs] 跳过无法解析的文件名：${file}`)
    continue
  }
  const num = parseInt(m[1], 10)
  const key = `${num}${m[2] || ''}`
  // 名称：文件名优先；无名称时从 metadata image 名回退；再不行用数字
  let name = (m[3] || '').trim().replace(/\.+$/, '').trim()
  const candidates = storyByFile.get(key) || []
  if (!name && candidates[0]?.name) name = candidates[0].name
  if (!name) name = String(num)

  // 故事：同号多 image 时名称相似度消歧；否则取首个
  let story = null
  const exact = candidates.find((c) => norm(c.name) === norm(name))
  const byName = exact || candidates.find((c) => c.name && norm(c.name).includes(norm(name))) || candidates[0]
  if (byName) story = byName.story
  else noStory++

  const slug = norm(name).replace(/^_+|_+$/g, '') || String(num)
  let id = `journey_ubs_${num}${m[2] || ''}_${slug}`
  if (idSeen.has(id)) id = id + '_2'
  idSeen.add(id)

  // 几何：单 Feature（LineString）或多段 FeatureCollection
  const data = JSON.parse(readFileSync(ROUTES + file, 'utf8'))
  const legs = []
  if (data.type === 'Feature' && data.geometry?.type === 'LineString') {
    legs.push(data.geometry.coordinates)
  } else if (data.type === 'FeatureCollection') {
    for (const f of data.features || []) {
      if (f?.geometry?.type === 'LineString' && f.geometry.coordinates?.length >= 2) legs.push(f.geometry.coordinates)
    }
  } else if (data.geometry?.type === 'MultiLineString') {
    legs.push(...data.geometry.coordinates)
  }
  if (!legs.length) {
    console.warn(`[ubs] 无有效几何：${file}（type=${data.type}）`)
    continue
  }

  // 停靠点 = 各段 DP 保留点串联（含起终点）
  const stops = []
  const segments = []
  let seq = 0
  for (const leg of legs) {
    const keepers = dpKeep(leg, 0.05)
    const legStops = keepers.map((k, i) => ({
      id: `stop_${id}_${stops.length + i + 1}`,
      name: '',
      lat: +k.pt[1].toFixed(6),
      lng: +k.pt[0].toFixed(6),
      sequence: stops.length + i + 1,
      confidence: 0.9,
    }))
    for (let i = 0; i < keepers.length - 1; i++) {
      const a = keepers[i].idx
      const b = keepers[i + 1].idx
      const line = leg.slice(a, b + 1).map(([lng, lat]) => [+lng.toFixed(6), +lat.toFixed(6)])
      if (line.length < 2) continue
      seq++
      const geometryId = `geometry_${id}_${seq}`
      geometries[geometryId] = line
      segments.push({
        id: `segment_${id}_${seq}`,
        journey_id: id,
        sequence: seq,
        from_stop_id: legStops[i].id,
        to_stop_id: legStops[i + 1].id,
        geometry_id: geometryId,
        transport_type: 'unknown',
        environment: 'land',
        confidence: 0.9,
      })
    }
    stops.push(...legStops)
  }

  journeys.push({
    id,
    name,
    type: journeyType(name, story),
    story: story ? { name: story } : null,
    person_ids: [],
    event_ids: [],
    scripture_refs: [],
    source_ids: ['ubs_marble'],
    description: '',
    confidence: 0.9,
    stops,
    segments,
  })
}

mkdirSync(OUT(''), { recursive: true })
writeFileSync(OUT('journeys.json'), JSON.stringify({ source: { key: 'ubs_marble', license: 'CC BY-SA 4.0' }, journeys }, null, 1))
writeFileSync(OUT('geometries.json'), JSON.stringify({ source: { key: 'ubs_marble', license: 'CC BY-SA 4.0' }, geometries }, null, 1))
console.log(`[ubs] 完成：${journeys.length} 条旅程（${Object.keys(geometries).length} 段几何），${noStory} 条无故事分组`)
