/**
 * geojson_validator.js — BRP 统一库 v2 结构与几何校验（TEMPORAL-MAP-DB §4.1/§4.3）
 * 用法：node map_tests/geojson_validator.js
 * 覆盖：data-src/geography/normalized/（places/polities/urban）+ public base GeoJSON
 * v2 断言：existence 窗口合法、importance 历史段（1-5 星）不重叠且落在 existence 内、
 *          state 段与 importance 对齐、affiliations 引用存在的政权实体
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NORM = join(HERE, '../data-src/geography/normalized')
const GEO = join(HERE, '../public/data/geography')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

function checkGeometry(name, geom, file) {
  if (!geom || !geom.type || !geom.coordinates) { problem(`${file}: ${name} 无 geometry`); return }
  const c = geom.coordinates
  if (geom.type === 'Polygon') {
    for (const [ri, ring] of c.entries()) {
      if (ring.length < 4) { problem(`${file}: ${name} Polygon 环[${ri}] 点 < 4`); continue }
      const a = ring[0], b = ring[ring.length - 1]
      if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) problem(`${file}: ${name} Polygon 环[${ri}] 未闭合`)
    }
  }
}

/* 1. places.json v2：existence/importance/state/affiliations */
const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
let noExist = 0, badCoord = 0, badImp = 0, badState = 0, badAffil = 0
for (const p of places) {
  if (!p.existence || p.existence.from == null || p.existence.to == null) { noExist++; continue }
  if (p.existence.from > p.existence.to) { problem(`places.json: ${p.name} existence 反置`); noExist++ }
  const loc = p.location || {}
  if (!isFinite(loc.lng) || !isFinite(loc.lat)) badCoord++
  // importance 段：level 1-5、from<=to、不重叠、落在 existence 内
  let prevTo = -Infinity
  for (const s of p.importance || []) {
    if (!s || s.level < 1 || s.level > 5) { badImp++; break }
    if (s.from > s.to) { badImp++; problem(`places.json: ${p.name} importance 段反置 ${s.from}~${s.to}`); break }
    if (s.from < prevTo) { badImp++; problem(`places.json: ${p.name} importance 段重叠`); break }
    prevTo = s.to
    if (s.from < p.existence.from || s.to > p.existence.to) { badImp++; problem(`places.json: ${p.name} importance 超出 existence`); break }
  }
  if (!p.importance?.length) badImp++
  // state 段：不重叠
  let prevToS = -Infinity
  for (const s of p.state || []) {
    if (!s || !s.state || s.from > s.to) { badState++; break }
    if (s.from < prevToS) { badState++; break }
    prevToS = s.to
  }
  // affiliations：窗口合法（polity 引用完整性在 §4 统一校验）
  for (const a of p.political_affiliations || []) {
    if (!a.polity || a.from > a.to) { badAffil++; break }
  }
}
if (noExist) problem(`places.json: ${noExist} 个地点 existence 非法`)
if (badCoord) problem(`places.json: ${badCoord} 个地点坐标非法`)
if (badImp) problem(`places.json: ${badImp} 个地点 importance 历史非法`)
if (badState) problem(`places.json: ${badState} 个地点 state 历史非法`)
if (badAffil) problem(`places.json: ${badAffil} 个地点 affiliations 非法`)
console.log(`places: ${places.length} 个（existence 非法: ${noExist}，importance 非法: ${badImp}，坏坐标: ${badCoord}）`)

/* 2. polities.json v2：实体 + states（每状态有时间窗 + 有效几何） */
const polities = JSON.parse(readFileSync(join(NORM, 'polities.json'), 'utf8')).entities
let badPoly = 0, noColor = 0, stateOverlap = 0
const ids = new Set()
for (const e of polities) {
  if (!e.id) { problem(`polities.json: ${e.name} 缺 id`); badPoly++ }
  if (ids.has(e.id)) problem(`polities.json: ${e.id} id 重复`)
  ids.add(e.id)
  if (!e.color) noColor++
  let prevTo = -Infinity
  for (const st of e.states || []) {
    if (st.from == null || st.to == null) badPoly++
    if (st.from > st.to) { badPoly++; problem(`polities.json: ${e.name} 状态窗口反置 ${st.from}~${st.to}`) }
    if (st.from < prevTo) stateOverlap++
    prevTo = st.to
    checkGeometry(`${e.name}(${st.from}~${st.to})`, st.geometry, 'polities.json')
  }
}
if (badPoly) problem(`polities.json: ${badPoly} 个状态无时间窗/窗口非法`)
if (noColor) problem(`polities.json: ${noColor} 个实体无颜色`)
if (stateOverlap) problem(`polities.json: ${stateOverlap} 个状态窗口重叠`)
console.log(`polities: ${polities.length} 个实体（无时间窗: ${badPoly}，状态重叠: ${stateOverlap}）`)

/* 3. affiliations 引用完整性（需 polities ids）：kind='polity' 的 polity_id 必须存在 */
let dangling = 0
for (const p of places) {
  for (const a of p.political_affiliations || []) {
    if (a.kind === 'polity' && !ids.has(a.polity_id)) {
      dangling++
      if (dangling <= 5) problem(`places.json: ${p.name} 引用不存在的政权 ${a.polity}（${a.polity_id}）`)
    }
  }
}
if (dangling) problem(`places.json: ${dangling} 个悬空政权引用`)
console.log(`affiliations: 悬空引用 ${dangling} 个`)

/* 4. urban.json：几何 + 时间窗非空（v2：ARK 时期映射修复后不得再有 null 窗口） */
const urban = JSON.parse(readFileSync(join(NORM, 'urban.json'), 'utf8')).features
let badUrban = 0
for (const u of urban) {
  checkGeometry(u.name, u.geometry, 'urban.json')
  if (u.from == null || u.to == null || u.from > u.to) { badUrban++; problem(`urban.json: ${u.name} 时间窗非法（${u.from}~${u.to}）`) }
}
if (badUrban) problem(`urban.json: ${badUrban} 个城区时间窗非法`)
console.log(`urban: ${urban.length} 个（时间窗非法: ${badUrban}）`)

/* 5. 底图 GeoJSON */
for (const f of readdirSync(join(GEO, 'base')).filter((f) => f.endsWith('.geojson'))) {
  const fc = JSON.parse(readFileSync(join(GEO, 'base', f), 'utf8'))
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) { problem(`base/${f}: 结构非法`); continue }
  for (const feat of fc.features) checkGeometry(feat.properties?.name || 'f', feat.geometry, `base/${f}`)
}
console.log(`base: ${readdirSync(join(GEO, 'base')).filter((f) => f.endsWith('.geojson')).length} 个 GeoJSON 检查完成`)

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems.slice(0, 40)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 统一库 v2 结构与几何检查通过')
}
