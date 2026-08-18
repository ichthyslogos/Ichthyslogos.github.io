/**
 * build-geo-layers.mjs — 历史底图与静态资源构建（HISTORICAL-BASEMAP.md）
 *
 * 读素材库（只读），产出运行时底图（public/data/geography/）：
 *   base/ne_land.geojson / ne_ocean.geojson    NE 50m 优先（110m 回退），属性精简 + 坐标降精度
 *   base/ne_rivers.geojson / ne_lakes.geojson  全球水域（50m 主要河流/湖泊，属性精简 + 坐标降精度）
 *   base/gray-earth.png                        Gray Earth 底图（data-src 投影 → public）
 *   glyphs/<字体>/                             MapLibre 文本字体（素材库 → public，路径规范）
 *
 * 用法：node scripts/geography/build-geo-layers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAW = (p) => fileURLToPath(new URL(`../../../素材/geography/raw/${p}`, import.meta.url))
const OUT = (p) => fileURLToPath(new URL(`../../public/data/geography/${p}`, import.meta.url))

function simplifyCoords(coords) {
  if (typeof coords[0] === 'number') return [Math.round(coords[0] * 1e4) / 1e4, Math.round(coords[1] * 1e4) / 1e4]
  return coords.map(simplifyCoords)
}

mkdirSync(OUT('base'), { recursive: true })
let n = 0
// 陆地/海洋：50m 优先（110m 海岸线无尼罗河三角洲等细节），110m 回退；全量（全球）
for (const [src50, src110, outName] of [
  ['ne_50m_land.geojson', 'ne_110m_land.geojson', 'ne_land.geojson'],
  ['ne_50m_ocean.geojson', 'ne_110m_ocean.geojson', 'ne_ocean.geojson'],
]) {
  let src = RAW('base_map/' + src50)
  if (!existsSync(src)) src = RAW('base_map/' + src110)
  if (!existsSync(src)) continue
  const d = JSON.parse(readFileSync(src, 'utf8'))
  d.features = d.features
    .filter((ft) => ft.geometry?.coordinates)
    .map((ft) => ({
      type: 'Feature',
      properties: { name: ft.properties?.name || '', featurecla: ft.properties?.featurecla || '' },
      geometry: { type: ft.geometry.type, coordinates: simplifyCoords(ft.geometry.coordinates) },
    }))
  writeFileSync(OUT('base/' + outName), JSON.stringify(d))
  n += d.features.length
}
// 河流/湖泊：50m 优先（110m 全球仅 3 条河流）；全球覆盖（用户要求：水域信息全球都要），
// 属性精简 + 坐标降精度（50m 为全球主要河流/湖泊，体量 ~1.6MB，直接全量）
for (const [src50, src110, outName] of [
  ['ne_50m_rivers_lake_centerlines.geojson', 'ne_110m_rivers_lake_centerlines.geojson', 'ne_rivers.geojson'],
  ['ne_50m_lakes.geojson', 'ne_110m_lakes.geojson', 'ne_lakes.geojson'],
]) {
  let src = RAW('base_map/' + src50)
  if (!existsSync(src)) src = RAW('base_map/' + src110)
  if (!existsSync(src)) continue
  const d = JSON.parse(readFileSync(src, 'utf8'))
  d.features = d.features
    .filter((ft) => ft.geometry?.coordinates)
    .map((ft) => ({
      type: 'Feature',
      properties: { name: ft.properties?.name || '', featurecla: ft.properties?.featurecla || '' },
      geometry: { type: ft.geometry.type, coordinates: simplifyCoords(ft.geometry.coordinates) },
    }))
  writeFileSync(OUT('base/' + outName), JSON.stringify(d))
  n += d.features.length
}
// Gray Earth 底图（data-src 投影 → public）
const gray = fileURLToPath(new URL('../../data-src/geography/base/gray-earth.png', import.meta.url))
if (existsSync(gray)) {
  writeFileSync(OUT('base/gray-earth.png'), readFileSync(gray))
  console.log('[geo-layers] Gray Earth 底图已复制')
}
// glyphs 字体（素材库 → public/data/geography/glyphs/<字体>/；先清旧目录避免路径错误残留）
const glyphDir = RAW('glyphs')
if (existsSync(glyphDir)) {
  const outDir = OUT('glyphs')
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  for (const font of readdirSync(glyphDir)) {
    if (!existsSync(glyphDir + '/' + font + '/')) continue
    mkdirSync(outDir + '/' + font, { recursive: true })
    for (const f of readdirSync(glyphDir + '/' + font)) {
      writeFileSync(outDir + '/' + font + '/' + f, readFileSync(glyphDir + '/' + font + '/' + f))
    }
  }
  console.log('[geo-layers] glyphs 字体已复制（' + readdirSync(outDir).join(', ') + '）')
}
console.log(`[geo-layers] 底图完成（${n} 要素）→ public/data/geography/base/`)
