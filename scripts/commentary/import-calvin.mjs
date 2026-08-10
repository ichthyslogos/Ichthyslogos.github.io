/**
 * import-calvin.mjs — Calvin 注释（SWORD 模块）→ data-src 导入
 *
 * 数据获取（完整记录，供维护）：
 *   来源：CrossWire 官方 SWORD 模块 CalvinCommentaries v1.1（2022-08-01）
 *     https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/CalvinCommentaries.zip
 *   内容：Calvin's Collected Commentaries（加尔文注释合集，47 卷：旧约 24 + 新约 23）
 *   上游：CCEL（Christian Classics Ethereal Library，http://www.ccel.org/）文本，
 *         由 Luke Plant 转换为 SWORD 模块格式
 *   许可：Public Domain（CrossWire 模块页与 conf 均标注）
 *   素材（只读）：../calvin-commentaries/（含 conf 与数据文件，见 calvin-commentaries/README.md）
 *
 * 模块格式（zCom/zText 系，与 strongsgreek zLD 同族）：
 *   .bzs 块表：每条 12 字节 {offset(4), size(4), sizeUncomp(4)}
 *   .bzz 数据：串联 zlib 流（每块一个流）
 *   .bzv 节索引：每条 10 字节 {blockNo(4), offsetInBlock(4), size(2)}，
 *     记录顺序即文档顺序（跳过 size=0），offsetInBlock 为解压后块内偏移
 *   内容为 OSIS 片段流：注释按节组织，每节一对
 *     <div annotateRef="Bible:Gen.1.2" osisID="Gen.1.2" sID="gen228" type="section"/>…<div …eID="gen228"…/>
 *
 * 输出：data-src/brp/commentary/reformed/calvin/<bookId>.json（lang: en，逐节 sections）
 *   结构：{ source: { key:'calvin', name, lang:'en' }, bookId,
 *           chapters: [{ chapter, summary:'', sections: [{ heading:'', ref:'N', text }] }] }
 *
 * 用法：node scripts/commentary/import-calvin.mjs（幂等；素材缺失时提示并跳过）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..', '..')

/** 素材模块目录（FISH 素材根 calvin-commentaries，只读） */
const MOD_DIR = join(SITE_ROOT, '..', 'calvin-commentaries', 'modules', 'comments', 'zcom', 'calvincommentaries')
/** 输出（网站"数据库"：改革宗传统下第二源） */
const OUT_DIR = join(SITE_ROOT, 'data-src', 'brp', 'commentary', 'reformed', 'calvin')

/** OSIS 书卷缩写 → bible-books 编号（Calvin 覆盖的 47 卷） */
const OSIS_TO_ID = {
  Gen: '01', Exod: '02', Lev: '03', Num: '04', Deut: '05', Josh: '06',
  Ps: '19', Isa: '23', Jer: '24', Lam: '25', Ezek: '26', Dan: '27',
  Hos: '28', Joel: '29', Amos: '30', Obad: '31', Jonah: '32', Mic: '33',
  Nah: '34', Hab: '35', Zeph: '36', Hag: '37', Zech: '38', Mal: '39',
  Matt: '40', Mark: '41', Luke: '42', John: '43', Rom: '45',
  '1Cor': '46', '2Cor': '47', Gal: '48', Eph: '49', Phil: '50', Col: '51',
  '1Thess': '52', '2Thess': '53', '1Tim': '54', '2Tim': '55', Titus: '56', Phlm: '57',
  Heb: '58', Jas: '59', '1Pet': '60', '2Pet': '61', '1John': '62', Jude: '65',
}

