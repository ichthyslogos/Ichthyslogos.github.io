/**
 * build-brp-historical.mjs — BRP Historical Database v2（Temporal Historical Map）
 *
 * 汇集四类历史数据源，产出统一的历史数据库（data-src/geography/normalized/），
 * schema v2（TEMPORAL-MAP-DB.md §2/§5）：实体 + 时间状态，任何实体不默认"永久存在"。
 *
 *   places.json v2   地点实体（Pleiades + STEP Bible + DARE）：每个实体带
 *                    existence{from,to}（存在窗口）+ names[]（时代名）+ importance[]
 *                    （1-5 星重要性历史）+ state[]（ACTIVE/EMERGING/DECLINING/
 *                    ABANDONED/UNKNOWN 推导）+ political_affiliations[]（点包含测试
 *                    自动计算的政权归属，仅 Cliopatria 国家疆域）+ location{lng,lat}
 *   polities.json v2 政权实体（Cliopatria）：同名切片分组为一个实体，states[] 为
 *                    随时间变化的疆域状态（from/to/area/geometry）；id = polity_*
 *   urban.json v2    城区（AWMC urban_areas）：timeperiod ARK URI → 时期窗口
 *                    （PeriodO/ARK 实测：p03wskdxnzf=Pleiades roman -30~300、
 *                     p03wskd389m=classical -550~-330；null 默认 roman）
 *
 * 用法：node scripts/geography/build-brp-historical.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { intersect } from '@turf/intersect' // v7：intersect(featureCollection([a, b]))
import { featureCollection, feature } from '@turf/helpers'
import { booleanPointInPolygon } from '@turf/turf'

const RAW = (p) => fileURLToPath(new URL(`../../../素材/geography/raw/${p}`, import.meta.url))
const SRC = (p) => fileURLToPath(new URL(`../../data-src/${p}`, import.meta.url))
const OUT = (p) => fileURLToPath(new URL(`../../data-src/geography/normalized/${p}`, import.meta.url))
const CUR = (p) => fileURLToPath(new URL(`../../data-src/geography/curated/${p}`, import.meta.url))

/** 核心区域 bbox：地中海-中东-波斯（经度 -10~65，纬度 0~50） */
const BBOX = [-10, 0, 65, 50]
const inBBox = (lng, lat) => lng >= BBOX[0] && lng <= BBOX[2] && lat >= BBOX[1] && lat <= BBOX[3]

/* ============ 通用工具 ============ */
/** 简单 CSV 解析（引号内逗号） */
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const head = lines[0].split(',')
  const rows = []
  const re = /("(?:[^"]|"")*"|[^,]*)(,|$)/g
  for (let i = 1; i < lines.length; i++) {
    const vals = []
    let m
    re.lastIndex = 0
    while ((m = re.exec(lines[i])) && m[0]) vals.push(m[1].replace(/^"|"$/g, '').replace(/""/g, '"'))
    const row = {}
    head.forEach((h, idx) => (row[h] = vals[idx] ?? ''))
    rows.push(row)
  }
  return rows
}
/** 年份解析："-3300" / "3300 BC" / "640" → 数字（BCE 负） */
function parseYear(s) {
  if (s == null || s === '') return null
  const str = String(s).trim()
  let m = str.match(/^(-?\d+(?:\.\d+)?)\s*(BC|BCE|AD|CE)?$/i)
  if (!m) return null
  let y = parseFloat(m[1])
  if (m[2] && /^BC/i.test(m[2])) y = -y
  return y
}
/** 窗口规范化：null 补齐 + 反置修复（源数据如 DARE startyear>endyear、7 条 valid_time
 *  反置均为数字化伪影，自动交换为 [min,max]；不得输出 from>to 的窗口） */
function normWindow(a, b, defA = -100000, defB = 640) {
  if (a == null) a = defA
  if (b == null) b = defB
  if (a > b) [a, b] = [b, a]
  return [a, b]
}
const EMPTY = { type: 'FeatureCollection', features: [] }

/** 名称归一（匹配用：小写 + 去变音符/标点） */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')

/* ============ 1. Pleiades ============ */
console.log('[brp] 加载 Pleiades…')
const plDir = RAW('places/')
const plPlaces = parseCsv(readFileSync(plDir + 'places.csv', 'utf8'))
const plPoints = parseCsv(readFileSync(plDir + 'location_points.csv', 'utf8'))
const plNames = parseCsv(readFileSync(plDir + 'names.csv', 'utf8'))
const plTypes = parseCsv(readFileSync(plDir + 'places_place_types.csv', 'utf8'))

const plCoord = new Map() // place_id → { lat, lng, radius }
for (const pt of plPoints) {
  const m = pt.geometry_wkt?.match(/POINT \((-?\d+\.?\d*) (-?\d+\.?\d*)\)/)
  if (!m) continue
  const r = parseFloat(pt.accuracy_radius) || 9999
  const prev = plCoord.get(pt.place_id)
  if (!prev || r < prev.radius) plCoord.set(pt.place_id, { lat: parseFloat(m[2]), lng: parseFloat(m[1]), radius: r })
}
const plTypeOf = new Map()
for (const t of plTypes) {
  if (!plTypeOf.has(t.place_id)) plTypeOf.set(t.place_id, t.place_type)
}
const plNameLists = new Map() // place_id → [{ name, from, to }]
for (const n of plNames) {
  if (!n.place_id) continue
  const after = parseYear(n.year_after_which)
  const before = parseYear(n.year_before_which)
  // 仅收录历史名称（before < 1800，即古代名称；现代名称默认名已在 title）
  if (before == null || before >= 1800) continue
  if (!plNameLists.has(n.place_id)) plNameLists.set(n.place_id, [])
  const name = (n.attested_form || n.romanized_form_1 || '').trim()
  if (!name) continue
  plNameLists.get(n.place_id).push({ name, from: after ?? -100000, to: before })
}

