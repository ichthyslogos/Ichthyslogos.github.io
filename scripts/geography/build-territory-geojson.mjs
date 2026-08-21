/**
 * build-territory-geojson — 将疆域改为「按时期 GeoJSON」渲染
 *
 * 背景：疆域矢量瓦片只生成到 z7（全球疆域刻意 z7 上限控制瓦片量），放大到 z8+ 会
 * 像素化、z11+ 直接消失（露出灰色底图，即"放大串起来"）。改用按时期 GeoJSON 源后，
 * 每时期活动政权只有少量多边形（亚伯拉罕 6 实体 / ~7KB），任意缩放级别都由 mapLibre
 * 直接渲染，永不像素化/消失，也无需重建瓦片。
 *
 * 产物：public/data/geography/tiles/territory-geo/<period>.geojson
 *   - 每个时期一个 FeatureCollection：
 *       · 多边形 feature（每活动 state 一条：name/color/area/polity_id + geometry）
 *       · 政权标签点 feature（每实体一条：最大 state 的质心 Point；供 territory-label）
 *   - all 时期输出空集（前端"全部"时隐藏疆域层）
 *
 * 数据源：data-src/geography/normalized/polities.json（Cliopatria，全库 1547 实体）位于
 *   deploy-tmp 拷贝（site 内无 data-src）。切片窗口复用 build-tiles 的 from<=year<=to。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { centroid } from '@turf/turf'

const POLITIES_FILE = fileURLToPath(new URL('../../../工作区/deploy-tmp/data-src/geography/normalized/polities.json', import.meta.url))
const PERIODS_FILE = fileURLToPath(new URL('../../public/data/geography/periods.json', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../../public/data/geography/tiles/territory-geo/', import.meta.url))

const polities = JSON.parse(readFileSync(POLITIES_FILE, 'utf8')).entities
const periods = JSON.parse(readFileSync(PERIODS_FILE, 'utf8')).periods
mkdirSync(OUT_DIR, { recursive: true })

/** 时期切片窗口判定（与 build-tiles.mjs inSlice 一致） */
function inSlice(state, slice) {
  if (slice.id === 'all') return true
  return state.from <= slice.year && state.to >= slice.year
}

/**
 * 疆域克制表（按时期屏蔽已知错误政权，依据历史校验 2026-08-22）：
 *  Cliopatria 采用粗粒度 50–150 年状态桶 + 个别实体名/窗口错乱，导致部分政权在
 *  锚点年被错误渲染。逐一按历史事实核对 polities.json 各实体 from/to 窗口后，
 *  对确属时代错误者在此屏蔽（多边形 + 标签一并移除），避免地图出现荒谬色块：
 *    · abraham(-2100)：Gutian Dynasty —— 库提王朝实际约 -2116 已亡，锚点年属归档桶误留；
 *    · babylon(-586)：Macedonian Empire —— 马其顿帝国实际约 -359 才成帝国，早于此皆为误标；
 *    · persia(-539)：Macedonian Empire —— 同上；Neo-Babylonian Empire —— -539 年巴比伦
 *      已被居鲁士攻占并入波斯，锚点年不应再与其并立；
 *    · rome_entry(-63)：Great Yuan —— 上游把 -110~50 的某古政权误命名为"大元"
 *      （蒙古元朝为 1271–1368 AD），名实皆错，整体屏蔽。
 */
const SUPPRESS = {
  abraham: ['Gutian Dynasty'],
  babylon: ['Macedonian Empire'],
  persia: ['Macedonian Empire', 'Neo-Babylonian Empire'],
  rome_entry: ['Great Yuan'],
  jesus: ['Goths'],
  paul: ['Goths'],
  temple_fall: ['Goths'],
}

/** 生成一个时期的地图 FeatureCollection（多边形 + 每实体标签质心点） */
function sliceFC(slice) {
  if (slice.id === 'all') return { type: 'FeatureCollection', features: [] }
  const blocked = SUPPRESS[slice.id] || []
  const feats = []
  const byName = new Map()
  for (const e of polities) {
    if (blocked.includes(e.name)) continue
    for (const st of e.states) {
      if (!inSlice(st, slice)) continue
      feats.push({
        type: 'Feature',
        properties: { name: e.name, color: e.color, area: st.area, polity_id: e.id },
        geometry: st.geometry,
      })
      if (!byName.has(e.name)) byName.set(e.name, [])
      byName.get(e.name).push({ area: st.area, geometry: st.geometry })
    }
  }
  // 标签点：每实体一条，取最大 state 的质心（与瓦片版 territoryLabelsFC 同逻辑）
  for (const [name, group] of byName) {
    const best = group.reduce((a, b) => (b.area > a.area ? b : a))
    const c = centroid(best.geometry)
    if (!c || !c.geometry) continue
    feats.push({
      type: 'Feature',
      properties: { name, label: 1, area: best.area }, // area 供前端 symbol-sort-key 大国优先占位（与瓦片版一致）
      geometry: c.geometry,
    })
  }
  return { type: 'FeatureCollection', features: feats }
}

let totalKb = 0
for (const slice of [...periods, { id: 'all', year: 0 }]) {
  const fc = sliceFC(slice)
  const out = `${OUT_DIR}${slice.id}.geojson`
  writeFileSync(out, JSON.stringify(fc))
  const kb = (Buffer.byteLength(JSON.stringify(fc)) / 1024).toFixed(0)
  totalKb += Number(kb)
  console.log(`${slice.id.padEnd(14)} ${String(fc.features.length).padStart(3)} features  ${String(kb).padStart(4)} KB`)
}
console.log(`done. total ≈ ${(totalKb / 1024).toFixed(1)} MB → ${OUT_DIR}`)