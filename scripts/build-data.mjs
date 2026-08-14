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
import { resolveBook, BOOK_ORDER, BOOKS } from './bible-books.mjs'
import { TRANSLATION_BOOK_NAMES } from './books-i18n.mjs'

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
  ChiUn: { lang: 'zh-Hant', original: false, tradition: 'protestant' },
  ChiSB: { lang: 'zh-Hant', original: false, tradition: 'catholic' },
  ChiUnL: { lang: 'zh-Hant', original: false, tradition: 'protestant' },
  ChiUns: { lang: 'zh-Hans', original: false, tradition: 'protestant' },
  KJV: { lang: 'en', original: false, name: '英王钦定本 (KJV)', tradition: 'protestant' },
  ASV: { lang: 'en', original: false, name: '美国标准译本 (ASV)', tradition: 'protestant' },
  DRC: { lang: 'en', original: false, name: '杜埃-兰斯译本 (DRC)', tradition: 'catholic' },
  FreBDM1744: { lang: 'fr', original: false, name: '法语 Martin 1744', tradition: 'protestant' },
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
    // 书卷显示名随译本（books-i18n.mjs 名表覆盖；未登记译本沿用标准和合本译名）
    const zh = TRANSLATION_BOOK_NAMES[key]?.[std.id] ?? std.zh
    const book = {
      translation: raw.translation,
      key,
      book: {
        id: std.id,
        zh,
        en: std.en,
        group: std.group,
        chapterCount: chapters.length,
        chapters,
      },
    }
    writeFileSync(join(bookOutDir, `${std.id}.json`), JSON.stringify(book))
    books.push({ id: std.id, zh, en: std.en, group: std.group, chapterCount: chapters.length })
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
    tradition: meta.tradition, // 宗派归属（protestant/catholic），译本菜单分组用
    books,
  })
  console.log(`[build-data] ${key}: ${books.length} 卷 / ${manifest.translations.at(-1).books.reduce((s, b) => s + b.chapterCount, 0)} 章`)
}

// 译本顺序：显式顺序表（和合本简中 → 繁中 → 思高本 → 英文 → 法文），未登记 key 按字母序排后；
// 原文（original）始终排在译本之后，保证 manifest 顺序稳定可预期
const TRANSLATION_ORDER = ['chiuns', 'chiun', 'chisb', 'kjv', 'frebdm1744']
const orderOf = (t) => {
  const i = TRANSLATION_ORDER.indexOf(t.key)
  return t.original ? 1e6 + i : (i === -1 ? 1e5 : i)
}
manifest.translations.sort((a, b) => orderOf(a) - orderOf(b))

writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest))
console.log(`\n[build-data] 完成：${manifest.translations.length} 个译本，共 ${totalBooks} 卷 / ${totalChapters} 章`)
console.log(`[build-data] 输出 -> public/data/brp/manifest.json`)

/* ============ 注释数据（多注释源，按传统两级组织） ============
 * data-src/brp/commentary/<tradition>/<sourceKey>/<bookId>.json → public/data/brp/commentary/（运行时扁平）
 * 新注释源 = 放入 data-src/brp/commentary/<tradition>/<key>/ 后重跑本脚本，前端自动显示
 * tradition 分类（9 个）：church-fathers/catholic/lutheran/reformed/baptist/methodist/anglican/pentecostal/evangelical
 */
const COMMENT_SRC = join(SITE_ROOT, 'data-src', 'brp', 'commentary')
const COMMENT_OUT = join(OUT_DIR, 'commentary')

/** 暂时关闭的注释源：data-src 数据保留，构建/显示时排除（恢复 = 从集合移除后重跑） */
const DISABLED_SOURCES = new Set(['matthew-henry'])

/**
 * 完整版源（full/）的宗派归属——数据目录保持 full 平铺（2026-08-14 整理），
 * 宗派作为元数据写入 manifest，前端「完整解经」层源菜单按宗派分组展示。
 * 简要版源（concise/）固定 tradition = 'concise'，供「一句话总结」层使用。
 */
const FULL_SOURCE_TRADITIONS = {
  'matthew-henry-en': 'reformed',
  'matthew-henry': 'reformed',
  calvin: 'reformed',
  catena: 'church-fathers',
  rwp: 'baptist',
  abbott: 'evangelical',
}

