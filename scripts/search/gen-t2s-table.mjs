/**
 * gen-t2s-table.mjs — 从 OpenCC TSCharacters.txt 生成繁→简映射模块
 *
 * 数据源：OpenCC t2s 单字字典（Apache-2.0，https://github.com/BYVoid/OpenCC）
 * 一对多时取第一候选（简体语境下最常用形态）。
 * 输出：src/lib/t2s-table.mjs（机器生成，勿手改；重跑本脚本再生成）
 *
 * 用法：curl.exe -sL https://raw.githubusercontent.com/BYVoid/OpenCC/master/data/dictionary/TSCharacters.txt -o %TEMP%\TSCharacters.txt
 *       node scripts/search/gen-t2s-table.mjs %TEMP%\TSCharacters.txt
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const src = process.argv[2]
if (!src || !fs.existsSync(src)) {
  console.error('用法：node scripts/search/gen-t2s-table.mjs <TSCharacters.txt 路径>')
  process.exit(1)
}

const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/)
const pairs = []
for (const line of lines) {
  if (!line || line.startsWith('#')) continue
  const [trad, cands] = line.split('\t')
  if (!trad || !cands) continue
  const simp = cands.trim().split(/\s+/)[0]
  if (!simp || trad === simp) continue
  if ([...trad].length !== 1 || [...simp].length !== 1) continue // 只收单字对
  pairs.push([trad, simp])
}

const out = `/* eslint-disable */
/**
 * t2s-table.mjs — 繁→简单字映射（机器生成，勿手改）
 *
 * 生成：scripts/search/gen-t2s-table.mjs
 * 数据：OpenCC TSCharacters.txt（Apache-2.0，https://github.com/BYVoid/OpenCC）
 * 规则：一对多取第一候选；仅用于检索匹配域归一化，不用于内容显示。
 * 共 ${pairs.length} 对。
 */
export const T2S = new Map(${JSON.stringify(pairs)})
`

const dest = path.join(root, 'src/lib/t2s-table.mjs')
fs.writeFileSync(dest, out)
console.log(`生成 ${dest}：${pairs.length} 对（${(fs.statSync(dest).size / 1024).toFixed(1)}KB）`)
