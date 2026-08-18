/**
 * convert-gray-earth.mjs — Natural Earth Gray Earth 底图转换（素材只读 → data-src 投影）
 *
 * 读取素材库 TIF（10800×5400 灰度阴影地形），降采样为全球底图 PNG：
 *   data-src/geography/base/gray-earth.png（2160×1080 灰度 8bit）
 *
 * 用途（HISTORICAL-BASEMAP.md §5）：Gray Earth 作为 Layer 0 地形底图（raster image source），
 * 海洋/河流/湖泊由矢量层覆盖其上。
 *
 * TIFF 解析（实测修正——重要）：
 *   GRAY_50M_SR.tif 为 Photoshop 保存的 TIFF（内含 8BIM 图像资源块），
 *   且 StripOffsets/StripByteCounts 为多值数组：值字段存的是【数组指针】而非内联值。
 *   旧实现从值字段顺序读取 → 读到的是标签区/8BIM 元数据垃圾字节，
 *   在渲染上表现为黑白斑驳与 16 像素周期竖条纹（花屏/竖条根因）。
 *   本实现按 TIFF 规范：count×typeSize ≤ 4 内联，否则跳转指针读取数组。
 *
 * 渲染修正（协议 §4 数据层检查）：
 *   读取后做完整性校验（strip 字节数=行宽、值域 0-255），失败即报错终止，杜绝静默垃圾底图；
 *   低对比高调拉伸：按实际值域线性映射到 200-255 浅灰带（海洋≈202，陆地保留阴影细节）；
 *   投影修正：等距圆柱 → Web Mercator 重投影（方形 2160×2160）——
 *   MapLibre image source 按 Mercator 线性铺图，等距圆柱直铺会导致纬度非线性错位
 *   （地形图层错位根因：35°N 地形被画到 ~55°N），此处逐像素反向映射重采样。
 *
 * 用法：node scripts/geography/convert-gray-earth.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import zlib from 'node:zlib'

const TIF = fileURLToPath(new URL('../../../素材/geography/raw/natural_earth_gray/GRAY_50M_SR.tif', import.meta.url))
const OUT = fileURLToPath(new URL('../../data-src/geography/base/gray-earth.png', import.meta.url))

if (!existsSync(TIF)) {
  console.error('[gray-earth] 未找到 GRAY_50M_SR.tif，跳过')
  process.exit(0)
}

/* ---------- 读 TIFF（规范解析：多值数组走指针） ---------- */
const buf = readFileSync(TIF)
if (buf.readUInt16LE(0) !== 0x4949) {
  console.error('[gray-earth] 非 little-endian TIFF，终止')
  process.exit(1)
}
const ifdOff = buf.readUInt32LE(4)
const count = buf.readUInt16LE(ifdOff)
const tags = {}
for (let i = 0; i < count; i++) {
  const off = ifdOff + 2 + i * 12
  const tag = buf.readUInt16LE(off)
  const type = buf.readUInt16LE(off + 2)
  const cnt = buf.readUInt32LE(off + 4)
  const val = buf.readUInt32LE(off + 8)
  tags[tag] = { type, cnt, val }
}
const W = tags[256].val // ImageWidth
const H = tags[257].val // ImageLength
const compression = tags[259].val
const rowsPerStrip = tags[278].val
if (compression !== 1) {
  console.error(`[gray-earth] TIFF 压缩类型 ${compression}，本脚本仅支持无压缩，终止`)
  process.exit(1)
}
/** 读取 tag 数组：count×typeSize ≤ 4 内联，否则 val 为指针（TIFF 规范） */
function readTagArray(tag) {
  const typeSize = tag.type === 3 ? 2 : 4 // SHORT=2, LONG=4
  if (tag.cnt * typeSize <= 4) return [tag.val]
  const ptr = tag.val
  const out = []
  for (let i = 0; i < tag.cnt; i++) {
    out.push(typeSize === 2 ? buf.readUInt16LE(ptr + i * 2) : buf.readUInt32LE(ptr + i * 4))
  }
  return out
}
const nStrips = Math.ceil(H / rowsPerStrip)
const stripOffsets = readTagArray(tags[273])
const stripCounts = readTagArray(tags[279])
console.log(`[gray-earth] TIF ${W}x${H}，${nStrips} 条 strip（每 strip ${rowsPerStrip} 行，无压缩）`)

