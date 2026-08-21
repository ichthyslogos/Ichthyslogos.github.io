/**
 * build-strongs-dict.mjs — 构建 Strong 词典（原文 → lemma → 音译 → gloss → 定义）
 *
 * 多源分层（按用户优先级）：
 *   基础层：Open Scriptures Strong's（openscriptures/strongs, CC0）——全量 5624 希腊 + 8674 希伯来，
 *           保证每个 Strong 码都有条目（lemma/translit/strong_def/derivation/kjv）。
 *   核心层：STEPBible TBESG/TBESH（STEPBible.org / Tyndale House, CC BY 4.0）——简明词典，
 *           覆盖时提供更完整的 lemma/translit/pos/gloss/def。
 *   高级层：TFLSJ（Full LSJ Bible lexicon, STEPBible.org CC BY）——独立文件，详情页懒加载。
 *
 * 产出：public/data/brp/strongs-dict.json
 *   { lang:{greek,hebrew}, count, items: { "G0026": {g,h,code,lemma,translit,pos,gloss,def,strong_def,derivation}, ... } }
 *   强码统一归一到 4 位数字前缀键（G/H + 4 位）；同一强码取其主词条行。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(root, 'data-src/brp/lexicons')
const EXTRA = path.join(root, 'data-src/brp/strongs-extra')
const GREEK = path.join(SRC, 'TBESG.tsv')
const HEBREW = path.join(SRC, 'TBESH.tsv')
const OUT = path.join(root, 'public/data/brp/strongs-dict.json')
const OUT_IDX = path.join(root, 'public/data/brp/strongs-index.json')
const OUT_LSJ = path.join(root, 'public/data/brp/strongs-lsj.json')

/** 强码归一到 4 位数字主键：H7225→H7225, H430→H0430, G26→G0026 */
function pad(letters, num) {
  return `${letters}${num.padStart(4, '0')}`
}

/** HTML 实体 → 字符（含命名与十六进制/十进制数字实体） */
function decodeEntities(s) {
  const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const isHex = e[1].toLowerCase() === 'x'
      const n = isHex ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isNaN(n) ? m : String.fromCodePoint(n)
    }
    return Object.prototype.hasOwnProperty.call(map, e) ? map[e] : m
  })
}

