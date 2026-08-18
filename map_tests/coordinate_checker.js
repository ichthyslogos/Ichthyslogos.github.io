/**
 * coordinate_checker.js — 坐标系统检查（协议 §4.2）：EPSG:4326 [lng,lat] 顺序与取值范围
 * 用法：node map_tests/coordinate_checker.js
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NORM = join(HERE, '../data-src/geography/normalized')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

function checkPair(file, ctx, pair) {
  if (!Array.isArray(pair) || pair.length < 2) return
  const [a, b] = pair
  if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b)) {
    problem(`${file}: ${ctx} 非数值坐标`); return
  }
  if (Math.abs(b) > 90) problem(`${file}: ${ctx} 疑似经纬度颠倒 [${a},${b}]`)
  else if (Math.abs(a) > 180) problem(`${file}: ${ctx} 经度越界 ${a}`)
}

// places v2（location 对象）
const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
for (const p of places) checkPair('places.json', p.name, [p.location?.lng, p.location?.lat])
// polities v2（实体 states）/urban 几何
function walk(coords, fn) {
  if (typeof coords[0] === 'number') fn(coords)
  else coords.forEach((c) => walk(c, fn))
}
const polities = JSON.parse(readFileSync(join(NORM, 'polities.json'), 'utf8')).entities
for (const e of polities) {
  for (const st of e.states) walk(st.geometry.coordinates, (c) => checkPair('polities.json', e.name, c))
}
for (const f of ['urban.json']) {
  const data = JSON.parse(readFileSync(join(NORM, f), 'utf8')).features
  for (const t of data) walk(t.geometry.coordinates, (c) => checkPair(f, t.name || 'f', c))
}
// 旅程几何
const geo = JSON.parse(readFileSync(join(HERE, '../public/data/geography/geometries.json'), 'utf8')).geometries
for (const [id, coords] of Object.entries(geo)) for (const p of coords) checkPair('geometries.json', id, p)

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题（前 30）：`)
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 全部坐标检查通过（EPSG:4326 [lng,lat]，范围合法）')
}
