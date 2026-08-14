/**
 * 扫描 MHCC 转换结果是否残留下一章内容：
 * 对每章，把 RawCom 中「下一章开头 60 字符」（norm 后）拿去本章 summary / 末段文本中查找。
 * 命中 = 跨章残留（转换 bug）。
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

let checked = 0
const hits = []

for (const [file, text] of [['ot', readFileSync(MHCC_DIR + 'ot', 'utf8')], ['nt', readFileSync(MHCC_DIR + 'nt', 'utf8')]]) {
  const list = chapters(text)
  for (let i = 0; i < list.length - 1; i++) {
    const c = list[i]
    const next = list[i + 1]
    const bookId = ABBR_TO_ID[c.abbr]
    if (!bookId) continue
    const nextSeg = text.slice(next.start, next.start + 400).replace(/\$-\$-\$-\s*[A-Z0-9]+:\d+\s*/, '')
    const nextHead = norm(nextSeg).slice(0, 60)
    if (!nextHead) continue
    let out
    try {
      out = JSON.parse(readFileSync(`${OUT_DIR}${bookId}.json`, 'utf8'))
    } catch {
      continue
    }
    const ch = out.chapters.find((x) => x.chapter === c.ch)
    if (!ch) continue
    checked++
    const tailTexts = [
      `summary:${ch.summary || ''}`,
      ...(ch.sections || []).map((s, si) => `sec${si}[${s.ref}]:${s.text || ''}`),
    ]
    for (const t of tailTexts) {
      const normT = norm(t)
      if (normT.includes(nextHead.slice(0, 30))) {
        hits.push(`${bookId}:${c.ch} ${t.split(':')[0]} 含下一章开头: ${nextHead.slice(0, 50)}`)
      }
    }
  }
}

console.log(`检查章数: ${checked} | 跨章残留: ${hits.length}`)
if (hits.length) console.log(hits.slice(0, 40).join('\n'))