/** 定义 HTML → 可读文本：保留 ref 内文字、解码实体、<BR/> 与 `__` 编号标记转换行 */
function htmlToText(s) {
  return decodeEntities(s || '')
    .replace(/<ref[^>]*>([^<]*)<\/ref>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/__/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * TFLSJ 数据中的音标占位符 → Unicode 近似字符（源数据无法编码的特殊音标）。
 * 仅映射确认为音标的 token；正文里的英文方括号词（[well]/[him]/[x] 等）保持原样。
 */
const LSJ_PHONETIC = {
  uglide: 'ʷ', // u 滑音（唇化）
  snull: 'ṣ', // 梵语卷舌 s
  tnull: 'ṭ', // 梵语卷舌 t
  ngnull: 'ṇ', // 梵语卷舌 n
  macutenull: 'ṃ', // 音节化 m
  null: '', // 空占位
  icaron: 'ǐ',
  ucaron: 'ǔ',
  acaron: 'ǎ',
  ocaron: 'ǒ',
  schwa: 'ə',
  hudot: 'ḥ',
  kudot: 'ḳ',
  kcirc: 'k̂',
  zcirc: 'ž',
  imacracute: 'ī́',
  umacracute: 'ū́',
  rmacr: 'r̄',
  mtilde: 'm̃',
  rtilde: 'r̃',
  etilde: 'ẽ',
  ltilde: 'l̃',
  rdot: 'ṙ',
  ndot: 'ṅ',
  adot: 'ȧ',
}

/**
 * TFLSJ（Full LSJ）定义 HTML → 干净 HTML（直接存 <strong>/<em>，渲染端 v-html 展示）：
 *  - <a title="…">Refs …</a> 参考文献链接 → 保留链接文字（如 "Refs 8th c.BC+"），丢弃长 title 引用数据
 *  - <ref>…</ref> 经文引用、<u>/<span>/<date>/<author> → 保留内容
 *  - <LevelN> 层级标签、__X 分节标记（__I/__II.2/__A/__1/__a/__C.I.2.b 等）→ 段落换行
 *  - <b>/<i> → <strong>/<em>（按嵌套深度开关；未闭合的在末尾补齐）
 *  - <br>/<lb> → 换行
 *  - [uglide]/[snull] 等音标占位符 → Unicode 近似字符
 *  - [Refs …]/[NT]/[LXX] 引用 → <span class="lsj-ref">（供样式弱化）
 * 用逐字符扫描解析标签（尊重引号属性，避免 title 内含 > 时误判），而非正则整体替换。
 */
function lsjToHtml(s) {
  const src = decodeEntities(s || '')
  let out = ''
  let bold = 0
  let italic = 0
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    if (ch !== '<') {
      if (ch === '_' && src[i + 1] === '_') {
        // 分节标记 __I / __II.2 / __C.I.2.b 等 → 段落换行
        let k = i + 2
        while (k < n && /[A-Za-z0-9.]/.test(src[k])) k++
        out += '\n'
        i = k
      } else if (ch === '[') {
        // 音标占位符 [xxx] → Unicode 近似字符
        const m = /^\[([a-z]+)\]/.exec(src.slice(i))
        if (m && Object.prototype.hasOwnProperty.call(LSJ_PHONETIC, m[1])) {
          out += LSJ_PHONETIC[m[1]]
          i += m[0].length
        } else {
          out += ch
          i++
        }
      } else {
        out += ch
        i++
      }
      continue
    }
    const close = src[i + 1] === '/'
    let j = close ? i + 2 : i + 1
    let name = ''
    while (j < n && /[a-zA-Z0-9]/.test(src[j])) {
      name += src[j]
      j++
    }
    name = name.toLowerCase()
    // 跳过属性（尊重双引号值，title 内可能含 >）
    while (j < n && src[j] !== '>') {
      if (src[j] === '"') {
        j++
        while (j < n && src[j] !== '"') j++
      }
      j++
    }
    if (j < n) j++ // 跳过 '>'
    if (name === 'b') {
      if (close) {
        bold--
        if (bold === 0) out += '</strong>'
      } else {
        bold++
        if (bold === 1) out += '<strong>'
      }
    } else if (name === 'i') {
      if (close) {
        italic--
        if (italic === 0) out += '</em>'
      } else {
        italic++
        if (italic === 1) out += '<em>'
      }
    } else if (name === 'br' || name === 'lb') {
      out += '\n'
    } else if (/^level\d$/.test(name)) {
      out += '\n'
    }
    // a/ref/u/span/date/author：仅保留内部文字
    i = j
  }
  // 补齐未闭合的加粗/斜体
  while (bold > 0) { out += '</strong>'; bold-- }
  while (italic > 0) { out += '</em>'; italic-- }
  return out
    .replace(/\[\[/g, '[') // 源数据里多余的方括号 → 单括号
    .replace(/\]\]/g, ']')
    .replace(/<strong> +/g, '<strong>') // 标签内首尾空格清理
    .replace(/ +<\/strong>/g, '</strong>')
    .replace(/<em> +/g, '<em>')
    .replace(/ +<\/em>/g, '</em>')
    .replace(/<strong>\n<\/strong>/g, '\n') // 分节标记夹在 <b> 内产生的空加粗 → 纯换行
    .replace(/<em>\n<\/em>/g, '\n')
    .replace(/\[(Refs|NT|LXX|same)[^\]]*\]/g, '<span class="lsj-ref">$&</span>')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** 解析一个简明词典文件 → Map<主键, 词条>（扩码首行为主词条） */
function parseFile(file, lang) {
  const rows = []
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const ln of lines) {
    if (!/^(G|H)\d/.test(ln.trim())) continue
    const c = ln.split('\t')
    if (c.length < 8) continue
    const code = c[0].trim()
    const m = /^(G|H)(\d+)$/.exec(code)
    if (!m) continue
    rows.push({
      letters: m[1],
      num: m[2],
      key: pad(m[1], m[2]),
      ext: c[1].trim(),
      sub: c[2].trim(),
      lemma: c[3].trim(),
      translit: c[4].trim(),
      pos: c[5].trim(),
      gloss: c[6].trim(),
      def: htmlToText(c[7]),
    })
  }
  // 保主词条：扩展标记为「key =」的主行；否则取首个
  const byKey = new Map()
  for (const r of rows) {
    if (!byKey.has(r.key)) {
      byKey.set(r.key, r)
    } else if (r.ext === `${r.key} =` || r.ext === `${r.code} =`) {
      byKey.set(r.key, r)
    }
  }
  return byKey
}

const g = parseFile(GREEK, 'greek')
const h = parseFile(HEBREW, 'hebrew')

/**
 * 司特朗原版（James Strong, public domain, via openscriptures/strongs, CC0）
 * greek-strong.js / hebrew-strong.js 形如 `var x = {…};`，键为未填充强码（G7/H430）。
 * 作为基础层：全量覆盖（希腊 5624 / 希伯来 8674），提供 lemma/translit/kjv/strong_def/derivation。
 */