/** 解包一个 .bzz 数据集：按块表解压 + 按 bzv 顺序拼接 → OSIS 连续流 */
function joinOsis(prefix) {
  const bzz = readFileSync(join(MOD_DIR, `${prefix}.bzz`))
  const bzs = readFileSync(join(MOD_DIR, `${prefix}.bzs`))
  const bzv = readFileSync(join(MOD_DIR, `${prefix}.bzv`))
  const blocks = []
  for (let i = 0; i < bzs.length / 12; i++) {
    blocks.push({ off: bzs.readUInt32LE(i * 12), size: bzs.readUInt32LE(i * 12 + 4) })
  }
  const blockData = blocks.map((b) => inflateSync(bzz.subarray(b.off, b.off + b.size)))
  const parts = []
  for (let i = 0; i < bzv.length / 10; i++) {
    const blk = bzv.readUInt32LE(i * 10)
    const off = bzv.readUInt32LE(i * 10 + 4)
    const size = bzv.readUInt16LE(i * 10 + 8)
    if (size === 0) continue
    parts.push(blockData[blk].subarray(off, off + size))
  }
  return Buffer.concat(parts).toString('utf8')
}

/** OSIS 节段文本 → 干净注释文本（段落/换行保留，标签与脚注剥除） */
function cleanSection(text) {
  // 剥除脚注
  let t = text.replace(/<note[\s\S]*?<\/note>/g, '')
  // 段落 div（x-p）→ 空行分段
  t = t.replace(/<div eID="[^"]*" type="x-p"\/>/g, '\n\n')
  // 行内换行
  t = t.replace(/<lb\/>/g, '\n')
  // 剥除节段开头节号标记（<hi type="bold">1.</hi>，ref 已标识）
  t = t.replace(/^\s*<hi type="bold">\d+\.?<\/hi>/, '')
  // 其余标签剥除
  t = t.replace(/<[^>]+>/g, '')
  // 实体
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // 空白整理：行首空格清理，保留空行分段；行尾清理
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return t
}

if (!existsSync(join(MOD_DIR, 'ot.bzz'))) {
  console.error(`[calvin] 跳过：素材模块不存在 ${MOD_DIR}`)
  process.exit(0)
}

// 1) 拼接 OT + NT 连续 OSIS 流
const full = joinOsis('ot') + joinOsis('nt')

// 2) 按节段 div 切分（sID/eID 成对 type="section"）
const byBook = new Map() // bookId -> Map<chapter, Map<verse, text>>
let sections = 0
let skipped = 0
const secRe = /<div annotateRef="Bible:([A-Za-z0-9]+)\.(\d+)\.([\d\-]+)"[^>]*sID="([^"]+)"[^>]*type="section"\/>([\s\S]*?)<div [^>]*eID="\4"[^>]*type="section"\/>/g
let m
while ((m = secRe.exec(full)) !== null) {
  const abbr = m[1]
  const ch = Number(m[2])
  const vs = Number(String(m[3]).match(/^\d+/)?.[0]) // 范围取首节
  const bookId = OSIS_TO_ID[abbr]
  if (!bookId || !ch || !vs) { skipped++; continue }
  const text = cleanSection(m[5])
  if (!text) { skipped++; continue }
  if (!byBook.has(bookId)) byBook.set(bookId, new Map())
  const chMap = byBook.get(bookId)
  if (!chMap.has(ch)) chMap.set(ch, new Map())
  chMap.get(ch).set(vs, text)
  sections++
}

// 3) 聚合输出
mkdirSync(OUT_DIR, { recursive: true })
let bookCount = 0
let totalChapters = 0
for (const [bookId, chMap] of [...byBook.entries()].sort((a, b) => a[0] - b[0])) {
  const chapters = [...chMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([chapter, vsMap]) => ({
      chapter,
      summary: '',
      sections: [...vsMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([verse, text]) => ({ heading: '', ref: String(verse), text })),
    }))
  const data = {
    source: { key: 'calvin', name: '加尔文注释 (Calvin)', lang: 'en' },
    bookId,
    chapters,
  }
  writeFileSync(join(OUT_DIR, `${bookId}.json`), JSON.stringify(data))
  bookCount++
  totalChapters += chapters.length
}
console.log(`[calvin] ${bookCount} 卷 / ${totalChapters} 章 / ${sections} 节段（跳过 ${skipped}） -> data-src/brp/commentary/reformed/calvin/`)
