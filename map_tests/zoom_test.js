/**
 * zoom_test.js — Zoom LOD 一致性检查（协议 §10）
 * 用法：node map_tests/zoom_test.js
 * 检查：前端 CITY_BANDS 与构建端 build-tiles.mjs CITY_BANDS 一致；
 *       zoom 层级表（0-4/5-7/8-10/11+ 分层显示）与缩放后瓦片切换机制存在
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const front = readFileSync(join(HERE, '../src/components/map/MapLibreMap.vue'), 'utf8')
const builder = readFileSync(join(HERE, '../scripts/geography/build-tiles.mjs'), 'utf8')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

// 1. 两端 CITY_BANDS 一致（min 可选：前端省略 min 时按上一带 max+1 计算）
const mF = /const CITY_BANDS = \[([\s\S]*?)\]/.exec(front)
const mB = /const CITY_BANDS = \[([\s\S]*?)\]/.exec(builder)
const parse = (s) => {
  const bands = [...s.matchAll(/\{\s*min:\s*(\d+),\s*max:\s*(\d+),\s*lodMax:\s*(\d+)\s*\}/g)].map((m) => [m[1], m[2], m[3]])
  if (bands.length) return bands
  // 无 min 的写法（前端）：累加计算 min
  const loose = [...s.matchAll(/\{\s*max:\s*(\d+),\s*lodMax:\s*(\d+)\s*\}/g)].map((m) => [+m[1], +m[2]])
  const out = []
  let prevMax = -1
  for (const [max, lod] of loose) {
    out.push([String(prevMax + 1), String(max), String(lod)])
    prevMax = max
  }
  return out
}
const fBands = mF ? parse(mF[1]) : []
const bBands = mB ? parse(mB[1]) : []
console.log('前端 CITY_BANDS:', JSON.stringify(fBands))
console.log('构建 CITY_BANDS:', JSON.stringify(bBands))
if (JSON.stringify(fBands) !== JSON.stringify(bBands)) problem('前端与构建端 CITY_BANDS 不一致（缩放带错位 → 城市遗漏/重复）')

// 2. 时期切换 = 瓦片集切换（setTiles 存在）
if (!/setTiles\(tiles\)/.test(front)) problem('时期切换未调用 source.setTiles（缩放/时间切换后数据消失）')
else console.log('时期切换 setTiles ✓')

// 3. 城市 LOD 预裁剪在瓦片构建中生效
if (!/if \(lod > lodMax\) continue/.test(builder)) problem('构建端无 LOD 预裁剪（低缩放瓦片超限/城市全部显示）')
else console.log('构建端 LOD 预裁剪 ✓')

// 4. zoom 层级表断言（用户规范）：
//    0-4 国家/海洋/大型湖泊（城市/河流/城区/路线隐藏）
//    5-7 主要城市（cities minzoom 5）+ 主要河流（base-rivers minzoom 5）
//    8-10 山脉（CAT_ZOOM_GATE z8+）+ 路线（routes minzoom 8）
//    11+ 村庄/遗址（CAT_ZOOM_GATE z11+）；国家渐隐出 z8（territory maxzoom 8）
const blocks = {}
for (const m of front.matchAll(/addLayer\(\{([\s\S]*?)\}\s*\)/g)) {
  const id = /id:\s*['"]([^'"]+)['"]/.exec(m[1])?.[1]
  if (id) blocks[id] = m[1]
}
const expectMin = { 'urban-fill': 5, 'urban-line': 5, 'routes-solid': 11, 'routes-dashed': 11, 'routes-dotted': 11 }
for (const [id, v] of Object.entries(expectMin)) {
  const mm = /minzoom:\s*(\d+)/.exec(blocks[id] || '')
  if (parseInt(mm?.[1], 10) !== v) problem(`zoom 层级表：${id} minzoom 应为 ${v}`)
}
// 分类图层的 zoom 显示完全由 CAT_ZOOM_GATE 控制，不得设置 minzoom（否则 z0-4 内容被层级挡掉）
for (const id of ['cities-dot', 'cities-label', 'base-rivers']) {
  if (/minzoom:\s*\d/.test(blocks[id] || '')) problem(`zoom 层级表：${id} 不应设置 minzoom（分类显示由 CAT_ZOOM_GATE 控制/河流常亮）`)
}
// 国家层级提高：疆域层不得设置 maxzoom（放大后底色消失 = bug；改为全程可见 + 高缩放降透明度）
for (const id of ['territory-fill', 'territory-line']) {
  if (/maxzoom:/.test(blocks[id] || '')) problem(`疆域层 ${id} 不得设置 maxzoom（放大后底色消失）`)
}
// 分类缩放门控（图例 zoom 表）：match 表达式 + 关键分类断点
if (!/const CAT_ZOOM_GATE = \['match'/.test(front)) problem('zoom 层级表：CAT_ZOOM_GATE 应为 match 表达式')
for (const [cat, op, val] of [['nation', '<=', 8.5], ['city', '>=', 6], ['site', '>=', 11]]) {
  if (!new RegExp(`'${cat}', \\['${op}', \\['zoom'\\], ${val}\\]`).test(front)) {
    problem(`zoom 层级表：CAT_ZOOM_GATE 缺 ${cat} 断点（${op} ${val}）`)
  }
}
console.log('zoom 层级表断言 ✓')

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ Zoom LOD 一致性检查通过')
}
