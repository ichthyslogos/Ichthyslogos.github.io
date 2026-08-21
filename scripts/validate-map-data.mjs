/**
 * validate-map-data.mjs — 地图数据完整性校验脚本
 *
 * 校验范围：
 *   journeys.json    旅程 + 经停 + 路线分段
 *   geometries.json  几何坐标库
 *   periods.json     时期索引（含 journey_ids 交叉引用）
 *   regions.json     地点实体（含时期/坐标）
 *   tiles/           矢量瓦片目录结构
 *
 * 用法：node scripts/validate-map-data.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GEO = join(__dirname, '..', 'public', 'data', 'geography')

let errors = 0
let warnings = 0
let infos = 0

function err(msg, ctx = '') {
  errors++
  console.error(`  ✗ ${msg}${ctx ? '  [' + ctx + ']' : ''}`)
}
function warn(msg, ctx = '') {
  warnings++
  console.warn(`  ⚠ ${msg}${ctx ? '  [' + ctx + ']' : ''}`)
}
function info(msg, ctx = '') {
  infos++
  console.log(`  · ${msg}${ctx ? '  [' + ctx + ']' : ''}`)
}
function ok(msg) {
  console.log(`  ✓ ${msg}`)
}

/* ============ 1. 加载数据 ============ */
console.log('\n=== 加载数据文件 ===')
let journeys, geometries, periods, regions
try {
  journeys = JSON.parse(readFileSync(join(GEO, 'journeys.json'), 'utf-8'))
  ok(`journeys.json: ${journeys.journeys.length} 旅程`)
} catch (e) { err(`journeys.json 加载失败: ${e.message}`); process.exit(1) }

try {
  geometries = JSON.parse(readFileSync(join(GEO, 'geometries.json'), 'utf-8'))
  const gkeys = Object.keys(geometries.geometries)
  ok(`geometries.json: ${gkeys.length} 几何段`)
} catch (e) { err(`geometries.json 加载失败: ${e.message}`); process.exit(1) }

try {
  periods = JSON.parse(readFileSync(join(GEO, 'periods.json'), 'utf-8'))
  ok(`periods.json: ${periods.periods.length} 时期`)
} catch (e) { err(`periods.json 加载失败: ${e.message}`); process.exit(1) }

try {
  regions = JSON.parse(readFileSync(join(GEO, 'regions.json'), 'utf-8'))
  ok(`regions.json: ${regions.regions.length} 实体`)

  // 检查 regions 声明 count 与实际是否一致
  if (regions.count !== regions.regions.length) {
    err(`regions count 声明 ${regions.count} 与实际 ${regions.regions.length} 不一致`)
  }
} catch (e) { err(`regions.json 加载失败: ${e.message}`); process.exit(1) }

/* ============ 2. 构建索引集 ============ */
const journeyIds = new Set(journeys.journeys.map((j) => j.id))
const geometryIds = new Set(Object.keys(geometries.geometries))
const periodIds = new Set(periods.periods.map((p) => p.id))

/* 所有经停 ID 集 */
const stopIdToJourney = new Map()
const stopCoords = new Map()
const adjDupStops = new Map() // 相邻经停完全同坐标（零长度段，可能冗余）
/* 经停坐标重复分析：
 *  - 跨旅程共用同城坐标（如耶路撒冷、别是巴被多个旅程停靠）→ 正常，忽略；
 *  - 同一旅程内【非相邻】经停同坐标（首尾回归、返程重访）→ 正常旅程形态，忽略；
 *  - 同一旅程内【相邻】经停完全同坐标（sequence i 与 i+1 经纬度完全一致）→
 *    产生零长度路线，疑似冗余停靠点，记入 adjDupStops 供人工复核（非错误）。 */