/** Pleiades place_type → 地图分类（entity_type）+ 默认存在时间窗（文档化启发式） */
const PL_TYPE_CAT = {
  // 城市类
  settlement: ['city', [-3000, 640]], polis: ['city', [-3000, 640]], urban: ['city', [-3000, 640]],
  'city-center': ['city', [-3000, 640]], townhouse: ['city', [-3000, 640]], vicus: ['village', [-3000, 640]],
  'deme-attic': ['village', [-3000, 640]], pagus: ['village', [-3000, 640]], station: ['village', [-3000, 640]],
  'nome-gr': ['village', [-3000, 640]], 'nome-egyptian': ['village', [-3000, 640]],
  // 要塞/聚落
  'fortified-settlement': ['village', [-3000, 640]], villa: ['village', [-3000, 640]], fort: ['village', [-3000, 640]],
  fortlet: ['village', [-3000, 640]], 'fort-2': ['village', [-3000, 640]], 'fort-group': ['village', [-3000, 640]],
  hillfort: ['village', [-3000, 640]], castle: ['village', [-3000, 640]], citadel: ['village', [-3000, 640]],
  acropolis: ['village', [-3000, 640]], port: ['village', [-3000, 640]], harbor: ['village', [-3000, 640]],
  anchorage: ['village', [-3000, 640]], lighthouse: ['village', [-3000, 640]], castellum: ['village', [-3000, 640]],
  // 国家/地区/民族
  region: ['region', [-2000, 640]], province: ['region', [-2000, 640]], 'province-2': ['region', [-2000, 640]],
  satrapy: ['region', [-2000, 640]], district: ['region', [-2000, 640]], territory: ['region', [-2000, 640]],
  league: ['region', [-2000, 640]], 'regio-augusti': ['region', [-2000, 640]], 'diocese-roman': ['region', [-2000, 640]],
  people: ['nation', [-2000, 640]], state: ['nation', [-2000, 640]], kingdom: ['nation', [-2000, 640]], tribus: ['nation', [-2000, 640]],
  // 自然地理（永久地理实体：窗口覆盖全部时期，非"永久存在"假设而是地理本质）
  river: ['river', [-100000, 100]], watercourse: ['river', [-100000, 100]], canal: ['river', [-100000, 100]],
  rapid: ['river', [-100000, 100]], 'water-inland': ['river', [-100000, 100]], mouth: ['river', [-100000, 100]],
  estuary: ['river', [-100000, 100]], delta: ['river', [-100000, 100]],
  mountain: ['mountain', [-100000, 100]], hill: ['mountain', [-100000, 100]], volcano: ['mountain', [-100000, 100]],
  pass: ['mountain', [-100000, 100]], plateau: ['mountain', [-100000, 100]],
  lake: ['water', [-100000, 100]], 'water-open': ['water', [-100000, 100]], bay: ['water', [-100000, 100]],
  gulf: ['water', [-100000, 100]], lagoon: ['water', [-100000, 100]], strait: ['water', [-100000, 100]],
  'marsh-wetland': ['water', [-100000, 100]], 'salt-marsh': ['water', [-100000, 100]], spring: ['water', [-100000, 100]],
  island: ['island', [-100000, 100]], 'island-group': ['island', [-100000, 100]], archipelago: ['island', [-100000, 100]],
  reef: ['island', [-100000, 100]], peninsula: ['island', [-100000, 100]], isthmus: ['island', [-100000, 100]],
  cape: ['coast', [-100000, 100]], coast: ['coast', [-100000, 100]], 'coastal-change': ['coast', [-100000, 100]],
  desert: ['desert', [-100000, 100]], oasis: ['desert', [-100000, 100]], plain: ['desert', [-100000, 100]],
  valley: ['desert', [-100000, 100]],
  // 遗迹/考古（协议 §10 LOD 3：zoom 13+ 建筑/遗址/考古地点）
  tomb: ['site', [-4000, 640]], cemetery: ['site', [-4000, 640]], temple: ['site', [-4000, 640]], 'temple-2': ['site', [-4000, 640]],
  sanctuary: ['site', [-4000, 640]], shrine: ['site', [-4000, 640]], monument: ['site', [-4000, 640]],
  'archaeological-site': ['site', [-4000, 640]], ruin: ['site', [-4000, 640]], theatre: ['site', [-4000, 640]],
  amphitheatre: ['site', [-4000, 640]], bridge: ['site', [-4000, 640]], aqueduct: ['site', [-4000, 640]],
  dam: ['site', [-4000, 640]], bath: ['site', [-4000, 640]], forum: ['site', [-4000, 640]], agora: ['site', [-4000, 640]],
  palace: ['site', [-4000, 640]], 'palace-complex': ['site', [-4000, 640]], basilica: ['site', [-4000, 640]],
  church: ['site', [-4000, 640]], 'church-2': ['site', [-4000, 640]], monastery: ['site', [-4000, 640]],
  abbey: ['site', [-4000, 640]], mosque: ['site', [-4000, 640]], synagogue: ['site', [-4000, 640]],
  stadion: ['site', [-4000, 640]], circus: ['site', [-4000, 640]], odeon: ['site', [-4000, 640]],
  gymnasium: ['site', [-4000, 640]], tell: ['site', [-4000, 640]], tumulus: ['site', [-4000, 640]],
  'tower-defensive': ['site', [-4000, 640]], 'tower-single': ['site', [-4000, 640]], 'city-wall': ['site', [-4000, 640]],
  'defensive-wall': ['site', [-4000, 640]], 'frontier-system-limes': ['site', [-4000, 640]],
  'military-installation-or-camp-temporary': ['site', [-4000, 640]], barracks: ['site', [-4000, 640]],
}
const PL_DEFAULT = ['village', [-3000, 640]]