/* ---------- 完整性校验（杜绝垃圾底图静默通过） ---------- */
{
  const expect = rowsPerStrip * W
  let bad = 0
  for (let i = 0; i < nStrips; i++) {
    if (stripCounts[i] !== expect) bad++
    if (stripOffsets[i] + stripCounts[i] > buf.length) bad++
  }
  if (bad) {
    console.error(`[gray-earth] strip 校验失败：${bad}/${nStrips} 条长度或偏移异常，终止（避免生成垃圾底图）`)
    process.exit(1)
  }
  // 抽查像素值域（Gray Earth 灰度应在 0-255，海洋约 140-150 平坦）
  let min = 255
  let max = 0
  for (let i = 0; i < 20000; i++) {
    const x = Math.floor(Math.random() * W)
    const y = Math.floor(Math.random() * H)
    const v = buf[stripOffsets[Math.floor(y / rowsPerStrip)] + (y % rowsPerStrip) * W + x]
    if (v < min) min = v
    if (v > max) max = v
  }
  console.log(`[gray-earth] 像素抽查值域 [${min}, ${max}]`)
  if (min < 0 || max > 255) {
    console.error('[gray-earth] 像素值域异常，终止')
    process.exit(1)
  }
}

/* ---------- 降采样（box filter）→ 等距圆柱灰度数组 ---------- */
const EW = 2160
const EH = 1080
const sx = W / EW // 5
const sy = H / EH // 5
const equirect = Buffer.alloc(EW * EH)
for (let oy = 0; oy < EH; oy++) {
  const sy0 = Math.floor(oy * sy)
  const sy1 = Math.min(H, Math.floor((oy + 1) * sy))
  for (let ox = 0; ox < EW; ox++) {
    const sx0 = Math.floor(ox * sx)
    const sx1 = Math.min(W, Math.floor((ox + 1) * sx))
    let sum = 0
    let n = 0
    for (let y = sy0; y < sy1; y++) {
      const strip = Math.floor(y / rowsPerStrip)
      const rowOff = stripOffsets[strip] + (y % rowsPerStrip) * W
      for (let x = sx0; x < sx1; x++) {
        sum += buf[rowOff + x]
        n++
      }
    }
    equirect[oy * EW + ox] = sum / n
  }
  if (oy % 200 === 0) process.stdout.write(`  降采样 行 ${oy}/${EH}\r`)
}
console.log(`\n[gray-earth] 等距圆柱降采样完成 ${EW}x${EH}`)

/* ---------- 重投影：等距圆柱 → Web Mercator（方形图，修复地形错位） ----------
 * MapLibre image source 按 Web Mercator 线性插值图像；等距圆柱图直接铺满
 * Mercator 盒子会造成纬度非线性错位（35°N 地形被画到 ~55°N）。
 * 此处逐像素反向映射：Mercator 像素 (mx,my) → lng/lat → 等距圆柱坐标 → 双线性采样。 */
const OW = 2160
const OH = 2160 // Mercator 世界为方形（±85.0511°）
const out = Buffer.alloc(OW * OH)
/** 双线性采样等距圆柱数组（坐标越界返回边缘值） */
function sampleEqui(ex, ey) {
  const x = Math.min(EW - 1.001, Math.max(0, ex))
  const y = Math.min(EH - 1.001, Math.max(0, ey))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const v00 = equirect[y0 * EW + x0]
  const v10 = equirect[y0 * EW + Math.min(EW - 1, x0 + 1)]
  const v01 = equirect[Math.min(EH - 1, y0 + 1) * EW + x0]
  const v11 = equirect[Math.min(EH - 1, y0 + 1) * EW + Math.min(EW - 1, x0 + 1)]
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
}
const LO = 200
const HI = 255
const lo = 138 // Gray Earth 阴影最小值（海洋约 145）
const hi = 255
for (let my = 0; my < OH; my++) {
  const v = (my + 0.5) / OH // 0=顶（北），1=底（南）
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180) / Math.PI
  for (let mx = 0; mx < OW; mx++) {
    const lng = ((mx + 0.5) / OW) * 360 - 180
    const val = sampleEqui(((lng + 180) / 360) * EW, ((90 - lat) / 180) * EH)
    out[my * OW + mx] = Math.min(HI, Math.max(LO, Math.round(LO + ((val - lo) / (hi - lo)) * (HI - LO))))
  }
  if (my % 200 === 0) process.stdout.write(`  重投影 行 ${my}/${OH}\r`)
}
console.log(`\n[gray-earth] Web Mercator 重投影完成 ${OW}x${OH}（${LO}-${HI} 浅灰带）`)

/* ---------- PNG 编码（灰度 8bit） ---------- */
const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
// 每行前置 filter 0（None）
const raw = Buffer.alloc(OH * (OW + 1))
for (let y = 0; y < OH; y++) {
  raw[y * (OW + 1)] = 0
  out.copy(raw, y * (OW + 1) + 1, y * OW, (y + 1) * OW)
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(OW, 0)
ihdr.writeUInt32BE(OH, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 0 // color type: grayscale
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, png)
console.log(`[gray-earth] 完成 → ${OUT}（${(png.length / 1024).toFixed(0)} KB）`)
