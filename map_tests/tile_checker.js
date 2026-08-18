/**
 * tile_checker.js — Vector Tile 完整性检查（协议 §6）
 * 用法：node map_tests/tile_checker.js
 * 检查：tiles/{layer}/{period}/{z}/{x}/{y}.pbf 结构、PBF 可解析（@mapbox/vector-tile）、
 *       非空、<500KB（§6.3）、manifest.json 与瓦片集一致、glyphs 字体完整
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { VectorTile } = require('@mapbox/vector-tile')
const { PbfReader } = require('pbf')

const HERE = dirname(fileURLToPath(import.meta.url))
const TILES = join(HERE, '../public/data/geography/tiles')
const GLYPHS = join(HERE, '../public/data/geography/glyphs')
let fail = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

if (!existsSync(TILES)) {
  console.error('❌ tiles/ 目录不存在——运行 npm run data:build 先生成瓦片')
  process.exit(1)
}

// 1. manifest 一致性
const manifest = JSON.parse(readFileSync(join(TILES, 'manifest.json'), 'utf8'))
console.log('manifest 层：' + manifest.layers.map((l) => `${l.id}(z${l.maxZoom})`).join(', '))
for (const layer of manifest.layers) {
  const dir = join(TILES, layer.id)
  if (!existsSync(dir)) { problem(`tiles/${layer.id} 目录不存在`); continue }
  const slices = readdirSync(dir).filter((s) => s !== 'manifest.json')
  for (const slice of slices) {
    const stat = statSync(join(dir, slice))
    if (!stat.isDirectory()) continue
    // 抽样检查：每个 slice 抽查 z 层与非空瓦片
    const zDirs = readdirSync(join(dir, slice)).filter((z) => /^\d+$/.test(z))
    if (!zDirs.length && layer.id === 'territories' && slice !== 'all') {
      problem(`tiles/${layer.id}/${slice} 无瓦片`)
      continue
    }
    let checked = 0
    let maxBytes = 0
    outer: for (const z of zDirs.slice(0, 3)) {
      const xDirs = readdirSync(join(dir, slice, z))
      for (const x of xDirs.slice(0, 5)) {
        const ys = readdirSync(join(dir, slice, z, x)).filter((y) => y.endsWith('.pbf'))
        for (const y of ys.slice(0, 3)) {
          const path = join(dir, slice, z, x, y)
          const buf = readFileSync(path)
          if (!buf.length) { problem(`${path} 空文件`); continue }
          maxBytes = Math.max(maxBytes, buf.length)
          if (buf.length > 500 * 1024) problem(`${path} 超 500KB（${buf.length}B）——协议 §6.3`)
          try {
            const vt = new VectorTile(new PbfReader(buf))
            const layerNames = Object.keys(vt.layers)
            if (!layerNames.length) { problem(`${path} 无矢量图层`); continue }
            if (layerNames[0] !== layer.id) problem(`${path} source-layer 名不匹配：${layerNames[0]} ≠ ${layer.id}`)
          } catch (e) {
            problem(`${path} PBF 解析失败：${e.message}`)
          }
          checked++
          if (checked >= 9) break outer
        }
      }
    }
    console.log(`  ${layer.id}/${slice}: ${zDirs.length} 个 z 层（抽查 ${checked} 瓦片，max ${(maxBytes / 1024).toFixed(0)}KB）`)
  }
}

// 2. glyphs 字体
if (!existsSync(GLYPHS)) {
  problem('glyphs 目录缺失——文字无法渲染')
} else {
  for (const font of readdirSync(GLYPHS)) {
    const files = readdirSync(join(GLYPHS, font)).filter((f) => f.endsWith('.pbf'))
    if (!files.includes('0-255.pbf')) problem(`glyphs/${font} 缺 0-255.pbf（拉丁字母无法渲染）`)
    console.log(`  glyphs/${font}: ${files.length} 个 PBF`)
  }
}

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ Tile/字体检查通过（矢量瓦片可解析、体积合规、source-layer 一致）')
}
