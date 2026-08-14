/**
 * 导入 STEP Bible TIPNR（Translators Individualised Proper Names with all References）
 * 专有名词词典 → data-src/brp/notes/tipnr/
 *
 * 素材：素材/stepbible-tipnr/TIPNR.txt（CC BY 4.0，来源 STEPBible/STEPBible-Data）
 * 记录结构（$ 开头行分隔）：
 *   主行: UnifiedName=uStrong\tDescription\tParents\tSiblings\tPartners\tOffspring\tTribe\t#Summary\tType
 *   子行: – Named|Greek|Total\tUniqueName\tdStrong«eStrong=Heb/Grk\tTranslated\tlink\tAll Refs
 *   描述: @Briefest= / @Brief= / @Short= / @Article= （<BR> 为段落分隔）
 * 经节: 书缩写.章.节（如 Exo.4.14），省略书缩写时承接上一 ref；ff 表示「及以后」；(?) 歧义标记
 *
 * 输出：
 *   books/<bookId>.json    按卷分片：每章 entries = 该章出现的人名/地名/词条（按出现序）
 *   entries.json           全量轻量索引（name/strong/type，供将来词条高亮匹配）
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../../../素材/stepbible-tipnr/TIPNR.txt', import.meta.url))
const OUT = fileURLToPath(new URL('../../data-src/brp/notes/tipnr/', import.meta.url))

/** TIPNR 书缩写 → 本站 bookId（TIPNR 用 ESV 缩写体系；先建常见映射，未知缩写统计报告） */
const TIPNR_ABBR = {
  Gen: '01', Exo: '02', Lev: '03', Num: '04', Deu: '05', Jos: '06', Jdg: '07', Rut: '08',
  '1Sa': '09', '2Sa': '10', '1Ki': '11', '2Ki': '12', '1Ch': '13', '2Ch': '14',
  Ezr: '15', Neh: '16', Est: '17', Job: '18', Psa: '19', Pro: '20', Ecc: '21', Son: '22',
  Isa: '23', Jer: '24', Lam: '25', Ezk: '26', Dan: '27', Hos: '28', Joe: '29', Amo: '30',
  Oba: '31', Jon: '32', Mic: '33', Nam: '34', Hab: '35', Zep: '36', Hag: '37', Zec: '38',
  Mal: '39', Mat: '40', Mrk: '41', Luk: '42', Jhn: '43', Act: '44', Rom: '45', '1Co': '46',
  '2Co': '47', Gal: '48', Eph: '49', Php: '50', Col: '51', '1Th': '52', '2Th': '53',
  '1Ti': '54', '2Ti': '55', Tit: '56', Phm: '57', Heb: '58', Jas: '59', '1Pe': '60',
  '2Pe': '61', '1Jo': '62', '2Jo': '63', '3Jo': '64', Jud: '65', Rev: '66',
  // TIPNR 特有缩写
  Sng: '22', Jol: '29', '1Jn': '62', '2Jn': '63', '3Jn': '64',
}

const TYPE_ZH = {
  Male: '人名', Female: '人名', Group: '群体', Place: '地名', Language: '语言',
  Time: '时间', Supernatural: '灵界', Musical: '音乐', Star: '星象', Title: '称号', Other: '其他',
}

/**
 * 解析单个经节引用 → { id, ch, vs }；无书缩写时承接 prevAbbr（-- Total 行省略式）
 * 处理：ff 后缀（4.27ff）、(?) 歧义标记、尾部 (d)/(a)/(f) 标记、尾分号
 */
function parseRef(raw, prevAbbr) {
  let s = raw.trim().replace(/;$/, '')
  if (!s) return null
  // 去歧义/角色标记：(?) (d) (a) (f)
  s = s.replace(/\(\?\)$/, '').replace(/\([daf]\)$/, '')
  const m = s.match(/^(?:([A-Za-z0-9]+)\.)?(\d+)(?:\.(\d+[a-z]*(?:,\d+[a-z]*)*))?(?:-([A-Za-z0-9]+)(?:\.[\d.]+)?)?$/)
  if (!m) return null
  const abbr = m[1] || prevAbbr
  if (!abbr) return null
  const id = TIPNR_ABBR[abbr]
  if (!id) return { unknown: abbr, raw }
  return { id, ch: Number(m[2]), vs: m[3] || '', abbr }
}

/** 解析一行的 All Refs（分号分隔），返回 [{id, ch, vs}] 与失败清单 */
function parseRefs(str, log) {
  const out = []
  let prevAbbr = null
  for (const part of str.split(';')) {
    const r = parseRef(part, prevAbbr)
    if (!r) continue
    if (r.unknown) {
      log.add(`${r.unknown}`)
      continue
    }
    prevAbbr = r.abbr
    out.push({ id: r.id, ch: r.ch, vs: r.vs })
  }
  return out
}

const text = readFileSync(SRC, 'utf8').replace(/\r/g, '')
const lines = text.split('\n')

const entries = [] // 全量词条
const byBook = new Map() // bookId → Map(chapter → [词条引用])
const unknownAbbr = new Set()
let cur = null

/** 提交当前记录（字段说明区的伪记录——无子行/描述/refs——丢弃） */
function commit() {
  if (
    cur &&
    cur.name &&
    (cur.refs.length || cur['@Briefest'] || cur['@Brief'] || cur['@Short'] || cur['@Article'] || cur.desc)
  ) {
    entries.push(cur)
  }
  cur = null
}

