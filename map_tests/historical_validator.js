/**
 * historical_validator.js — Historical Data Validator（HISTORICAL-GIS.md §7）
 * 用法：node map_tests/historical_validator.js
 *
 * 跨文件冲突检测（curated ↔ normalized ↔ periods ↔ polities）：
 *   ERROR   结构性错误，渲染必然出错（exit code = 1）
 *   WARNING 时间/来源冲突或 curated 特例，需人工复核（报告不阻断）
 *
 * 分工：单文件结构校验（环闭合/坐标/几何缺陷）在 temporal_consistency.js、
 *       geojson_validator.js、polygon_defect_checker.js 等既有测试；
 *       本校验器专注"跨文件时间/身份/来源冲突"。
 *
 * 原则（HISTORICAL-GIS.md §0）：AI 不决定历史事实——curated 白名单特例只报告不修改。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const NORM = join(HERE, '../data-src/geography/normalized')
const CURATED = join(HERE, '../data-src/geography/curated')
const GEO = join(HERE, '../public/data/geography')

const errors = []
const warnings = []
const report = (level, msg) => (level === 'ERROR' ? errors : warnings).push(msg)

/* ============ 数据加载 ============ */
const places = JSON.parse(readFileSync(join(NORM, 'places.json'), 'utf8')).places
const polities = JSON.parse(readFileSync(join(NORM, 'polities.json'), 'utf8')).entities
const urban = JSON.parse(readFileSync(join(NORM, 'urban.json'), 'utf8')).features
const periods = JSON.parse(readFileSync(join(GEO, 'periods.json'), 'utf8')).periods
const placeEras = JSON.parse(readFileSync(join(CURATED, 'place-eras.json'), 'utf8'))
const placeImportance = JSON.parse(readFileSync(join(CURATED, 'place-importance.json'), 'utf8'))

const polityIds = new Set(polities.map((e) => e.id))

/* ============ 1. 窗口反置（任何 from > to 都是数据 bug；§3.1） ============ */
let inverted = 0
const checkInverted = (file, ctx, from, to) => {
  if (from != null && to != null && from > to) {
    inverted++
    report('ERROR', `${file}: ${ctx} 窗口反置 ${from}~${to}（来源: 源数据）Action: normWindow 修复或人工修正`)
  }
}
for (const p of places) {
  checkInverted('places.json', p.name, p.existence?.from, p.existence?.to)
  for (const n of p.names || []) checkInverted('places.json', `${p.name} 名称 ${n.name}`, n.from, n.to)
  for (const s of p.importance || []) checkInverted('places.json', `${p.name} importance`, s.from, s.to)
  for (const s of p.state || []) checkInverted('places.json', `${p.name} state`, s.from, s.to)
  for (const a of p.political_affiliations || []) checkInverted('places.json', `${p.name} 归属 ${a.polity}`, a.from, a.to)
}
for (const e of polities) {
  for (const st of e.states) checkInverted('polities.json', `${e.name} state`, st.from, st.to)
}
for (const u of urban) checkInverted('urban.json', u.name, u.from, u.to)

/* ============ 2. 地点 existence 缺失（§3.2） ============ */
let noExist = 0
for (const p of places) {
  if (!p.existence || p.existence.from == null || p.existence.to == null) {
    noExist++
    report('ERROR', `places.json: ${p.name} 缺 existence 窗口（来源: ${(p.sources || []).join('+')}）Action: 补充存在窗口`)
  }
}

/* ============ 3. affiliation 悬空引用（§4） ============ */
let dangle = 0
for (const p of places) {
  for (const a of p.political_affiliations || []) {
    if (a.kind === 'polity' && !polityIds.has(a.polity_id)) {
      dangle++
      report('ERROR', `places.json: ${p.name} 引用不存在的政权 ${a.polity}（${a.polity_id}）（来源: 构建期点包含测试）Action: 重建 polities 或修正 polity_id`)
    }
  }
}

/* ============ 4. polity states 窗口重叠/未排序（TEMPORAL-MAP-DB §0.4） ============ */
let stateOverlap = 0
for (const e of polities) {
  let prevTo = -Infinity
  let prevFrom = -Infinity
  for (const st of e.states) {
    if (st.from < prevFrom) report('ERROR', `polities.json: ${e.name} states 未按 from 排序（${st.from} < ${prevFrom}）Action: normalizeStates 重建`)
    if (st.from < prevTo) {
      stateOverlap++
      report('ERROR', `polities.json: ${e.name} 状态窗口重叠 ${prevTo} vs ${st.from}（来源: cliopatria 同窗切片）Action: normalizeStates 去重/截断`)
    }
    prevFrom = st.from
    prevTo = st.to
  }
}

