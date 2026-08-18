/**
 * build-tiles.mjs — Vector Tile 构建 v2（Temporal Historical Map：TIME→ZOOM→RENDER）
 *
 * 用 @maplibre/geojson-vt（GeoJSON→瓦片切分）+ @maplibre/vt-pbf（MVT 序列化），
 * 均为 maplibre-gl 的传递依赖（零新增安装）。只输出非空瓦片；单瓦片 <500KB（协议 §6.3）。
 *
 * 过滤链（TEMPORAL-MAP-DB v2）：
 *   TIME     inSlice 锚点年过滤（实体 existence/state 窗口覆盖时期年份才进入瓦片）
 *   ZOOM     importance（1-5 星历史）→ lod（★5→0, ★4→1, ★3→2, ★2/★1→3）→ CITY_BANDS
 *            预裁剪——即图例 zoom 表（z0-3 国家/湖海/沙漠/山脉/海岸；z4-5 地区/首都；
 *            z6-8 城市/河流/岛屿；z9-10 村庄/山；z11+ 遗址由前端门控 overzoom 补显）
 *   RENDER   前端图层（CAT_ZOOM_GATE + CAT_SYMBOL_EXPR；瓦片属性 cat/color/lod/major/
 *            polity 驱动样式；polity = 该时期覆盖地点的最具体政权（最小面积），弹窗显示）
 *
 * 瓦片集（每时期预切，时间轴切换 = 切换瓦片集 URL；「all」= 全部时期）：
 *   tiles/territories/<period>/  疆域（Cliopatria 实体 states，按 valid_time 窗口过滤）
 *   tiles/cities/<period>/       城市/地点（按 existence 过滤；era name 按时期年份选取；
 *                                **各时期显示当时名称**；importance→LOD 预裁剪）
 *   tiles/urban/<period>/        城区（AWMC urban_areas）
 *   tiles/manifest.json          瓦片集清单（层/缩放范围/时期/瓦片数）
 *
 * 用法：node scripts/geography/build-tiles.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GeoJSONVT } from '@maplibre/geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'
import { centroid } from '@turf/turf'

const NORM = (p) => fileURLToPath(new URL(`../../data-src/geography/normalized/${p}`, import.meta.url))
const PERIODS_FILE = fileURLToPath(new URL('../../public/data/geography/periods.json', import.meta.url))
const TILES = (p) => fileURLToPath(new URL(`../../public/data/geography/tiles/${p}`, import.meta.url))

/* ============ 分类 → 颜色（与前端 CAT_COLOR 一致） ============ */
const CAT_COLOR = {
  capital: '#8b7355', city: '#3c4652', village: '#8a94a3',
  region: '#7a6a4a', nation: '#7a6a4a', mountain: '#a98d5f', range: '#a98d5f',
  river: '#4a90c4', water: '#4a90c4', desert: '#c9a86a', coast: '#4a90c4', island: '#4a90c4',
  site: '#9aa3ad',
}
const MAJOR_COLOR = '#8b5f2a'

/* ============ 数据加载（v2 schema） ============ */
const places = JSON.parse(readFileSync(NORM('places.json'), 'utf8')).places
const polities = JSON.parse(readFileSync(NORM('polities.json'), 'utf8')).entities
const urban = JSON.parse(readFileSync(NORM('urban.json'), 'utf8')).features
const periods = JSON.parse(readFileSync(PERIODS_FILE, 'utf8')).periods
console.log(`[tiles] 输入：${places.length} 地点实体 / ${polities.length} 政权实体 / ${urban.length} 城区 / ${periods.length} 时期`)
// 地区中文名映射（entity_type region/nation；来自 regions.json，curated 表录入——
// 有中文名才烘焙，未录入的 zh 留空由前端回退英文）
const regionZh = new Map()
try {
  for (const r of JSON.parse(readFileSync(NORM('regions.json'), 'utf8')).regions) {
    if (r.zh) regionZh.set(r.en, r.zh)
  }
} catch (e) {
  console.warn('[tiles] regions.json 缺失或损坏，地区中文名降级为空')
}

