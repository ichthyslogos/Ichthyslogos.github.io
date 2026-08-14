/**
 * 扫描 MHCC（concise/mhcc）全部 66 卷的 ref 连贯性：
 *  1. ref 语法解析（"1,2" / "1-8" / "17" / 混合）
 *  2. 段间连续性：乱序 / 缺口 / 重叠
 *  3. 覆盖范围与完整版 matthew-henry-en 对比（遗漏节）
 * 只读扫描，输出问题清单；修复另行处理。
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../data-src/brp/commentary/', import.meta.url))
const MHCC = join(ROOT, 'concise/mhcc')
const MHEN = join(ROOT, 'full/matthew-henry-en')

/** 解析 ref 字符串 → 节集合（[] = 无法解析/空） */
export function parseRef(ref) {
  if (!ref || typeof ref !== 'string') return []
  const out = new Set()
  for (const part of ref.split(',')) {
    const p = part.trim()
    if (!p) continue
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      const a = +m[1], b = +m[2]
      if (a > b || b - a > 200) return null // 异常范围
      for (let i = a; i <= b; i++) out.add(i)
    } else if (/^\d+$/.test(p)) {
      out.add(+p)
    } else {
      return null // 无法解析
    }
  }
  return out.size ? [...out].sort((a, b) => a - b) : null
}

function scanBook(dir, bookId) {
  const p = join(dir, `${bookId}.json`)
  if (!existsSync(p)) return null
  return JSON.parse(readFileSync(p, 'utf8'))
}

const issues = []
const coverage = [] // 每章覆盖统计

for (const f of readdirSync(MHCC).filter((f) => f.endsWith('.json'))) {
  const bookId = f.replace(/\.json$/, '')
  const mhcc = scanBook(MHCC, bookId)
  const mhen = scanBook(MHEN, bookId)
  for (const ch of mhcc.chapters) {
    const secs = ch.sections || []
    let prevMax = 0
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i]
      const ref = s.ref || ''
      const verses = parseRef(ref)
      const loc = `${bookId}:${ch.chapter} #${i}`
      if (verses === null) {
        issues.push({ type: 'REF_PARSE', loc, ref, text: (s.text || '').slice(0, 60) })
        continue
      }
      if (!verses.length) {
        issues.push({ type: 'REF_EMPTY', loc, ref })
        continue
      }
      const min = verses[0], max = verses[verses.length - 1]
      if (prevMax) {
        if (min < prevMax) {
          issues.push({ type: 'OVERLAP', loc, ref, prevMax })
        } else if (min > prevMax + 1) {
          issues.push({ type: 'GAP', loc, ref, gap: `${prevMax + 1}-${min - 1}` })
        }
      }
      prevMax = max
    }
    // 覆盖统计（用于与完整版对比）
    const covered = new Set()
    for (const s of secs) {
      const v = parseRef(s.ref)
      if (v) v.forEach((x) => covered.add(x))
    }
    coverage.push({ bookId, chapter: ch.chapter, covered: [...covered].sort((a, b) => a - b) })
    // 对比完整版（同章）
    if (mhen) {
      const mhenCh = mhen.chapters.find((c) => c.chapter === ch.chapter)
      if (mhenCh) {
        const mhenCovered = new Set()
        for (const s of mhenCh.sections || []) {
          const v = parseRef(s.ref)
          if (v) v.forEach((x) => mhenCovered.add(x))
        }
        const missing = [...mhenCovered].filter((x) => !covered.has(x)).sort((a, b) => a - b)
        const extra = [...covered].filter((x) => !mhenCovered.has(x)).sort((a, b) => a - b)
        if (missing.length || extra.length) {
          issues.push({
            type: 'COVERAGE_DIFF',
            loc: `${bookId}:${ch.chapter}`,
            mhenOnly: missing.slice(0, 20),
            mhccOnly: extra.slice(0, 20),
            missingCount: missing.length,
            extraCount: extra.length,
          })
        }
      }
    }
  }
}

// 输出报告
const byType = {}
for (const i of issues) (byType[i.type] = byType[i.type] || []).push(i)
console.log('=== 问题统计 ===')
for (const [t, list] of Object.entries(byType)) {
  console.log(`${t}: ${list.length} 处`)
  for (const i of list.slice(0, 15)) console.log('   ', JSON.stringify(i))
  if (list.length > 15) console.log(`    … 共 ${list.length} 处`)
}
console.log(`\n总问题数：${issues.length}`)
