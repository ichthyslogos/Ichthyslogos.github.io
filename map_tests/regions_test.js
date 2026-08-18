/**
 * regions_test.js — 地区数据库一致性检查（HISTORICAL-GIS.md §地区数据库）
 * 用法：node map_tests/regions_test.js
 * 检查：regions.json schema（en/from/to/坐标/时期映射）+ 映射与瓦片锚点年规则一致
 *       + zh 槽位（curated 表键必须存在）+ 与 places.json 数量一致
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NORM = join(HERE, '../data-src/geography/normalized')
const CURATED = join(HERE, '../data-src/geography/curated')
const GEO = join(HERE, '../public/data/geography')
let fail = 0
const problems = []
const problem = (msg) => { problems.push(msg); fail++ }

const regions = JSON.parse(readFileSync(join(NORM, 'regions.json'), 'utf8'))
const periods = JSON.parse(readFileSync(join(GEO, 'periods.json'), 'utf8')).periods
const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
const zhNames = JSON.parse(readFileSync(join(CURATED, 'region-names.json'), 'utf8'))

const periodIds = new Set(regions.periods || [])
if (!periodIds.size) problem('regions.json: periods 列表为空')
for (const p of periods) if (!periodIds.has(p.id)) problem(`regions.json: 缺时期 ${p.id}（映射表与 periods.json 不一致）`)

// 1. schema：en/from/to/坐标/entity_type
let schemaBad = 0
for (const r of regions.regions) {
  if (!r.en) { schemaBad++; problem(`regions.json: ${r.id} 缺英文名`); continue }
  if (!['region', 'nation'].includes(r.entity_type)) { schemaBad++; problem(`regions.json: ${r.en} entity_type 非法（${r.entity_type}）`) }
  if (r.from == null || r.to == null || r.from > r.to) { schemaBad++; problem(`regions.json: ${r.en} 时间窗非法（${r.from}~${r.to}）`) }
  const { lng, lat } = r.location || {}
  if (lng == null || lat == null || !isFinite(lng) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    schemaBad++; problem(`regions.json: ${r.en} 坐标非法（${lng},${lat}）`)
  }
  if (typeof r.zh !== 'string') { schemaBad++; problem(`regions.json: ${r.en} zh 应为字符串（当前 ${typeof r.zh}）`) }
  for (const pid of r.periods) if (!periodIds.has(pid)) { schemaBad++; problem(`regions.json: ${r.en} 映射到不存在的时期 ${pid}`) }
}
console.log(`regions schema：${regions.regions.length} 个地区（异常 ${schemaBad}）`)

// 2. 映射一致性：与瓦片锚点年规则（period.year ∈ [from,to]）比对——抽样 30 个
const anchorIn = (from, to, year) => from != null && to != null && from <= year && to >= year
const sample = regions.regions.filter((r) => r.from != null && r.to != null).sort(() => Math.random() - 0.5).slice(0, 30)
let mapBad = 0
for (const r of sample) {
  const expect = periods.filter((p) => anchorIn(r.from, r.to, p.year)).map((p) => p.id).sort()
  const actual = [...r.periods].sort()
  if (JSON.stringify(expect) !== JSON.stringify(actual)) {
    mapBad++
    problem(`regions.json: ${r.en} 时期映射与锚点年规则不一致（期望 ${expect.join(',')}，实际 ${actual.join(',')}）`)
  }
}
console.log(`时期映射一致性：抽样 ${sample.length} 个地区（不一致 ${mapBad}）`)

// 3. zh 槽位：curated 表键必须存在于 regions；zh 为空串合法（暂未录入）
let zhBad = 0
const enSet = new Set(regions.regions.map((r) => r.en))
for (const [en, zh] of Object.entries(zhNames)) {
  if (en.startsWith('_')) continue
  if (!enSet.has(en)) { zhBad++; problem(`region-names.json: ${en} 无对应地区（拼写或实体不存在）`) }
  if (typeof zh !== 'string' || !zh) { zhBad++; problem(`region-names.json: ${en} 中文名应为非空字符串`) }
}
console.log(`中文名表：${Object.keys(zhNames).filter((k) => !k.startsWith('_')).length} 条（异常 ${zhBad}）`)

// 4. 与 places.json 数量一致（region 751 + nation 209 = 960）
const expectCount = places.filter((p) => ['region', 'nation'].includes(p.entity_type)).length
if (regions.regions.length !== expectCount) {
  problem(`regions.json 数量 ${regions.regions.length} ≠ places.json region/nation ${expectCount}`)
}
console.log(`数量一致性：regions ${regions.regions.length} / places region+nation ${expectCount}`)

console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 地区数据库检查通过（schema/映射/中文名槽位/数量一致）')
}