/** 时期集合：10 个时期 + 'all' */
const SLICES = [
  ...periods.map((p) => ({ id: p.id, from: p.valid_time.from, to: p.valid_time.to, year: p.year })),
  { id: 'all', from: null, to: null, year: null },
]
const intersects = (a, b, c, d) => a != null && b != null && c != null && d != null && a <= d && b >= c
/** 时期匹配：锚点年包含（时期 year 时刻实体存在才显示）——时间窗相交会把
 *  窗口边缘的实体误带入（如 586 BC 巴比伦时期混入前 550 年才建国的 Achaemenid；
 *  722 BC 亚述时期混入晚起的 Assyrian Egypt/26 王朝）。图例与地图均按时期锚点年校准 */
const inSlice = (from, to, slice) => slice.id === 'all' || (slice.year != null ? from <= slice.year && to >= slice.year : intersects(from, to, slice.from, slice.to))

/* ============ Temporal 查询（与前端 src/lib/temporal.js 一致） ============ */
/** 重要性等级 @ 年份（'all' 取最高等级段——保守显示重要实体）；
 *  等级 → lod（★5→0 … ★2/★1→3；图例 zoom 表编码） */
const LEVEL_LOD = { 5: 0, 4: 1, 3: 2, 2: 3, 1: 3 }
function importanceAt(imp, year) {
  if (!imp?.length) return 2
  if (year == null) {
    let best = imp[0]
    for (const s of imp) if (s.level > best.level) best = s
    return best.level
  }
  for (const s of imp) if (s.from <= year && s.to >= year) return s.level
  return 2
}
/** 政治归属 @ 年份：覆盖该点的最具体政权（最小面积；kind='polity'）——弹窗「隶属」 */
function polityAt(affils, year) {
  if (!affils?.length || year == null) return null
  let best = null
  for (const a of affils) {
    if (a.kind !== 'polity' || a.from > year || a.to < year) continue
    if (!best || (a.polity_area || 0) < (best.polity_area || 0)) best = a
  }
  return best || null
}

/* ============ 各层按时期组装 FeatureCollection ============ */
/** 地点：existence 覆盖时期锚点年；era name 按时期年份选取（时代名）；
 *  importance@时期年 → lod 预裁剪；polity@时期年 → 弹窗隶属 */
function citiesFC(slice, lodMax = 99) {
  const feats = []
  for (const p of places) {
    const { from, to } = p.existence
    if (!inSlice(from, to, slice)) continue
    const cat = p.entity_type || 'city'
    const major = p.major ? 1 : 0
    const level = importanceAt(p.importance, slice.year)
    const lod = LEVEL_LOD[level] ?? 3
    if (lod > lodMax) continue // LOD 预裁剪：低缩放瓦片只含大城（协议 §10 + 瓦片 <500KB）
    // 时代名：名称窗口覆盖时期年份且跨度最小者，否则默认名
    let name = p.name
    if (slice.year != null && p.names?.length) {
      let best = null
      let bestSpan = Infinity
      for (const n of p.names) {
        if (n.from <= slice.year && n.to >= slice.year && n.to - n.from < bestSpan) {
          best = n
          bestSpan = n.to - n.from
        }
      }
      if (best) name = best.name
    }
    const props = {
      name,
      cat,
      lod,
      level,
      major,
      color: major ? MAJOR_COLOR : CAT_COLOR[cat] || '#3c4652',
      src: p.sources?.includes('step') ? 'step' : 'pleiades',
      // 弹窗信息（HISTORICAL-GIS §12 显示需求）：英文名（规范名）+ 存在窗口起止
      en: p.name,
      from: p.existence?.from ?? null,
      to: p.existence?.to ?? null,
    }
    const zh = regionZh.get(p.name)
    if (zh) props.zh = zh // 地区中文名（弹窗显示"中文名（英文名）"用）
    const pol = polityAt(p.political_affiliations, slice.year)
    if (pol) props.polity = pol.polity
    feats.push({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: [p.location.lng, p.location.lat] },
    })
  }
  return { type: 'FeatureCollection', features: feats }
}