/** 主行判定：名字（无空格）@书缩写.章.节[后缀][(标记)]=Strong；后缀可为空（Abdon@1Ch.8.30-=H5658J）；字段说明区例子虽匹配但无子行/描述，被 commit 校验丢弃 */
const MAIN_RE = /^[A-Za-z][^\t@ ]*@[A-Za-z0-9]+\.\d+(?:\.\d+[a-z]*(?:,\d+[a-z]*)*)?(?:-[A-Za-z0-9]*)?(?:\([a-z?]+\))?[=\t]/

for (const rawLine of lines) {
  const line = rawLine.replace(/\t+$/, '') // 去行尾空 tab
  const t = line.trim()
  if (!t) continue
  if (t.startsWith('‖') || t.startsWith('©') || t.startsWith('=')) continue
  if (t.startsWith('$')) {
    // 记录分隔：$========== PERSON(s)（含分类标签）或 $ 单独行
    commit()
    continue
  }
  if (t.startsWith('@Briefest=') || t.startsWith('@Brief=') || t.startsWith('@Short=') || t.startsWith('@Article=')) {
    if (!cur) continue
    const key = t.slice(1, t.indexOf('=')).trim()
    const val = t.slice(t.indexOf('=') + 1).trim().replace(/<BR>/g, '\n\n')
    cur[`@${key}`] = val
    continue
  }
  if (t.startsWith('–') || t.startsWith('- ')) {
    if (!cur) continue
    // 子行：– Significance\tUniqueName\tdStrong\tTranslated\tlink\tAll Refs
    const cols = line.replace(/^[–\-]\s*/, '').split('\t')
    const sig = (cols[0] || '').trim()
    const refsStr = cols[cols.length - 1] || ''
    // refs：Named/Greek/Spelled 等行完整带书缩写；Total 行有省略式承接——优先 Total 行
    const refs = parseRefs(refsStr, unknownAbbr)
    if (refs.length && (sig === 'Total' || !cur.refs.length)) cur.refs = refs
    continue
  }
  if (!MAIN_RE.test(line)) continue // 字段说明等其他行
  // 主行：UnifiedName=uStrong\tDescription\t...\t#Summary\tType
  commit()
  const cols = line.split('\t')
  const unified = (cols[0] || '').trim()
  const name = unified.slice(0, unified.indexOf('@'))
  const strong = unified.includes('=') ? unified.slice(unified.indexOf('=') + 1) : ''
  const desc = (cols[1] || '').trim()
  const summary = (cols[7] || '').trim().replace(/^#/, '')
  const type = (cols[8] || '').trim()
  cur = {
    name,
    strong,
    type: TYPE_ZH[type] ? type : 'Other',
    desc: summary || desc,
    refs: [],
  }
}

commit()

// 按卷分片
for (const e of entries) {
  const seen = new Set()
  const item = {
    name: e.name,
    strong: e.strong,
    type: e.type,
    briefest: e['@Briefest'] || '',
    brief: e['@Brief'] || '',
    short: e['@Short'] || '',
    article: e['@Article'] || '',
  }
  for (const r of e.refs) {
    if (!r.id) continue
    const key = `${r.id}:${r.ch}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!byBook.has(r.id)) byBook.set(r.id, new Map())
    const chMap = byBook.get(r.id)
    if (!chMap.has(r.ch)) chMap.set(r.ch, [])
    chMap.get(r.ch).push({ ...item, refs: [] })
  }
}

// 组装每卷 JSON
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'books'), { recursive: true })
const books = []
for (const [bookId, chMap] of byBook) {
  const chapters = []
  for (const [ch, list] of [...chMap.entries()].sort((a, b) => a[0] - b[0])) {
    // 词条级：合并同词条在同一章的多个 refs
    const byName = new Map()
    for (const item of list) {
      if (!byName.has(item.name)) byName.set(item.name, { ...item, refs: [] })
      byName.get(item.name).refs.push(ch)
    }
    chapters.push({ chapter: ch, entries: [...byName.values()] })
  }
  const out = {
    source: { key: 'tipnr', name: 'STEP 专有名词注释 (TIPNR)', lang: 'en' },
    bookId,
    chapters,
  }
  writeFileSync(join(OUT, 'books', `${bookId}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8')
  books.push({ id: bookId, chapterCount: chapters.length, entryCount: chapters.reduce((s, c) => s + c.entries.length, 0) })
}

// 全量轻量索引（供将来词条高亮匹配）
const index = {
  source: { key: 'tipnr', name: 'STEP 专有名词注释 (TIPNR)', lang: 'en' },
  count: entries.length,
  entries: entries.map((e) => ({ name: e.name, strong: e.strong, type: e.type })),
}
writeFileSync(join(OUT, 'entries.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')

console.log(`TIPNR 导入：${entries.length} 词条 → ${books.length} 卷 / ${books.reduce((s, b) => s + b.chapterCount, 0)} 章 / ${books.reduce((s, b) => s + b.entryCount, 0)} 章次`)
console.log(`未知书缩写：${[...unknownAbbr].slice(0, 20).join(', ') || '无'}`)
