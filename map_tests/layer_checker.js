/**
 * layer_checker.js — Layer 顺序与样式检查（协议 §7.2 / §8）
 * 用法：node map_tests/layer_checker.js
 * 静态解析 MapLibreMap.vue：addLayer 顺序（底图→疆域→路线→城区→城市）、样式合规
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(HERE, '../src/components/map/MapLibreMap.vue'), 'utf8')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

// 1. addLayer 顺序提取
const reBlock = /addLayer\(\{([\s\S]*?)\}\s*\)/g
let m
const blocks = []
while ((m = reBlock.exec(src))) {
  const id = /id:\s*['"]([^'"]+)['"]/.exec(m[1])?.[1]
  if (id) blocks.push({ id, block: m[1] })
}
console.log('addLayer 顺序:', blocks.map((b) => b.id).join(' → '))

// 2. 分层顺序验证（协议 §7.2：Base → 疆域 → Route → 城区 → City；行政区划已删除）
const tier = (id) => {
  if (id === 'bg' || id.startsWith('base-')) return 0
  if (id.startsWith('territory')) return 1
  if (id.startsWith('routes-')) return 2
  if (id.startsWith('urban')) return 3
  if (id.startsWith('pleiades')) return 4
  if (id.startsWith('cities')) return 5
  if (id.startsWith('focus')) return 6
  return 9
}
let lastTier = -1
for (const b of blocks) {
  const t = tier(b.id)
  if (t < lastTier) problem(`图层顺序错误：${b.id} 出现在更高层级之后（协议 §7.2）`)
  lastTier = Math.max(lastTier, t)
}

// 3. 样式检查
for (const b of blocks) {
  const { id, block } = b
  const type = /type:\s*['"]([^'"]+)['"]/.exec(block)?.[1]
  if (id === 'territory-fill' && /'fill-opacity':\s*0(?![\d.])/.test(block)) problem('疆域 fill-opacity = 0（§8.1）')
  if (type === 'line') {
    if (/'line-width':\s*0(?![\d.])/.test(block)) problem(`${id} line-width = 0（§8.2）`)
    const op = /'line-opacity':\s*([\d.]+)/.exec(block)
    if (op && parseFloat(op[1]) === 0) problem(`${id} line-opacity = 0（§8.2）`)
  }
  if (type === 'symbol') {
    if (!/['"]text-field['"]/.test(block)) problem(`${id} 缺 text-field（§8.3）`)
    if (!/['"]text-font['"]/.test(block)) problem(`${id} 缺 text-font`)
  }
}

console.log('='.repeat(60))
// 4. 分类过滤（applyCatFilter）必须覆盖 STEP 与 Pleiades 两层——
//    只过滤 STEP 层时图例切换对占多数的 Pleiades 补充点无效
for (const lid of ['cities-dot', 'cities-label', 'pleiades-dot', 'pleiades-label']) {
  if (!new RegExp(`\\['${lid}',`).test(src)) problem(`applyCatFilter 未覆盖图层 ${lid}（图例切换不生效）`)
}

// 5. 水域不得被国家疆域遮挡（海域部分须被遮盖）：水域锚定在国界线之下
if (!/const WATER = \[[^\]]*'base-ocean'[^\]]*'base-rivers'[^\]]*'base-lakes'/.test(src)) {
  problem('fixLayerOrder 未定义水域常量（ocean/rivers/lakes）')
}
if (!/moveLayer\(id, 'territory-line'\)/.test(src)) {
  problem('fixLayerOrder 未将水域锚定到国界线之下（海域部分应被遮盖）')
}
// 6. 点击疆域弹出国家名（重叠实体全列）
if (!/queryRenderedFeatures\(e\.point, \{ layers: \['territory-fill'\] \}\)/.test(src)) {
  problem('地图点击未查询 territory-fill（点击疆域应显示国家名）')
}

if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ Layer 顺序与样式检查通过')
}
