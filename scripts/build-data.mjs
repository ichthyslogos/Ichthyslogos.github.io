/**
 * build-data.mjs — data-src → public/data 构建（核心数据流水线）
 *
 * 扫描 data-src/brp/translations/*.json（统一格式 {translation, books:[...]}），
 * 生成：
 *   1. public/data/brp/manifest.json                   译本清单（前端据此渲染译本切换器）
 *   2. public/data/brp/translations/<key>/books/<id>.json  每译本按书卷切片（按需加载）
 *
 * 添加新译本 = 放入 JSON 文件后重跑本脚本，前端零改动（"放入即自动显示"）。
 * 原文（Strong 原文数据）与译本隔离：manifest 中 original=true 的条目归入原文类目。
 *
 * 用法：node scripts/build-data.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveBook, BOOK_ORDER } from './bible-books.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')

const SRC_DIR = join(SITE_ROOT, 'data-src', 'brp', 'translations')
const OUT_DIR = join(SITE_ROOT, 'public', 'data', 'brp')

/**
 * 译本元数据表：文件名 → { lang, original }
 * - original: true 表示原文（原语言圣经，如希伯来文/希腊文），与译本在 UI 上分区展示；
 *   未来 Strong 编号将挂接在这些原文上，与译本数据流完全隔离。
 * - lang: BCP47 语言代码，zh* 文本在切片时做空格净化
 */
const META_BY_KEY = {
  ChiUn: { lang: 'zh-Hant', original: false },
  ChiSB: { lang: 'zh-Hant', original: false },
  ChiUnL: { lang: 'zh-Hant', original: false },
  ChiUns: { lang: 'zh-Hans', original: false },
  KJV: { lang: 'en', original: false, name: '英王钦定本 (KJV)' },
  WLC: { lang: 'hbo', original: true }, // 希伯来文马所拉文本
  Byz: { lang: 'grc', original: true }, // 希腊文拜占庭文本
  TR: { lang: 'grc', original: true }, // 希腊文公认文本
}

/** 从 translation 字段提炼展示名："ChiUn: 和合本 (繁體字)" → "和合本 (繁體字)" */
function displayName(translation) {
  return translation
    .replace(/^[A-Za-z0-9]+:\s*/, '') // 去掉 "ChiUn: " 前缀
    .split(/[,，]/)[0] // 去掉副标题
    .trim()
}

/** 中文文本净化：去掉分词排版产生的空格 */
function cleanText(text, lang) {
  return lang && lang.startsWith('zh') ? text.replace(/ /g, '') : text
}

/**
 * 清理旧输出目录：Windows 文件系统大小写不敏感，若 key 大小写曾变化
 * （如 ChiUn→chiun），残留目录会让 vite 的 public 文件集合匹配失败。
 * 每次构建前重建，保证目录名与 key 完全一致。
 */
rmSync(join(OUT_DIR, 'translations'), { recursive: true, force: true })

const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.json'))
if (!files.length) {
  console.error('[build-data] data-src/brp/translations/ 中没有译本 JSON，请先运行 node scripts/import.mjs')
  process.exit(1)
}

const manifest = { generatedAt: new Date().toISOString(), translations: [] }
let totalBooks = 0
let totalChapters = 0

for (const file of files) {
  const rawKey = file.replace(/\.json$/, '')
  const key = rawKey.toLowerCase() // 统一小写作为 URL 与目录 key
  const meta = META_BY_KEY[rawKey] || { lang: 'und', original: false }
  const raw = JSON.parse(readFileSync(join(SRC_DIR, file), 'utf8'))

  if (!raw.translation || !Array.isArray(raw.books)) {
    console.error(`[build-data] 跳过：${file} 不符合统一格式（缺 translation/books）`)
    continue
  }

  const books = []
  const bookOutDir = join(OUT_DIR, 'translations', key, 'books')
  mkdirSync(bookOutDir, { recursive: true })

  for (const b of raw.books) {
    const std = resolveBook(b.name)
    if (!std) {
      console.warn(`[build-data] 警告：${key} 有未知书卷 "${b.name}"，已跳过`)
      continue
    }
    const chapters = b.chapters.map((ch) => ({
      chapter: ch.chapter,
      verses: ch.verses.map((v) => ({ verse: v.verse, text: cleanText(v.text, meta.lang) })),
    }))
    const book = {
      translation: raw.translation,
      key,
      book: {
        id: std.id,
        zh: std.zh,
        en: std.en,
        group: std.group,
        chapterCount: chapters.length,
        chapters,
      },
    }
    writeFileSync(join(bookOutDir, `${std.id}.json`), JSON.stringify(book))
    books.push({ id: std.id, zh: std.zh, en: std.en, group: std.group, chapterCount: chapters.length })
    totalBooks += 1
    totalChapters += chapters.length
  }

  // 目录按圣经正典顺序排列（源数据顺序不可靠，如 ChiUns 素材为字母序）
  books.sort((a, b) => (BOOK_ORDER.get(a.id) ?? 1e9) - (BOOK_ORDER.get(b.id) ?? 1e9))

  manifest.translations.push({
    key,
    name: meta.name || displayName(raw.translation),
    original: meta.original,
    lang: meta.lang,
    books,
  })
  console.log(`[build-data] ${key}: ${books.length} 卷 / ${manifest.translations.at(-1).books.reduce((s, b) => s + b.chapterCount, 0)} 章`)
}

