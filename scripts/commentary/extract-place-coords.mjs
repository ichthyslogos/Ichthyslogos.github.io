/**
 * extract-place-coords.mjs — 从 TIPNR 源文件提取地点经纬度 + 分类（一次性生成）
 *
 * 本地增强版 TIPNR.txt 的 Place 主行带 Google Maps 坐标链接（col4）与摘要描述（col7）：
 *   Abana@2Ki.5.12=H0071 \t Abana \t \t \t https://www.google.com/maps/@33.545097,36.224661,14z \t ... \t > \t #Summary \t Place
 * 输出 → data-src/brp/commentary/notes/tipnr/place-coords.json：
 *   { source, count, coords: { "<词条名>": { lat, lng, cat } } }
 * cat 为地点分类（地图图例用，12 类）：
 *   city 城市 / village 村庄 / capital 首都 / region 地区 / nation 国家·民族区域 /
 *   mountain 山 / range 山脉 / river 河流 / water 湖·海 / desert 沙漠 / coast 海岸 / island 岛屿
 * 分类方法：核心表（首都/国家/地区/村庄等明确地点）优先，其余按描述关键词规则，兜底 city。
 *
 * 用法：node scripts/commentary/extract-place-coords.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../../../素材/stepbible-tipnr/TIPNR.txt', import.meta.url))
const OUT = fileURLToPath(new URL('../../data-src/brp/commentary/notes/tipnr/place-coords.json', import.meta.url))

if (!existsSync(SRC)) {
  console.error('[place-coords] 未找到 TIPNR.txt，跳过')
  process.exit(0)
}

/** 核心表：明确分类的地点（TIPNR 词条名；覆盖/优先于规则） */
const OVERRIDES = {
  // 首都
  Jerusalem: 'capital', Samaria: 'capital', Damascus: 'capital', Babylon: 'capital',
  Nineveh: 'capital', Thebes: 'capital', Susa: 'capital', Ecbatana: 'capital',
  Memphis: 'capital', Carchemish: 'capital', Hamath: 'capital',
  // 村庄（示例：伯大尼、以马忞斯）
  Bethany: 'village', Emmaus: 'village', Nain: 'village', Cana: 'village',
  Bethphage: 'village', Ramah: 'village', Michmash: 'village', Shunem: 'village',
  // 国家 / 民族区域（示例：埃及、亚述、巴比伦）
  Egypt: 'nation', Assyria: 'nation', Media: 'nation', Persia: 'nation',
  Moab: 'nation', Edom: 'nation', Ammon: 'nation', Philistia: 'nation',
  Syria: 'nation', Aram: 'nation', Greece: 'nation', Rome: 'nation',
  Ethiopia: 'nation', Arabia: 'nation', Cush: 'nation', Elam: 'nation',
  Scythia: 'nation', Lycia: 'nation', Lydia: 'nation', Macedonia: 'nation',
  'Asia Minor': 'nation', Phoenicia: 'nation', Canaan: 'nation', Egypt_: 'nation',
  // 地区（示例：加利利、犹太、撒玛利亚）
  Galilee: 'region', Judea: 'region', Perea: 'region', Decapolis: 'region',
  Bashan: 'region', Gilead: 'region', Idumea: 'region', Judah: 'region',
  Negeb: 'region', Arabah: 'region', Sharon: 'region', Goshen: 'region',
  Ituraea: 'region', Trachonitis: 'region', Samaria_region: 'region',
  // 山脉（示例：黎巴嫩山脉）
  Lebanon: 'range', Antilebanon: 'range',
  // 河流（示例：约旦河、幼发拉底河）
  Jordan: 'river', Euphrates: 'river', Tigris: 'river', Nile: 'river',
  Abana: 'river', Pharpar: 'river', Kishon: 'river', Jabbok: 'river',
  Arnon: 'river', Kidron: 'river', Cherith: 'river', Besor: 'river',
  Ahava: 'river', Chebar: 'river', Ulai: 'river', Pishon: 'river', Gihon: 'river',
  // 湖 / 海
  'Sea of Galilee': 'water', 'Dead Sea': 'water', 'Mediterranean Sea': 'water',
  'Red Sea': 'water', 'Great Sea': 'water', 'Salt Sea': 'water', 'Sea of Chinnereth': 'water',
  // 沙漠（示例：犹大旷野、西奈旷野）
  'Wilderness of Judah': 'desert', 'Wilderness of Sinai': 'desert', 'Wilderness of Shur': 'desert',
  'Wilderness of Paran': 'desert', 'Wilderness of Zin': 'desert', 'Wilderness of Sin': 'desert',
  'Wilderness of Etham': 'desert', 'Wilderness of Beersheba': 'desert',
  // 山（示例：西奈山、橄榄山）
  Sinai: 'mountain', 'Mount of Olives': 'mountain', Nebo: 'mountain', Pisgah: 'mountain',
  Carmel: 'mountain', Tabor: 'mountain', Gerizim: 'mountain', Ebal: 'mountain',
  Hermon: 'mountain', Moriah: 'mountain', Zion: 'mountain', Hor: 'mountain',
  Ararat: 'mountain', Gilboa: 'mountain', Ephraim_mountain: 'mountain',
  // 岛屿（示例：塞浦路斯、革哩底）
  Cyprus: 'island', Crete: 'island', Rhodes: 'island', Patmos: 'island',
  Chios: 'island', Samos: 'island', Melita: 'island', Caphtor: 'island',
  // 海域（使徒行传 27:17 锡德拉湾浅滩，类别修正）
  Syrtis: 'water',
}