const pleiades = [] // 中间：{ pid, name, cat, win, src, names, lat, lng }
for (const p of plPlaces) {
  const coord = plCoord.get(p.id)
  // dumps 版（2026-08 起）列名为 reprLat/reprLong；旧版 representative_latitude/longitude 兼容
  const lat = coord ? coord.lat : parseFloat(p.reprLat ?? p.representative_latitude)
  const lng = coord ? coord.lng : parseFloat(p.reprLong ?? p.representative_longitude)
  if (!isFinite(lat) || !isFinite(lng) || !inBBox(lng, lat)) continue
  const type = plTypeOf.get(p.id)
  const [cat, hWin] = (type && PL_TYPE_CAT[type]) || PL_DEFAULT
  // 存在窗口来源链（HISTORICAL-GIS §3）：curated（STEP 特例）> Pleiades 数值年
  // （minDate/maxDate，带符号整数年；单侧 null 用类型启发式补齐）> 类型启发式
  const minD = parseYear(p.minDate)
  const maxD = parseYear(p.maxDate)
  const win = normWindow(minD, maxD, hWin[0], hWin[1])
  const src = minD != null || maxD != null ? 'pleiades' : 'heuristic'
  pleiades.push({
    pid: p.id,
    name: (p.title || '').trim(),
    cat,
    win,
    src,
    names: plNameLists.get(p.id) || [],
    lat,
    lng,
  })
}
console.log(`[brp] Pleiades bbox 内 ${pleiades.length} 个地点`)

/* ============ 2. STEP Bible（TIPNR place-coords） ============ */
console.log('[brp] 加载 STEP Bible…')
const stepFile = SRC('brp/commentary/notes/tipnr/place-coords.json')
const stepData = existsSync(stepFile) ? JSON.parse(readFileSync(stepFile, 'utf8')) : { coords: {} }
const curatedFile = CUR('place-eras.json')
const curated = existsSync(curatedFile) ? JSON.parse(readFileSync(curatedFile, 'utf8')) : {}
const importanceFile = CUR('place-importance.json')
const curatedImportance = existsSync(importanceFile) ? JSON.parse(readFileSync(importanceFile, 'utf8')) : {}

/** 重要城市（全球视角核心城市；TEMPORAL-MAP-DB §6 重要性评分） */
const MAJOR_CITIES = new Set([
  'Jerusalem', 'Rome', 'Babylon', 'Nineveh', 'Athens', 'Antioch', 'Alexandria',
  'Damascus', 'Corinth', 'Ephesus', 'Sidon', 'Tyre', 'Memphis', 'Thebes',
  'Susa', 'Ecbatana', 'Carthage', 'Philippi', 'Thessalonica', 'Pergamum',
])

// Pleiades 名称索引（title + attested names → 记录）
const plNameIndex = new Map()
for (const pl of pleiades) {
  const keys = new Set([norm(pl.name)])
  for (const n of pl.names) keys.add(norm(n.name))
  for (const k of keys) {
    if (!k) continue
    if (!plNameIndex.has(k)) plNameIndex.set(k, [])
    plNameIndex.get(k).push(pl)
  }
}

/* ============ 3. DARE ============ */
console.log('[brp] 加载 DARE…')
const darePlaces = []
if (existsSync(RAW('dare/places_medium.geojson'))) {
  const d = JSON.parse(readFileSync(RAW('dare/places_medium.geojson'), 'utf8'))
  for (const f of d.features || []) {
    const pr = f.properties || {}
    const c = f.geometry?.coordinates
    if (!c || !inBBox(c[0], c[1])) continue
    // startyear/endyear 可能反置（源数据伪影）→ normWindow 自动交换
    const [from, to] = normWindow(parseFloat(pr.startyear) || -30, parseFloat(pr.endyear) || 476)
    darePlaces.push({
      name: pr.modern || '',
      latin: pr.latin || '',
      greek: pr.greek || '',
      major: pr.major === 1,
      from,
      to,
      lat: c[1],
      lng: c[0],
    })
  }
  console.log(`[brp] DARE bbox 内 ${darePlaces.length} 个地点`)
} else {
  console.warn('[brp] DARE places 缺失，罗马地点层降级')
}

/** DARE 并入：坐标 ≤1km 的 Pleiades 记录合并（附加罗马名），否则独立记录 */
const dareMerged = new Set()
function nearestPleiades(lat, lng) {
  const cell = (Math.floor(lat / 0.5) * 10000 + Math.floor(lng / 0.5))
  const list = grid.get(cell)
  if (!list) return null
  let best = null
  let bestD = 1 // km
  for (const pl of list) {
    const d = Math.hypot((pl.lat - lat) * 111, (pl.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180))
    if (d < bestD) { bestD = d; best = pl }
  }
  return best
}
const grid = new Map()
for (const pl of pleiades) {
  const cell = Math.floor(pl.lat / 0.5) * 10000 + Math.floor(pl.lng / 0.5)
  if (!grid.has(cell)) grid.set(cell, [])
  grid.get(cell).push(pl)
}

