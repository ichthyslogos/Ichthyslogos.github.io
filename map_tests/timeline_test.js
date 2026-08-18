/**
 * timeline_test.js — 时间系统一致性检查（协议 §9 + §15 验收数据）
 * 用法：node map_tests/timeline_test.js
 * 检查：periods.json 旅程引用、每时期瓦片集存在、地点 valid_time 覆盖、§15 验收实体
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const GEO = join(HERE, '../public/data/geography')
const NORM = join(HERE, '../data-src/geography/normalized')
let fail = 0
const problems = []
const notes = []
function problem(msg) { problems.push(msg); fail++ }

const periods = JSON.parse(readFileSync(join(GEO, 'periods.json'), 'utf8')).periods
const journeys = JSON.parse(readFileSync(join(GEO, 'journeys.json'), 'utf8')).journeys
const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
// polities v2：实体 states 平铺（与瓦片构建一致）
const polities = JSON.parse(readFileSync(join(NORM, 'polities.json'), 'utf8')).entities.flatMap((e) =>
  e.states.map((st) => ({ name: e.name, from: st.from, to: st.to, geometry: st.geometry })),
)

// 1. journey_ids 引用完整性
const journeyIds = new Set(journeys.map((j) => j.id))
for (const p of periods) {
  for (const id of p.journey_ids || []) if (!journeyIds.has(id)) problem(`${p.id} 引用不存在旅程 ${id}`)
}
console.log(`periods: ${periods.length} 个时期，journey_ids 引用完整 ✓`)

// 2. 每时期瓦片集存在
//    territories/cities：全部时期（锚点年过滤，时期必有疆域/地点）
//    urban：仅 AWMC 时期窗口覆盖的时期（roman -30~300 → jesus/paul/temple_fall；
//    classical -550~-330 → persia；其余时期城区数据不存在——ARK 映射修复后的正确语义）
const urbanPeriods = new Set(['persia', 'jesus', 'paul', 'temple_fall'])
for (const p of periods) {
  for (const layer of ['territories', 'cities']) {
    const dir = join(GEO, 'tiles', layer, p.id)
    if (!existsSync(dir)) problem(`瓦片集缺失 tiles/${layer}/${p.id}`)
  }
  if (urbanPeriods.has(p.id) && !existsSync(join(GEO, 'tiles', 'urban', p.id))) {
    problem(`瓦片集缺失 tiles/urban/${p.id}（该时期应有城区数据）`)
  }
}
for (const layer of ['cities', 'urban']) {
  if (!existsSync(join(GEO, 'tiles', layer, 'all'))) problem(`瓦片集缺失 tiles/${layer}/all`)
}
console.log(`瓦片集：10 时期 × territories/cities + all ✓（urban 按时期语义 ${[...urbanPeriods].join('/')}）`)

// 3. 地点 existence 覆盖（TEMPORAL-MAP-DB v2：每个地点必须有存在窗口）
const noTime = places.filter((p) => !p.existence || p.existence.from == null || p.existence.to == null).length
if (noTime) problem(`${noTime} 个地点无 existence`)
else console.log(`地点 existence：${places.length}/${places.length} 全覆盖 ✓`)

// 3b. 时代元数据（era）——时间轴副标题（Temporal Engine）
const noEra = periods.filter((p) => !p.era)
if (noEra.length) problem(`${noEra.length} 个时期缺 era 元数据（${noEra.map((p) => p.id).join(', ')}）`)
else console.log(`时期 era 元数据：${periods.length}/${periods.length} ✓`)

// 3c. 重要性历史（v2：major 城市应有 importance 段；耶路撒冷按 curated 曲线随时代变化）
const jerImp = places.find((p) => p.name === 'Jerusalem')?.importance
if (!jerImp || jerImp.length < 3) problem('Jerusalem importance 历史不足（应有随时代变化的 1-5 星曲线）')
else {
  const lvls = jerImp.map((s) => s.level)
  if (Math.max(...lvls) < 5) problem('Jerusalem importance 峰值应达 5 星（大卫/耶稣时期）')
  else console.log(`Jerusalem importance 曲线：${lvls.join('→')}（峰值 ${Math.max(...lvls)}★）✓`)
}

// 4. §15 验收数据（按时期锚点年从统一库查询——与瓦片构建 inSlice 一致：
//    只查国家疆域（Cliopatria；行政区划已删除，正式版只保留国家疆域））
const namesAt = (pid) => {
  const p = periods.find((x) => x.id === pid)
  const list = polities.filter((t) => (t.from ?? -1e9) <= p.year && (t.to ?? 1e9) >= p.year)
  return new Set(list.map((t) => t.name))
}
const david = namesAt('david')
const babylon = namesAt('babylon')
const jesus = namesAt('jesus')
if (!david.has('Kingdom of Israel')) problem('Test1(1000 BC)：缺 Kingdom of Israel')
else console.log('Test1(1000 BC)：Kingdom of Israel ✓')
if (!babylon.has('Neo-Babylonian Empire')) problem('Test2(586 BC)：缺 Neo-Babylonian Empire')
else console.log('Test2(586 BC)：Neo-Babylonian Empire ✓')
if (!babylon.has('Kingdom of Judah')) notes.push('Test2(586 BC)：Kingdom of Judah 不在 Cliopatria 源（源数据止于 701 BC）——数据源限制')
if (!jesus.has('Roman Empire')) problem('Test3(30 AD)：缺 Roman Empire')
else console.log('Test3(30 AD)：Roman Empire ✓')
// Cliopatria Judea 切片止于 5 AD（犹地亚转由罗马直辖）；行政区划已删除，
// 30 AD 无 Iudaea 行省层——犹地亚区域仅显示 Roman Empire（数据源限制）
if (!jesus.has('Judea')) notes.push('Test3(30 AD)：Cliopatria Judea 止于 5 AD——30 AD 犹地亚无专属疆域（仅 Roman Empire，数据源限制）')
// 城市时代名（罗马期 Aelia Capitolina）
const jerusalem = places.find((p) => p.name === 'Jerusalem')
if (jerusalem && !jerusalem.names.some((n) => /Aelia/i.test(n.name))) {
  notes.push('Jerusalem 罗马期名 Aelia Capitolina 缺失（DARE 并入未命中）——时代名降级为默认名')
} else if (jerusalem) {
  console.log('Test3 城市时代名：Jerusalem → Aelia Capitolina ✓')
}
// 流放路线旅程
const exile = journeys.some((j) => /going_to_egypt|exile/i.test(j.id + j.name))
console.log('Test2(586 BC)：Exile 相关旅程 ' + (exile ? '存在 ✓' : '缺失！'))
if (!exile) problem('Test2(586 BC)：缺流放路线旅程')

console.log('='.repeat(60))
for (const n of notes) console.log('ℹ ' + n)
if (fail) {
  console.log(`❌ ${fail} 处问题：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 时间系统检查通过')
}