// 排序：译本在前（按 key），原文（original）在后，保证 manifest 顺序稳定可预期
manifest.translations.sort((a, b) =>
  a.original !== b.original ? (a.original ? 1 : -1) : a.key.localeCompare(b.key),
)

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest))
console.log(`\n[build-data] 完成：${manifest.translations.length} 个译本，共 ${totalBooks} 卷 / ${totalChapters} 章`)
console.log(`[build-data] 输出 -> public/data/brp/manifest.json`)

/* ============ 注释数据（多注释源） ============
 * data-src/brp/commentary/<sourceKey>/<bookId>.json → public/data/brp/commentary/
 * 新注释源 = 放入 data-src/brp/commentary/<key>/ 后重跑本脚本，前端自动显示
 */
const COMMENT_SRC = join(SITE_ROOT, 'data-src', 'brp', 'commentary')
const COMMENT_OUT = join(OUT_DIR, 'commentary')

function buildCommentary() {
  if (!existsSync(COMMENT_SRC)) return
  const sources = []
  for (const key of readdirSync(COMMENT_SRC)) {
    const dir = join(COMMENT_SRC, key)
    if (!statIsDir(dir)) continue
    const books = []
    const outDir = join(COMMENT_OUT, key)
    mkdirSync(outDir, { recursive: true })
    let meta = null
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json') || f === '_report.json') continue
      const bookId = f.replace(/\.json$/, '')
      const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      meta = meta || raw.source
      copyFileSync(join(dir, f), join(outDir, f))
      books.push(bookId)
    }
    if (books.length) {
      sources.push({ key, name: meta?.name || key, lang: meta?.lang || 'und', books })
    }
  }
  if (sources.length) {
    writeFileSync(join(COMMENT_OUT, 'manifest.json'), JSON.stringify({ sources }))
    console.log(`[build-data] 注释源：${sources.map((s) => `${s.key}(${s.books.length}卷)`).join(', ')}`)
  }
}

function statIsDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/* ============ 护教数据（护教问答） ============
 * data-src/apologetics/*.json → public/data/apologetics/
 * 内容格式：{ source: {key,name,lang}, categories: [{ id, title, questions: [{ id, question, answer }] }] }
 */
const APOLOG_SRC = join(SITE_ROOT, 'data-src', 'apologetics')
const APOLOG_OUT = join(SITE_ROOT, 'public', 'data', 'apologetics') // 独立目录（与路由同名约定）

function buildApologetics() {
  if (!existsSync(APOLOG_SRC)) return
  mkdirSync(APOLOG_OUT, { recursive: true })
  let files = 0
  for (const f of readdirSync(APOLOG_SRC)) {
    if (!f.endsWith('.json')) continue
    const raw = JSON.parse(readFileSync(join(APOLOG_SRC, f), 'utf8'))
    const cats = raw.categories || []
    copyFileSync(join(APOLOG_SRC, f), join(APOLOG_OUT, f))
    files += 1
    console.log(`[build-data] 护教：${raw.source?.name || f}（${cats.length} 类，${cats.reduce((s, c) => s + (c.questions?.length || 0), 0)} 问）`)
  }
  if (files) console.log(`[build-data] 输出 -> public/data/apologetics/`)
}

buildCommentary()
buildApologetics()