/** 疆域：政权实体 states 平铺（Cliopatria；all 不出疆域——「全部时期：无固定政治实体」） */
function territoriesFC(slice) {
  if (slice.id === 'all') return { type: 'FeatureCollection', features: [] }
  const feats = []
  for (const e of polities) {
    for (const st of e.states) {
      if (!inSlice(st.from, st.to, slice)) continue
      feats.push({
        type: 'Feature',
        properties: { name: e.name, color: e.color, area: st.area, source: 'cliopatria', polity_id: e.id },
        geometry: st.geometry,
      })
    }
  }
  return { type: 'FeatureCollection', features: feats }
}

/** 城区：时间窗相交（v2：from/to 已由 ARK 时期映射修复，无 null 窗口） */
function urbanFC(slice) {
  const feats = []
  for (const u of urban) {
    if (slice.id !== 'all' && !inSlice(u.from, u.to, slice)) continue
    feats.push({ type: 'Feature', properties: { name: u.name || '', from: u.from, to: u.to }, geometry: u.geometry })
  }
  return { type: 'FeatureCollection', features: feats }
}

/* ============ 切片与写入 ============ */
/** 城市层缩放带（importance→LOD 预裁剪：图例 zoom 表分带 + 瓦片 <500KB）。
 *  上限 z10（z13-14 瓦片分辨率过高，全库瓦片数会爆炸；z11+ 由前端门控 + overzoom 显示） */
const CITY_BANDS = [
  { min: 0, max: 3, lodMax: 0 }, // ★5：国家/湖海/沙漠/山脉/海岸
  { min: 4, max: 5, lodMax: 1 }, // ★4+：地区/首都
  { min: 6, max: 8, lodMax: 2 }, // ★3+：城市/河流/岛屿
  { min: 9, max: 10, lodMax: 3 }, // ★2+：山/村庄/遗址
]
const LAYER_CFG = {
  territories: { maxZoom: 7, builder: territoriesFC }, // 全球疆域：z7 上限控制瓦片量，z8+ 由前端 overzoom
  cities: { maxZoom: 10, builder: citiesFC, bands: CITY_BANDS },
  urban: { maxZoom: 9, builder: urbanFC },
  // 疆域国家名（独立瓦片层：只有 label 点——不与疆域多边形混在同一源，
  // 避免空 polygon 质心 symbol 与 label 点碰撞剔除蓝字）
  'territory-labels': { maxZoom: 7, builder: territoryLabelsFC },
}

/** 疆域 label 点（每实体一个：最大切片质心；独立层，前端独立 symbol 源） */
function territoryLabelsFC(slice) {
  if (slice.id === 'all') return { type: 'FeatureCollection', features: [] }
  const feats = []
  const byName = new Map()
  for (const e of polities) {
    for (const st of e.states) {
      if (!inSlice(st.from, st.to, slice)) continue
      if (!byName.has(e.name)) byName.set(e.name, [])
      byName.get(e.name).push({ area: st.area, geometry: st.geometry })
    }
  }
  for (const [name, group] of byName) {
    const best = group.reduce((a, b) => (b.area > a.area ? b : a))
    const c = centroid(best.geometry)
    if (!c) continue
    feats.push({
      type: 'Feature',
      properties: { name, area: best.area },
      geometry: { type: 'Point', coordinates: c.geometry.coordinates },
    })
  }
  return { type: 'FeatureCollection', features: feats }
}

/** 要素 bbox → 某 zoom 覆盖的瓦片范围 */
function tileRange(bbox, z) {
  const n = 2 ** z
  const x0 = Math.max(0, Math.min(n - 1, Math.floor(((bbox[0] + 180) / 360) * n)))
  const x1 = Math.max(0, Math.min(n - 1, Math.floor(((bbox[2] + 180) / 360) * n)))
  const lat2y = (lat) => {
    const s = Math.sin((lat * Math.PI) / 180)
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n
  }
  const y0 = Math.max(0, Math.min(n - 1, Math.floor(lat2y(bbox[3]))))
  const y1 = Math.max(0, Math.min(n - 1, Math.floor(lat2y(bbox[1]))))
  return [x0, y0, x1, y1]
}
/** FeatureCollection 全要素 bbox（收集候选瓦片用） */
function fcBBox(fc) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity]
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      if (coords[0] < bbox[0]) bbox[0] = coords[0]
      if (coords[1] < bbox[1]) bbox[1] = coords[1]
      if (coords[0] > bbox[2]) bbox[2] = coords[0]
      if (coords[1] > bbox[3]) bbox[3] = coords[1]
    } else coords.forEach(walk)
  }
  for (const f of fc.features) {
    if (f.geometry?.coordinates) walk(f.geometry.coordinates)
  }
  return bbox
}