/* ============ 4. 地点实体构建（v2：existence/importance/state/affiliations） ============
 * 实体化原则（TEMPORAL-MAP-DB）：存在性 ≠ 意义——existence 决定"是否出现"，
 * importance 决定"何时值得显示"（→ 图例 zoom 表），state 记录历史状态。 */
/** 分类 → 重要性基线等级（图例 zoom 表 2026-08 编码为 1-5 星：
 *  ★5=z0-3 国家/湖海/沙漠/山脉/海岸；★4=z4-5 地区/首都；★3=z6-8 城市/河流/岛屿；
 *  ★2=z9-10 村庄/山；★1=z11+ 遗址。curated 特例可覆盖任意时期等级） */
const CAT_IMPORTANCE = {
  nation: 5, water: 5, desert: 5, range: 5, coast: 5,
  capital: 4, region: 4,
  city: 3, river: 3, island: 3,
  mountain: 2, village: 2,
  site: 1,
}
/** importance 历史段构建：curated 曲线裁剪到 existence 窗口；否则分类基线（major +1，上限 5） */
function buildImportance(cat, major, existence, placeName) {
  const curve = curatedImportance[placeName]
  if (curve?.length) {
    return curve
      .map((s) => ({ from: Math.max(s.from, existence.from), to: Math.min(s.to, existence.to), level: Math.max(1, Math.min(5, s.level)) }))
      .filter((s) => s.from <= s.to)
  }
  let level = CAT_IMPORTANCE[cat] ?? 2
  if (major) level = Math.min(5, level + 1)
  return [{ from: existence.from, to: existence.to, level }]
}

/** 历史状态推导：相邻 importance 段比较（升→EMERGING、持平→ACTIVE、降→DECLINING）；
 *  窗口早于 existence 结束时 → ABANDONED；无 importance 数据 → UNKNOWN（实际不出现） */
function deriveStates(importance, existence) {
  const states = []
  let prev = null
  for (const seg of importance) {
    let st = 'ACTIVE'
    if (prev) {
      if (seg.level > prev.level) st = 'EMERGING'
      else if (seg.level < prev.level) st = 'DECLINING'
    }
    states.push({ from: seg.from, to: seg.to, state: st })
    prev = seg
  }
  const last = states[states.length - 1]
  if (last && last.to < existence.to) states.push({ from: last.to, to: existence.to, state: 'ABANDONED' })
  return states
}

console.log('[brp] 合并地点库…')
let fishSeq = 0
const places = [] // v2 实体（affiliations 稍后回填）

for (const pl of pleiades) {
  fishSeq++
  const fishId = `fish_place_${String(fishSeq).padStart(6, '0')}`
  const eraNames = [...pl.names]
  const dareHit = darePlaces.length ? nearestPleiades(pl.lat, pl.lng) : null
  let dareId = null
  if (dareHit && !dareMerged.has(dareHit)) {
    // DARE 罗马名并入（坐标 ≤1km 匹配）
    if (dareHit.latin && eraNames.every((n) => norm(n.name) !== norm(dareHit.latin))) {
      eraNames.push({ name: dareHit.latin, from: -30, to: 476 })
    }
    if (dareHit.major) pl.majorDare = true
    dareId = dareHit
    dareMerged.add(dareHit)
  }
  const [from, to] = normWindow(pl.win[0], pl.win[1])
  const major = pl.majorDare || MAJOR_CITIES.has(pl.name) ? 1 : 0
  const importance = buildImportance(pl.cat, major, { from, to }, pl.name)
  places.push({
    id: fishId,
    name: pl.name,
    entity_type: pl.cat,
    existence: { from, to },
    existence_src: pl.src,
    names: eraNames,
    importance,
    state: deriveStates(importance, { from, to }),
    political_affiliations: [], // 后置计算（需要 polities v2）
    location: { lng: +pl.lng.toFixed(6), lat: +pl.lat.toFixed(6) },
    major,
    sources: dareId ? ['pleiades', 'dare'] : ['pleiades'],
    external_ids: { pleiades: pl.pid },
  })
}
for (const d of darePlaces) {
  if (dareMerged.has(d)) continue
  fishSeq++
  const names = []
  if (d.latin) names.push({ name: d.latin, from: -30, to: 476 })
  // 现代名窗口 [476,2100]——修复原 {477,100} 反置窗口 bug（反置窗口无意义且违反
  // "任何窗口 from≤to"；现代名不覆盖任何历史时期年份，era name 选择永不命中）
  if (d.name && norm(d.name) !== norm(d.latin)) names.push({ name: d.name, from: 476, to: 2100 })
  const major = d.major ? 1 : 0
  const importance = buildImportance(d.major ? 'city' : 'village', major, { from: d.from, to: d.to }, d.latin || d.name)
  places.push({
    id: `fish_place_${String(fishSeq).padStart(6, '0')}`,
    name: d.latin || d.name,
    entity_type: d.major ? 'city' : 'village',
    existence: { from: d.from, to: d.to },
    existence_src: 'dare',
    names,
    importance,
    state: deriveStates(importance, { from: d.from, to: d.to }),
    political_affiliations: [],
    location: { lng: +d.lng.toFixed(6), lat: +d.lat.toFixed(6) },
    major,
    sources: ['dare'],
    external_ids: {},
  })
}