/* ============ 5. 名称窗口超出 existence（§3.2 四类时间分离） ============
 * 注意：existence 是构建期启发式窗口（Pleiades place_type 默认窗 + curated 覆盖），
 * 而 Pleiades attested names 携带各自的"名称使用窗口"——两者独立（四类时间分离），
 * 名称窗口超出 existence 是源数据常态（如中世纪阿拉伯名 [1500,1599] 之于
 * 启发式 existence [-3000,640]）。因此：源生名称聚合为一条 WARNING 统计；
 * curated 时代名若超出 existence 则是人工特例（白名单 §10，逐条报告）。 */
const CURATED_EXCEPTIONS = new Map([
  // Jerusalem：STEP 存在窗口覆盖圣经时期 [-1800,100]；Aelia Capitolina 是罗马殖民地
  // 时代名（135-324），curated 特例有意记录——校验器只报告
  ['Jerusalem', [{ name: 'Aelia Capitolina', from: 135, to: 324 }]],
])
const isCuratedNameException = (placeName, seg) =>
  (CURATED_EXCEPTIONS.get(placeName) || []).some(
    (x) => x.name === seg.name && x.from === seg.from && x.to === seg.to,
  )
let nameOut = 0
let nameOutCurated = 0
const nameOutExamples = []
for (const p of places) {
  const { from: exFrom, to: exTo } = p.existence || {}
  if (exFrom == null || exTo == null) continue
  for (const n of p.names || []) {
    if (n.from < exFrom || n.to > exTo) {
      if (isCuratedNameException(p.name, n)) {
        nameOutCurated++
        report('WARNING', `places.json: ${p.name} 名称 ${n.name} [${n.from},${n.to}] 超出 existence [${exFrom},${exTo}]（来源: curated 特例白名单 §10）Action: 无需处理（有意特例）`)
      } else {
        nameOut++
        if (nameOutExamples.length < 5) {
          nameOutExamples.push(`${p.name}「${n.name}」[${n.from},${n.to}]（existence [${exFrom},${exTo}]，来源 ${(p.sources || []).join('+')}）`)
        }
      }
    }
  }
}
if (nameOut) {
  report('WARNING', `places.json: ${nameOut} 个名称窗口超出 existence——Pleiades/DARE attested names 独立窗口（四类时间分离 §3.2），启发式 existence 不裁剪；示例：${nameOutExamples.join('；')}。Action: 无需处理（源数据常态；curated 时代名例外见 §10 白名单）`)
}

/* ============ 5b. curated place-eras 名称窗口超出 curated valid_time（§10 白名单） ============ */
let eraNameOut = 0
for (const [name, spec] of Object.entries(placeEras)) {
  if (name.startsWith('_')) continue
  const [ef, et] = spec.valid_time || []
  if (ef == null || et == null) continue
  for (const n of spec.names || []) {
    if (n.from < ef || n.to > et) {
      if (isCuratedNameException(name, n)) {
        eraNameOut++
        report('WARNING', `place-eras.json: ${name} 名称 ${n.name} [${n.from},${n.to}] 超出 valid_time [${ef},${et}]（来源: curated 特例白名单 §10）Action: 无需处理（有意特例）`)
      } else {
        eraNameOut++
        report('WARNING', `place-eras.json: ${name} 名称 ${n.name} [${n.from},${n.to}] 超出 valid_time [${ef},${et}]（来源: curated）Action: 人工复核（curated 时代名应与存在窗口协调）`)
      }
    }
  }
}

/* ============ 6. 归属窗口超出 existence（§3.2 注：锚点年采样粒度） ============
 * 归属段端点为锚点年采样值（如 -2100 采样 vs existence 默认 -2000 起点），
 * 端点外溢属预期——聚合为一条统计报告 */
