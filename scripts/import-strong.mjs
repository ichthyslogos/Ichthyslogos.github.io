// import-strong.mjs — 从 chiuns SWORD 模块（素材只读）生成 Strong 逐词数据
// 源：chiuns-copy/modules/texts/ztext/chiuns/{ot,nt}_full.txt（OSIS 逐词：<w lemma="strong:Hxxxxx">词</w>）
// 处理：
//   1. 解析 OSIS → 每卷每章的词片段序列（含词间标点/间隙；脚注 <note> 剔除；空 w 跳过）
//   2. 与站点已导入的 chiuns 译本文本做字符对齐（同源）→ 按节切分
// 输出：data-src/brp/strong/<bookId>.json（{ key, book: { id, chapters: [{chapter, verses: [{verse, words}]}] } }）
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(__dirname, '..', '..') // FISH 素材根（site 的上一级）
const SRC_OT = join(ASSETS, 'chiuns-copy', 'modules', 'texts', 'ztext', 'chiuns', 'ot_full.txt')
const SRC_NT = join(ASSETS, 'chiuns-copy', 'modules', 'texts', 'ztext', 'chiuns', 'nt_full.txt')
const TRANS_SRC = 'data-src/brp/translations/ChiUns.json'
const OUT = 'data-src/brp/strong'

const OSIS_IDS = [
  'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam',
  '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov',
  'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos',
  'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
  'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph',
  'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb',
  'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev',
]
const BOOK_IDS = Object.fromEntries(OSIS_IDS.map((id, i) => [id, String(i + 1).padStart(2, '0')]))

/** ChiUns.json 的英文卷名 → OSIS 缩写（该译本 books 按英文名排列，非规范顺序） */
const NAME_TO_OSIS = {
  Genesis: 'Gen', Exodus: 'Exod', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deut',
  Joshua: 'Josh', Judges: 'Judg', Ruth: 'Ruth', 'I Samuel': '1Sam', 'II Samuel': '2Sam',
  'I Kings': '1Kgs', 'II Kings': '2Kgs', 'I Chronicles': '1Chr', 'II Chronicles': '2Chr',
  Ezra: 'Ezra', Nehemiah: 'Neh', Esther: 'Esth', Job: 'Job', Psalms: 'Ps', Proverbs: 'Prov',
  Ecclesiastes: 'Eccl', 'Song of Solomon': 'Song', Isaiah: 'Isa', Jeremiah: 'Jer', Lamentations: 'Lam',
  Ezekiel: 'Ezek', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obad',
  Jonah: 'Jonah', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab', Zephaniah: 'Zeph', Haggai: 'Hag',
  Zechariah: 'Zech', Malachi: 'Mal', Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke', John: 'John',
  Acts: 'Acts', Romans: 'Rom', 'I Corinthians': '1Cor', 'II Corinthians': '2Cor', Galatians: 'Gal',
  Ephesians: 'Eph', Philippians: 'Phil', Colossians: 'Col', 'I Thessalonians': '1Thess', 'II Thessalonians': '2Thess',
  'I Timothy': '1Tim', 'II Timothy': '2Tim', Titus: 'Titus', Philemon: 'Phlm', Hebrews: 'Heb',
  James: 'Jas', 'I Peter': '1Pet', 'II Peter': '2Pet', 'I John': '1John', 'II John': '2John',
  'III John': '3John', Jude: 'Jude', 'Revelation of John': 'Rev',
}

