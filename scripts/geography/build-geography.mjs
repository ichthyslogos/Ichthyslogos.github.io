/**
 * build-geography.mjs — normalized 旅程/几何 → 运行时数据（public/data/geography/）
 *
 * 复制 data-src/geography/normalized/ 的 journeys.json 与 geometries.json 到 public。
 * 旅程数据保持 GeoJSON/JSON 直连（动态交互数据：179 旅程 + 508 段几何），
 * 其余图层走 Vector Tile（见 build-tiles.mjs）。
 *
 * 用法：node scripts/geography/build-geography.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = (p) => fileURLToPath(new URL(`../../data-src/geography/normalized/${p}`, import.meta.url))
const OUT = (p) => fileURLToPath(new URL(`../../public/data/geography/${p}`, import.meta.url))

mkdirSync(OUT(''), { recursive: true })
for (const f of ['journeys.json', 'geometries.json']) {
  writeFileSync(OUT(f), readFileSync(SRC(f)))
}
const j = JSON.parse(readFileSync(OUT('journeys.json'), 'utf8'))
const g = JSON.parse(readFileSync(OUT('geometries.json'), 'utf8'))
console.log(`[geo] journeys.json（${j.journeys.length} 旅程）→ public/data/geography/`)
console.log(`[geo] geometries.json（${Object.keys(g.geometries).length} 段几何）→ public/data/geography/`)