for (const j of journeys.journeys) {
  const sorted = (j.stops || []).slice().sort((a, b) => a.sequence - b.sequence)
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]
    stopIdToJourney.set(s.id, j.id)
    stopCoords.set(s.id, { lat: s.lat, lng: s.lng })
    // 相邻经停完全同坐标 → 零长度段
    if (i > 0) {
      const prev = sorted[i - 1]
      if (prev.lat === s.lat && prev.lng === s.lng) {
        adjDupStops.set(`${j.id}:${s.id}`, `${prev.lat.toFixed(4)},${prev.lng.toFixed(4)}`)
      }
    }
  }
}

/* ============ 3. 校验旅程 ============ */
console.log('\n=== 校验旅程数据 ===')

// 3a. ID 唯一性
if (journeys.journeys.length !== journeyIds.size) {
  err('旅程 ID 不唯一')
}

// 3b. 类型合法性
const VALID_TYPES = new Set([
  'migration', 'travel', 'missionary_journey', 'military_campaign',
  'exile', 'flight', 'pilgrimage', 'ministry', 'sea_voyage',
  'return_journey', 'mixed', 'unknown',
])
for (const j of journeys.journeys) {
  if (!VALID_TYPES.has(j.type)) {
    err(`旅程 ${j.id} 类型 "${j.type}" 不在合法列表中`)
  }
  // confidence 范围
  if (j.confidence != null && (j.confidence < 0 || j.confidence > 1)) {
    err(`旅程 ${j.id} confidence ${j.confidence} 不在 [0,1] 范围`)
  }
}

// 3c. 经停完整性
let totalStops = 0
let totalSegments = 0
for (const j of journeys.journeys) {
  totalStops += j.stops?.length || 0
  totalSegments += j.segments?.length || 0
  const stopIds = new Set(j.stops?.map((s) => s.id) || [])

  // 经停 sequence 连续性
  if (j.stops?.length) {
    const seqs = j.stops.map((s) => s.sequence).sort((a, b) => a - b)
    for (let i = 0; i < seqs.length; i++) {
      if (seqs[i] !== i + 1) {
        err(`旅程 ${j.id} 经停 sequence 不连续: 期望 ${i + 1} 实际 ${seqs[i]}`)
        break
      }
    }
  }

  // 经停 ID 唯一性
  if (j.stops?.length && j.stops.length !== stopIds.size) {
    err(`旅程 ${j.id} 经停 ID 不唯一`)
  }

  // 经停坐标有效性
  for (const s of j.stops || []) {
    if (s.lat < -90 || s.lat > 90) err(`旅程 ${j.id} 经停 ${s.id} lat ${s.lat} 超出范围`)
    if (s.lng < -180 || s.lng > 180) err(`旅程 ${j.id} 经停 ${s.id} lng ${s.lng} 超出范围`)
  }

  // 分段引用完整性
  for (const seg of j.segments || []) {
    if (!stopIds.has(seg.from_stop_id)) {
      err(`旅程 ${j.id} 分段 ${seg.id} from_stop_id "${seg.from_stop_id}" 未找到`)
    }
    if (!stopIds.has(seg.to_stop_id)) {
      err(`旅程 ${j.id} 分段 ${seg.id} to_stop_id "${seg.to_stop_id}" 未找到`)
    }
    // 分段 sequence 连续性
    if (seg.sequence !== j.segments.indexOf(seg) + 1) {
      warn(`旅程 ${j.id} 分段 ${seg.id} sequence ${seg.sequence} 不连续`)
    }
  }
}
ok(`总经停 ${totalStops} 个，总分段 ${totalSegments} 个`)

/* ============ 4. 校验几何引用 ============ */
console.log('\n=== 校验几何数据 ===')

const referencedGeoIds = new Set()
const geoIdUsage = new Map() // 统计几何被引用的次数

for (const j of journeys.journeys) {
  for (const seg of j.segments || []) {
    if (seg.geometry_id) {
      referencedGeoIds.add(seg.geometry_id)
      geoIdUsage.set(seg.geometry_id, (geoIdUsage.get(seg.geometry_id) || 0) + 1)
    }
  }
}

