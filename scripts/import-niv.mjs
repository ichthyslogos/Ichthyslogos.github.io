/**
 * import-niv.mjs — 素材库 aruljohn/Bible-niv → data-src 导入
 *
 * 把素材库 bible-niv（GitHub aruljohn/Bible-niv，66 卷按卷 JSON）转换为网站
 * 统一译本格式（{translation, books:[{name, chapters}]}），写入 data-src/brp/translations/NIV.json，
 * 与 import.mjs 导入的其他译本（bibledatabase 整本 JSON）同格式，供 build-data.mjs 切片。
 *
 * 数据源格式：{book, count, chapters:[{chapter, verses:[{verse, text}]}]}，文件名即英文卷名。
 * 卷名归一化：数字前缀 → 罗马数字（1 Samuel → I Samuel）、Revelation → Revelation of John、
 * Song Of Solomon → Song of Solomon（与 bible-books.mjs 的 srcName 对齐）。
 *
 * 用法：node scripts/import-niv.mjs
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveBook, CANON_BOOK_COUNT } from './bible-books.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')

/** 素材源目录（FISH 素材根目录下的 bible-niv，只读） */
const SOURCE_DIR = join(SITE_ROOT, '..', '素材', 'bible-niv')
/** 网站数据库目标文件（与其他译本并列，build-data.mjs 扫描 data-src/brp/translations/*.json） */
const TARGET_FILE = join(SITE_ROOT, 'data-src', 'brp', 'translations', 'NIV.json')

/** 数字前缀 → 罗马数字（bible-books.mjs srcName 用罗马数字命名卷） */
const ROMAN = { 1: 'I', 2: 'II', 3: 'III' }

/** 卷名归一化：Bible-niv 文件名 → bible-books.mjs 标准 srcName */
function toSrcName(name) {
  const m = name.match(/^([1-3]) (.+)$/)
  if (m) name = `${ROMAN[m[1]]} ${m[2]}`
  if (name === 'Revelation') name = 'Revelation of John'
  name = name.replace(/\bOf\b/g, 'of') // "Song Of Solomon" → "Song of Solomon"
  return name
}

const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.json') && f !== 'Books.json')
const books = []
const skipped = []

for (const file of files.sort()) {
  const srcName = toSrcName(file.replace(/\.json$/, ''))
  const std = resolveBook(srcName)
  if (!std) {
    skipped.push(file)
    continue
  }
  const raw = JSON.parse(readFileSync(join(SOURCE_DIR, file), 'utf8'))
  if (!Array.isArray(raw.chapters)) {
    skipped.push(file)
    continue
  }
  books.push({
    name: srcName,
    chapters: raw.chapters.map((ch) => ({
      // chapter/verse 统一转数字（与现有译本一致；Bible-niv 源均为字符串）
      chapter: Number(ch.chapter),
      verses: ch.verses.map((v) => ({ verse: Number(v.verse), text: v.text })),
    })),
  })
}

if (books.length !== CANON_BOOK_COUNT) {
  console.error(`[import-niv] 失败：期望 ${CANON_BOOK_COUNT} 卷，实际 ${books.length} 卷；跳过：${skipped.join(', ')}`)
  process.exit(1)
}

const out = { translation: 'NIV: New International Version (NIV)', books }
mkdirSync(dirname(TARGET_FILE), { recursive: true })
writeFileSync(TARGET_FILE, JSON.stringify(out))

const totalChapters = books.reduce((s, b) => s + b.chapters.length, 0)
const totalVerses = books.reduce((s, b) => s + b.chapters.reduce((x, c) => x + c.verses.length, 0), 0)
console.log(`[import-niv] ${books.length} 卷 / ${totalChapters} 章 / ${totalVerses} 节 -> data-src/brp/translations/NIV.json`)
