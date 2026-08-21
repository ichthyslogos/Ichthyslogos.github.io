/**
 * bibleEntries.js — 圣经词条（人物/事件）共享数据层
 * 数据源：
 *   data/search/index.json        persons（zh/en/strong/first/n/ps/by/dy/gender）
 *                                + timeline（编年事件：zh/en 标题/年份/时长/参与者强码 ppl）
 *                                + books（书卷名）+ periods（时期定义）
 *   data/theographic/persons.json 人物增强数据（Easton 词典 + 亲属关系），详情按需加载
 * 模块级缓存：搜索面板/人物页/事件页共享，只拉一次。
 */

let indexPromise = null
let theoPromise = null

/** 站点根路径（尊重 vite base；深层路由下相对 fetch 会解析错目录，统一用根路径） */
const ROOT = import.meta.env.BASE_URL === './' ? '/' : import.meta.env.BASE_URL

export function loadEntryIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${ROOT}data/search/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`词条索引加载失败 (${r.status})`)
        return r.json()
      })
      .catch((e) => {
        indexPromise = null
        throw e
      })
  }
  return indexPromise
}

export function loadTheoPersons() {
  if (!theoPromise) {
    theoPromise = fetch(`${ROOT}data/theographic/persons.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`人物词典数据加载失败 (${r.status})`)
        return r.json()
      })
      .catch((e) => {
        theoPromise = null
        throw e
      })
  }
  return theoPromise
}

/* ---------- 显示工具 ---------- */

/** 书:章:节 → 中文显示（43:3:16 → 约翰福音 3:16） */
export function refLabel(first, books) {
  if (!first) return ''
  const [bookId, ch, vs] = String(first).split(':')
  const b = (books || []).find((x) => x.id === bookId)
  if (!b) return first
  return `${b.zh} ${ch}${vs ? ':' + vs : ''}`
}

/** 书:章:节 → 读经页深链（/brp/43/3?v=16，v= 节高亮） */
export function refUrl(first) {
  if (!first) return ''
  const [bookId, ch, vs] = String(first).split(':')
  return `/brp/${bookId}/${ch}${vs ? `?v=${vs}` : ''}`
}

/** 年份显示：负数 → 前 N 年（传统编年，非考古学定年） */
export function yearLabel(y) {
  if (y == null) return ''
  return y < 0 ? `约前 ${Math.abs(y)} 年` : `约公元 ${y} 年`
}

/** 生卒年区间：null 安全（两人皆无 → ''） */
export function yearsLabel(by, dy) {
  if (by == null && dy == null) return ''
  const f = (y) => (y < 0 ? `前${Math.abs(y)}` : String(y))
  if (by != null && dy != null) return `约 ${f(by)}–${f(dy)}`
  if (by != null) return `约 ${f(by)} 生`
  return `约 ${f(dy)} 卒`
}

/* ---------- 人物解析 ---------- */

/**
 * 人物解析器：强码 → 索引人物记录。
 * 索引存在两种强码形态：id（无零填充，如 H175）与 s（零填充，如 H0175）；
 * 事件参与者和亲属关系字段的编码两种形态混用，解析时两者都试。
 */
export function buildPersonResolver(persons) {
  const byId = new Map()
  const byS = new Map()
  for (const p of persons || []) {
    byId.set(p.id.replace(/^person_/, ''), p)
    byS.set(p.s, p)
  }
  return (code) => (code != null ? byId.get(code) || byS.get(code) || null : null)
}

/* ---------- 事件 → 时期 ---------- */

/**
 * 事件年份 → 时期 id。时期按年份锚点升序，事件归属最后一个 year ≤ 事件年的时期；
 * 早于首时期（< -2100，如创造/洪水）→ 'primeval'（太古）；无年份 → ''（未定年）。
 */
export function eventPeriodId(y, periods) {
  if (y == null) return ''
  const sorted = [...(periods || [])].sort((a, b) => a.year - b.year)
  if (!sorted.length) return ''
  if (y < sorted[0].year) return 'primeval'
  let cur = sorted[0].id
  for (const p of sorted) {
    if (y >= p.year) cur = p.id
    else break
  }
  return cur
}