function parseStrongOriginal() {
  const out = new Map()
  for (const file of ['greek-strong.js', 'hebrew-strong.js']) {
    const p = path.join(EXTRA, file)
    if (!fs.existsSync(p)) continue
    const raw = fs.readFileSync(p, 'utf8')
    const obj = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    for (const [code, e] of Object.entries(obj)) {
      const m = /^(G|H)(\d+)$/i.exec(code)
      if (!m) continue
      const key = pad(m[1].toUpperCase(), m[2])
      if (!out.has(key)) {
        out.set(key, {
          lemma: e.lemma || '',
          translit: e.translit || '',
          kjv: e.kjv_def || '',
          strong_def: e.strongs_def || null,
          derivation: e.derivation || null,
        })
      }
    }
  }
  return out
}

const strongOrig = parseStrongOriginal()

/**
 * TFLSJ（Full LSJ Bible lexicon, STEPBible.org CC BY）— 高级希腊词典
 * 8 列制表，与 TBESG 同构；定义字段含 <LevelN>/<a title> 等标签。
 * 产出独立文件 strongs-lsj.json（约 13MB，详情页按需懒加载），键为 4 位强码。
 */
function parseTFLSJ() {
  const p = path.join(EXTRA, 'TFLSJ.txt')
  if (!fs.existsSync(p)) return new Map()
  const items = new Map()
  for (const ln of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!/^(G|H)\d/.test(ln.trim())) continue
    const c = ln.split('\t')
    if (c.length < 8) continue
    const m = /^(G|H)(\d+)$/.exec(c[0].trim())
    if (!m) continue
    const key = pad(m[1], m[2])
    if (!items.has(key)) items.set(key, { lemma: c[3].trim(), translit: c[4].trim(), def: lsjToHtml(c[7]) })
  }
  return items
}

const tflsj = parseTFLSJ()

export function build() {
  const items = {}
  // 基础层：Open Scriptures Strong's 全量条目（保证每个码都有 lemma/translit/strong_def）
  for (const [key, s] of strongOrig) {
    const isG = key[0] === 'G'
    items[key] = {
      g: isG ? 1 : 0,
      h: isG ? 0 : 1,
      code: key,
      lemma: s.lemma,
      translit: s.translit,
      pos: '',
      gloss: s.kjv,
      def: '',
      strong_def: s.strong_def,
      derivation: s.derivation,
    }
  }
  // 核心层：TBESG/TBESH 覆盖（更完整的 lemma/translit/pos/gloss/def）；未覆盖的补入
  for (const [key, r] of g) {
    if (items[key]) {
      items[key].g = 1
      items[key].lemma = r.lemma
      items[key].translit = r.translit
      items[key].pos = r.pos
      items[key].gloss = r.gloss
      items[key].def = r.def
    } else {
      items[key] = { g: 1, h: 0, code: key, lemma: r.lemma, translit: r.translit, pos: r.pos, gloss: r.gloss, def: r.def, strong_def: null, derivation: null }
    }
  }
  for (const [key, r] of h) {
    if (items[key]) {
      items[key].h = 1
      items[key].lemma = r.lemma
      items[key].translit = r.translit
      items[key].pos = r.pos
      items[key].gloss = r.gloss
      items[key].def = r.def
    } else {
      items[key] = { g: 0, h: 1, code: key, lemma: r.lemma, translit: r.translit, pos: r.pos, gloss: r.gloss, def: r.def, strong_def: null, derivation: null }
    }
  }

  const out = { lang: { greek: 'G', hebrew: 'H' }, count: Object.keys(items).length, items }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out))

  // 轻量索引（无定义），供词典列表页即时搜索
  const idx = {}
  for (const [key, it] of Object.entries(items)) idx[key] = { lemma: it.lemma, translit: it.translit, pos: it.pos, gloss: it.gloss }
  fs.writeFileSync(OUT_IDX, JSON.stringify({ count: Object.keys(items).length, items: idx }))

  // TFLSJ 高级希腊词典（独立文件，详情页懒加载）
  const lsjOut = { lang: 'G', count: tflsj.size, items: Object.fromEntries(tflsj) }
  fs.writeFileSync(OUT_LSJ, JSON.stringify(lsjOut))

  console.log(`[build-strongs-dict] 完成：${Object.keys(items).length} 词条（基础 Open Scriptures + 核心 TBESG/TBESH）-> strongs-dict.json + strongs-index.json；TFLSJ ${tflsj.size} 条 -> strongs-lsj.json`)
}

// 直接运行本脚本时执行构建
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  build()
}