function buildCommentary() {
  if (!existsSync(COMMENT_SRC)) return
  // 重建输出目录，保证被关闭的源不残留旧切片
  rmSync(COMMENT_OUT, { recursive: true, force: true })
  const sources = []
  for (const tradition of readdirSync(COMMENT_SRC)) {
    if (tradition.startsWith('_')) continue // 模板目录（_template）不参与构建
    const tDir = join(COMMENT_SRC, tradition)
    if (!statIsDir(tDir)) continue
    for (const key of readdirSync(tDir)) {
      if (key.startsWith('_')) continue
      if (DISABLED_SOURCES.has(key)) continue // 暂时关闭的源
      const dir = join(tDir, key)
      if (!statIsDir(dir)) continue
      // 空目录（历史残留）不生成输出
      const jsonFiles = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_report.json')
      if (!jsonFiles.length) continue
      const books = []
      const outDir = join(COMMENT_OUT, key)
      mkdirSync(outDir, { recursive: true })
      let meta = null
      for (const f of jsonFiles) {
        const bookId = f.replace(/\.json$/, '')
        const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        meta = meta || raw.source
        copyFileSync(join(dir, f), join(outDir, f))
        books.push(bookId)
      }
      if (books.length) {
        sources.push({
          key,
          tradition: FULL_SOURCE_TRADITIONS[key] || tradition, // 完整版源按宗派归属；简要版保持 concise
          name: meta?.name || key,
          lang: meta?.lang || 'und',
          books,
        })
      }
    }
  }
  // 注释源排序：按宗派顺序（ROADMAP 9 传统，concise 简要版排最后），组内按语言（zh 优先）→ key
  // 完整版源（full/）的宗派归属见 FULL_SOURCE_TRADITIONS（数据目录保持 full 平铺，宗派为元数据）
  const TRADITION_ORDER = [
    'church-fathers', 'catholic', 'lutheran', 'reformed',
    'baptist', 'methodist', 'anglican', 'pentecostal', 'evangelical',
    'concise',
  ]
  const tradOrder = (t) => {
    const i = TRADITION_ORDER.indexOf(t)
    return i === -1 ? 1e5 : i
  }
  sources.sort((a, b) => {
    const d = tradOrder(a.tradition) - tradOrder(b.tradition)
    if (d) return d
    if (a.lang !== b.lang) return a.lang === 'zh' ? -1 : b.lang === 'zh' ? 1 : a.lang.localeCompare(b.lang)
    return a.key.localeCompare(b.key)
  })
  if (sources.length) {
    writeFileSync(join(COMMENT_OUT, 'manifest.json'), JSON.stringify({ sources }))
    console.log(`[build-data] 注释源：${sources.map((s) => `${s.tradition}/${s.key}(${s.books.length}卷,${s.lang})`).join(', ')}`)
  }
}

function statIsDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/* ============ 护教数据（子数据库：主题 → 分类 → 子命题） ============
 * 源：data-src/apologetics/topics/<topicId>/
 *     ├── topic.json                 主题元数据（title/description/tags/categories 顺序列表）
 *     └── <categoryId>/<sqId>/question.json  子命题（最基层：question/objection + 内容）
 * 输出（public/data/apologetics/）：
 *     ├── content.json               索引（主题元数据 + 子命题轻量搜索文本，不含正文，探索/搜索用）
 *     └── topics/<topicId>.json      主题切片（categories 分组 + sub_questions 完整数据，按需加载）
 */
