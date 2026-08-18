/**
 * rebuild-chiuns.mjs — 从素材重新获取简中译本（修复 bzz 压缩层损坏的 "a" 节）
 *
 * 背景：convert-chiuns.py 从 chiuns SWORD 模块 bzz（zlib 压缩）读取，
 *       而模块发布时 70 处经文在 bzz 中被损坏为单个 "a"（民1 家谱 13 节 +
 *       其他书卷零散 54+ 节）；bible_databases 的 ChiUn（繁体）同样损坏。
 *       但模块导出文本 ot_full.txt / nt_full.txt（素材 chiuns-copy）完好。
 *
 * 方法：以现 ChiUns.json（bzz 版）为节结构骨架，逐章与 ot/nt_full.txt
 *       连续文本做锚定对齐——正常节用 indexOf 推进游标，损坏节（trim 后 "a"）
 *       取其与下一正常节之间的文本。损坏节全部孤立分布，锚定可靠。
 *
 * 输出：data-src/brp/translations/ChiUns.json（仅替换损坏节文本，其余不变）
 * 用法：node scripts/rebuild-chiuns.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(__dirname, '..', '..', '素材')
const OT_SRC = join(ASSETS, 'chiuns-copy', 'modules', 'texts', 'ztext', 'chiuns', 'ot_full.txt')
const NT_SRC = join(ASSETS, 'chiuns-copy', 'modules', 'texts', 'ztext', 'chiuns', 'nt_full.txt')
const OUT = 'data-src/brp/translations/ChiUns.json'

/** 清理 HTML 实体与标签间隙（与 convert-chiuns.py / import-strong.mjs 一致） */
const clean = (s) =>
  s
    .replace(/<note[^>]*>[\s\S]*?<\/note>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;.*?&gt;/g, '')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .replace(/&amp;/g, '&')

/** 提取全 OT/NT 连续文本：{ 书缩写: [{ chapter, text }] }（按 <chapter> 标签切章） */
function parseFull(src) {
  const text = readFileSync(src, 'utf8')
  const books = {}
  let curBook = null
  let curChapter = null
  let buf = ''
  const flush = () => {
    if (curBook && curChapter != null && buf) books[curBook][curChapter] = clean(buf).replace(/\s+/g, '')
    buf = ''
  }
  let i = 0
  while (i < text.length) {
    const lt = text.indexOf('<', i)
    if (lt < 0) {
      buf += text.slice(i)
      break
    }
    buf += text.slice(i, lt)
    const gt = text.indexOf('>', lt)
    if (gt < 0) break
    const raw = text.slice(lt + 1, gt).trim()
    const name = raw.split(/\s/)[0]
    if (name === 'div' && raw.includes('type="book"') && !raw.includes('eID=')) {
      flush()
      const m = raw.match(/osisID="([A-Za-z0-9]+)"/)
      curBook = m ? m[1] : null
      if (curBook) books[curBook] = {}
      i = gt + 1
      continue
    }
    if (name === 'chapter' && !raw.includes('eID=')) {
      flush()
      const m = raw.match(/n="(\d+)"/)
      curChapter = m ? Number(m[1]) : null
      i = gt + 1
      continue
    }
    i = gt + 1
  }
  flush()
  return books
}

/** 损坏节判定：bzz 损坏形态为单字符 "a" */
const isBad = (t) => String(t || '').replace(/\s+/g, '') === 'a'

/** 逐章锚定修复：返回 { fixed, changed } */
function fixChapter(chiTexts, fullText) {
  const fixed = [...chiTexts]
  let changed = 0
  let cursor = 0
  let i = 0
  while (i < fixed.length) {
    const cur = String(fixed[i] || '').replace(/\s+/g, '')
    if (isBad(fixed[i])) {
      // 损坏节：取游标到下一正常节锚之间的文本
      let j = i + 1
      while (j < fixed.length && isBad(fixed[j])) j++
      if (j < fixed.length) {
        const anchor = String(fixed[j] || '').replace(/\s+/g, '')
        const nextIdx = fullText.indexOf(anchor, cursor)
        if (nextIdx >= 0) {
          const block = fullText.slice(cursor, nextIdx)
          if (block) {
            fixed[i] = block
            changed++
          }
          cursor = nextIdx + anchor.length
          i = j + 1
          continue
        }
      }
      // 章尾损坏或无锚：取剩余文本
      const tail = fullText.slice(cursor)
      if (tail) {
        fixed[i] = tail
        changed++
      }
      break
    }
    const idx = fullText.indexOf(cur, cursor)
    if (idx >= 0) cursor = idx + cur.length
    else cursor += cur.length
    i++
  }
  return { fixed, changed }
}

const fullOT = parseFull(OT_SRC)
const fullNT = parseFull(NT_SRC)
const data = JSON.parse(readFileSync(OUT, 'utf8'))

/** ChiUns.json 的英文卷名 → OSIS 缩写 */
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

let totalFixed = 0
let totalBad = 0
const failures = []
for (const book of data.books) {
  const abbr = NAME_TO_OSIS[book.name]
  const full = (abbr && (fullOT[abbr] || fullNT[abbr])) || null
  for (const ch of book.chapters) {
    const bads = ch.verses.filter((v) => isBad(v.text)).length
    if (!bads) continue
    totalBad += bads
    if (!full || !full[ch.chapter]) {
      failures.push(`${book.name} ${ch.chapter}（无 full 源）`)
      continue
    }
    const { fixed, changed } = fixChapter(ch.verses.map((v) => v.text), full[ch.chapter])
    for (let k = 0; k < ch.verses.length; k++) ch.verses[k].text = fixed[k]
    totalFixed += changed
    if (changed !== bads) failures.push(`${book.name} ${ch.chapter}（修复 ${changed}/${bads}）`)
  }
}

writeFileSync(OUT, JSON.stringify(data, null, 1) + '\n', 'utf8')
console.log(`损坏节 ${totalBad}，修复 ${totalFixed}`)
if (failures.length) console.log('异常：', failures.join('；'))
// 验证无残留
let remain = 0
for (const b of data.books) for (const c of b.chapters) for (const v of c.verses) if (isBad(v.text)) remain++
console.log(`残留损坏节：${remain}`)
