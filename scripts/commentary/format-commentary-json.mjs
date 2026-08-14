/**
 * 统一完整版译注（data-src/brp/commentary/full/ 各源）JSON 格式为 MHCC 样式：
 *   - 2 空格缩进美化（便于人工修改/审阅）
 *   - 字段顺序统一：source{key,name,lang} → bookId → chapters[{chapter, summary, sections[{ref, heading, text}]}]
 *     （ref 在 heading 前，与简要版 MHCC 一致；heading 保留原文值，可为空）
 * 只重排字段顺序与缩进，不改动任何数据值；跳过 _report.json。
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FULL_DIR = fileURLToPath(new URL('../../data-src/brp/commentary/full/', import.meta.url))

/** 统一章节对象：{ chapter, summary, sections: [{ ref, heading, text }] } */
function fmtChapter(ch) {
  const out = { chapter: ch.chapter }
  if ('summary' in ch) out.summary = ch.summary
  out.sections = (ch.sections || []).map((s) => {
    const o = {}
    if ('ref' in s) o.ref = s.ref
    if ('heading' in s) o.heading = s.heading
    if ('text' in s) o.text = s.text
    return o
  })
  return out
}

let files = 0
for (const key of readdirSync(FULL_DIR)) {
  const dir = join(FULL_DIR, key)
  if (!statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || f === '_report.json') continue
    const p = join(dir, f)
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    const out = {
      source: { key: raw.source.key, name: raw.source.name, lang: raw.source.lang },
      bookId: raw.bookId,
      chapters: (raw.chapters || []).map(fmtChapter),
    }
    writeFileSync(p, JSON.stringify(out, null, 2) + '\n', 'utf8')
    files++
  }
}
console.log(`格式统一完成：${files} 个文件 → data-src/brp/commentary/full/（2 空格缩进，section 字段 ref 在前）`)