const APOLOG_SRC = join(SITE_ROOT, 'data-src', 'apologetics')
const APOLOG_OUT = join(SITE_ROOT, 'public', 'data', 'apologetics') // 独立目录（与路由同名约定）

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function buildApologetics() {
  const topicsDir = join(APOLOG_SRC, 'topics')
  if (!existsSync(topicsDir)) return
  mkdirSync(join(APOLOG_OUT, 'topics'), { recursive: true })

  const meta = readJson(join(APOLOG_SRC, 'content.meta.json'))
  const indexTopics = []
  let sqTotal = 0

  // 主题顺序以 content.meta.json 的 topics 列表为准（readdirSync 是字母序，不可靠）
  const topicOrder = meta.topics || readdirSync(topicsDir)
  for (const topicId of topicOrder) {
    const tDir = join(topicsDir, topicId)
    if (!statIsDir(tDir)) throw new Error(`[build-data] 护教主题目录缺失或未登记：${topicId}`)

    const t = readJson(join(tDir, 'topic.json'))
    if (t.id !== topicId) throw new Error(`[build-data] 护教 topic.json id 与目录名不符：${t.id} != ${topicId}`)

    // 组装子命题（按 topic.json 的 categories 顺序；question.json 即完整内容）
    const sub_questions = []
    for (const cat of t.categories) {
      for (const sqId of cat.sub_questions) {
        const q = readJson(join(tDir, cat.id, sqId, 'question.json'))
        sub_questions.push(q)
        sqTotal++
      }
    }

    // 主题切片（categories 分组定义 + 完整数据，按需加载）
    const slice = {
      id: t.id,
      title: t.title,
      description: t.description,
      tags: t.tags,
      categories: t.categories.map((c) => ({ id: c.id, title: c.title, sub_questions: c.sub_questions })),
      sub_questions,
    }
    writeFileSync(join(APOLOG_OUT, 'topics', `${topicId}.json`), JSON.stringify(slice))

    // 索引条目：主题元数据 + 子命题轻量搜索文本（question/objection/标题/核心思想，不含长正文）
    indexTopics.push({
      id: t.id,
      title: t.title,
      description: t.description,
      tags: t.tags,
      sqCount: sub_questions.length,
      searchText: sub_questions
        .map((sq) => `${sq.question} ${sq.objection || ''} ${sq.title?.zh || ''} ${sq.title?.en || ''} ${sq.summary || ''}`)
        .join(' ')
        .toLowerCase(),
      questions: sub_questions.map((sq) => ({
        id: sq.id,
        question: sq.question,
        searchText: `${sq.question} ${sq.objection || ''} ${sq.title?.zh || ''} ${sq.title?.en || ''} ${sq.summary || ''}`.toLowerCase(),
      })),
    })
  }

  writeFileSync(join(APOLOG_OUT, 'content.json'), JSON.stringify({ source: meta.source, topics: indexTopics }))
  console.log(`[build-data] 护教：${indexTopics.length} 主题 / ${sqTotal} 子命题（索引 + 主题切片）`)
  console.log(`[build-data] 输出 -> public/data/apologetics/`)
}

/* ============ Strong 逐词数据（和合本简体 chiuns 标注层） ============
 * 源：data-src/brp/strong/<bookId>.json（scripts/import-strong.mjs 从 chiuns SWORD 素材生成）
 * 输出：public/data/brp/strong/books/<bookId>.json（按卷切片，按需加载）
 * 结构：{ key:'chiuns', book:{ id, chapters:[{chapter, verses:[{verse, words:[{t,s,m}]}]}] } }
 */
const STRONG_SRC = join(SITE_ROOT, 'data-src', 'brp', 'strong')
const STRONG_OUT = join(SITE_ROOT, 'public', 'data', 'brp', 'strong', 'books')

function buildStrong() {
  if (!existsSync(STRONG_SRC)) return
  mkdirSync(STRONG_OUT, { recursive: true })
  let n = 0
  for (const f of readdirSync(STRONG_SRC)) {
    if (!f.endsWith('.json') || f.startsWith('lexicon')) continue // lexicon 词典走 buildStrongLexicon
    const raw = JSON.parse(readFileSync(join(STRONG_SRC, f), 'utf8'))
    writeFileSync(join(STRONG_OUT, f), JSON.stringify(raw))
    n++
  }
  if (n) console.log(`[build-data] Strong：${n} 卷 -> public/data/brp/strong/books/`)
}

/* ============ Strong 词典（逐词码 → 词义） ============
 * 源：data-src/brp/strong/lexicon-<greek|hebrew>.json
 *   （scripts/import-strong-lexicon.mjs / import-strong-lexicon-hebrew.mjs 从素材生成）
 * 输出：public/data/brp/strong/lexicon/<g|h><seg>.json（按 1000 编号段切片，按需加载）
 * 结构：{ source, entries: { "G1"/"H430": { orth, translit, pron, def, … } } }
 */
const LEX_OUT = join(SITE_ROOT, 'public', 'data', 'brp', 'strong', 'lexicon')

