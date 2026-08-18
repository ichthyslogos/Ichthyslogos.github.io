/**
 * temporal.js — Temporal Engine（TEMPORAL-MAP-DB v2 前端查询层）
 *
 * 统一的时间查询 API：任何实体（地点/政权）在任何年份的
 *   存在性（existence）→ TIME 过滤
 *   名称（names 时代名）→ RENDER 显示
 *   重要性（importance 1-5 星历史）→ ZOOM 分级
 *   政治归属（political_affiliations）→ 弹窗/上下文
 *   历史状态（state：ACTIVE/EMERGING/DECLINING/ABANDONED）→ 未来动画/样式
 *
 * 渲染管线：TIME（existsAt）→ ZOOM（importanceAt→等级）→ RENDER。
 * 数据来自 normalized/places.json v2（fetch 后传入查询）；本模块只做纯查询，
 * 不持有数据——与 build-tiles.mjs 的 Temporal 查询逻辑保持一致。
 */

/** 当前时间状态（由时间轴设置；null = 全部时期） */
let currentPeriod = null // { id, year, era, valid_time, ... }
let currentYear = null // number | null

/** 设置当前时期（时间轴切换时调用；period 为 periods.json 条目或 null） */
export function setCurrentPeriod(period) {
  currentPeriod = period || null
  currentYear = period && period.year != null ? period.year : null
}
export function getCurrentPeriod() {
  return currentPeriod
}
export function getCurrentYear() {
  return currentYear
}

/** 实体在给定年份是否存在（TIME 过滤；year=null 表示全部时期 → 只要实体有窗口即存在） */
export function existsAt(entity, year = currentYear) {
  const ex = entity?.existence || {}
  if (ex.from == null && ex.to == null) return true
  if (year == null) return true
  if (ex.from != null && year < ex.from) return false
  if (ex.to != null && year > ex.to) return false
  return true
}

/** 时代名 @ 年份：覆盖年份且跨度最小的名称段；无则默认名 */
export function nameAt(entity, year = currentYear) {
  if (year == null || !entity?.names?.length) return entity?.name || ''
  let best = null
  let bestSpan = Infinity
  for (const n of entity.names) {
    // from/to 缺失视为无界（null 隐式转 0 会误判 AD 年代）
    const from = n.from ?? -Infinity
    const to = n.to ?? Infinity
    if (from <= year && year <= to && to - from < bestSpan) {
      best = n
      bestSpan = to - from
    }
  }
  return best ? best.name : entity.name || ''
}

/** 重要性等级（1-5）@ 年份；全部时期取最高等级段（保守显示）；无数据默认 2 */
export function importanceAt(entity, year = currentYear) {
  const imp = entity?.importance
  if (!imp?.length) return 2
  if (year == null) {
    let best = imp[0]
    for (const s of imp) if (s.level > best.level) best = s
    return best.level
  }
  for (const s of imp) {
    if ((s.from ?? -Infinity) <= year && year <= (s.to ?? Infinity)) return s.level
  }
  return 2
}

/** 政治归属列表 @ 年份（全部时期返回全部段） */
export function affiliationAt(entity, year = currentYear) {
  const affils = entity?.political_affiliations || []
  if (year == null) return affils
  return affils.filter((a) => (a.from ?? -Infinity) <= year && year <= (a.to ?? Infinity))
}

/** 最具体（最小面积）政权归属 @ 年份——弹窗「隶属」显示用 */
export function polityAt(entity, year = currentYear) {
  const affils = affiliationAt(entity, year)
  let best = null
  for (const a of affils) {
    if (a.kind !== 'polity') continue
    if (!best || (a.polity_area || 0) < (best.polity_area || 0)) best = a
  }
  return best || null
}

/** 历史状态 @ 年份（ACTIVE/EMERGING/DECLINING/ABANDONED/UNKNOWN） */
export function stateAt(entity, year = currentYear) {
  const states = entity?.state
  if (!states?.length) return 'UNKNOWN'
  if (year == null) return states[0]?.state || 'UNKNOWN'
  for (const s of states) {
    if ((s.from ?? -Infinity) <= year && year <= (s.to ?? Infinity)) return s.state
  }
  return 'UNKNOWN'
}
