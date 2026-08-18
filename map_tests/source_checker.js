/**
 * source_checker.js — MapLibre Source 检查（协议 §7.1/§7.3）
 * 用法：node map_tests/source_checker.js
 * 静态解析 MapLibreMap.vue：vector source 瓦片 URL 模板、source-layer 与图层引用一致性
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(HERE, '../src/components/map/MapLibreMap.vue'), 'utf8')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

// 1. addSource 清单
const sources = []
const reSrc = /addSource\(\s*['"]([^'"]+)['"]/g
let m
while ((m = reSrc.exec(src))) sources.push(m[1])
console.log('sources:', sources.join(', '))

// 2. vector source 的 tiles 模板与 maxzoom（分块解析：每个 addSource 块到下一个 addSource/addLayer 为止）
// 先解析 LAYER_ZOOM 常量表，maxzoom 符号引用解析为真实数值（避免打印伪值）
const LAYER_ZOOM = {}
{
  const lzBlock = /const LAYER_ZOOM = \{([\s\S]*?)\}/.exec(src)?.[1] || ''
  for (const [, k, v] of lzBlock.matchAll(/(\w+):\s*(\d+)/g)) LAYER_ZOOM[k] = Number(v)
}
const vectorSources = {}
{
  const starts = [...src.matchAll(/addSource\(\s*['"]([^'"]+)['"]/g)]
  const bounds = [...src.matchAll(/addSource\(\s*['"][^'"]+['"]|addLayer\(\s*\{/g)].map((m) => m.index)
  starts.forEach((m, i) => {
    const name = m[1]
    const from = m.index
    const to = bounds.find((b) => b > from) ?? src.length
    const block = src.slice(from, to)
    if (!/type:\s*'vector'/.test(block)) return
    const tilesM = /tiles:\s*\[([^\]]*)\]/.exec(block)
    const maxM = /maxzoom:\s*(LAYER_ZOOM\.\w+|\d+)/.exec(block)
    const maxzoom = maxM ? (LAYER_ZOOM[maxM[1].replace('LAYER_ZOOM.', '')] ?? parseInt(maxM[1], 10)) : 0
    vectorSources[name] = { tiles: (tilesM?.[1] || '').trim(), maxzoom }
  })
}
for (const [name, v] of Object.entries(vectorSources)) {
  console.log(`  ${name}: ${v.tiles} maxzoom=${v.maxzoom}`)
  // 瓦片模板必须含 {z}/{x}/{y} 且相对路径（本地瓦片）
  if (!/{z}\/{x}\/{y}\.pbf/.test(v.tiles)) problem(`${name} 瓦片模板非法：${v.tiles}`)
  if (!v.tiles.replace(/`/g, '').startsWith('${TILE_ROOT}')) problem(`${name} 瓦片路径未使用 TILE_ROOT 常量`)
}
// TILE_ROOT 常量必须指向 data/geography/tiles/（绝对化 new URL() 包装，相对 WebView 兼容）
const rootM = /const TILE_ROOT = new URL\('([^']+)', window\.location\.href\)\.href/.exec(src)
if (rootM?.[1] !== 'data/geography/tiles/') problem(`TILE_ROOT 应为 data/geography/tiles/（new URL 绝对化），实际 ${rootM?.[1]}`)

// 3. 必备 source
for (const req of ['gray-earth', 'base-ocean', 'base-rivers', 'base-lakes', 'territories', 'cities', 'urban', 'routes']) {
  if (!sources.includes(req)) problem(`缺少必备 source "${req}"`)
}

// 4. source-layer 一致性（协议 §7.3：source-layer 必须等于瓦片内图层名）
const reLay = /addLayer\(\{([\s\S]*?)\}\s*\)/g
while ((m = reLay.exec(src))) {
  const block = m[1]
  const id = /id:\s*['"]([^'"]+)['"]/.exec(block)?.[1]
  const srcName = /source:\s*['"]([^'"]+)['"]/.exec(block)?.[1]
  const layerName = /['"]source-layer['"]:\s*['"]([^'"]+)['"]/.exec(block)?.[1]
  if (!id || !srcName) continue
  if (vectorSources[srcName] && layerName !== srcName) {
    problem(`图层 ${id} 引用 source "${srcName}" 但 source-layer="${layerName}"——协议 §7.3 名称不匹配`)
  }
  if (!vectorSources[srcName] && !['gray-earth', 'base-ocean', 'base-rivers', 'base-lakes', 'routes', 'focus-places'].includes(srcName)) {
    problem(`图层 ${id} 引用未定义 source "${srcName}"`)
  }
}

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ Source 检查通过（矢量瓦片 URL/缩放/source-layer 一致）')
}