for (const [stepName, c] of Object.entries(stepData.coords || {})) {
  if (!isFinite(c?.lat) || !isFinite(c?.lng)) continue
  fishSeq++
  const fishId = `fish_place_${String(fishSeq).padStart(6, '0')}`
  // 与 Pleiades 精确名称匹配 → 继承存在时间与时代名（GEOGRAPHY.md 匹配优先级）
  const match = (plNameIndex.get(norm(stepName)) || [])[0]
  const cu = curated[stepName]
  const cat = c.cat || 'city'
  let win = null
  const eraNames = []
  if (match) {
    win = match.win
    eraNames.push(...match.names)
  }
  if (cu?.valid_time) win = cu.valid_time
  if (cu?.names) {
    for (const n of cu.names) if (!eraNames.some((e) => norm(e.name) === norm(n.name))) eraNames.push(n)
  }
  // 存在窗口：Pleiades 继承 / curated 特例 / 圣经主体默认窗口（curated 特例优先）
  const [from, to] = win ? normWindow(win[0], win[1]) : [-2200, 100]
  const major = MAJOR_CITIES.has(stepName) ? 1 : 0
  const importance = buildImportance(cat, major, { from, to }, stepName)
  places.push({
    id: fishId,
    name: stepName,
    entity_type: cat,
    existence: { from, to },
    existence_src: cu?.valid_time ? 'curated' : match ? match.src : 'heuristic',
    names: eraNames,
    importance,
    state: deriveStates(importance, { from, to }),
    political_affiliations: [],
    location: { lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6) },
    major,
    sources: match ? ['step', 'pleiades'] : ['step'],
    external_ids: { step: stepName, pleiades: match ? match.pid : null },
  })
}

/* ============ 4b. existence 来源覆盖率（HISTORICAL-GIS §3：保证每个城市/国家有数据） ============ */
const srcCount = {}
for (const p of places) {
  const k = `${p.entity_type}|${p.existence_src}`
  srcCount[k] = (srcCount[k] || 0) + 1
}
console.log('[brp] existence 来源覆盖（类别|来源）：')
for (const [k, n] of Object.entries(srcCount).sort()) console.log(`  ${k}: ${n}`)
const heuristicCore = places.filter(
  (p) => ['city', 'region', 'nation', 'capital'].includes(p.entity_type) && p.existence_src === 'heuristic',
)
if (heuristicCore.length) {
  console.warn(
    `[brp] 纯启发式窗口的城市/国家 ${heuristicCore.length} 个（待人工 curated 补录，见 historical_validator WARNING）：${heuristicCore
      .slice(0, 20)
      .map((p) => p.name)
      .join('、')}${heuristicCore.length > 20 ? ` 等 ${heuristicCore.length} 个` : ''}`,
  )
} else {
  console.log('[brp] 全部城市/国家均有真实时间来源（curated/pleiades/dare）✓')
}

/* ============ 5. 疆域（Cliopatria → polities v2 实体 + 时间状态） ============ */
console.log('[brp] 构建疆域库…')
const EMPIRE_COLORS = {
  'roman empire': '#d88c8c', 'neo-babylonian empire': '#8cb8d8', 'achaemenid empire': '#e0c878',
  'neo-assyrian empire': '#c8a06a', 'assyria': '#c8a06a', 'kingdom of judah': '#c9a227',
  'kingdom of israel': '#a0a85a', 'new kingdom of egypt': '#7fb8a0', 'egypt': '#7fb8a0',
  'hittite empire': '#a08ad8', 'kingdom of kush': '#a08ad8', 'parthian empire': '#8cc8a0',
  'seleucid empire': '#78b8c8', 'ptolemaic kingdom': '#78b8c8', 'hasmonean kingdom': '#d8b060',
  'phoenicia': '#7fb8c8', 'philistia': '#c88ca0', 'elam': '#b0a8d8', 'media': '#d8b8a0',
  'median kingdom': '#d8b8a0', 'lydia': '#c8b078', 'babylonia': '#8cb8d8', 'scythia': '#a8b8a0',
  'greece': '#8ca0d8', 'macedonia': '#8ca0d8', 'mauretania': '#a8c8b0', 'numidia': '#a8c8b0',
  'kingdom of armenia': '#c8a0c8', 'himyarite kingdom': '#d8a8a0', 'arabia': '#d8c8a0',
  'nabataea': '#d8c8a0', 'lakhmid kingdom': '#b8c8a0', 'byzantine empire': '#c8b8d8',
  'sasanian empire': '#d8a8b8', 'palmyrene kingdom': '#b8a8d8', 'yuezhi': '#9ac8b8',
  'indo-scythians': '#8ab8c8', 'twenty-sixth dynasty of egypt': '#7fb8a0',
  'twenty-fifth dynasty of egypt': '#7fb8a0', 'twenty-first dynasty of egypt': '#7fb8a0',
  'kushite empire': '#a08ad8', 'maukhari': '#b8b8a0',
}
const EMPIRE_FALLBACK = ['#a8b8c8', '#c8b8a8', '#b8c8a8', '#c8a8b8', '#a8c8c8', '#c8c8a8', '#b8a8c8', '#c8a8a8', '#a8a8c8', '#c8c8b8']
const colorCache = new Map()
function polityColor(name) {
  const key = (name || '').toLowerCase().replace(/^\(+|\)+$/g, '').trim()
  if (colorCache.has(key)) return colorCache.get(key)
  let color = EMPIRE_COLORS[key]
  if (!color) {
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
    color = EMPIRE_FALLBACK[h % EMPIRE_FALLBACK.length]
  }
  colorCache.set(key, color)
  return color
}

