/**
 * import-crosswire.mjs — CrossWire 注释模块（SWORD zCom）→ data-src 批量导入
 *
 * 数据获取（完整记录，供维护，详见素材根 crosswire-commentaries/README.md）：
 *   来源：CrossWire 官方 Raw ZIP（https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/<Key>.zip）
 *   本脚本接入三个模块（均为英文原文）：
 *     1. RWP    — Robertson's Word Pictures in the New Testament（A.T. Robertson）
 *                 新约 27 卷逐节；conf 标注 "Copyrighted; Free non-commercial distribution"，
 *                 第 5/6 卷版权 2006/2007 到期（conf 自注），现属公有领域
 *                 → data-src/brp/commentary/baptist/rwp/
 *     2. Catena — Catena Aurea（托马斯·阿奎那编"金链"，汇集教父注解，四福音逐节，Public Domain）
 *                 → data-src/brp/commentary/church-fathers/catena/
 *     3. Abbott — Illustrated New Testament（John S.C. Abbott & Jacob Abbott, 1878，新约 27 卷逐节，Public Domain）
 *                 → data-src/brp/commentary/evangelical/abbott/
 *
 * 模块格式（zCom 通用，与 import-calvin.mjs 同族，实测结论）：
 *   .bzs/.czs 块表：每条 12 字节 {offset(4), size(4), sizeUncomp(4)}
 *   .bzz/.czz 数据：串联 zlib 流；cz 变体与 b 变体同构（无文件头，offset 0 起即 zlib 魔数 0x789c）
 *   .bzv/.czv 节索引：每条 10 字节 {blockNo(4), offsetInBlock(4), size(2)}，
 *     同一节段可被多条索引引用（sID/eID 成对），按唯一 ref 聚合
 *   内容为 OSIS 片段流：每节一对
 *     <div annotateRef="Book.Ch.V" sID="xxx" type="section"/>…<div …eID="xxx"…/>
 *     （ref 无 "Bible:" 前缀；Calvin 模块有前缀，本脚本兼容两者）
 *
 * 输出：data-src/brp/commentary/<tradition>/<key>/<bookId>.json
 *   结构：{ source: { key, name, lang:'en' }, bookId,
 *           chapters: [{ chapter, summary:'', sections: [{ heading:'', ref:'N', text }] }] }
 *
 * 用法：node scripts/commentary/import-crosswire.mjs（幂等；素材缺失时提示并跳过）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..', '..')
const ASSETS_ROOT = join(SITE_ROOT, '..', '素材', 'crosswire-commentaries')

/** OSIS 书卷缩写（无空格风格，如 1Cor）→ bible-books 编号（66 卷全集） */
const OSIS_TO_ID = {
  Gen: '01', Exod: '02', Lev: '03', Num: '04', Deut: '05', Josh: '06', Judg: '07', Ruth: '08',
  '1Sam': '09', '2Sam': '10', '1Kgs': '11', '2Kgs': '12', '1Chr': '13', '2Chr': '14',
  Ezra: '15', Neh: '16', Esth: '17', Job: '18', Ps: '19', Prov: '20', Eccl: '21', Song: '22',
  Isa: '23', Jer: '24', Lam: '25', Ezek: '26', Dan: '27', Hos: '28', Joel: '29', Amos: '30',
  Obad: '31', Jonah: '32', Mic: '33', Nah: '34', Hab: '35', Zeph: '36', Hag: '37', Zech: '38',
  Mal: '39', Matt: '40', Mark: '41', Luke: '42', John: '43', Acts: '44', Rom: '45',
  '1Cor': '46', '2Cor': '47', Gal: '48', Eph: '49', Phil: '50', Col: '51',
  '1Thess': '52', '2Thess': '53', '1Tim': '54', '2Tim': '55', Titus: '56', Phlm: '57',
  Heb: '58', Jas: '59', '1Pet': '60', '2Pet': '61', '1John': '62', '2John': '63', '3John': '64',
  Jude: '65', Rev: '66',
}

/** 接入配置：素材模块键 → 输出传统/源 key 与显示名 */
const SOURCES = [
  {
    modKey: 'RWP', tradition: 'baptist', key: 'rwp',
    name: "Robertson's Word Pictures (罗伯逊新约字义)",
  },
  {
    modKey: 'Catena', tradition: 'church-fathers', key: 'catena',
    name: 'Catena Aurea 金链 (阿奎那编教父注释)',
  },
  {
    modKey: 'Abbott', tradition: 'evangelical', key: 'abbott',
    name: "Abbott's Illustrated New Testament (雅博特新约注释)",
  },
]

