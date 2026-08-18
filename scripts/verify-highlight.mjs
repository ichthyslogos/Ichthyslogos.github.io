/**
 * verify-highlight.mjs — 注释文本级高亮全量校验（普查，非抽查）
 *
 * 判定口径与前端 VerseItem 一致（2026-08-15 起无 Strong 词数据，纯文本子串匹配）：
 *   - 词条 refs 指向的节：经文文本（和合本简体 chiuns）含词条中文名（zh-names）
 *     或变体（name-variants）→ 命中
 *   - 多字名/变体：子串匹配；单字变体（「主」「坑」）走词边界匹配（与前端 matchAt 一致）
 * 统计：
 *   - 少划（under）：词条 refs 节中文本无任何词条名/变体命中
 *   - 变体命中（varHits）：因 name-variants 新增的命中
 * 用法：node scripts/verify-highlight.mjs [--detail]
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = path.resolve('public/data/brp')
const TRANS_DIR = path.join(BASE, 'translations/chiuns/books')
const notesDir = path.join(BASE, 'commentary/notes/tipnr/books')
const zhNames = JSON.parse(fs.readFileSync(path.join(BASE, 'commentary/notes/tipnr/zh-names.json'), 'utf8'))
const variants = JSON.parse(fs.readFileSync(path.join(BASE, 'commentary/notes/tipnr/name-variants.json'), 'utf8'))

/** 归一化 Strong 码：H0085 → H85；H6160G → H6160；与前端一致 */
const normCode = (code) => {
  const m = String(code).match(/^([HG])0*(\d+)/)
  return m ? m[1] + m[2] : ''
}

/** 单字变体词边界（与 VerseItem 一致：Jesus/LORD 的「主」不划「财主」，Sheol 的「坑」词边界） */
const SINGLE_SUFFIX = {
  '主': ['啊', '呀', '哪', '的', '呢', '着', '罢', '么'],
  '坑': ['中', '里', '内', '下', '的'],
}
const SINGLE_PREFIX = {
  '主': ['的', '前'],
  '坑': ['的', '于', '下', '上', '入'],
}
const isBoundary = (c) => !c || /[，。、；：？！「」『』（）"'“”‘’·…—\s]/.test(c)
const matchAt = (text, idx, nm) => {
  if ([...nm].length > 1) return true
  const pre = text[idx - 1] || ''
  const suf = text.slice(idx + 1, idx + 3) || ''
  const headOk = isBoundary(pre) || (SINGLE_PREFIX[nm] || []).some((p) => pre.endsWith(p))
  if (!headOk) return false
  if (!suf || isBoundary(suf[0])) return true
  const sufList = SINGLE_SUFFIX[nm] || []
  return sufList.some((s) => suf.startsWith(s))
}

/** 节文本是否命中任一词条名/变体（与前端 segments 一致：多字子串 / 单字边界） */
function textHit(text, names) {
  for (const n of names) {
    const list = n.nameZh ? [n.nameZh, ...(n.variants || [])] : [...(n.variants || [])]
    for (const nm of list) {
      if (!nm) continue
      if ([...nm].length > 1) {
        if (text.includes(nm)) return { viaVariant: n.variants?.includes(nm), matched: nm }
      } else {
        for (let i = 0; i < text.length; i++) {
          if (text[i] === nm && matchAt(text, i, nm)) return { viaVariant: true, matched: nm }
        }
      }
    }
  }
  return null
}

const under = [] // 少划：词条-节对（文本无任何命中）
const varHits = [] // 变体命中样本
let totalRefs = 0
let hits = 0
let varHitCount = 0

for (let i = 1; i <= 66; i++) {
  const id = String(i).padStart(2, '0')
  let trans, notes
  try {
    trans = JSON.parse(fs.readFileSync(path.join(TRANS_DIR, `${id}.json`), 'utf8'))
    notes = JSON.parse(fs.readFileSync(path.join(notesDir, `${id}.json`), 'utf8'))
  } catch {
    continue
  }
  const tChs = new Map(trans.book.chapters.map((c) => [c.chapter, c]))
  for (const nch of notes.chapters || []) {
    const tch = tChs.get(nch.chapter)
    if (!tch) continue
    const verses = new Map(tch.verses.map((v) => [v.verse, v]))
    for (const e of nch.entries || []) {
      const eNorm = e.strong ? normCode(e.strong) : ''
      const eZh = zhNames[eNorm] || ''
      const eVar = variants[e.name] || []
      const names = [{ nameZh: eZh, variants: eVar }]
      for (const rv of e.refs || []) {
        totalRefs++
        const v = verses.get(Number(rv))
        if (!v) continue
        const hit = textHit(v.text || '', names)
        if (hit) {
          hits++
          if (hit.viaVariant) {
            varHitCount++
            if (varHits.length < 1000) varHits.push({ ref: `${id}:${nch.chapter}:${rv}`, name: e.name, zh: eZh, matched: hit.matched })
          }
        } else {
          under.push({ ref: `${id}:${nch.chapter}:${rv}`, name: e.name, zh: eZh || e.name, text: (v.text || '').slice(0, 60) })
        }
      }
    }
  }
}

// —— 输出 ——
console.log(`词条-节引用对总数：${totalRefs}`)
console.log(`命中：${hits}（${(hits / totalRefs * 100).toFixed(2)}%） 少划：${under.length}（${((totalRefs - hits) / totalRefs * 100).toFixed(2)}%）`)
console.log(`其中变体新增命中：${varHitCount} 条`)
console.log('')
console.log('== 变体命中样本（前 20） ==')
for (const h of varHits.slice(0, 20)) console.log(`  ${h.ref} [${h.name}] zh:${h.zh} 匹配词:${h.matched}`)
console.log('')
console.log(`== 少划明细（${under.length} 条） ==`)
for (const u of under) console.log(`${u.ref} [${u.name}] zh:${u.zh} 文本:[${u.text}...]`)
