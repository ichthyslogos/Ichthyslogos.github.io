/**
 * build-regions.mjs — 地区数据库构建（HISTORICAL-GIS.md §地区数据库）
 *
 * 从 places.json 提取地区地点（entity_type ∈ {region, nation}），生成 regions.json：
 *   每个地区 = { id, en（英文名）, zh（curated 中文名，未录入为空串）, entity_type,
 *                from/to（出现/灭亡时间 = existence 窗口）, location, periods（时期映射）}
 *
 * 时期映射规则（与 build-tiles.mjs inSlice 完全一致——"时期在时间区间内才显示"）：
 *   地区 in 时期 ⇔ period.year（锚点年）∈ [from, to]；to 为 null 视为开放区间。
 *
 * 中文名来源：curated/region-names.json（en → 中文名，人工审定；未收录留空）。
 *
 * 产出：
 *   data-src/geography/normalized/regions.json   权威库（含 source 头）
 *   public/data/geography/regions.json           运行时副本（前端可直接查询）
 *
 * 用法：node scripts/geography/build-regions.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const NORM = (p) => fileURLToPath(new URL(`../../data-src/geography/normalized/${p}`, import.meta.url))
const CUR = (p) => fileURLToPath(new URL(`../../data-src/geography/curated/${p}`, import.meta.url))
const PERIODS_FILE = fileURLToPath(new URL('../../public/data/geography/periods.json', import.meta.url))
const OUT = (p) => fileURLToPath(new URL(`../../public/data/geography/${p}`, import.meta.url))

const places = JSON.parse(readFileSync(NORM('places.json'), 'utf8')).places
const periods = JSON.parse(readFileSync(PERIODS_FILE, 'utf8')).periods
const zhNames = JSON.parse(readFileSync(CUR('region-names.json'), 'utf8'))

/** 锚点年包含测试（与 build-tiles.mjs inSlice 一致）：时期年在 [from,to] 内才显示 */
const inPeriod = (from, to, year) => from != null && to != null && from <= year && to >= year

const REGION_TYPES = new Set(['region', 'nation'])
const regions = []
let skipped = 0
for (const p of places) {
  if (!REGION_TYPES.has(p.entity_type)) continue
  const { from, to } = p.existence || {}
  if (from == null || to == null) {
    skipped++
    console.warn(`[regions] 跳过无 existence 的地区：${p.name}`)
    continue
  }
  const active = periods.filter((pd) => inPeriod(from, to, pd.year)).map((pd) => pd.id)
  regions.push({
    id: p.id,
    en: p.name,
    zh: zhNames[p.name] || '',
    entity_type: p.entity_type,
    from,
    to,
    existence_src: p.existence_src || 'heuristic',
    location: { lng: p.location?.lng ?? null, lat: p.location?.lat ?? null },
    periods: active,
  })
}
regions.sort((a, b) => a.en.localeCompare(b.en))

const doc = {
  source: {
    key: 'fish_regions',
    providers: 'pleiades+step+dare',
    schema: 'temporal-v2',
    // 映射规则：period.year（锚点年）∈ [from,to] 才显示——与瓦片 inSlice 一致
    updated: '2026-08-17',
  },
  count: regions.length,
  periods: periods.map((p) => p.id),
  regions,
}
const json = JSON.stringify(doc, null, 1)

mkdirSync(NORM(''), { recursive: true })
writeFileSync(NORM('regions.json'), json)
mkdirSync(OUT(''), { recursive: true })
writeFileSync(OUT('regions.json'), json)

const zhFilled = regions.filter((r) => r.zh).length
console.log(`[regions] 地区数据库：${regions.length} 个地区（${REGION_TYPES.size} 类：${[...REGION_TYPES].join('/')}；中文名 ${zhFilled} 条，跳过 ${skipped}）→ normalized + public/data/geography/regions.json`)