function buildStrongLexicon() {
  const kinds = [
    ['greek', 'lexicon-greek.json', 'g'],
    ['hebrew', 'lexicon-hebrew.json', 'h'],
  ]
  if (!kinds.some(([, f]) => existsSync(join(STRONG_SRC, f)))) return
  mkdirSync(LEX_OUT, { recursive: true })
  // 每次清空再写：段文件随词典变化增减，避免旧段残留（同译本目录清理教训）
  for (const f of readdirSync(LEX_OUT)) rmSync(join(LEX_OUT, f), { recursive: true, force: true })
  let totalSegs = 0
  for (const [kind, file, prefix] of kinds) {
    const src = join(STRONG_SRC, file)
    if (!existsSync(src)) continue
    const raw = JSON.parse(readFileSync(src, 'utf8'))
    const segs = new Map()
    for (const [code, entry] of Object.entries(raw.entries)) {
      const m = code.match(/^[GH](\d+)/)
      if (!m) continue
      const seg = Math.floor(Number(m[1]) / 1000) * 1000
      if (!segs.has(seg)) segs.set(seg, {})
      segs.get(seg)[code] = entry
    }
    for (const [seg, entries] of segs) {
      writeFileSync(join(LEX_OUT, `${prefix}${seg}.json`), JSON.stringify({ source: raw.source, entries }))
    }
    totalSegs += segs.size
    console.log(`[build-data] Strong 词典 ${kind}：${segs.size} 段 -> public/data/brp/strong/lexicon/`)
  }
  console.log(`[build-data] Strong 词典合计 ${totalSegs} 段`)
}

/* ============ 图书馆书目（子数据库：分类 → 书目 → 文件直链） ============
 * 源：data-src/library/
 *     ├── content.meta.json   分类顺序（与护教约定一致）
 *     ├── categories.json     分类定义（id/zh/en/desc）
 *     └── books/<bookId>.json 书目详情（元数据 + files[] 文件直链，_ 前缀文件跳过）
 * 输出（public/data/library/）：
 *     ├── content.json        索引（分类 + 书目轻量条目含搜索文本，书架/搜索用）
 *     └── books/<bookId>.json 书目详情切片（按需加载）
 * 书籍文件本体不在本站：按类别存放于独立 GitHub 仓库（library-books-*，Pages 直链），
 * 收录流程与存储约束见 docs/LIBRARY.md。
 */
const LIB_SRC = join(SITE_ROOT, 'data-src', 'library')
const LIB_OUT = join(SITE_ROOT, 'public', 'data', 'library')

