/**
 * import-strong-lexicon-hebrew.mjs — Strong 希伯来词典 → data-src 导入
 *
 * 素材（只读）：../HebrewLexicon/HebrewStrong.xml
 *   来源：Open Scriptures Hebrew Bible Project
 *     https://github.com/openscriptures/HebrewLexicon（HebrewStrong.xml，2019 更新版）
 *   许可：CC BY 4.0（OSHB 整理版式；Strong 词典原文公有领域）。
 *     署名：credit the Open Scriptures Hebrew Bible Project
 *
 * 输出：data-src/brp/strong/lexicon-hebrew.json
 *   { source: { key, name, lang, license, attribution },
 *     entries: { "H430": { orth, pos, translit, pron, def, usage, see }, … } }
 *   key 无零填充（"H430"）；chiuns 逐词码（"H0430"）由前端归一化（去前导零）后匹配。
 *
 * 用法：node scripts/import-strong-lexicon-hebrew.mjs（幂等；素材缺失时提示并跳过）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')

/** 素材 XML（FISH 素材根 strong-lexicons/HebrewLexicon，只读；见 strong-lexicons/README.md） */
const SRC = join(SITE_ROOT, '..', 'strong-lexicons', 'HebrewLexicon', 'HebrewStrong.xml')
/** 输出（网站"数据库"） */
const OUT = join(SITE_ROOT, 'data-src', 'brp', 'strong', 'lexicon-hebrew.json')

if (!existsSync(SRC)) {
  console.error(`[strong-lexicon-hebrew] 跳过：素材不存在 ${SRC}`)
  process.exit(0)
}

const xml = readFileSync(SRC, 'utf8')
const strip = (t) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/** 条目内交叉引用（<w src="H6"> 等）→ ["H6", ...]；引用编号去前导零与词典 key 对齐 */
const seeRefs = (t) =>
  [...t.matchAll(/<w src="(H\d+)"/g)].map((m) => 'H' + Number(m[1].slice(1)))

const entries = {}
for (const m of xml.matchAll(/<entry id="(H\d+)">([\s\S]*?)<\/entry>/g)) {
  const id = m[1]
  const body = m[2]
  const w = body.match(/<w([^>]*)>(.*?)<\/w>/)
  const pos = w && w[1].match(/pos="([^"]*)"/)
  const pron = w && w[1].match(/pron="([^"]*)"/)
  const xlit = w && w[1].match(/xlit="([^"]*)"/)
  const source = body.match(/<source>([\s\S]*?)<\/source>/)
  const meaning = body.match(/<meaning>([\s\S]*?)<\/meaning>/)
  const usage = body.match(/<usage>([\s\S]*?)<\/usage>/)
  const meaningText = meaning ? strip(meaning[1]) : ''
  const usageText = usage ? strip(usage[1]) : ''
  if (!meaningText && !usageText) continue // 空条目（H1 系列以外的占位）
  const see = []
  if (source) see.push(...seeRefs(source[1]))
  if (meaning) see.push(...seeRefs(meaning[1]))
  if (usage) see.push(...seeRefs(usage[1]))
  entries[id] = {
    orth: w ? strip(w[2]) : '',
    pos: pos ? pos[1] : '',
    translit: xlit ? xlit[1] : '',
    pron: pron ? pron[1] : '',
    def: meaningText,
    usage: usageText,
    see: [...new Set(see)],
  }
}

const data = {
  source: {
    key: 'strongs-hebrew',
    name: 'Strong 希伯来词典',
    lang: 'en',
    license: 'CC BY 4.0',
    attribution: 'Open Scriptures Hebrew Bible Project (github.com/openscriptures/HebrewLexicon)',
  },
  entries,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data))
console.log(`[strong-lexicon-hebrew] ${Object.keys(entries).length} 词条 -> data-src/brp/strong/lexicon-hebrew.json`)