function simplifyCoords(coords) {
  if (typeof coords[0] === 'number') return [Math.round(coords[0] * 1e4) / 1e4, Math.round(coords[1] * 1e4) / 1e4]
  return coords.map(simplifyCoords)
}
function walkCoords(coords, fn) {
  if (typeof coords[0] === 'number') fn(coords)
  else coords.forEach((c) => walkCoords(c, fn))
}
function geomInBBox(coords) {
  let hit = false
  walkCoords(coords, (c) => {
    if (c[0] >= BBOX[0] && c[0] <= BBOX[2] && c[1] >= BBOX[1] && c[1] <= BBOX[3]) hit = true
  })
  return hit
}
/** 几何 bbox（点包含测试的粗过滤；坐标已被 simplifyCoords 舍入） */
function geomBBox(geom) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  walkCoords(geom.coordinates, (c) => {
    if (c[0] < x0) x0 = c[0]
    if (c[1] < y0) y0 = c[1]
    if (c[0] > x1) x1 = c[0]
    if (c[1] > y1) y1 = c[1]
  })
  return [x0, y0, x1, y1]
}

/* ---- Douglas-Peucker（疆域多边形抽稀：全球数据顶点量大，控制体量；环闭合保持） ---- */
function dpDistToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}
function dpSimplify(pts, tol) {
  const n = pts.length
  if (n <= 2) return pts.slice()
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    if (e - s < 2) continue
    let maxD = 0, idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = dpDistToSeg(pts[i], pts[s], pts[e])
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  const out = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}
/** 环抽稀（保持闭合）：容差 0.005° ≈ 550m，低于 z7 瓦片分辨率（0.0054°） */
function simplifyRing(ring, tol) {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const pts = closed ? ring.slice(0, -1) : ring
  const simp = dpSimplify(pts, tol)
  if (closed) simp.push([simp[0][0], simp[0][1]])
  return simp
}
/** Polygon/MultiPolygon 递归抽稀 */
function simplifyPolygonCoords(coords, tol) {
  if (typeof coords[0][0] === 'number') return simplifyRing(coords, tol)
  return coords.map((c) => simplifyPolygonCoords(c, tol))
}

/** 剔除 ≤5 点（≤4 顶点）的洞环——Cliopatria 源数字化伪影：
 *  如 New Kingdom of Egypt 在 Hepher 附近 4 顶点平行四边形洞（规则缺口），
 *  同一批四边形洞在全球多处政权间重复出现；合法洞环（飞地等）顶点数远多于此 */
function cleanHoles(geom) {
  const isPoly = geom.type === 'Polygon'
  const parts = isPoly ? [geom.coordinates] : geom.coordinates
  const out = parts.map((rings) => [rings[0], ...rings.slice(1).filter((h) => h.length > 5)])
  return { type: geom.type, coordinates: isPoly ? out[0] : out }
}

/** proper 线段自交检测（跳过相邻段）；DP 抽稀可能把简单环抽出钳形交叉 */
function ringSelfCrosses(ring) {
  const n = ring.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) < 2 || (i === 0 && j === n - 1) || (j === 0 && i === n - 1)) continue
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % n]
      const [cx, cy] = ring[j], [dx, dy] = ring[(j + 1) % n]
      if (Math.max(ax, bx) < Math.min(cx, dx) || Math.max(cx, dx) < Math.min(ax, bx)) continue
      if (Math.max(ay, by) < Math.min(cy, dy) || Math.max(cy, dy) < Math.min(ay, by)) continue
      const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)
      const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
      const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
      const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
    }
  }
  return false
}
function geomSelfCrosses(coords) {
  if (typeof coords[0][0] === 'number') return ringSelfCrosses(coords)
  return coords.some(geomSelfCrosses)
}

const POLITY_SIMPLIFY_TOL = 0.005

/* 同名时间片去重后平铺 → v2 实体分组（entities[] + states[]） */
const flatSlices = []
const clioFile = RAW('political_entities/cliopatria_polities_only.geojson')
if (existsSync(clioFile)) {
  const all = JSON.parse(readFileSync(clioFile, 'utf8'))
  const clioGeo = new Map() // 去重：同名同期的重复切片（Cliopatria 源重复特征）只保留一份
  for (const ft of all.features) {
    const pr = ft.properties || {}
    const fy = pr.FromYear
    const ty = pr.ToYear
    if (fy == null || ty == null) continue
    const geom = ft.geometry
    // 全球疆域（用户要求：疆域信息全球都要）——不做 bbox 裁剪；多边形抽稀控制体量
    if (!geom || !geom.coordinates) continue
    const name = (pr.Name || '').replace(/^\(+|\)+$/g, '').trim() || '未知'
    let coords = simplifyPolygonCoords(cleanHoles(geom).coordinates, POLITY_SIMPLIFY_TOL)
    // DP 后 6+ 点洞环可能被抽稀成 ≤5 点四边形——再清一次（原始即四边形的首轮已删）
    coords = cleanHoles({ type: geom.type, coordinates: coords }).coordinates
    if (geomSelfCrosses(coords)) {
      // DP 抽稀引入自交（钳形环）→ 回退原始坐标（仅舍入不抽稀），保证几何正确
      coords = cleanHoles(geom).coordinates
      console.warn(`[brp] ${name}(${fy}~${ty}) 抽稀自交，回退原始坐标`)
    }
    // 同名同期重复切片去重（如 Roman Empire 每期两份相同几何）
    const baseKey = `${name}|${fy}|${ty}`
    const geoKey = JSON.stringify(coords)
    if (!clioGeo.has(baseKey)) clioGeo.set(baseKey, new Set())
    if (clioGeo.get(baseKey).has(geoKey)) continue
    clioGeo.get(baseKey).add(geoKey)
    flatSlices.push({
      name,
      color: polityColor(name),
      from: fy,
      to: ty,
      area: Math.round(pr.Area || 0),
      geometry: { type: geom.type, coordinates: simplifyCoords(coords) },
    })
  }
}
/** 政权实体 id：polity_ + 归一化名（冲突加序号；affiliations 复用同一 id） */
const usedIds = new Set()
const entityIdByName = new Map()
function polityEntityId(name) {
  if (entityIdByName.has(name)) return entityIdByName.get(name)
  let id = 'polity_' + (norm(name).slice(0, 40) || 'unknown')
  let n = 2
  const base = id
  while (usedIds.has(id)) id = `${base}_${n++}`
  usedIds.add(id)
  entityIdByName.set(name, id)
  return id
}
/* v2 实体分组：states[] 规范化（排序 + 源数据伪影清理） */
const entityByName = new Map()
for (const s of flatSlices) {
  let e = entityByName.get(s.name)
  if (!e) {
    e = { id: polityEntityId(s.name), name: s.name, color: s.color, states: [], sources: ['cliopatria'] }
    entityByName.set(s.name, e)
  }
  e.states.push({ from: s.from, to: s.to, area: s.area, geometry: s.geometry })
}
/** 实体 states 规范化：Cliopatria 源数据同名同窗重复切片 / 相邻期边界重叠伪影
 *  （同一政权同窗多份几何、旧切片未在新切片开始时截断）——
 *  1) 窗口完全相同 → 保留面积最大者（重复伪影）
 *  2) 前段完全包含后段 → 删后段
 *  3) 部分重叠 → 截断前段 to = 后段 from（边界漂移由后切片表达；截断成空段则删除）
 *  保证同实体状态窗口有序且不重叠（"该年该政权的疆域"无二义性） */
