/**
 * fetch-dare.mjs — 下载 DARE（Digital Atlas of the Roman Empire）素材 → 素材库（只读约定）
 *
 * 来源：klokantech/roman-empire（GitHub，CC BY 4.0，DARE gazetteer 数据）
 *   https://github.com/klokantech/roman-empire
 * 产物（素材/geography/raw/dare/）：
 *   places_medium.geojson   DARE 地点（罗马帝国全境约 2.5 万，medium 精度层）
 *   LICENSE.md              许可说明
 *（provinces.geojson 罗马行省已随行政区划删除停用；fortifications.geojson、
 *  roads_high.geojson 均无构建消费，不再下载）
 *
 * 若下载失败：如实输出错误并退出码 0（降级，不阻断数据管线；构建脚本按文件存在性降级）
 *
 * 用法：node scripts/geography/fetch-dare.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT_DIR = fileURLToPath(new URL('../../../素材/geography/raw/dare', import.meta.url))
const BASE = 'https://raw.githubusercontent.com/klokantech/roman-empire/master/data/'
const FILES = ['places_medium.geojson']

mkdirSync(OUT_DIR, { recursive: true })
let ok = 0
for (const f of FILES) {
  const url = BASE + f
  try {
    const resp = await fetch(url, { redirect: 'follow' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = Buffer.from(await resp.arrayBuffer())
    if (buf.length < 10000) throw new Error(`体积异常 ${buf.length}B`)
    writeFileSync(OUT_DIR + '/' + f, buf)
    ok++
    console.log(`[dare] ${f} → ${(buf.length / 1024 / 1024).toFixed(1)} MB`)
  } catch (e) {
    console.warn(`[dare] ${f} 下载失败：${e?.message || e}`)
  }
}
writeFileSync(
  OUT_DIR + '/LICENSE.md',
  'DARE (Digital Atlas of the Roman Empire) 数据，来自 klokantech/roman-empire（GitHub）。\n' +
  '许可：CC BY 4.0（归属 Digital Atlas of the Roman Empire / Johan Åhlfeldt）\n' +
  '来源：https://github.com/klokantech/roman-empire · https://imperium.ahlfeldt.se\n'
)
console.log(`[dare] 完成：${ok}/${FILES.length} 个文件${ok === FILES.length ? '' : '（罗马时期层将降级）'}`)
