/**
 * fetch-pleiades.mjs — 下载 Pleiades 官方数据 → 素材库（只读约定）
 *
 * 来源：Pleiades（isawnyu/pleiades.datasets），CC BY 4.0
 *   places.csv    ← dumps 包（https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz）
 *                  含 minDate / maxDate（带符号整数年，无 0 年）——构建期 existence 窗口数据源
 *   location_points.csv / names.csv / places_place_types.csv
 *                 ← GIS 包（https://atlantides.org/downloads/pleiades/gis/pleiades_gis_data.zip）
 *                  （同属 2026-08-17 日更，列兼容才替换）
 *
 * 产物（素材/geography/raw/places/）：
 *   places.csv / location_points.csv / names.csv / places_place_types.csv
 *   legacy-2021/          旧版（2021-11-14 导出，无时间列）归档，保留溯源
 *   README-来源.md        下载记录
 *
 * 若下载/解压失败：如实输出错误并退出码 0（降级，构建脚本按文件存在性降级）
 *
 * 用法：node scripts/geography/fetch-pleiades.mjs
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync, inflateRawSync } from 'node:zlib'

const OUT_DIR = fileURLToPath(new URL('../../../素材/geography/raw/places', import.meta.url))
const DUMPS_URL = 'https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz'
const GIS_ZIP_URL = 'https://atlantides.org/downloads/pleiades/gis/pleiades_gis_data.zip'
const LEGACY_DIR = OUT_DIR + '/legacy-2021'
const GIS_TARGETS = ['location_points.csv', 'names.csv', 'places_place_types.csv']

/** 最小 ZIP 解压（DEFLATE/STORE；按 basename 从中央目录提取指定文件） */
function extractZip(buf, wanted) {
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('非 ZIP 文件（找不到 EOCD）')
  const cdCount = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const out = new Map()
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    const nlen = buf.readUInt16LE(localOff + 26)
    const elen = buf.readUInt16LE(localOff + 28)
    const data = buf.subarray(localOff + 30 + nlen + elen, localOff + 30 + nlen + elen + compSize)
    const base = name.slice(name.lastIndexOf('/') + 1)
    if (wanted.includes(base)) {
      out.set(base, method === 8 ? inflateRawSync(data) : method === 0 ? data : null)
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** CSV 表头存在性检查（构建脚本读取的必需列） */
const REQUIRED_COLS = {
  'places.csv': ['id', 'title', 'reprLat', 'reprLong', 'minDate', 'maxDate'],
  'location_points.csv': ['place_id', 'geometry_wkt', 'accuracy_radius'],
  'names.csv': ['place_id', 'attested_form', 'romanized_form_1', 'year_after_which', 'year_before_which'],
  'places_place_types.csv': ['place_id', 'place_type'],
}
const csvCols = (buf) => buf.toString('utf8', 0, 8192).split('\n')[0].split(',').map((s) => s.trim().replace(/^\uFEFF/, ''))

mkdirSync(OUT_DIR, { recursive: true })
let ok = 0

// 1. places.csv ← dumps 包（含 minDate/maxDate）
try {
  const resp = await fetch(DUMPS_URL, { redirect: 'follow' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const gz = Buffer.from(await resp.arrayBuffer())
  const buf = gunzipSync(gz)
  if (buf.length < 100000) throw new Error(`解压体积异常 ${buf.length}B`)
  const missing = REQUIRED_COLS['places.csv'].filter((c) => !csvCols(buf).includes(c))
  if (missing.length) throw new Error(`缺列 ${missing.join(',')}`)
  writeFileSync(OUT_DIR + '/places.csv', buf)
  ok++
  console.log(`[pleiades] places.csv ← dumps（${(buf.length / 1024 / 1024).toFixed(1)} MB，含 minDate/maxDate）`)
} catch (e) {
  console.warn(`[pleiades] places.csv 下载失败：${e?.message || e}（保留现有素材）`)
}

// 2. 其余 CSV ← GIS 包（列兼容才替换）
try {
  const resp = await fetch(GIS_ZIP_URL, { redirect: 'follow' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const zipBuf = Buffer.from(await resp.arrayBuffer())
  const files = extractZip(zipBuf, GIS_TARGETS)
  for (const f of GIS_TARGETS) {
    const buf = files.get(f)
    if (!buf) { console.warn(`[pleiades] ${f} 不在 GIS 包中，保留旧版`); continue }
    const missing = REQUIRED_COLS[f].filter((c) => !csvCols(buf).includes(c))
    if (missing.length) { console.warn(`[pleiades] ${f} 缺列 ${missing.join(',')}——保留旧版`); continue }
    writeFileSync(OUT_DIR + '/' + f, buf)
    ok++
    console.log(`[pleiades] ${f} → ${(buf.length / 1024 / 1024).toFixed(1)} MB（列齐全）`)
  }
} catch (e) {
  console.warn(`[pleiades] GIS 包下载失败：${e?.message || e}（保留现有素材）`)
}

// 3. 旧版归档（首次运行；在成功替换至少一个文件后执行）
if (ok > 0 && !existsSync(LEGACY_DIR)) {
  mkdirSync(LEGACY_DIR, { recursive: true })
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.csv')) renameSync(OUT_DIR + '/' + f, LEGACY_DIR + '/' + f)
  }
  console.log(`[pleiades] 旧版 CSV 已归档 → places/legacy-2021/`)
}

writeFileSync(
  OUT_DIR + '/README-来源.md',
  '# Pleiades 素材来源记录\n\n' +
  '来源：Pleiades（Ancient World Mapping Center / Institute for the Study of the Ancient World），' +
  'https://pleiades.stoa.org · 下载页 https://pleiades.stoa.org/downloads\n' +
  'places.csv：dumps 包（https://atlantides.org/downloads/pleiades/dumps/pleiades-places-latest.csv.gz）——' +
  '含 minDate/maxDate（带符号整数年，无 0 年，proleptic Julian 历）\n' +
  '其余 CSV：GIS 包（https://atlantides.org/downloads/pleiades/gis/pleiades_gis_data.zip）\n' +
  `下载日期：${new Date().toISOString().slice(0, 10)}\n` +
  '许可：CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）\n' +
  '说明：existence 窗口来源链 = curated（place-eras 特例）> Pleiades minDate/maxDate 数值年 > 类型启发式默认。\n' +
  '旧版（2021-11-14 导出，无时间列）归档于 legacy-2021/。\n'
)
console.log(`[pleiades] 完成：${ok} 个文件更新（来源记录已写）`)