function buildLibrary() {
  if (!existsSync(LIB_SRC)) return
  mkdirSync(join(LIB_OUT, 'books'), { recursive: true })

  const meta = readJson(join(LIB_SRC, 'content.meta.json'))
  const categories = readJson(join(LIB_SRC, 'categories.json'))
  const catById = new Map(categories.map((c) => [c.id, c]))

  const booksDir = join(LIB_SRC, 'books')
  const indexBooks = []
  let total = 0
  // 书目顺序：分类顺序 → 书名（readdirSync 是字母序，按 meta.categories 归并）
  const byCat = new Map()
  for (const f of readdirSync(booksDir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue
    const book = readJson(join(booksDir, f))
    if (book.id !== f.replace(/\.json$/, '')) {
      throw new Error(`[build-data] 书目 id 与文件名不符：${book.id} != ${f}`)
    }
    if (!catById.has(book.category)) {
      throw new Error(`[build-data] 书目 ${book.id} 的分类未登记：${book.category}`)
    }
    // 详情切片（原样）
    writeFileSync(join(LIB_OUT, 'books', `${book.id}.json`), JSON.stringify(book))
    // 索引条目（轻量：元数据 + 搜索文本，不含 description 长文）
    indexBooks.push({
      id: book.id,
      category: book.category,
      title: book.title,
      author: book.author || '',
      lang: book.lang || 'und',
      year: book.year || '',
      tags: book.tags || [],
      cover: book.cover || '',
      fileCount: (book.files || []).length,
      formats: [...new Set((book.files || []).map((f) => f.format))],
      searchText: `${book.title} ${book.author || ''} ${(book.tags || []).join(' ')} ${book.category}`.toLowerCase(),
    })
    total++
  }
  indexBooks.sort((a, b) => {
    const d = (meta.categories.indexOf(a.category) - meta.categories.indexOf(b.category)) || a.title.localeCompare(b.title, 'zh')
    return d
  })
  writeFileSync(join(LIB_OUT, 'content.json'), JSON.stringify({ source: meta.source, categories, books: indexBooks }))
  console.log(`[build-data] 图书馆：${categories.length} 分类 / ${total} 书目（索引 + 详情切片）`)
  console.log(`[build-data] 输出 -> public/data/library/`)
}

/* ============ 教会史数据（《历史的轨迹——二千年教会史》） ============
 * 源：data-src/church-history/（工作区 convert-chm.mjs 生成）
 *     content.json  书目索引    partN.json  按部切片（intro + chapters）
 * 输出：public/data/church-history/（JSON 原样复制；插图已在转换时复制到 images/）
 */
const HISTORY_SRC = join(SITE_ROOT, 'data-src', 'church-history')
const HISTORY_OUT = join(SITE_ROOT, 'public', 'data', 'church-history')

function buildChurchHistory() {
  if (!existsSync(HISTORY_SRC)) return
  mkdirSync(HISTORY_OUT, { recursive: true })
  for (const f of readdirSync(HISTORY_SRC)) {
    if (!f.endsWith('.json')) continue
    copyFileSync(join(HISTORY_SRC, f), join(HISTORY_OUT, f))
  }
  const meta = readJson(join(HISTORY_SRC, 'content.json'))
  console.log(`[build-data] 教会史：${meta.title}（${meta.parts.length} 部 / ${meta.parts.reduce((n, p) => n + p.chapterCount, 0)} 章）`)
  console.log(`[build-data] 输出 -> public/data/church-history/`)
}

/* ============ 背景注释数据（notes） ============
 * 源：data-src/brp/notes/<key>/（import-tipnr.mjs 生成；TIPNR 专有名词注释，CC BY 4.0）
 *     entries.json            全量轻量索引（词条名/strong/type，供将来词条高亮匹配）
 *     books/<bookId>.json     按卷分片：每章 entries（人名/地名/背景词条 + 四级描述 + 出现节）
 * 输出：public/data/brp/notes/（原样复制 + manifest）
 */
const NOTES_SRC = join(SITE_ROOT, 'data-src', 'brp', 'notes')
const NOTES_OUT = join(OUT_DIR, 'notes')

function buildNotes() {
  if (!existsSync(NOTES_SRC)) return
  rmSync(NOTES_OUT, { recursive: true, force: true })
  mkdirSync(join(NOTES_OUT, 'books'), { recursive: true })
  const sources = []
  for (const key of readdirSync(NOTES_SRC)) {
    if (key.startsWith('_')) continue
    const dir = join(NOTES_SRC, key)
    if (!statIsDir(dir)) continue
    const booksDir = join(dir, 'books')
    if (!existsSync(booksDir)) continue
    mkdirSync(join(NOTES_OUT, 'books'), { recursive: true })
    // 按卷分片复制
    for (const f of readdirSync(booksDir)) {
      if (!f.endsWith('.json')) continue
      copyFileSync(join(booksDir, f), join(NOTES_OUT, 'books', f))
    }
    // manifest 元数据
    let meta = null
    let entryCount = 0
    let chapterCount = 0
    const books = []
    const entriesFile = join(dir, 'entries.json')
    if (existsSync(entriesFile)) {
      const idx = readJson(entriesFile)
      meta = idx.source
      entryCount = idx.count || (idx.entries || []).length
      copyFileSync(entriesFile, join(NOTES_OUT, 'entries.json'))
    }
    for (const f of readdirSync(booksDir)) {
      if (!f.endsWith('.json')) continue
      const bookId = f.replace(/\.json$/, '')
      const raw = readJson(join(booksDir, f))
      meta = meta || raw.source
      chapterCount += (raw.chapters || []).length
      books.push(bookId)
    }
    if (meta) {
      sources.push({ key, name: meta.name, lang: meta.lang || 'en', books, entryCount, chapterCount })
    }
  }
  if (sources.length) {
    writeFileSync(join(NOTES_OUT, 'manifest.json'), JSON.stringify({ sources }))
    console.log(`[build-data] 背景注释：${sources.map((s) => `${s.key}(${s.entryCount}词条/${s.books.length}卷/${s.chapterCount}章)`).join(', ')}`)
    console.log(`[build-data] 输出 -> public/data/brp/notes/`)
  }
}

buildCommentary()
buildApologetics()
buildLibrary()
buildChurchHistory()
buildStrong()
buildStrongLexicon()
buildNotes()