/** 坐标修正表：TIPNR 源坐标有明显问题的词条（名称 → 修正后坐标）。
 * 修正前均对照经文章节语境与主流圣经地图集核实。 */
const COORD_FIXES = {
  // Suph / Suphah：源数据给红海（yam suph「芦苇海」词源关联），但申命记 1:1「约旦河东的旷野，
  // 对着苏弗」与民数记 21:14（亚嫩河谷诗歌语境）均指向约旦河东摩押平原一带 → 移至摩押北部。
  Suph: { lat: 31.9, lng: 35.8 },
  Suphah: { lat: 31.9, lng: 35.8 },
  // Forest_Ephraim（撒下 18:6 以法莲树林，约旦河东基列）：源数据 lat/lng 写反
  //（35.76,32.38 指向黎巴嫩沿海）→ 反转修正。
  Forest_Ephraim: { lat: 32.381111, lng: 35.764722 },
}

/** 描述关键词规则（顺序即优先级；文本 = 名称 + 摘要小写） */
const RULES = [
  [/island|isle/, 'island'],
  [/mountain range|mountains|highland/, 'range'],
  [/\bmountain\b|mount\b|mountainous/, 'mountain'],
  [/\briver\b|brook|wadi|stream/, 'river'],
  [/\bsea\b|\blake\b/, 'water'],
  [/desert|wilderness/, 'desert'],
  [/coast|seashore|shoreline/, 'coast'],
  [/capital/, 'capital'],
  [/nation|empire|kingdom of|land of|country/, 'nation'],
  [/region|district|territory|valley|plain|plateau|area/, 'region'],
  [/village|town\b/, 'village'],
]

function classify(name, desc) {
  const t = `${name} ${desc}`.toLowerCase()
  for (const [re, cat] of RULES) {
    if (re.test(t)) return cat
  }
  return 'city'
}

const text = readFileSync(SRC, 'utf8')
const coords = {}
const missing = [] // Place 行但坐标缺失/无法解析
const dup = []

const MAPS_RE = /\/maps\/@(-?[\d.]+),(-?[\d.]+),\d+z/

for (const line of text.split('\n')) {
  if (!line || line.startsWith('$') || line.startsWith('–') || line.startsWith('- ')) continue
  const cols = line.split('\t')
  if (cols.length < 9) continue
  const m = cols[0].match(/^([^@]+)@/)
  if (!m) continue
  const name = m[1]
  const type = (cols[8] || '').trim()
  if (type !== 'Place') continue
  const mc = (cols[4] || '').match(MAPS_RE)
  if (mc) {
    const lat = Number(mc[1])
    const lng = Number(mc[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
      const cat = OVERRIDES[name] || classify(name, cols[7] || '')
      if (coords[name]) dup.push(name)
      else coords[name] = { lat, lng, cat }
      continue
    }
  }
  missing.push(name)
}

// 应用坐标修正（覆盖源数据明显错误的坐标）
for (const [name, fix] of Object.entries(COORD_FIXES)) {
  if (coords[name]) Object.assign(coords[name], fix)
}

const out = {
  source: { key: 'tipnr', name: 'STEP 专有名词注释 (TIPNR)', lang: 'en' },
  count: Object.keys(coords).length,
  coords,
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')

const byCat = {}
for (const c of Object.values(coords)) byCat[c.cat] = (byCat[c.cat] || 0) + 1
console.log(`[place-coords] ${Object.keys(coords).length} 个地点坐标（缺失 ${missing.length}）`)
console.log(`[place-coords] 分类分布: ${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(' ')}`)
console.log(`[place-coords] 样本: ${JSON.stringify(Object.entries(coords).slice(0, 4))}`)
if (missing.length) console.log(`[place-coords] 缺失坐标: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`)
console.log(`[place-coords] 输出 -> data-src/brp/commentary/notes/tipnr/place-coords.json`)