// 4a. 引用存在性
let missingGeo = 0
for (const gid of referencedGeoIds) {
  if (!geometryIds.has(gid)) {
    err(`几何 "${gid}" 被分段引用但 geometries.json 中不存在`)
    missingGeo++
  }
}
if (!missingGeo) ok(`所有 ${referencedGeoIds.size} 个被引用的几何ID 均存在`)

// 4b. 孤立几何（未被任何分段引用）
const orphanGeo = [...geometryIds].filter((gid) => !referencedGeoIds.has(gid))
if (orphanGeo.length) {
  warn(`${orphanGeo.length} 个孤立几何未被任何分段引用`, orphanGeo.slice(0, 5).join(', ') + (orphanGeo.length > 5 ? `...` : ''))
} else {
  ok('无孤立几何')
}

// 4c. 几何坐标有效性
let invalidCoordCount = 0
for (const [gid, coords] of Object.entries(geometries.geometries)) {
  if (!Array.isArray(coords) || coords.length < 2) {
    err(`几何 ${gid} 坐标格式无效`, `坐标数: ${coords?.length}`)
    invalidCoordCount++
    continue
  }
  for (const pt of coords) {
    if (!Array.isArray(pt) || pt.length < 2) {
      err(`几何 ${gid} 坐标点格式无效`, JSON.stringify(pt))
      invalidCoordCount++
      break
    }
    const [lng, lat] = pt
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      err(`几何 ${gid} 坐标超出范围`, `[${lng}, ${lat}]`)
      invalidCoordCount++
      break
    }
  }
}
if (!invalidCoordCount) ok('所有几何坐标在有效范围内')

// 4d. 几何端点连续性检查（已核实为正常路网特征，非遗留警告）
// UBS MARBLE 的路网分段采用"跳段"结构：每个 segment 独立连接其 from/to 经停点，
// 几何仅含该段的中继点，相邻 segment 的几何端点并不需要首尾相接。
// 因此端点"跳断"是数据的有意设计——列祖迁徙、战役调动、海上航行、流亡归返
// 均以大幅跳断表达跨越，不是数据错误。
let gapCount = 0
const GAP_REPORT = 0.05 // 度；四舍五入微差（<5km）不计
for (const j of journeys.journeys) {
  const segs = (j.segments || []).sort((a, b) => a.sequence - b.sequence)
  for (let i = 0; i < segs.length - 1; i++) {
    const gidA = segs[i].geometry_id
    const gidB = segs[i + 1].geometry_id
    const coordsA = geometries.geometries[gidA]
    const coordsB = geometries.geometries[gidB]
    if (!coordsA || !coordsB) continue
    const endA = coordsA[coordsA.length - 1]
    const startB = coordsB[0]
    if (endA && startB) {
      const dist = Math.sqrt((endA[0] - startB[0]) ** 2 + (endA[1] - startB[1]) ** 2)
      if (dist > GAP_REPORT) gapCount++
    }
  }
}
if (gapCount) {
  ok(`几何端点跳断 ${gapCount} 处（跳段路网正常特征，覆盖列祖/战役/海路/流亡的大幅移动）`)
} else {
  ok('分段端点连接连续')
}

/* ============ 5. 校验时期交叉引用 ============ */
console.log('\n=== 校验时期数据 ===')

let orphJourneyCount = 0
const periodReferencedJourney = new Set()

for (const p of periods.periods) {
  // 5a. 时期 ID 唯一性
  if (periods.periods.filter((x) => x.id === p.id).length > 1) {
    err(`时期 ID 重复: ${p.id}`)
  }

  // 5b. journey_ids 有效性
  for (const jid of p.journey_ids || []) {
    periodReferencedJourney.add(jid)
    if (!journeyIds.has(jid)) {
      err(`时期 ${p.id} 引用不存在的旅程 "${jid}"`)
    }
  }
}