function normalizeStates(states) {
  const sorted = [...states].sort((a, b) => a.from - b.from)
  const out = []
  for (const st of sorted) {
    const prev = out[out.length - 1]
    if (!prev) { out.push(st); continue }
    if (st.from === prev.from && st.to === prev.to) {
      if ((st.area || 0) > (prev.area || 0)) out[out.length - 1] = st // 同窗重复：保留面积大者
      continue
    }
    if (st.from >= prev.from && st.to <= prev.to) continue // 完全包含 → 删
    if (st.from < prev.to) {
      prev.to = st.from // 部分重叠 → 截断前段
      if (prev.to < prev.from) out.pop()
      out.push(st)
      continue
    }
    out.push(st)
  }
  return out
}
const entities = [...entityByName.values()]
for (const e of entities) e.states = normalizeStates(e.states)
/* curated 政权窗口修正（polity-eras.json：源数据时间窗错误的人工 clamp——见文件 _note） */
const polityEras = JSON.parse(readFileSync(CUR('polity-eras.json'), 'utf8'))
let polityFixed = 0
for (const e of entities) {
  const ov = polityEras[e.name]
  if (!ov) continue
  const before = e.states.length
  e.states = e.states
    .map((st) => ({
      ...st,
      from: ov.from != null ? Math.max(st.from, ov.from) : st.from,
      to: ov.to != null ? Math.min(st.to, ov.to) : st.to,
    }))
    .filter((st) => st.from <= st.to)
  e.states = normalizeStates(e.states)
  polityFixed++
  console.log(`[brp] 政权窗口 curated 修正：${e.name}（${before} → ${e.states.length} 状态）`)
}
if (polityFixed) console.log(`[brp] 政权窗口修正 ${polityFixed} 个实体（curated/polity-eras.json）`)
writeFileSync(
  OUT('polities.json'),
  JSON.stringify(
    {
      source: {
        key: 'brp_polities',
        providers: 'cliopatria',
        schema: 'temporal-v2',
        url: 'https://github.com/Seshat-Global-History-Databank/cliopatria',
        version: '2024 数据集（3400 BCE–2024 CE，Seshat Global History Databank）',
        license: 'CC BY 4.0',
        updated: '2026-08-17',
      },
      entityCount: entities.length,
      stateCount: flatSlices.length,
      entities,
    },
    null,
    1,
  ),
)
console.log(`[brp] 疆域库 v2：${entities.length} 个政权实体 / ${flatSlices.length} 个时间状态（Cliopatria）`)

/* ============ 6. 政治归属计算（political_affiliations，点包含测试） ============
 * 对圣经相关地点（STEP 913 + 首都/地区/国家类 + major 城市，约 2,000 个）按 10 个
 * 时期锚点年测试：被哪些政权疆域（Cliopatria states）覆盖 → 归属段。
 * 同政权连续年份合并为一段；段记录 polity_area（该时段政权面积）——
 * 瓦片层据此选"最具体"（最小面积）归属显示。
 * 注：行政区划（DARE 行省/NE admin-1）已按用户要求删除（正式版：只保留国家疆域） */
const ANCHOR_YEARS = [-2100, -1400, -1000, -722, -586, -539, -63, 30, 50, 70]
/** 归属候选地点：STEP 全部 + 首都/地区/国家类 + major 城市（其余地点不计算，控制构建时长） */
function isAffiliationCandidate(p) {
  return p.sources.includes('step') || p.major === 1 || ['capital', 'region', 'nation'].includes(p.entity_type)
}
const AFFIL_CANDIDATES = places.filter(isAffiliationCandidate)
console.log(`[brp] 政治归属计算：${AFFIL_CANDIDATES.length}/${places.length} 个候选地点 × ${ANCHOR_YEARS.length} 个锚点年…`)

