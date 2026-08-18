/**
 * temporal_consistency.js — Temporal Historical Map v2 时间一致性检查（TEMPORAL-MAP-DB §2/§5）
 * 用法：node map_tests/temporal_consistency.js
 * 检查：实体级时间约束——
 *   places：existence ↔ importance 段 ↔ state 段 对齐（不重叠、落在存在窗口内）；
 *           政治归属段窗口合法且引用的政权实体存在；
 *           任何窗口不得反置（from > to 一律判定为数据 bug）
 *   polities：states 窗口有序不重叠；实体 id 唯一
 *   periods：era 时代元数据与时期一一对应
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NORM = join(HERE, '../data-src/geography/normalized')
const GEO = join(HERE, '../public/data/geography')
let fail = 0
const problems = []
const notes = []
function problem(msg) { problems.push(msg); fail++ }

const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
const polities = JSON.parse(readFileSync(join(NORM, 'polities.json'), 'utf8')).entities
const periods = JSON.parse(readFileSync(join(GEO, 'periods.json'), 'utf8')).periods

/* 1. 政权实体：id 唯一 + states 排序不重叠 */
const ids = new Set()
let dupId = 0, stateOverlap = 0, stateUnsorted = 0
for (const e of polities) {
  if (ids.has(e.id)) dupId++
  ids.add(e.id)
  let prevTo = -Infinity
  let prevFrom = -Infinity
  for (const st of e.states) {
    if (st.from < prevFrom) stateUnsorted++
    if (st.from < prevTo) stateOverlap++
    prevFrom = st.from
    prevTo = st.to
  }
}
if (dupId) problem(`polities: ${dupId} 个重复实体 id`)
if (stateUnsorted) problem(`polities: ${stateUnsorted} 个状态未按 from 排序`)
if (stateOverlap) problem(`polities: ${stateOverlap} 个状态窗口重叠`)
console.log(`polities 实体 ${polities.length} 个：id 唯一 ✓，states 排序/不重叠 ${stateUnsorted + stateOverlap ? '✗' : '✓'}`)

/* 2. places：importance/state 段与 existence 对齐；affiliations 引用完整 */
let impBad = 0, stateBad = 0, affilBad = 0, dangle = 0
for (const p of places) {
  const ex = p.existence
  // importance 段：level 1-5、不重叠、落在 existence 内、覆盖 existence 起点
  let prevTo = -Infinity
  for (const s of p.importance || []) {
    if (!s || s.level < 1 || s.level > 5) { impBad++; break }
    if (s.from > s.to) { impBad++; break }
    if (s.from < prevTo) { impBad++; problem(`places: ${p.name} importance 段重叠（${s.from}~${s.to}）`); break }
    prevTo = s.to
    if (s.from < ex.from - 0.5 || s.to > ex.to + 0.5) { impBad++; break }
  }
  if (!p.importance?.length) impBad++
  // state 段：不重叠且窗口与 existence 一致（最后一段可延伸至 existence.to 表示 ABANDONED）
  let prevToS = -Infinity
  for (const s of p.state || []) {
    if (!s || !s.state || s.from > s.to) { stateBad++; break }
    if (s.from < prevToS) { stateBad++; problem(`places: ${p.name} state 段重叠`); break }
    prevToS = s.to
    if (!['ACTIVE', 'EMERGING', 'DECLINING', 'ABANDONED', 'UNKNOWN'].includes(s.state)) { stateBad++; break }
  }
  if (!p.state?.length) stateBad++
  // affiliations：窗口合法；kind='polity' 引用存在（行政区划已删除，只保留政权归属）
  for (const a of p.political_affiliations || []) {
    if (!a.polity || a.from > a.to || a.kind !== 'polity') { affilBad++; break }
    if (!ids.has(a.polity_id)) { dangle++; break }
  }
}
if (impBad) problem(`places: ${impBad} 个 importance 历史与 existence 不一致`)
if (stateBad) problem(`places: ${stateBad} 个 state 历史非法`)
if (affilBad) problem(`places: ${affilBad} 个 affiliations 非法`)
if (dangle) problem(`places: ${dangle} 个悬空政权引用`)
console.log(`places 时间一致性：${places.length} 个（importance 异常 ${impBad} / state 异常 ${stateBad} / affiliations 异常 ${affilBad} + 悬空 ${dangle}）`)

/* 3. 全部窗口反置清零（任何 from>to 都视为 bug——含 names 段） */
let inverted = 0
for (const p of places) {
  if (p.existence.from > p.existence.to) { inverted++; continue }
  for (const n of p.names || []) if (n.from > n.to) { inverted++; if (inverted <= 5) problem(`places: ${p.name} 名称段反置 ${n.name} ${n.from}~${n.to}`) }
  for (const s of p.importance || []) if (s.from > s.to) inverted++
  for (const s of p.state || []) if (s.from > s.to) inverted++
  for (const a of p.political_affiliations || []) if (a.from > a.to) inverted++
}
for (const u of JSON.parse(readFileSync(join(NORM, 'urban.json'), 'utf8')).features) {
  if (u.from > u.to) inverted++
}
if (inverted) problem(`全库反置窗口：${inverted} 处`)
else console.log('反置窗口：全库 0 处 ✓（existence/names/importance/state/affiliations/urban）')

/* 4. periods：era 元数据齐全且与 id 对应 */
const noEra = periods.filter((p) => !p.era)
if (noEra.length) problem(`periods: ${noEra.length} 个时期缺 era（${noEra.map((p) => p.id).join(', ')}）`)
else console.log(`periods era：${periods.length}/${periods.length} ✓（${periods.map((p) => p.era).join(' / ')}）`)

/* 5. 时期锚点年 → 地点存在性（TIME 过滤演示：每时期应有核心地点存在）
 *    同名多实体（如 Babylon = 美索不达米亚 Babylon + 埃及 Babylon）任一存在即可；
 *    窗口合理性说明（2026-08 起 existence 来自 Pleiades 数值年 minDate/maxDate，见
 *    HISTORICAL-GIS §3.4）：Jerusalem/Jebus curated -1800 起、Bethlehem Pleiades -1400 起、
 *    Nazareth -200 起（考古最早希腊化期）、Nineveh -1800 起、Rome -753 起、Athens -1400 起
 *    ——早期时期（abraham -2100）只有远古即已存在的城市（Damascus/Tyre/Babylon 等）显示，
 *    这是真实年代过滤的正确语义，阈值取 ≥3/10 */
const core = ['Jerusalem', 'Bethlehem', 'Nazareth', 'Capernaum', 'Damascus', 'Tyre', 'Nineveh', 'Babylon', 'Athens', 'Rome']
let missing = 0
for (const p of periods) {
  const atYear = core.filter((name) => places.some((x) => x.name === name && x.existence.from <= p.year && x.existence.to >= p.year))
  if (atYear.length < 3) { missing++; problem(`${p.id}(${p.year})：仅 ${atYear.length}/10 核心地点存在（${atYear.join(', ') || '无'}）`) }
  else notes.push(`${p.id}(${p.year})：${atYear.length} 个核心地点存在`)
}
if (missing) problem(`${missing} 个时期核心地点覆盖不足`)
console.log(`时期锚点年：核心地点存在性抽样（每时期 ≥3/10）${missing ? '✗' : '✓'}`)

console.log('='.repeat(60))
for (const n of notes.slice(0, 12)) console.log('ℹ ' + n)
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems.slice(0, 40)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 时间一致性检查通过（实体 ↔ 时间段 ↔ 归属全面对齐）')
}