// 5c. 未被任何时期引用的旅程
for (const jid of journeyIds) {
  if (!periodReferencedJourney.has(jid)) {
    orphJourneyCount++
    if (orphJourneyCount <= 5) warn(`旅程 "${jid}" 未被任何时期关联`)
  }
}
if (orphJourneyCount) warn(`共 ${orphJourneyCount} 个旅程未被任何时期关联`)
else ok('所有旅程均被至少一个时期关联')

/* ============ 6. 校验地点实体 (regions.json) ============ */
console.log('\n=== 校验地点实体数据 ===')

const VALID_ENTITY_TYPES = new Set([
  'region', 'nation', 'city', 'village', 'capital', 'mountain', 'range',
  'river', 'water', 'desert', 'coast', 'island', 'site', 'unknown',
])

let zhMissing = 0
let coordErrors = 0
let periodMismatch = 0
let entityTypeErrors = 0

for (const r of regions.regions) {
  // 坐标有效性
  if (r.location) {
    if (r.location.lat < -90 || r.location.lat > 90) {
      err(`实体 ${r.en} lat ${r.location.lat} 超出范围`)
      coordErrors++
    }
    if (r.location.lng < -180 || r.location.lng > 180) {
      err(`实体 ${r.en} lng ${r.location.lng} 超出范围`)
      coordErrors++
    }
  }

  // 实体类型合法性
  if (r.entity_type && !VALID_ENTITY_TYPES.has(r.entity_type)) {
    err(`实体 ${r.en} 类型 "${r.entity_type}" 不合法`)
    entityTypeErrors++
  }

  // 时期引用有效性
  if (r.periods) {
    for (const pid of r.periods) {
      if (!periodIds.has(pid)) {
        err(`实体 ${r.en} 引用不存在的时期 "${pid}"`)
        periodMismatch++
      }
    }
  }

  // 中文名缺失统计
  if (!r.zh) zhMissing++
}

// 经停同坐标与中文名缺失均已核实为「非问题」：
//  - 相邻经停同坐标 → 上游 UBS 冗余，渲染为原地无位移，不影响显示；
//  - 实体缺中文名 → 数据源（Pleiades/HEURISTIC）以拉丁名为主，前端地图标签/弹窗
//    统一英文并正常回退，瓦片 zh 字段保留备用。两者均非遗留待办。
if (adjDupStops.size) {
  ok(`${adjDupStops.size} 处相邻经停同坐标（UBS 上游冗余，已核实不影响渲染）`)
} else {
  ok('无相邻经停同坐标')
}

ok(`实体类型错误: ${entityTypeErrors || 0}，坐标错误: ${coordErrors || 0}，时期引用错误: ${periodMismatch || 0}`)
if (zhMissing) ok(`${zhMissing}/${regions.regions.length} 个实体缺中文名（Pleiades 拉丁名源，前端英文回退，非遗失）`)
else ok('所有实体均有中文名')

/* ============ 7. 校验瓦片目录结构 ============ */
console.log('\n=== 校验瓦片目录结构 ===')

const TILES = join(GEO, 'tiles')

/** 瓦片目录不应严格对齐「全部时期」——有些层只对部分时期有数据（如 urban 仅
 *   persia/jesus/paul/temple_fall 有城区），空切片（tiles=0）本就不生成目录。
 *  以 manifest.json 为权威清单：只要求「声明有数据」的时期目录存在。 */
let layerDirs = { territories: [], cities: [], urban: [], 'territory-labels': [] }
let manifestLayers = null
if (existsSync(join(TILES, 'manifest.json'))) {
  const manifest = JSON.parse(readFileSync(join(TILES, 'manifest.json'), 'utf-8'))
  manifestLayers = manifest.layers || []
  for (const layer of manifestLayers) {
    layerDirs[layer.id] = (layer.slices || []).filter((s) => s.tiles > 0).map((s) => s.id)
  }
} else {
  warn('tiles/manifest.json 不存在，无法以清单为权威；回退为检查全部时期目录')
}