/** 主解析：标签流同步收集词与间隙文本 */
function parse(text) {
  const books = {}
  let curBook = null
  let curChapter = null
  let noteDepth = 0
  // 词间文本缓冲：标签之间的普通字符
  let pending = ''
  const flush = () => {
    if (curBook && curChapter != null && pending) {
      const b = books[curBook]
      const ch = b.find((c) => c.chapter === curChapter)
      if (ch) {
        const t = pending.trim()
        if (t) ch.words.push({ t, s: null, m: null })
      }
    }
    pending = ''
  }
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) { pending += text.slice(i); break }
    pending += text.slice(i, lt) // 标签前的普通文本
    const gt = text.indexOf('>', lt)
    if (gt < 0) break
    const raw = text.slice(lt + 1, gt).trim()
    const name = raw.split(/\s/)[0]
    if (name === '/note') { flush(); noteDepth = Math.max(0, noteDepth - 1); i = gt + 1; continue }
    if (name === 'note' || noteDepth > 0) {
      if (name === 'note') noteDepth++
      pending = '' // note 内容不进正文
      i = gt + 1
      continue
    }
    if (name === 'div' && raw.includes('type="book"')) {
      flush()
      // eID（卷尾闭合标记）带 osisID 但不应重置卷数据——仅 sID 开卷
      if (raw.includes('eID=')) { curBook = null; i = gt + 1; continue }
      const m = raw.match(/osisID="([A-Za-z0-9]+)"/)
      curBook = m ? BOOK_IDS[m[1]] : null
      if (curBook) books[curBook] = []
      i = gt + 1
      continue
    }
    if (name === 'chapter' && raw.includes('eID=')) {
      // 章尾闭合标记（无 n 属性），不影响章节状态
      i = gt + 1
      continue
    }
    if (name === 'chapter') {
      flush()
      const m = raw.match(/n="(\d+)"/)
      curChapter = m ? Number(m[1]) : null
      if (curBook && curChapter != null) books[curBook].push({ chapter: curChapter, words: [] })
      i = gt + 1
      continue
    }
    if (name === 'w') {
      flush() // 词前间隙入序列
      const close = text.indexOf('</w>', gt)
      const t = close >= 0 ? text.slice(gt + 1, close) : ''
      if (curBook && curChapter != null && t.trim()) {
        const ch = books[curBook].find((c) => c.chapter === curChapter)
        const codes = (raw.match(/strong:([A-Z0-9]+)/g) || []).map((x) => x.slice(7))
        const morphs = (raw.match(/robinson:([A-Z0-9-]+)/g) || []).map((x) => x.slice(9))
        ch.words.push({ t: t.trim(), s: codes.join(' ') || null, m: morphs.join(' ') || null })
      }
      i = close >= 0 ? close + 4 : gt + 1
      continue
    }
    // 其他标签（milestone/div/seg 等）：其后文本继续累积到 pending
    i = gt + 1
  }
  flush()
  return books
}

/** 按 chiuns 译本文本做字符对齐并按节切分（同源文本，去空白后应逐字符一致） */
function alignAndSplit(bookData, bookId, transBook) {
  const chapters = []
  let warn = 0
  for (const ch of bookData) {
    const transCh = transBook.chapters.find((c) => c.chapter === ch.chapter)
    if (!transCh) { warn++; continue }
    const plain = ch.words.map((w) => w.t).join('').replace(/\s+/g, '')
    const trans = transCh.verses.map((v) => v.text).join('').replace(/\s+/g, '')
    if (plain !== trans) {
      warn++
      console.warn(`[import-strong] 对齐差异 ${bookId} 第${ch.chapter}章：OSIS ${plain.length} 字符 vs 译本 ${trans.length} 字符`)
      continue // 跳过差异章（数据不全比错位好）
    }
    // 按节字符数切分
    const verses = []
    let pos = 0
    for (const v of transCh.verses) {
      const len = v.text.replace(/\s+/g, '').length
      const slice = []
      let acc = 0
      while (pos < ch.words.length && acc < len) {
        const w = ch.words[pos]
        slice.push(w)
        acc += w.t.replace(/\s+/g, '').length
        pos++
      }
      verses.push({ verse: v.verse, words: slice })
    }
    if (pos !== ch.words.length) {
      warn++
      console.warn(`[import-strong] 切分余量 ${bookId} 第${ch.chapter}章：剩 ${ch.words.length - pos} 片段`)
    }
    chapters.push({ chapter: ch.chapter, verses })
  }
  return { chapters, warn }
}

mkdirSync(OUT, { recursive: true })
const transAll = JSON.parse(readFileSync(TRANS_SRC, 'utf8'))
// ChiUns.json 的 books 按英文卷名排列（无 id）——用 NAME_TO_OSIS 映射到站点编号
const transBooks = new Map()
for (const b of transAll.books) {
  const osis = NAME_TO_OSIS[b.name]
  if (!osis) { console.warn(`[import-strong] 无法映射卷名：${b.name}`); continue }
  transBooks.set(BOOK_IDS[osis], b)
}
let totalBooks = 0
let totalWarn = 0
for (const [src, label] of [[SRC_OT, '旧约'], [SRC_NT, '新约']]) {
  if (!existsSync(src)) { console.warn(`[import-strong] 缺少素材：${src}`); continue }
  const books = parse(readFileSync(src, 'utf8'))
  for (const [bookId, bookData] of Object.entries(books)) {
    const transBook = transBooks.get(bookId)
    if (!transBook) { console.warn(`[import-strong] 译本缺失 ${bookId}，跳过`); continue }
    const { chapters, warn } = alignAndSplit(bookData, bookId, transBook)
    totalWarn += warn
    if (!chapters.length) continue
    writeFileSync(
      join(OUT, `${bookId}.json`),
      JSON.stringify({ key: 'chiuns', book: { id: bookId, chapters } }),
    )
    totalBooks++
  }
}
console.log(`[import-strong] 完成：${totalBooks} 卷（警告 ${totalWarn} 处）-> data-src/brp/strong/`)
