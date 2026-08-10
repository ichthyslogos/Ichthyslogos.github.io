/**
 * import-strong-lexicon.mjs — Strong 希腊文词典 → data-src 导入
 *
 * 素材（只读）：../StrongsGreek/（SWORD zLD 模块 strongsgreek，Public Domain）
 *   - dict.zdx：块表（每块 {offset(4), size(4)}，8 字节 × 192）
 *   - dict.zdt：数据（串联 zlib 流，每流一块）
 *   - 块内结构：[count u32][off0 u32][(size u32, nextOff u32) × count] + 条目文本串联
 *   - 条目文本为 TEI 标记：<entryFree n="X"><orth>希腊原形</orth>…
 *     <pron>{发音}</pron><def>释义</def>；占位条目内容为 "@@@@X"（丢弃）
 *
 * 输出：data-src/brp/strong/lexicon-greek.json
 *   { source: { key, name, lang, license },
 *     entries: { "G1": { orth, translit, pron, def, see: ["G427", "H0104"] }, … } }
 *   key 与 chiuns 逐词数据的 Strong 码（"G5207"）直接对齐，无零填充。
 *
 * 用法：node scripts/import-strong-lexicon.mjs（幂等；素材缺失时提示并跳过）
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = join(__dirname, '..')

/** 素材模块目录（FISH 素材根 strong-lexicons/StrongsGreek，只读；见 strong-lexicons/README.md） */
const MOD_DIR = join(SITE_ROOT, '..', '素材', 'strong-lexicons', 'StrongsGreek', 'modules', 'lexdict', 'zld', 'strongsgreek')
/** 输出（网站"数据库"） */
const OUT = join(SITE_ROOT, 'data-src', 'brp', 'strong', 'lexicon-greek.json')

if (!existsSync(join(MOD_DIR, 'dict.zdt')) || !existsSync(join(MOD_DIR, 'dict.zdx'))) {
  console.error(`[strong-lexicon] 跳过：素材模块不存在 ${MOD_DIR}`)
  process.exit(0)
}

const zdt = readFileSync(join(MOD_DIR, 'dict.zdt'))
const zdx = readFileSync(join(MOD_DIR, 'dict.zdx'))

/** 解析一块解压数据：返回条目文本数组 */
function parseBlock(buf) {
  const count = buf.readUInt32LE(0)
  let start = buf.readUInt32LE(4)
  const texts = []
  for (let k = 0; k < count; k++) {
    const size = buf.readUInt32LE(8 + k * 8)
    const next = buf.readUInt32LE(12 + k * 8)
    const end = start + size
    if (end <= buf.length && size > 0) texts.push(buf.toString('utf8', start, end))
    start = next
  }
  return texts
}

/** TEI 条目 → { n, orth, translit, pron, def, see }；占位返回 null */
function parseEntry(txt) {
  const m = txt.match(/<entryFree n="([^"]*)"/)
  if (!m) return null
  const n = m[1]
  if (!/^\d+$/.test(n)) return null // 仅纯数字编号（G 码）；a/b 后缀为占位
  const orth = txt.match(/<orth>(.*?)<\/orth>/)
  const translit = txt.match(/<orth[^>]*type="trans"[^>]*>(.*?)<\/orth>/)
  const pron = txt.match(/<pron[^>]*>(.*?)<\/pron>/)
  const def = txt.match(/<def>([\s\S]*?)<\/def>/)
  if (!def || !def[1].trim()) return null
  const rawDef = def[1]
  if (rawDef.includes('@@@@')) return null // 占位条目
  // <lb/> → 换行，其余标签剥除
  const clean = rawDef
    .replace(/<lb\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!clean) return null
  const see = [...clean.matchAll(/see (?:GREEK|HEBREW) for (\d+)/gi)].map((x) =>
    x[0].toLowerCase().includes('hebrew') ? `H${x[1]}` : `G${x[1]}`,
  )
  return {
    n,
    orth: orth ? orth[1].replace(/<[^>]+>/g, '').trim() : '',
    translit: translit ? translit[1].replace(/<[^>]+>/g, '').trim() : '',
    pron: pron ? pron[1].replace(/<[^>]+>/g, '').trim() : '',
    def: clean,
    see,
  }
}

// 按块表顺序解压全部块 → 条目
const entries = {}
let skipped = 0
for (let i = 0; i < zdx.length; i += 8) {
  const off = zdx.readUInt32LE(i)
  const size = zdx.readUInt32LE(i + 4)
  const buf = inflateSync(zdt.subarray(off, off + size))
  for (const txt of parseBlock(buf)) {
    const e = parseEntry(txt)
    if (!e) { skipped++; continue }
    const { n, ...rest } = e
    entries[`G${n}`] = rest
  }
}

const data = {
  source: {
    key: 'strongs-greek',
    name: 'Strong 希腊文词典',
    lang: 'en',
    license: 'Public Domain',
  },
  entries,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(data))
console.log(`[strong-lexicon] ${Object.keys(entries).length} 词条（跳过占位 ${skipped}） -> data-src/brp/strong/lexicon-greek.json`)
