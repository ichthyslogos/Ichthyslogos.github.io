/**
 * split-mhcc.mjs — 拆分 MHCC 简要版数据（一次性迁移脚本）
 *
 * 解经抽屉按栏目分文件夹后，一句话总结（summary）与经文解释（sections）
 * 不再混在同一个 concise 文件里：
 *   commentary/concise/mhcc/<bookId>.json        （旧：chapter + summary + sections）
 *       ↓ 拆分
 *   commentary/summary/mhcc/<bookId>.json         （新：仅 chapter + summary）
 *   commentary/interpretation/mhcc/<bookId>.json  （新：仅 chapter + sections）
 *
 * 用法：node scripts/commentary/split-mhcc.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMMENT_DIR = join(__dirname, '..', '..', 'data-src', 'brp', 'commentary')

const SRC = join(COMMENT_DIR, 'concise', 'mhcc')
const OUT_SUMMARY = join(COMMENT_DIR, 'summary', 'mhcc')
const OUT_INTERP = join(COMMENT_DIR, 'interpretation', 'mhcc')

if (!existsSync(SRC)) {
  console.error('[split-mhcc] 未找到 concise/mhcc/，跳过（可能已拆分）')
  process.exit(0)
}

mkdirSync(OUT_SUMMARY, { recursive: true })
mkdirSync(OUT_INTERP, { recursive: true })

let books = 0
let summaryCh = 0
let sectionCh = 0
for (const f of readdirSync(SRC)) {
  if (!f.endsWith('.json')) continue
  const raw = JSON.parse(readFileSync(join(SRC, f), 'utf8'))
  const { source, bookId } = raw

  // summary 切片：每章仅保留 summary（经文解释列已移除，字段不再携带）
  const summaryBook = {
    source,
    bookId,
    chapters: (raw.chapters || []).map((c) => ({ chapter: c.chapter, summary: c.summary || '' })),
  }
  writeFileSync(join(OUT_SUMMARY, f), JSON.stringify(summaryBook, null, 2) + '\n', 'utf8')

  // interpretation 切片：每章仅保留 sections（逐节讲解）
  const interpBook = {
    source,
    bookId,
    chapters: (raw.chapters || []).map((c) => ({ chapter: c.chapter, sections: c.sections || [] })),
  }
  writeFileSync(join(OUT_INTERP, f), JSON.stringify(interpBook, null, 2) + '\n', 'utf8')

  books++
  summaryCh += summaryBook.chapters.length
  sectionCh += interpBook.chapters.filter((c) => c.sections && c.sections.length).length
}

// 拆分完成后移除旧目录
rmSync(join(COMMENT_DIR, 'concise'), { recursive: true, force: true })

console.log(`[split-mhcc] ${books} 卷已拆分：summary ${summaryCh} 章 / interpretation ${sectionCh} 章有分节`)
console.log('[split-mhcc] concise/ 已删除 -> summary/mhcc + interpretation/mhcc')