let affilOut = 0
const affilOutExamples = []
for (const p of places) {
  const { from: exFrom, to: exTo } = p.existence || {}
  if (exFrom == null || exTo == null) continue
  for (const a of p.political_affiliations || []) {
    if (a.from < exFrom || a.to > exTo) {
      affilOut++
      if (affilOutExamples.length < 3) {
        affilOutExamples.push(`${p.name} → ${a.polity} [${a.from},${a.to}]（existence [${exFrom},${exTo}]）`)
      }
    }
  }
}
if (affilOut) {
  report('WARNING', `places.json: ${affilOut} 个归属段端点超出 existence——10 锚点年采样粒度（ANCHOR_YEARS）所致，端点外溢属预期；示例：${affilOutExamples.join('；')}。Action: 人工复核（归属段非连续真实窗口）`)
}

/* ============ 7. curated ↔ normalized 一致性（§2 规则 1：curated 优先） ============ */
let eraMismatch = 0
for (const [name, spec] of Object.entries(placeEras)) {
  if (name.startsWith('_')) continue // _comment/_note 元字段
  const place = places.find((p) => p.name === name)
  if (!place) {
    report('WARNING', `place-eras.json: ${name} 无对应 normalized 地点（来源: curated）Action: 人工核对拼写或地点合并`)
    continue
  }
  const [cf, ct] = spec.valid_time || []
  const { from: nf, to: nt } = place.existence || {}
  if (cf != null && ct != null && (nf !== cf || nt !== ct)) {
    eraMismatch++
    report('WARNING', `place-eras.json: ${name} valid_time [${cf},${ct}] 与 normalized existence [${nf},${nt}] 不一致（来源: curated vs 构建结果）Action: 人工复核（curated 应优先）`)
  }
}

/* ============ 8. curated place-importance 段超出 eras 窗口（§10） ============ */
let impOut = 0
for (const [name, segs] of Object.entries(placeImportance)) {
  if (name.startsWith('_')) continue
  const spec = placeEras[name]
  const [ef, et] = (spec && spec.valid_time) || []
  if (ef == null || et == null) continue
  for (const s of segs) {
    if (s.from < ef || s.to > et) {
      impOut++
      report('WARNING', `place-importance.json: ${name} 段 [${s.from},${s.to}] level ${s.level} 超出 eras valid_time [${ef},${et}]（来源: curated 全历史曲线，超出 STEP 窗口属有意）Action: 无需处理（§10 白名单）`)
    }
  }
}

/* ============ 9. external_ids 键白名单（§4） + sources 一致性（§5） ============ */
const ID_KEYS = new Set(['step', 'pleiades', 'whg', 'wikidata', 'awmc', 'dare'])
let badIdKey = 0
let sourceMismatch = 0
for (const p of places) {
  const ids = p.external_ids || {}
  for (const k of Object.keys(ids)) {
    if (!ID_KEYS.has(k)) {
      badIdKey++
      report('WARNING', `places.json: ${p.name} external_ids 键 "${k}" 不在白名单 {${[...ID_KEYS].join(',')}}（来源: 构建）Action: 修正键名或扩展白名单`)
    }
  }
  const srcs = p.sources || []
  // 声明 pleiades/step 来源却无对应 ID（DARE 并入地点 external_ids 为空属正常，不查 dare）
  if (srcs.includes('pleiades') && !ids.pleiades) {
    sourceMismatch++
    report('WARNING', `places.json: ${p.name} sources 含 pleiades 但 external_ids.pleiades 缺失（来源: 构建）Action: 人工复核 ID 映射`)
  }
  if (srcs.includes('step') && !ids.step) {
    sourceMismatch++
    report('WARNING', `places.json: ${p.name} sources 含 step 但 external_ids.step 缺失（来源: 构建）Action: 人工复核 ID 映射`)
  }
}

/* ============ 10. 时期 era 元数据（§7 #12） ============ */
let noEra = 0
for (const p of periods) {
  if (!p.era) {
    noEra++
    report('ERROR', `periods.json: ${p.id} 缺 era 元数据（来源: build-periods.mjs）Action: 补充 era`)
  }
}

/* ============ 10b. 纯启发式窗口的城市/国家（§3：待人工 curated 补录） ============ */
let heuristicCore = 0
const heuristicExamples = []
for (const p of places) {
  if (!['city', 'region', 'nation', 'capital'].includes(p.entity_type)) continue
  if (p.existence_src !== 'heuristic') continue
  heuristicCore++
  if (heuristicExamples.length < 10) heuristicExamples.push(p.name)
}
if (heuristicCore) {
  report('WARNING', `places.json: ${heuristicCore} 个城市/国家 existence 为纯启发式窗口（无 curated/Pleiades/DARE 时间来源）——示例：${heuristicExamples.join('、')}。Action: 人工 curated 补录（place-eras.json）`)
}