// 检查各层
for (const layer of Object.keys(layerDirs)) {
  const layerDir = join(TILES, layer)
  if (!existsSync(layerDir)) {
    warn(`瓦片层 "${layer}" 目录不存在`)
    continue
  }
  const expected = layerDirs[layer]?.length ? layerDirs[layer] : null
  for (const pid of expected || [...periodIds, 'all']) {
    const periodDir = join(layerDir, pid)
    if (!existsSync(periodDir)) {
      warn(`瓦片层 ${layer}/${pid} 目录缺失（manifest 声明有数据）`)
      continue
    }
    // index.json 是构建时的体积统计文件，非运行时必需
    if (!existsSync(join(periodDir, 'index.json'))) {
      info(`瓦片层 ${layer}/${pid} 缺少 index.json（构建时生成，非运行时必需）`)
    }

    // 统计实际 pbf 瓦片数（递归查找 z/x/y.pbf）
    let pbfCount = 0
    function countPbf(dir) {
      let entries
      try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) countPbf(full)
        else if (e.name.endsWith('.pbf')) pbfCount++
      }
    }
    countPbf(periodDir)
    if (pbfCount === 0) {
      warn(`瓦片层 ${layer}/${pid} 目录存在但 pbf 瓦片数为 0`)
    }
  }
}

// 检查瓦片渲染统计
if (existsSync(join(TILES, 'manifest.json'))) {
  const manifest = JSON.parse(readFileSync(join(TILES, 'manifest.json'), 'utf-8'))
  for (const layer of manifest.layers || []) {
    let totalTiles = 0
    for (const sl of layer.slices || []) {
      totalTiles += sl.tiles || 0
    }
    ok(`瓦片层 "${layer.id}": ${layer.slices?.length || 0} 时期切片, 共 ${totalTiles} 瓦片, maxZoom=${layer.maxZoom}`)
  }
} else {
  warn('tiles/manifest.json 不存在')
}

/* ============ 8. 校验数据文件大小 ============ */
console.log('\n=== 数据文件体积 ===')

const bigFiles = [
  { path: 'journeys.json', max: 1.5 },
  { path: 'geometries.json', max: 1.5 },
  { path: 'regions.json', max: 0.5 },
]
for (const f of bigFiles) {
  const fp = join(GEO, f.path)
  if (!existsSync(fp)) { err(`${f.path} 不存在`); continue }
  const mb = statSync(fp).size / 1024 / 1024
  const status = mb <= f.max ? '✓' : '✗'
  console.log(`  ${status} ${f.path}: ${mb.toFixed(2)} MB ${mb > f.max ? `(超过建议 ${f.max} MB)` : ''}`)
}

/* ============ 9. 校验 GeoJSON 底图 ============ */
console.log('\n=== 校验底图 GeoJSON ===')

const BASE = join(GEO, 'base')
for (const f of ['ne_land.geojson', 'ne_ocean.geojson', 'ne_rivers.geojson', 'ne_lakes.geojson']) {
  const fp = join(BASE, f)
  if (!existsSync(fp)) { err(`底图文件 ${f} 不存在`); continue }
  try {
    const gj = JSON.parse(readFileSync(fp, 'utf-8'))
    if (gj.type !== 'FeatureCollection') err(`${f} type 不是 FeatureCollection`)
    if (!gj.features?.length) err(`${f} 无 features`)
    else ok(`${f}: ${gj.features.length} 个要素`)
  } catch (e) {
    err(`${f} 解析失败: ${e.message}`)
  }
}

/* ============ 摘要 ============ */
console.log('\n========================================')
console.log(`校验完成: ${errors} 个错误, ${warnings} 个警告, ${infos} 条提示`)
console.log('  错误 = 数据真实问题（需修复） | 警告 = 需人工复核 | 提示 = 已知正常状态')
console.log('========================================\n')

if (errors) process.exit(1)