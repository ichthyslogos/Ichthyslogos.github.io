/**
 * 验证 MHCC 转换内容完整性：每个转换段的首 40 字符（空白归一化后）
 * 必须能在 RawCom 原文章文本中找到——确认转换未丢失/篡改原文内容。
 * 只读校验，输出统计与缺失清单。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MHCC_DIR = fileURLToPath(new URL('../../../素材/crosswire-commentaries/MHCC/modules/comments/rawcom/mhcc/', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../../data-src/brp/commentary/concise/mhcc/', import.meta.url))

const ABBR_TO_ID = {
  GE: '01', EX: '02', LE: '03', NU: '04', DE: '05', JOS: '06', JUD: '07', RU: '08',
  '1SA': '09', '2SA': '10', '1KI': '11', '2KI': '12', '1CH': '13', '2CH': '14',
  EZR: '15', NE: '16', ES: '17', JOB: '18', PS: '19', PR: '20', EC: '21', SO: '22',
  ISA: '23', JER: '24', LA: '25', EZE: '26', DA: '27', HO: '28', JOE: '29', AM: '30',
  OB: '31', JON: '32', MIC: '33', NA: '34', HAB: '35', ZEP: '36', HAG: '37', ZEC: '38',
  MAL: '39', MT: '40', MR: '41', LU: '42', JOH: '43', AC: '44', RO: '45', '1CO': '46',
  '2CO': '47', GA: '48', EPH: '49', PHP: '50', COL: '51', '1TH': '52', '2TH': '53',
  '1TI': '54', '2TI': '55', TIT: '56', PHM: '57', HEB: '58', JAS: '59', '1PE': '60',
  '2PE': '61', '1JO': '62', '2JO': '63', '3JO': '64', JUDE: '65', RE: '66',
}

function chapters(text) {
  const re = /\$-\$-\$-(?:\$-)?\s*([A-Z0-9]+):(\d+)/g
  const out = []
  let m
  while ((m = re.exec(text))) out.push({ abbr: m[1], ch: Number(m[2]), start: re.lastIndex })
  return out
}

const norm = (s) => s.replace(/\s+/g, ' ').trim()

let total = 0
const missing = []

for (const [file, text] of [['ot', readFileSync(MHCC_DIR + 'ot', 'utf8')], ['nt', readFileSync(MHCC_DIR + 'nt', 'utf8')]]) {
  const list = chapters(text)
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    const end = list[i + 1] ? list[i + 1].start : text.length
    const bookId = ABBR_TO_ID[c.abbr]
    if (!bookId) continue
    const seg = text.slice(c.start, end).replace(/\$-\$-\$-\s*[A-Z0-9]+:\d+\s*/g, '')
    let out
    try {
      out = JSON.parse(readFileSync(`${OUT_DIR}${bookId}.json`, 'utf8'))
    } catch {
      missing.push(`${bookId} 输出文件缺失`)
      continue
    }
    const ch = out.chapters.find((x) => x.chapter === c.ch)
    if (!ch) {
      missing.push(`${bookId}:${c.ch} 输出无此章`)
      continue
    }
    // 源比对前归一：转换脚本（convert_mhcc_full.mjs）把引用标记 #ref| 保留为文本（如
    // #Mt 12:17| → Mt 12:17），源侧需同步归一，避免跨引用段的 40 字符窗口误报
    // 源比对前归一：转换脚本（convert_mhcc_full.mjs）把引用标记 #ref| 保留为文本（如
    // #Mt 12:17| → Mt 12:17），源侧需同步归一，避免跨引用段的 40 字符窗口误报。
    // 书缩写正则要求含字母（\d*[A-Za-z][A-Za-z0-9]*）：兼容 1Jo/2Ki 数字前缀缩写，
    // 同时避免误吞 #N 段标记（#31-34 的纯数字不被匹配）
    const normSeg = norm(seg).replace(/#(\d*[A-Za-z][A-Za-z0-9]*[^|]*)\|/g, '$1').replace(/#(\d+:\d+[^|]*)\|/g, '$1').replace(/#(\d+(?:[,;\-–]\s*\d+)*)\|/g, '$1')
    for (const s of ch.sections) {
      const t = norm(s.text)
      if (!t) continue
      total++
      if (!normSeg.includes(t.slice(0, 40))) {
        missing.push(`${bookId}:${c.ch} [${s.ref}] 原文无此句: ${t.slice(0, 50)}`)
      }
    }
  }
}

console.log(`转换段总数: ${total} | 原文未找到: ${missing.length}`)
if (missing.length) console.log(missing.slice(0, 30).join('\n'))