rmSync(TILES(''), { recursive: true, force: true })
const manifest = { layers: [] }
for (const [layer, cfg] of Object.entries(LAYER_CFG)) {
  const layerStat = { id: layer, maxZoom: cfg.maxZoom, slices: [] }
  const bands = cfg.bands || [{ min: 0, max: cfg.maxZoom, lodMax: 99 }]
  for (const slice of SLICES) {
    let tiles = 0
    let maxBytes = 0
    let totalFeats = 0
    for (const band of bands) {
      const fc = cfg.builder(slice, band.lodMax)
      totalFeats += fc.features.length
      if (!fc.features.length) continue
      const index = new GeoJSONVT(fc, {
        maxZoom: band.max,
        indexMaxZoom: 0,
        extent: 4096,
        tolerance: 3,
        buffer: 64,
        lineMetrics: false,
      })
      const bbox = fcBBox(fc)
      for (let z = band.min; z <= band.max; z++) {
        if (!isFinite(bbox[0])) continue
        const [x0, y0, x1, y1] = tileRange(bbox, z)
        for (let x = x0; x <= x1; x++) {
          for (let y = y0; y <= y1; y++) {
            const tile = index.getTile(z, x, y)
            if (!tile || !tile.features?.length) continue
            // fromGeojsonVt(layers, options)：layers = { 图层名: geojson-vt tile }，图层名即前端 source-layer
            const buf = fromGeojsonVt({ [layer]: tile }, { extent: 4096, version: 2 })
            if (buf.length > 500 * 1024) {
              console.warn(`[tiles] ${layer}/${slice.id}/${z}/${x}/${y}.pbf 超 500KB（${buf.length}B）——协议 §6.3`)
            }
            maxBytes = Math.max(maxBytes, buf.length)
            const dir = TILES(`${layer}/${slice.id}/${z}/${x}`)
            mkdirSync(dir, { recursive: true })
            writeFileSync(dir + `/${y}.pbf`, buf)
            tiles++
          }
        }
      }
    }
    layerStat.slices.push({ id: slice.id, tiles, features: totalFeats, maxBytes })
    console.log(`[tiles] ${layer}/${slice.id}: ${totalFeats} 要素 → ${tiles} 瓦片（max ${(maxBytes / 1024).toFixed(0)}KB）`)
    // 疆域图例索引：实体名+颜色按面积排序（前端动态图例用；'all' 无实体）
    if (layer === 'territories') {
      const fc = cfg.builder(slice, 99)
      const seen = new Map()
      for (const f of fc.features) {
        const name = f.properties?.name
        if (!name || seen.has(name)) continue
        seen.set(name, { name, color: f.properties?.color || '#c9b896', area: f.properties?.area || 0 })
      }
      const entities = [...seen.values()].sort((a, b) => b.area - a.area)
      const dir = TILES(`${layer}/${slice.id}`)
      mkdirSync(dir, { recursive: true })
      writeFileSync(dir + '/index.json', JSON.stringify({ period: slice.id, count: entities.length, entities }))
    }
  }
  manifest.layers.push(layerStat)
}
writeFileSync(TILES('manifest.json'), JSON.stringify(manifest, null, 1))
const totalTiles = manifest.layers.reduce((s, l) => s + l.slices.reduce((a, c) => a + c.tiles, 0), 0)
console.log(`[tiles] 完成：${manifest.layers.length} 层，共 ${totalTiles} 个瓦片 → public/data/geography/tiles/`)
