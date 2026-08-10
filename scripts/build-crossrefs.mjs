/**
 * build-crossrefs.mjs — 串珠（交叉引用）数据构建
 *
 * 素材（只读）：bible-cross-references/kjv/crossreferences_kjv.tsv
 *   （TSK 系短语级串珠，KJV 锚短语，CC BY 4.0）
 * 输出：public/data/brp/crossrefs/<bookId>.json（按卷切片）
 *
 * 数据格式（每卷）：
 *   { source: { key: 'tsk', name: '串珠（TSK）' }, bookId: '01',
 *     chapters: [ { chapter: 1, verses: [ { verse: 1, refs: [
 *       { anchor: 'beginning', targets: [ { id: '20', ch: 8, vs: '22-24' } ] } ] } ] } ] }
 *
 * 用法：node scripts/build-crossrefs.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { KJV_ABBR } from './bible-books.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')
const SOURCE = join(
  SITE_ROOT, '..', 'bible-cross-references',
  'kjv', 'crossreferences_kjv.tsv',
)
const OUT_DIR = join(SITE_ROOT, 'public', 'data', 'brp', 'crossrefs')

/** 引用目标："Prov 8:22-24" → { id, ch, vs }；无法解析返回 null */
function parseTarget(ref) {
  const m = ref.match(/^([A-Za-z0-9 ]+?) (\d+):([0-9,\-–]+)$/)
  if (!m) return null
  const id = KJV_ABBR[m[1]]
  if (!id) return null
  return { id, ch: Number(m[2]), vs: m[3] }
}

const rows = readFileSync(SOURCE, 'utf8').split('\n')
// 按卷聚合：bookId → chapter → verse → refs[]
const byBook = new Map()
let skipped = 0

for (let i = 1; i < rows.length; i++) {
  const line = rows[i]
  if (!line.trim()) continue
  const [book, chapter, verse, anchor, references] = line.split('\t')
  const id = KJV_ABBR[book]
  if (!id) {
    if (book !== 'book') skipped++
    continue
  }
  const ch = Number(chapter)
  const vs = Number(verse)
  if (!Number.isInteger(ch) || !Number.isInteger(vs)) continue

  const bookMap = byBook.get(id) || new Map()
  const chMap = bookMap.get(ch) || new Map()
  const refs = chMap.get(vs) || []

  for (const raw of references.split('|')) {
    const target = parseTarget(raw.trim())
    if (target) {
      refs.push({ anchor: anchor.trim(), targets: [target] })
    } else if (!/^\d+$/.test(raw.trim())) {
      skipped++
    }
  }
  // 同节同锚合并
  const merged = []
  for (const r of refs) {
    const prev = merged.find((x) => x.anchor === r.anchor)
    prev ? prev.targets.push(r.targets[0]) : merged.push(r)
  }
  chMap.set(vs, merged)
  bookMap.set(ch, chMap)
  byBook.set(id, bookMap)
}

mkdirSync(OUT_DIR, { recursive: true })
let total = 0
for (const [bookId, bookMap] of byBook) {
  const chapters = [...bookMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ch, chMap]) => ({
      chapter: ch,
      verses: [...chMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([verse, refs]) => ({ verse, refs })),
    }))
  const data = {
    source: { key: 'tsk', name: '串珠（TSK）', lang: 'en' },
    bookId,
    chapters,
  }
  writeFileSync(join(OUT_DIR, `${bookId}.json`), JSON.stringify(data))
  total += chapters.reduce((a, c) => a + c.verses.length, 0)
}
console.log(`[build-crossrefs] ${byBook.size} 卷 / ${total} 节含串珠，未知目标 ${skipped} 个`)
console.log(`[build-crossrefs] 输出 -> public/data/brp/crossrefs/`)