/** 平铺政权状态（带 bbox 粗过滤）；点 → 覆盖状态列表 */
const flatStates = []
for (const e of entities) {
  for (const st of e.states) flatStates.push({ ...st, id: e.id, name: e.name, bbox: geomBBox(st.geometry) })
}
const statesAtYear = ANCHOR_YEARS.map((year) => flatStates.filter((s) => s.from <= year && s.to >= year))

/** 去重排序年份 → 归属段：相邻锚点年（采样点连续）合并为一段（政权归属近似不变） */
function mergeRuns(years) {
  const out = []
  let run = null
  let prev = null
  for (const y of years) {
    if (run && prev != null && ANCHOR_YEARS.indexOf(y) === ANCHOR_YEARS.indexOf(prev) + 1) {
      run.to = y
    } else {
      if (run) out.push(run)
      run = { from: y, to: y }
    }
    prev = y
  }
  if (run) out.push(run)
  return out
}

let affilCount = 0
for (const place of AFFIL_CANDIDATES) {
  const lng = place.location.lng
  const lat = place.location.lat
  const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } }
  const byPolity = new Map() // polity_id → { name, area, years: Set }
  for (let i = 0; i < ANCHOR_YEARS.length; i++) {
    const year = ANCHOR_YEARS[i]
    for (const s of statesAtYear[i]) {
      if (lng < s.bbox[0] || lng > s.bbox[2] || lat < s.bbox[1] || lat > s.bbox[3]) continue
      if (!booleanPointInPolygon(pt, { type: 'Feature', geometry: s.geometry })) continue
      if (!byPolity.has(s.id)) byPolity.set(s.id, { name: s.name, area: s.area || 0, years: new Set() })
      byPolity.get(s.id).years.add(year)
    }
  }
  const affils = []
  for (const [id, info] of byPolity) {
    const years = [...info.years].sort((a, b) => a - b)
    for (const run of mergeRuns(years)) {
      affils.push({ polity: info.name, polity_id: id, kind: 'polity', from: run.from, to: run.to, polity_area: info.area })
    }
  }
  affils.sort((a, b) => a.from - b.from)
  place.political_affiliations = affils
  if (affils.length) affilCount++
}

/* ============ 8. 写出 places.json v2 ============ */
writeFileSync(
  OUT('places.json'),
  JSON.stringify(
    {
      source: {
        key: 'brp_places',
        providers: 'pleiades+step+dare',
        schema: 'temporal-v2',
        // 多源文件：逐源 provenance（HISTORICAL-GIS.md §5）
        sources: [
          { provider: 'pleiades', url: 'https://pleiades.stoa.org', version: '2021-11-14 导出 CSV', license: 'CC BY 4.0' },
          { provider: 'step', url: 'https://www.stepbible.org', version: 'TIPNR 词表', license: 'CC BY 4.0' },
          { provider: 'dare', url: 'https://imperium.ahlfeldt.se', version: 'klokantech/roman-empire', license: 'CC BY 4.0' },
        ],
        updated: '2026-08-17',
      },
      count: places.length,
      places,
    },
    null,
    1,
  ),
)
console.log(`[brp] 地点库 v2：${places.length} 个（${affilCount} 个带政治归属；Pleiades ${pleiades.length} + DARE ${darePlaces.length} + STEP ${Object.keys(stepData.coords || {}).length}，坐标合并去重）`)

/* ============ 9. 城区（AWMC urban_areas） ============ */
/** AWMC timeperiod ARK URI → 年份范围（PeriodO 实测解析，2026-08：
 *  https://data.perio.do/3wskdxnzf.json → sameAs pleiades roman（start -30, stop 300）
 *  https://data.perio.do/3wskd389m.json → sameAs pleiades classical（start -550, stop -330） */
const AWMC_ARK_PERIOD = {
  'http://n2t.net/ark:/99152/p03wskdxnzf': [-30, 300], // Pleiades roman
  'http://n2t.net/ark:/99152/p03wskd389m': [-550, -330], // Pleiades classical
}
const AWMC_DEFAULT = [-30, 300] // 无时期字段（仅 5 条且无 pleiadesid）：AWMC urban_areas 为罗马世界城区数据集，默认 roman
function awmcWindow(uri) {
  if (!uri) return AWMC_DEFAULT
  return AWMC_ARK_PERIOD[uri] || AWMC_DEFAULT
}
const urban = []
if (existsSync(RAW('awmc/urban_areas.geojson'))) {
  const all = JSON.parse(readFileSync(RAW('awmc/urban_areas.geojson'), 'utf8'))
  for (const ft of all.features) {
    const pr = ft.properties || {}
    const coords = ft.geometry?.coordinates
    if (!coords || !geomInBBox(coords)) continue
    const [from, to] = awmcWindow(pr.timeperiod)
    urban.push({
      name: pr.title || '',
      pleiadesid: pr.pleiadesid || '',
      from,
      to,
      geometry: { type: ft.geometry.type, coordinates: simplifyCoords(coords) },
    })
  }
  writeFileSync(
    OUT('urban.json'),
    JSON.stringify({
      source: {
        key: 'awmc_urban',
        schema: 'temporal-v2',
        url: 'https://awmc.unc.edu',
        version: 'urban_areas 矢量',
        // 素材库 awmc/LICENSE.md 为失效 404 记录——AWMC 官方为 CC BY-NC 4.0，待核实后回填
        license: null,
        updated: '2026-08-17',
      },
      count: urban.length,
      features: urban,
    }),
  )
  console.log(`[brp] 城区库：${urban.length} 个（AWMC urban_areas，ARK 时期映射已修复）`)
}

console.log('[brp] BRP Historical Database v2 构建完成 → data-src/geography/normalized/')