/** 解包一个数据集：按块表解压 + 按 bzv 顺序拼接 → OSIS 连续流（b/c 变体通用） */
function joinOsis(modDir, prefix) {
  const hasCz = existsSync(join(modDir, `${prefix}.czz`))
  const suf = hasCz ? ['czz', 'czs', 'czv'] : ['bzz', 'bzs', 'bzv']
  const bzz = readFileSync(join(modDir, `${prefix}.${suf[0]}`))
  const bzs = readFileSync(join(modDir, `${prefix}.${suf[1]}`))
  const bzv = readFileSync(join(modDir, `${prefix}.${suf[2]}`))
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
    if (size === 0 || blk >= blockData.length) continue
    parts.push(blockData[blk].subarray(off, off + size))
  }
  return Buffer.concat(parts).toString('utf8')
}

/** OSIS 节段文本 → 干净注释文本（段落/换行保留，标签与脚注剥除） */
function cleanSection(text) {
  // 剥除脚注
  let t = text.replace(/<note[\s\S]*?<\/note>/g, '')
  // 段落 div（x-p / paragraph）→ 空行分段；开标签直接剥除
  t = t.replace(/<div sID="[^"]*" type="(?:x-p|paragraph)"\/>/g, '')
  t = t.replace(/<div eID="[^"]*" type="(?:x-p|paragraph)"\/>/g, '\n\n')
  // 行内换行
  t = t.replace(/<lb\/>/g, '\n')
  // 剥除节段开头节号标记（<hi type="bold">1.</hi>，ref 已标识）
  t = t.replace(/^\s*<hi type="bold">\d+\.?<\/hi>/, '')
  // 其余标签剥除
  t = t.replace(/<[^>]+>/g, '')
  // 实体
  t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
  // 空白整理：行首空格清理，保留空行分段；行尾清理
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return t
}

for (const src of SOURCES) {
  const modDir = join(ASSETS_ROOT, src.modKey, 'modules', 'comments', 'zcom', src.modKey.toLowerCase())
  if (!existsSync(modDir)) {
    console.error(`[crosswire:${src.key}] 跳过：素材模块不存在 ${modDir}`)
    continue
  }
  // 1) 拼接该模块全部数据集（ot/nt）
  const files = readdirSync(modDir)
  const prefixes = ['ot', 'nt'].filter((p) => files.includes(`${p}.bzz`) || files.includes(`${p}.czz`))
  const full = prefixes.map((p) => joinOsis(modDir, p)).join('')

  // 2) 按节段 div 切分（sID/eID 成对 type="section"；兼容有/无 Bible: 前缀）
  const byBook = new Map() // bookId -> Map<chapter, Map<verse, text>>
  let sections = 0
  let skipped = 0
  const secRe = /<div annotateRef="(?:Bible:)?([A-Za-z0-9]+)\.(\d+)\.(\d+)"[^>]*sID="([^"]+)"[^>]*type="section"\/>([\s\S]*?)<div [^>]*eID="\4"[^>]*type="section"\/>/g
  let m
  while ((m = secRe.exec(full)) !== null) {
    const bookId = OSIS_TO_ID[m[1]]
    const ch = Number(m[2])
    const vs = Number(m[3])
    if (!bookId || !ch || !vs) { skipped++; continue }
    const text = cleanSection(m[5])
    if (!text) { skipped++; continue }
    if (!byBook.has(bookId)) byBook.set(bookId, new Map())
    const chMap = byBook.get(bookId)
    if (!chMap.has(ch)) chMap.set(ch, new Map())
    const prev = chMap.get(ch).get(vs)
    chMap.get(ch).set(vs, prev ? `${prev}\n\n${text}` : text)
    sections++
  }

  // 3) 聚合输出
  const outDir = join(SITE_ROOT, 'data-src', 'brp', 'commentary', src.tradition, src.key)
  mkdirSync(outDir, { recursive: true })
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
    writeFileSync(
      join(outDir, `${bookId}.json`),
      JSON.stringify({ source: { key: src.key, name: src.name, lang: 'en' }, bookId, chapters }),
    )
    bookCount++
    totalChapters += chapters.length
  }
  console.log(`[crosswire:${src.key}] ${bookCount} 卷 / ${totalChapters} 章 / ${sections} 节段（跳过 ${skipped}） -> data-src/brp/commentary/${src.tradition}/${src.key}/`)
}
