/**
 * build-chisim.mjs — 和合本简体（带逐字 Strong）数据构建
 *
 * 数据源：biblesuper "All Bibles - JSON" 的 chinese_union_simp_s.json
 *   （和合本简体 with Strong's numbers，公共领域 / 非商用可共享，来自 MySword）
 * 产出两份运行时数据：
 *   1. public/data/brp/translations/chisim/books/{bookId}.json
 *      和合本简体纯文（剥离 {H/G####} 码与段首 ¶ 标记），结构与其他译本一致，
 *      可像 chiun/KJV 一样参与多选译本对照。
 *   2. public/data/brp/strongs/{bookId}.json
 *      逐字 Strong 标注：每章每节一组 words[{t 中文字/标点, s Strong码|''}]，
 *      供读经页「逐字原文」逐字展示强码。
 *
 * 说明：和合本简体仅含 66 卷正典（book 1..66）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(root, 'data-src/brp/translations/chisim-strongs.json')
const TRANS_OUT = path.join(root, 'public/data/brp/translations/chisim/books')
const STRONG_OUT = path.join(root, 'public/data/brp/strongs')

/** 剥离段首 ¶ 与后续空白 */
const stripPara = (s) => s.replace(/^\u00b6\s*/, '').trim()
/** 剥离全部 Strong 码 → 纯文（保留中英文括号注与标点） */
const plainText = (t) => stripPara(t).replace(/\{[HG]\d+\}/g, '')

/** 标点/空白（含全角空格、中文/英文括号与省略号），作为独立的无强码 token */
const PUNCT_CLASS =
  '\u3000\uFF0C\u3002\u3001\uFF1A\uFF1B\uFF01\uFF1F\uFF08\uFF09()\u300C\u300D\u300E\u300F\u00B7\u2026\u2014-'
const PUNCT_RE = new RegExp(`^[${PUNCT_CLASS}]+$`, 'u')
const SPLIT_RE = new RegExp(`([${PUNCT_CLASS}]+)`, 'u')

/** 逐字切分：中文词/标点分开；源格式为「词{强码}」，强码归属其紧邻前一真词 */
function tokenize(t) {
  const out = []
  let pendingWord = null // 刚穿出的真词 token，等待其后的 {强码}
  for (const part of stripPara(t).split(/(\{[HG]\d+\})/)) {
    const m = /^\{([HG]\d+)\}$/.exec(part)
    if (m) {
      if (pendingWord && !pendingWord.s) {
        pendingWord.s = m[1]
        pendingWord = null
      }
      continue
    }
    for (const seg of part.split(SPLIT_RE)) {
      if (!seg) continue
      if (PUNCT_RE.test(seg)) {
        out.push({ t: seg, s: '' })
      } else {
        const w = { t: seg, s: '' }
        out.push(w)
        pendingWord = w
      }
    }
  }
  return out
}

export function build() {
  const src = JSON.parse(fs.readFileSync(SRC, 'utf8'))
  const byBook = new Map()
  for (const v of src.verses) {
    if (!byBook.has(v.book)) byBook.set(v.book, [])
    byBook.get(v.book).push(v)
  }

  fs.mkdirSync(TRANS_OUT, { recursive: true })
  fs.mkdirSync(STRONG_OUT, { recursive: true })

  for (const [bok, verses] of byBook) {
  const id = String(bok).padStart(2, '0')
  const chMap = new Map()
  for (const v of verses) {
    if (!chMap.has(v.chapter)) chMap.set(v.chapter, [])
    chMap.get(v.chapter).push(v)
  }
  const chapters = [...chMap.entries()].map(([chapter, vs]) => ({
    chapter,
    verses: vs
      .map((v) => ({ verse: v.verse, text: plainText(v.text), words: tokenize(v.text) }))
      .sort((a, b) => a.verse - b.verse),
  }))

  // 1) 和合本简体纯文译本
  fs.writeFileSync(
    path.join(TRANS_OUT, `${id}.json`),
    JSON.stringify({
      translation: 'Chinese Union Version (Simplified) 和合本簡體',
      key: 'chisim',
      book: {
        id,
        chapters: chapters.map((c) => ({ chapter: c.chapter, verses: c.verses.map(({ verse, text }) => ({ verse, text })) })),
      },
    }),
  )

  // 2) 逐字 Strong
  fs.writeFileSync(
    path.join(STRONG_OUT, `${id}.json`),
    JSON.stringify({
      bookId: id,
      chapters: chapters.map((c) => ({ chapter: c.chapter, verses: c.verses.map(({ verse, words }) => ({ verse, words })) })),
    }),
  )
}
}

// 直接运行本脚本时执行构建（被其他脚本 import 调用 build()）
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  build()
  console.log(`[build-chisim] 完成：和合本简体译本 + 逐字 Strong，${fs.readdirSync(TRANS_OUT).filter((f) => f.endsWith('.json')).length} 卷`)
}