/* ============ 11. precision/certainty 取值校验（§3.3，出现即校验） ============ */
const PRECISIONS = new Set(['year', 'decade', 'century'])
const CERTAINTIES = new Set(['certain', 'probable', 'uncertain'])
let badPrecision = 0
const scanTemporal = (file, ctx, t) => {
  if (!t || typeof t !== 'object') return
  if (t.precision != null && !PRECISIONS.has(t.precision)) {
    badPrecision++
    report('ERROR', `${file}: ${ctx} precision "${t.precision}" 非法（允许 year/decade/century）（来源: 数据）Action: 修正取值`)
  }
  if (t.certainty != null && !CERTAINTIES.has(t.certainty)) {
    badPrecision++
    report('ERROR', `${file}: ${ctx} certainty "${t.certainty}" 非法（允许 certain/probable/uncertain）（来源: 数据）Action: 修正取值`)
  }
}
for (const [name, spec] of Object.entries(placeEras)) {
  if (name.startsWith('_')) continue
  scanTemporal('place-eras.json', name, spec.valid_time)
  for (const n of spec.names || []) scanTemporal('place-eras.json', `${name} 名称 ${n.name}`, n)
}

/* ============ 11b. curated 政权窗口修正表引用完整性（§3.4） ============ */
let polityEraBad = 0
const polityEras = JSON.parse(readFileSync(join(CURATED, 'polity-eras.json'), 'utf8'))
const polityNames = new Set(polities.map((e) => e.name))
for (const [name, ov] of Object.entries(polityEras)) {
  if (name.startsWith('_')) continue
  if (!polityNames.has(name)) {
    polityEraBad++
    report('ERROR', `polity-eras.json: ${name} 无对应政权实体（拼写或实体不存在）Action: 修正表键名`)
    continue
  }
  if (ov.from == null && ov.to == null) {
    polityEraBad++
    report('ERROR', `polity-eras.json: ${name} 修正项为空（需 from/to 至少其一）Action: 补充修正值或删除条目`)
  }
  if (ov.from != null && ov.to != null && ov.from > ov.to) {
    polityEraBad++
    report('ERROR', `polity-eras.json: ${name} 修正窗口反置（${ov.from} > ${ov.to}）Action: 修正`)
  }
}

/* ============ 输出 ============ */
const dedupe = (arr) => [...new Set(arr)]
const allErrors = dedupe(errors)
const allWarnings = dedupe(warnings)
console.log('='.repeat(68))
console.log('Historical Data Validator（HISTORICAL-GIS.md §7）')
console.log(`  输入：${places.length} 地点 / ${polities.length} 政权实体 / ${urban.length} 城区 / ${periods.length} 时期 / curated ${Object.keys(placeEras).filter((k) => !k.startsWith('_')).length} 地点`)
console.log('='.repeat(68))
for (const w of allWarnings.slice(0, 60)) console.log(`WARNING ${w}`)
if (allWarnings.length > 60) console.log(`…另有 ${allWarnings.length - 60} 条 WARNING（完整见上方统计）`)
for (const e of allErrors.slice(0, 40)) console.log(`ERROR   ${e}`)
if (allErrors.length > 40) console.log(`…另有 ${allErrors.length - 40} 条 ERROR`)
console.log('='.repeat(68))
console.log(
  `统计：ERROR ${allErrors.length} / WARNING ${allWarnings.length}` +
    `（反置 ${inverted} · 缺 existence ${noExist} · 悬空 ${dangle} · 状态重叠 ${stateOverlap} · 名称越窗 ${nameOut} + curated ${nameOutCurated} · 归属越窗 ${affilOut} · eras 不一致 ${eraMismatch} · importance 越窗 ${impOut} · ID 键异常 ${badIdKey} · 来源不一致 ${sourceMismatch} · 缺 era ${noEra} · 启发式城市/国家 ${heuristicCore} · precision 非法 ${badPrecision}）`,
)
if (allErrors.length) {
  console.log(`❌ ${allErrors.length} 处 ERROR——必须修复（WARNING ${allWarnings.length} 条供人工复核）`)
  process.exitCode = 1
} else {
  console.log(`✅ 结构性冲突 0（WARNING ${allWarnings.length} 条为 curated 特例/采样粒度，见 §10 白名单）`)
}
