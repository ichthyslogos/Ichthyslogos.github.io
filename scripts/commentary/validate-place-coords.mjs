/**
 * validate-place-coords.mjs — 全量校验 place-coords.json 坐标合理性
 *
 * 用 Natural Earth 陆地多边形（ne_50m_land）做 point-in-polygon：
 * 落在海洋中的地点列为「可疑」（water/river/coast 类别天然在水域，排除）；
 * 另输出数值异常（越界/NaN）与经度带外地点。
 *
 * 用法：node scripts/commentary/validate-place-coords.mjs [ne_land.geojson 路径]
 * 陆地数据下载：https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const COORDS_FILE = fileURLToPath(new URL('../../data-src/brp/commentary/notes/tipnr/place-coords.json', import.meta.url))
const LAND_FILE = process.argv[2] || 'ne-land-50m.geojson'

if (!existsSync(LAND_FILE)) {
  console.error('[validate] 缺少陆地多边形文件：' + LAND_FILE)
  process.exit(1)
}
if (!existsSync(COORDS_FILE)) {
  console.error('[validate] 缺少坐标文件：' + COORDS_FILE)
  process.exit(1)
}

const { coords } = JSON.parse(readFileSync(COORDS_FILE, 'utf8'))
const land = JSON.parse(readFileSync(LAND_FILE, 'utf8'))

/** 收集所有多边形环（外环），按 [lng, lat] 存储 */
const rings = []
for (const f of land.features) {
  const g = f.geometry
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
  for (const poly of polys) {
    rings.push(poly[0].map(([lng, lat]) => [lng, lat])) // 外环（第一环）
  }
}

/** ray casting：点在多边形内？ */
function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** 点是否在陆地（任一外环内；外环默认代表陆地，天然海洋 hole 极少，50m 数据可忽略） */
function onLand(lng, lat) {
  for (const ring of rings) {
    if (inRing(lng, lat, ring)) return true
  }
  return false
}

const WATER_CATS = new Set(['water', 'river', 'coast'])
const atSea = []
const badNum = []
const outOfRange = []
const entries = Object.entries(coords)

for (const [name, c] of entries) {
  const lat = c.lat, lng = c.lng
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    badNum.push(name)
    continue
  }
  // 圣经地理大致范围（西至西班牙他施 lng≈-6，南至示巴 lat≈12，东至波斯/以拦 lng≈55+）
  if (lng < -10 || lng > 80 || lat < 8 || lat > 48) {
    outOfRange.push({ name, lat, lng, cat: c.cat })
  }
  if (!WATER_CATS.has(c.cat) && !onLand(lng, lat)) {
    atSea.push({ name, lat, lng, cat: c.cat })
  }
}

console.log(`[validate] 共 ${entries.length} 个地点`)
console.log(`[validate] 数值异常: ${badNum.length ? badNum.join(', ') : '无'}`)
console.log(`[validate] 经纬范围外(≈>80E/<-10W/南<8/北>48): ${outOfRange.length} 个`)
for (const o of outOfRange) console.log(`  - ${o.name} (${o.lat.toFixed(3)}, ${o.lng.toFixed(3)}) [${o.cat}]`)
console.log(`[validate] 海洋中的地点(排除 water/river/coast): ${atSea.length} 个`)
for (const o of atSea) console.log(`  - ${o.name} (${o.lat.toFixed(3)}, ${o.lng.toFixed(3)}) [${o.cat}]`)
