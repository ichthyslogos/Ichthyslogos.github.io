<script setup>
/**
 * MapLibreMap — 圣经历史地图（MapLibre GL JS + Vector Tile）
 *
 * 地图标签核心规则（MAP LABEL ENGINE）：
 *   Entity Never Hide, Label May Move.
 *   实体永不因标签碰撞而隐藏；标签允许自动重新定位。
 * 实现：符号层（dot）碰撞剔除（同坐标多实体只显一个 ●，控制蚂蚁堆）；
 * 名称层（label）text-variable-anchor 在 8 个锚点间自动避让（屏幕空间
 * bounding box 软碰撞）——同坐标多名字（Jerusalem/Jebus/Aelia Capitolina…）
 * 扇形展开全部显示，文字绝不重叠。
 *
 * 技术栈（重建方案 v2）：MapLibre GL JS 6 + 本地 Vector Tile（GeoJSON 直连仅底图与旅程线）
 *   底图  Gray Earth 栅格（image source）+ NE 自然层 GeoJSON（海洋/河流/湖泊）
 *   国家  tiles/territories/<period>/   Cliopatria（时间轴切换瓦片集）
 *   城市  tiles/cities/<period>/        Pleiades + STEP + DARE（各时期显示当时名称；LOD 预裁剪瓦片）
 *   城区  tiles/urban/<period>/         AWMC urban_areas
 *   路线  旅程 GeoJSON（UBS MARBLE，confidence 三层样式）
 *
 * 图层顺序（HISTORICAL-BASEMAP.md §8）：
 *   bg → base-gray → base-ocean/rivers/lakes → territory-fill/line →
 *   routes → urban → pleiades-dot/label → cities-dot/label → focus-places（brp 聚焦覆盖层，最上）
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import maplibregl from 'maplibre-gl' // v5 UMD 构建：default = 命名空间（Map/NavigationControl/Popup…）
import 'maplibre-gl/dist/maplibre-gl.css'
import { fetchBaseLayer } from '../../lib/data.js'

const props = defineProps({
  visibleCats: { type: Set, default: () => new Set() }, // 当前显示的地点分类（图例切换）
  journeys: { type: Array, default: () => [] }, // 旅程列表（journeys.json）
  geometries: { type: Object, default: () => ({}) }, // geometry_id → [[lng,lat],...]
  activeJourneyId: { type: String, default: '' },
  activePeriodId: { type: String, default: null }, // 当前时期（瓦片集切换；null = 全部）
  /** 聚焦地点（brp 地图抽屉的本章地点）[{ name, lat, lng, cat }]：
   *  覆盖层常显，不受 CAT_ZOOM_GATE/瓦片 LOD 裁剪影响——地点被 zoom 隐藏时依然可见 */
  focusPlaces: { type: Array, default: () => [] },
  activeFocusName: { type: String, default: '' }, // 选中聚焦地点（金色放大 + flyTo 定位）
})
const emit = defineEmits(['territories', 'select-focus'])

/** 瓦片根路径（协议 §6：tiles/{layer}/{period}/{z}/{x}/{y}.pbf）
 *  绝对化：maplibre 内部 new Request(相对 URL) 在部分 WebView（IAB 等）中解析失败，
 *  new URL() 生成绝对地址后所有环境一致（相对当前页面解析，部署子路径同样安全）
 *  ?v= 版本参数：瓦片数据重建后强制浏览器取新瓦片（HTTP 缓存失效） */
const TILE_ROOT = new URL('data/geography/tiles/', window.location.href).href
const TILE_VERSION = '?v=20260818b'
/** 单瓦片 URL（带版本参数） */
const tileUrl = (layer, period, z, x, y) => `${TILE_ROOT}${layer}/${period}/${z}/${x}/${y}.pbf${TILE_VERSION}`
/** 各矢量层缩放范围（与 build-tiles.mjs 一致；territories 全球 z7 上限，z8+ overzoom） */
const LAYER_ZOOM = { territories: 7, urban: 9, cities: 10 }
/** 城市 LOD 缩放带（与 build-tiles.mjs CITY_BANDS 一致——瓦片已预裁剪，前端无需再过滤） */
const CITY_BANDS = [
  { max: 3, lodMax: 0 }, { max: 5, lodMax: 1 }, { max: 8, lodMax: 2 }, { max: 10, lodMax: 3 },
]

const CAT_COLOR = {
  capital: '#8b7355', city: '#3c4652', village: '#8a94a3',
  region: '#7a6a4a', nation: '#7a6a4a', mountain: '#a98d5f', range: '#a98d5f',
  river: '#4a90c4', water: '#4a90c4', desert: '#c9a86a', coast: '#4a90c4', island: '#4a90c4',
  site: '#9aa3ad',
}
/** 分类 → 几何符号（与 MapPage 图例 CAT_ICON 一致；地图标记用 symbol 图层渲染同款符号，
 *  字体为本地图 setGlyphs 的 Noto Sans，全 BMP 码点已预生成） */
const CAT_SYMBOL_EXPR = ['match', ['get', 'cat'],
  'capital', '★', 'city', '●', 'village', '○', 'region', '◆', 'nation', '▲',
  'mountain', '△', 'range', '▴▴', 'river', '▬', 'water', '◍', 'desert', '◒',
  'coast', '◐', 'island', '◌', 'site', '✕',
  '●']
/** JS 版分类符号（点击拾取 popup 列表显示用，与 CAT_SYMBOL_EXPR 保持一致） */
const CAT_SYMBOL = {
  capital: '★', city: '●', village: '○', region: '◆', nation: '▲',
  mountain: '△', range: '▴▴', river: '▬', water: '◍', desert: '◒',
  coast: '◐', island: '◌', site: '✕',
}
/** 分类缩放门控（图例 zoom 表 2026-08 校审）：
 *  nation 0-8；water/desert/range/coast 0-5；capital/region 4-10；city/river 6+；
 *  island 6-12；mountain/village 9+；site 11+（z11+ 由瓦片 z10 overzoom + 本门控补显） */
const CAT_ZOOM_GATE = ['match', ['get', 'cat'],
  'nation', ['<=', ['zoom'], 8.5],
  'water', ['<=', ['zoom'], 5.5],
  'desert', ['<=', ['zoom'], 5.5],
  'range', ['<=', ['zoom'], 5.5],
  'coast', ['<=', ['zoom'], 5.5],
  'capital', ['all', ['>=', ['zoom'], 4], ['<=', ['zoom'], 10.5]],
  'region', ['all', ['>=', ['zoom'], 4], ['<=', ['zoom'], 10.5]],
  'city', ['>=', ['zoom'], 6],
  'river', ['>=', ['zoom'], 6],
  'island', ['all', ['>=', ['zoom'], 6], ['<=', ['zoom'], 12.5]],
  'mountain', ['>=', ['zoom'], 9],
  'village', ['>=', ['zoom'], 9],
  'site', ['>=', ['zoom'], 11],
  true,
]

/* ============ 信息密度（Map Data Engine：Zoom 过滤 + 重要性排序；§9 密度控制器） ============
 * 三档密度：简洁（大区域/国家/重要城市）→ 标准（+行政区/城市/重要地点）→ 详细（全部）。
 * 每档为每类地点指定 zoom 起点——zoom 越低地图越语义化（少而重要），越高越资料化（全量）。
 * 城市另按 importance 分级（major 重要城市更早出现），参考分级表：
 *   0-4 大区域/国家 · 4-6 国家/主要海域/重要城市 · 6-8 国家/行政区/重要城市 ·
 *   8-10 行政区/城市/重要地点 · 10-12 城市/村镇/圣经地点 · 12-14 小型地点/山/河 · 14+ 遗址/地名细节 */
const DENSITY_ZOOM = {
  // 简洁：国家+首都+重要城市，其余地点不显示
  simple: {
    nation: 0, water: 0, range: 2, desert: 4, coast: 5, river: 8, island: 8,
    capital: 4, region: 6, majorCity: 5, city: 99, village: 99, site: 99, mountain: 99,
  },
  // 标准：现有分级表（首都/地区 4+、城市 6+、村镇 10+、遗址 12+、山 11+）
  standard: {
    nation: 0, water: 0, range: 2, desert: 4, coast: 5, river: 6, island: 7,
    capital: 4, region: 4, majorCity: 5, city: 6, village: 10, site: 12, mountain: 11,
  },
  // 详细：全部放开（村镇 9+、遗址 11+、山 9+，接近原分级表）
  detailed: {
    nation: 0, water: 0, range: 2, desert: 4, coast: 5, river: 6, island: 6,
    capital: 4, region: 4, majorCity: 4, city: 6, village: 9, site: 11, mountain: 9,
  },
}

/** 密度档位（默认标准；用户选择持久化） */
const density = ref('standard')
const DENSITY_STORAGE = 'brp-map-density'
/** 密度控制器选项（两处地图共用；图标样式不变，仅控制信息量） */
const DENSITY_OPTIONS = [
  { key: 'simple', label: '简洁' },
  { key: 'standard', label: '标准' },
  { key: 'detailed', label: '详细' },
]
// 恢复用户上次选择的密度
{
  const saved = localStorage.getItem(DENSITY_STORAGE)
  if (saved === 'simple' || saved === 'standard' || saved === 'detailed') density.value = saved
}
function setDensity(d) {
  density.value = d
  localStorage.setItem(DENSITY_STORAGE, d)
}
/** 密度 → 图层过滤表达式：分类 zoom 起点 + 重要城市（major）优先 */
function densityGate() {
  const z = DENSITY_ZOOM[density.value] || DENSITY_ZOOM.standard
  return ['match', ['get', 'cat'],
    'nation', ['>=', ['zoom'], z.nation],
    'water', ['>=', ['zoom'], z.water],
    'range', ['>=', ['zoom'], z.range],
    'desert', ['>=', ['zoom'], z.desert],
    'coast', ['>=', ['zoom'], z.coast],
    'river', ['>=', ['zoom'], z.river],
    'island', ['>=', ['zoom'], z.island],
    'capital', ['>=', ['zoom'], z.capital],
    'region', ['>=', ['zoom'], z.region],
    'mountain', ['>=', ['zoom'], z.mountain],
    'village', ['>=', ['zoom'], z.village],
    'site', ['>=', ['zoom'], z.site],
    // city 分级：重要城市（major=1）按 majorCity 起点，普通城市按 city 起点
    'city', ['case', ['==', ['get', 'major'], 1], ['>=', ['zoom'], z.majorCity], ['>=', ['zoom'], z.city]],
    true,
  ]
}
/** Pleiades 补充点：按密度档位控制显示起点（简单不显示——避免蚂蚁堆） */
const PLEIADES_MINZOOM = { simple: 99, standard: 11.5, detailed: 9 }

const mapEl = ref(null)
let map = null
let ro = null

/** 年代显示（负值 = BC）：-2100 → "2100 BC"，30 → "30 AD"（与 MapPage fmtYear 一致） */
function fmtYear(y) {
  if (y == null) return ''
  return y < 0 ? `${-y} BC` : `${y} AD`
}

/** HTML 转义：瓦片属性来自第三方数据集（Pleiades/DARE 等），拼入弹窗 HTML 前必须转义 */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
/** 颜色校验：仅放行 #hex 形态，其余回退默认色（防 style 属性注入） */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/
function safeColor(c, fallback) {
  return HEX_COLOR_RE.test(String(c || '')) ? c : fallback
}

/* ============ 诊断（协议 §13 调试日志；仅开发环境，生产关闭：moveend 上全层 queryRenderedFeatures 是持续开销） ============ */
function dumpRenderState(tag, delayed = false) {
  if (!import.meta.env.DEV || !map) return
  const dump = () => {
    try {
      const ids = map.getStyle().layers.map((l) => l.id)
      const c = map.getCenter()
      mapEl.value?.setAttribute('data-view', `${c.lng.toFixed(2)},${c.lat.toFixed(2)} z${map.getZoom()}`)
      const counts = {}
      for (const id of ids) {
        try { counts[id] = map.queryRenderedFeatures({ layers: [id] }).length } catch (e) { counts[id] = '?' }
      }
      mapEl.value?.setAttribute('data-rendered', Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' '))
      mapEl.value?.setAttribute('data-rendered-at', tag)
    } catch (e) {}
  }
  if (delayed) setTimeout(dump, 900)
  else dump()
}

/* ============ 底图锚定（异步 base 层归位） ============
 *  层级设计：gray 栅格在疆域填充之下；水域在疆域填充之上、国界线之下
 *  ——水域在海域部分遮盖疆域填充（国家疆域不得画到海上） */
const WATER = ['base-ocean', 'base-rivers', 'base-lakes']
function fixLayerOrder() {
  if (!map) return
  try {
    if (map.getLayer('base-gray') && map.getLayer('territory-fill')) map.moveLayer('base-gray', 'territory-fill')
  } catch (e) { /* 锚点未就绪时跳过，后续调用修正 */ }
  // 水域在国界线之下：海域部分被水域遮盖
  for (const id of WATER) {
    try {
      if (!map.getLayer(id)) continue
      if (map.getLayer('territory-line')) map.moveLayer(id, 'territory-line')
      else if (map.getLayer('territory-fill')) map.moveLayer(id, 'territory-fill')
    } catch (e) { /* 同上 */ }
  }
}

/* ============ 时期切换：瓦片集 URL 切换（时间轴 → 数据） ============ */
let periodSeq = 0 // 竞态守卫：快速切换时期时丢弃过期的图例响应
function applyPeriod(periodId) {
  if (!map) return
  const seq = ++periodSeq
  mapEl.value?.setAttribute('data-period', periodId || 'all')
  const setTiles = (layer, slices) => {
    const src = map.getSource(layer)
    if (!src) return
    const tiles = slices ? slices.map((s) => `${TILE_ROOT}${layer}/${s}/{z}/{x}/{y}.pbf${TILE_VERSION}`) : []
    src.setTiles(tiles)
  }
  const slices = periodId ? [periodId] : ['all']
  // 城市/城区/疆域标签：按时期（或 all）切换瓦片集
  for (const layer of ['cities', 'urban', 'territory-labels']) setTiles(layer, slices)
  if (periodId) {
    setTiles('territories', [periodId])
    for (const id of ['territory-fill', 'territory-line']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
    }
    fetch(new URL(`data/geography/tiles/territories/${periodId}/index.json`, window.location.href).href, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((idx) => {
        if (seq !== periodSeq) return // 时期已切换，丢弃过期图例
        emit('territories', idx?.entities || [])
      })
      .catch(() => {
        if (seq === periodSeq) emit('territories', [])
      })
  } else {
    // '全部' 时期：无固定政治实体 → 隐藏疆域层（瓦片集保持上次，避免 setTiles([]) 边界问题）
    for (const id of ['territory-fill', 'territory-line']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
    }
    emit('territories', [])
  }
  dumpRenderState('period', true)
}

/* ============ 分类显隐 + 信息密度（图例切换 / 密度档位 → 图层 filter） ============ */
function applyCatFilter() {
  if (!map) return
  const cats = [...props.visibleCats]
  const catFilter = ['in', ['get', 'cat'], ['literal', cats]]
  const gate = densityGate() // 密度档位 → 分类 zoom 起点
  const pleiadesZoom = ['>=', ['zoom'], PLEIADES_MINZOOM[density.value]]
  mapEl.value?.setAttribute('data-cat-filter', cats.join(','))
  mapEl.value?.setAttribute('data-density', density.value)
  // STEP 主城市层 + Pleiades/DARE 补充点层都按分类过滤——
  // 否则图例切换只影响少数 STEP 点，占多数的 Pleiades 灰点纹丝不动（图例"不生效"）
  for (const [layer, baseFilter, extra] of [
    ['cities-dot', ['==', ['get', 'src'], 'step'], null],
    ['cities-label', ['==', ['get', 'src'], 'step'], null],
    // Pleiades 补充点：密度档位控制起点（简单不显示，避免蚂蚁堆）
    ['pleiades-dot', ['!=', ['get', 'src'], 'step'], pleiadesZoom],
    ['pleiades-label', ['all', ['!=', ['get', 'src'], 'step'], ['has', 'name'], ['!=', ['get', 'name'], '']], pleiadesZoom],
  ]) {
    try {
      // 与原 filter 组合（AND），不覆盖——否则 STEP 专属层会混入 Pleiades 特征；
      // densityGate（分类 zoom 分级）一并保留，图例切换不得破坏 zoom 层级表
      const parts = [baseFilter, catFilter, gate]
      if (extra) parts.push(extra)
      map.setFilter(layer, ['all', ...parts])
    } catch (e) {
      mapEl.value?.setAttribute('data-cat-err', `${layer}: ${String(e?.message || e)}`)
    }
  }
}

/* ============ 路线（UBS MARBLE 旅程：confidence 三层样式） ============ */
function journeyGeoJSON(journeyId) {
  const j = props.journeys.find((x) => x.id === journeyId)
  if (!j) return { type: 'FeatureCollection', features: [] }
  const feats = []
  for (const seg of j.segments || []) {
    const coords = props.geometries[seg.geometry_id]
    if (!coords) continue
    feats.push({
      type: 'Feature',
      properties: { name: j.name, confidence: seg.confidence ?? j.confidence, sequence: seg.sequence },
      geometry: { type: 'LineString', coordinates: coords },
    })
  }
  return { type: 'FeatureCollection', features: feats }
}

/* ============ 聚焦地点（brp 本章地点覆盖层） ============
 * 独立 GeoJSON 源 + 圆点/名称两层，加在全部图层之后（最上层）；
 * 无 minzoom / 无 CAT_ZOOM_GATE 门控——地点被 zoom 层级表隐藏时（村庄/遗址 z11+、
 * 山脉 z8+、或瓦片 LOD 裁剪）本层依然可见，满足"zoom 隐藏则取消隐藏"。 */
function focusGeoJSON() {
  const feats = []
  for (const p of props.focusPlaces) {
    if (p.lat == null || p.lng == null) continue
    feats.push({
      type: 'Feature',
      // key = 调用方的选中键（原英文名）；name = 标签文本（调用方传入，当前为英文——
      // 地图中文显示暂时关闭）。点击回传 key，选中判定不受显示名切换影响
      // （select-focus 与调用方 activeName 同键）
      properties: { name: p.name, key: p.key || p.name, active: (p.key || p.name) === props.activeFocusName },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })
  }
  return { type: 'FeatureCollection', features: feats }
}

/** 聚焦地点变化 → 重建覆盖层 + fitBounds（无地点回默认视野） */
function syncFocusPlaces() {
  if (!map) return
  const src = map.getSource('focus-places')
  if (!src) return // 样式未就绪：load 回调末尾会调用一次
  src.setData(focusGeoJSON())
  mapEl.value?.setAttribute('data-focus', props.focusPlaces.map((p) => `${p.name}:${p.lat},${p.lng}`).join(' '))
  const pts = props.focusPlaces.filter((p) => p.lat != null && p.lng != null)
  if (pts.length) {
    const bounds = new maplibregl.LngLatBounds()
    for (const p of pts) bounds.extend([p.lng, p.lat])
    // 移动端窄屏/读经页小地图框留足边距，标签不被控件遮挡
    map.fitBounds(bounds, { padding: 60, maxZoom: 10 })
  } else {
    map.flyTo({ center: [35.2, 31.7], zoom: 6 }) // 无地点：默认视野（耶路撒冷）
  }
}

/** 选中聚焦地点 → 金色放大 + flyTo 定位（缩放不低于 8；覆盖层任何缩放均可见） */
function syncFocusActive() {
  if (!map) return
  const src = map.getSource('focus-places')
  if (!src) return
  src.setData(focusGeoJSON())
  mapEl.value?.setAttribute('data-focus-active', props.activeFocusName || '')
  const active = props.focusPlaces.find((p) => (p.key || p.name) === props.activeFocusName)
  if (!active || active.lat == null || active.lng == null) return
  map.flyTo({ center: [active.lng, active.lat], zoom: Math.max(map.getZoom(), 8) })
}

/* ============ 全局错误捕获（协议 §13；命名函数便于卸载，防监听泄漏） ============ */
function onWinError(e) {
  mapEl.value?.setAttribute('data-js-error', String(e.message || e.error?.message || '').slice(0, 140))
}
function onWinReject(e) {
  mapEl.value?.setAttribute('data-js-reject', String(e.reason?.message || e.reason || '').slice(0, 140))
}

onMounted(async () => {
  window.addEventListener('error', onWinError)
  window.addEventListener('unhandledrejection', onWinReject)

  map = new maplibregl.Map({
    container: mapEl.value,
    attributionControl: false,
    failIfMajorPerformanceCaveat: false,
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#c6d0d6' } }],
    },
    center: [35.2, 31.7], // 耶路撒冷
    zoom: 6,
    maxZoom: 16,
  })
  mapEl.value._map = map // 诊断钩子（浏览器验证渲染状态）
  map.on('error', (e) => {
    mapEl.value?.setAttribute('data-err', String(e?.error?.message || e?.message || e).slice(0, 100))
  })
  // 缩放控件放右上角：左上角留给地图页信息栏收起后的「☰ 地图信息」小按钮（MapPage）
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
  // 比例尺（左下角）：读图测距参照（米/公里）
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    mapEl.value?.setAttribute('data-ml', 'loaded')
    // 本地 glyphs（离线可用；绝对地址，避免相对 URL 在部分 WebView 中解析失败。
    // 注意 {fontstack}/{range} 占位符不能被 new URL() 编码，拼接在绝对前缀之后）
    try {
      map.setGlyphs(new URL('data/geography/glyphs/', window.location.href).href + '{fontstack}/{range}.pbf')
    } catch (e) {
      console.warn('[ml] setGlyphs 失败：', e)
    }

    /* ---- Layer 0：Gray Earth 栅格底图（image source） ---- */
    ;(async () => {
      try {
        const grayUrl = new URL(`${TILE_ROOT}../base/gray-earth.png`, window.location.href).href
        const resp = await fetch(grayUrl)
        if (resp.ok && map) {
          map.addSource('gray-earth', { type: 'image', url: grayUrl, coordinates: [[-180, 85.0511], [180, 85.0511], [180, -85.0511], [-180, -85.0511]] })
          map.addLayer({ id: 'base-gray', type: 'raster', source: 'gray-earth', paint: { 'raster-opacity': 0.55, 'raster-resampling': 'linear' } })
          fixLayerOrder()
          mapEl.value?.setAttribute('data-gray', 'ok')
        }
      } catch (e) {
        console.warn('[ml] Gray Earth 加载失败：', e)
      }
    })()

    /* ---- Layer 1：NE 自然层（GeoJSON：海洋/河流/湖泊） ---- */
    ;(async () => {
      try {
        const [ocean, rivers, lakes] = await Promise.all([
          fetchBaseLayer('ocean'),
          fetchBaseLayer('rivers'),
          fetchBaseLayer('lakes'),
        ])
        if (!map) return
        if (ocean?.features) {
          map.addSource('base-ocean', { type: 'geojson', data: ocean })
          map.addLayer({ id: 'base-ocean', type: 'fill', source: 'base-ocean', paint: { 'fill-color': '#c6d0d6' } })
        }
        if (rivers?.features) {
          map.addSource('base-rivers', { type: 'geojson', data: rivers })
          // 河流常亮：任何缩放级别都显示（图例中河流分类的 zoom 标注保留，仅图例遵循 zoom 表）
          map.addLayer({ id: 'base-rivers', type: 'line', source: 'base-rivers', paint: { 'line-color': '#8fa8bc', 'line-width': 1.3, 'line-opacity': 0.85 } })
        }
        if (lakes?.features) {
          map.addSource('base-lakes', { type: 'geojson', data: lakes })
          map.addLayer({ id: 'base-lakes', type: 'fill', source: 'base-lakes', paint: { 'fill-color': '#a9c0d2' } })
        }
        fixLayerOrder()
        mapEl.value?.setAttribute('data-natural', `ok:r${rivers?.features?.length || 0}/l${lakes?.features?.length || 0}`)
      } catch (e) {
        console.warn('[ml] 自然层加载失败：', e)
      }
    })()

    /* ---- Layer 2：疆域（Vector Tile：Cliopatria，按时期切换） ---- */
    map.addSource('territories', {
      type: 'vector',
      tiles: [`${TILE_ROOT}territories/jesus/{z}/{x}/{y}.pbf${TILE_VERSION}`],
      minzoom: 0,
      maxzoom: LAYER_ZOOM.territories,
    })
    // 帝国/王国级填充（Cliopatria 国家疆域；z0+ 全程可见）
    map.addLayer({
      id: 'territory-fill',
      type: 'fill',
      source: 'territories',
      'source-layer': 'territories',
      // 国家层级提高：全程可见不消失（z8+ 渐降透明度，避免覆盖街景细节）
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.28, 13, 0.18],
      },
    })
    map.addLayer({
      id: 'territory-line',
      type: 'line',
      source: 'territories',
      'source-layer': 'territories',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 10, 0.4, 13, 0.25],
      },
    })
    // 国家区域标签（独立瓦片层 territory-labels：每实体一个 label 点，质心固定）
    // 放在城市层之前：先占位——国家名不被城市标签/符号挤掉；蓝字之间参与碰撞
    // （allow-overlap:false + symbol-sort-key 按面积：大国优先，小国重叠处让位），
    // 位置固定在质心不移动；大写 + 字距 + 半透明，与城市点标签两套视觉
    map.addSource('territory-labels', {
      type: 'vector',
      tiles: [`${TILE_ROOT}territory-labels/jesus/{z}/{x}/{y}.pbf${TILE_VERSION}`],
      minzoom: 0,
      maxzoom: LAYER_ZOOM.territories,
    })
    map.addLayer({
      id: 'territory-label', type: 'symbol', source: 'territory-labels', 'source-layer': 'territory-labels',
      layout: {
        // 地图标签统一英文（中文显示暂时关闭；瓦片 zh 字段保留，恢复时改回 coalesce）
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.14,
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 13, 9, 15],
        'text-allow-overlap': false, // 蓝字不重叠（位置仍固定在质心，不移动）
        'symbol-sort-key': ['get', 'area'], // 面积大的国家优先占位
      },
      paint: {
        'text-color': 'rgba(47, 93, 158, 0.7)',
        'text-halo-color': 'rgba(255,255,255,0.92)',
        'text-halo-width': 1.4,
      },
    })

    /* ---- Layer 3：圣经路线（UBS MARBLE GeoJSON；confidence 分层：实线/虚线/点线）
     *   图例 zoom 表：道路 z11+（事件路线尺度） ---- */
    map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'routes-solid', type: 'line', source: 'routes', minzoom: 11,
      filter: ['all', ['has', 'confidence'], ['>=', ['get', 'confidence'], 0.75]],
      paint: { 'line-color': '#b0692f', 'line-width': 2.5 },
    })
    map.addLayer({
      id: 'routes-dashed', type: 'line', source: 'routes', minzoom: 11,
      filter: ['all', ['has', 'confidence'], ['>=', ['get', 'confidence'], 0.5], ['<', ['get', 'confidence'], 0.75]],
      paint: { 'line-color': '#b0692f', 'line-width': 2, 'line-dasharray': [4, 3] },
    })
    map.addLayer({
      id: 'routes-dotted', type: 'line', source: 'routes', minzoom: 11,
      filter: ['all', ['has', 'confidence'], ['<', ['get', 'confidence'], 0.5]],
      paint: { 'line-color': '#b0692f', 'line-width': 1.5, 'line-dasharray': [1, 4] },
    })

    /* ---- Layer 4.5：城区（AWMC urban_areas，Vector Tile） ---- */
    map.addSource('urban', {
      type: 'vector',
      tiles: [`${TILE_ROOT}urban/jesus/{z}/{x}/{y}.pbf${TILE_VERSION}`],
      minzoom: 0,
      maxzoom: LAYER_ZOOM.urban,
    })
    // zoom 层级表：城区/地区 z5+（0-4 仅国家/海洋/大型湖泊）
    map.addLayer({ id: 'urban-fill', type: 'fill', source: 'urban', 'source-layer': 'urban', minzoom: 5, paint: { 'fill-color': '#cbb89a', 'fill-opacity': 0.35 } })
    map.addLayer({ id: 'urban-line', type: 'line', source: 'urban', 'source-layer': 'urban', minzoom: 5, paint: { 'line-color': '#a08a68', 'line-width': 0.8, 'line-opacity': 0.5 } })

    /* ---- Layer 5：城市（Vector Tile：Pleiades + STEP + DARE；瓦片已按 LOD 预裁剪） ---- */
    map.addSource('cities', {
      type: 'vector',
      tiles: [`${TILE_ROOT}cities/jesus/{z}/{x}/{y}.pbf${TILE_VERSION}`],
      minzoom: 0,
      maxzoom: LAYER_ZOOM.cities,
    })
    // Pleiades/DARE 补充点（小灰符号；zoom 起点由密度档位控制——标准 z11.5+、详细 z9+、
    // 简洁不显示；符号允许重叠全部显示；名字 symbol-sort-key 按 importance 排序避让）
    map.addLayer({
      id: 'pleiades-dot', type: 'symbol', source: 'cities', 'source-layer': 'cities',
      filter: ['all', ['!=', ['get', 'src'], 'step'], densityGate(), ['>=', ['zoom'], PLEIADES_MINZOOM.standard]],
      layout: {
        'text-field': CAT_SYMBOL_EXPR,
        'text-font': ['Noto Sans Regular'],
        'text-size': 8,
        'text-allow-overlap': true, // 符号全部显示（点可以重叠）
        'text-ignore-placement': true,
        'symbol-sort-key': ['get', 'level'],
      },
      paint: { 'text-color': '#8b97a3', 'text-opacity': 0.6 },
    })
    map.addLayer({
      id: 'pleiades-label', type: 'symbol', source: 'cities', 'source-layer': 'cities',
      filter: ['all', ['!=', ['get', 'src'], 'step'], ['has', 'name'], ['!=', ['get', 'name'], ''], densityGate(), ['>=', ['zoom'], PLEIADES_MINZOOM.standard]],
      layout: {
        // 地图标签统一英文（中文显示暂时关闭）
        'text-field': ['get', 'name'],
        'text-size': 10,
        // 同 cities-label：variable-anchor 自动避让，重叠名字全部显示
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 0.7,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'symbol-sort-key': ['get', 'level'],
      },
      paint: { 'text-color': '#6f7c89', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1 },
    })
    // STEP 城市（分类符号 + 名称；符号与图例 CAT_ICON 一致，时代名由瓦片数据携带）
    // 图层不设 minzoom——分类的 zoom 显示完全由 densityGate（密度档位）控制
    // 核心规则（MAP LABEL ENGINE）：Entity Never Hide, Label May Move——
    // 符号层允许重叠（点可以重叠：同坐标多实体符号全部显示，不因碰撞丢失）；
    // 名称层用 text-variable-anchor 自动在 8 个锚点间避让（屏幕 bounding box
    // 软碰撞），重叠名字全部显示、文字绝不重叠
    map.addLayer({
      id: 'cities-dot', type: 'symbol', source: 'cities', 'source-layer': 'cities',
      filter: ['all', ['==', ['get', 'src'], 'step'], densityGate()],
      layout: {
        'text-field': CAT_SYMBOL_EXPR,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, ['case', ['==', ['get', 'major'], 1], 14, 12]],
        'text-allow-overlap': true, // 符号全部显示（点可以重叠；密度由档位控制）
        'text-ignore-placement': true,
        'symbol-sort-key': ['get', 'level'],
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': ['case', ['==', ['get', 'major'], 1], 1, 0],
      },
    })
    map.addLayer({
      id: 'cities-label', type: 'symbol', source: 'cities', 'source-layer': 'cities',
      filter: ['all', ['==', ['get', 'src'], 'step'], densityGate()],
      layout: {
        // 地图标签统一英文（中文显示暂时关闭；瓦片 zh 字段保留，恢复时改回
        // format 双行中英对照）；name（时代名）保留在弹窗中完整展示
        'text-field': ['get', 'name'],
        'text-size': ['case', ['==', ['get', 'major'], 1], 13, 11.5],
        // 标签避让：在 8 个锚点（上/下/左/右/四角）间自动选择无冲突位置——
        // 同坐标多名字（Jerusalem/Jebus/Aelia Capitolina/Holy City）扇形展开全部显示；
        // 与 text-anchor/text-offset 互斥（用 text-radial-offset 控制贴点距离）
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 0.7,
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'symbol-sort-key': ['get', 'level'],
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(250,249,247,0.94)',
        'text-halo-width': 1.8,
      },
    })

    /* ---- Layer 6：聚焦地点覆盖层（brp 本章地点；无 zoom 门控、无 LOD 裁剪，常显最上层） ---- */
    map.addSource('focus-places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'focus-places-dot', type: 'circle', source: 'focus-places',
      filter: ['!', ['get', 'active']], // 未选中：金环白心小圆
      paint: {
        'circle-radius': 5,
        'circle-color': '#fffdf4',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#b8860b',
      },
    })
    map.addLayer({
      id: 'focus-places-dot-active', type: 'circle', source: 'focus-places',
      filter: ['==', ['get', 'active'], true], // 选中：金色大圆 + 白描边
      paint: {
        'circle-radius': 8,
        'circle-color': '#c8962e',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#fffdf4',
      },
    })
    map.addLayer({
      id: 'focus-places-label', type: 'symbol', source: 'focus-places',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['case', ['get', 'active'], 14, 12.5],
        // 与 map 子页面同款重叠修复：variable-anchor 8 锚点自动避让——
        // 本章地点重叠（如多个地点同一位置）时名字扇形展开全部显示，文字不重叠
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 0.8,
        'text-allow-overlap': false, // 文字绝不重叠（锚点间避让）
      },
      paint: {
        'text-color': '#8a5a12',
        'text-halo-color': 'rgba(255,255,255,0.95)',
        'text-halo-width': 2,
      },
    })
    syncFocusPlaces()
    // 初始 activeFocusName（挂载前已选中，如解经面板跳转先于地图挂载）→ 定位
    if (props.activeFocusName) syncFocusActive()
    applyCatFilter()

    fixLayerOrder()
    mapEl.value?.setAttribute('data-ml', 'layers-ready')
    scheduleDiagnostics()

    // 点击 → 聚焦地点（brp 本章地点）emit select-focus；否则 popup：城市/地点显示名称；
    // 疆域显示国家名——多个重叠实体全部列出（色块 + 名称）
    map.on('click', (e) => {
      // 1) 本章地点高亮层（圆点或名称都算）→ 选中高亮
      const focusFeats = map.queryRenderedFeatures(e.point, {
        layers: ['focus-places-dot', 'focus-places-dot-active', 'focus-places-label'],
      })
      if (focusFeats.length) {
        emit('select-focus', focusFeats[0].properties.key || focusFeats[0].properties.name)
        return
      }
      // 2) 城市/地点：符号（dot）与名称（label）都参与拾取——点击图例本身或名字均可
      const cityFeats = map.queryRenderedFeatures(e.point, {
        layers: ['cities-dot', 'cities-label', 'pleiades-dot', 'pleiades-label'],
      })
      const terrFeats = map.queryRenderedFeatures(e.point, { layers: ['territory-fill', 'territory-label'] })
      // 城市去重（同一地点多个时期切片同名）：重叠的图例全部列出，不再只取第一个
      const seenC = new Set()
      const cities = []
      for (const f of cityFeats) {
        const key = f.properties?.en || f.properties?.name || ''
        if (!key || seenC.has(key)) continue
        seenC.add(key)
        cities.push(f.properties)
      }
      // 疆域去重：同一政权多个时间切片同名，只列一条
      const seenT = new Set()
      const terrs = []
      for (const f of terrFeats) {
        const name = f.properties?.name
        if (!name || seenT.has(name)) continue
        seenT.add(name)
        terrs.push({ name, color: f.properties.color || '#c9b896' })
      }
      if (!cities.length && !terrs.length) return
      let html = ''
      if (cities.length) {
        html += `<div class="ml-city-list">`
        for (const p of cities) {
          const en = p.en || p.name
          // 地图弹窗统一英文（中文显示暂时关闭；瓦片 zh 字段保留备用）
          const title = en
          // 分类符号 + 英文名 + 时代名 + 存在窗口（第三方数据一律转义）
          html += `<div class="ml-city-item">`
          html += `<span class="ml-cat-sym" style="color:${safeColor(p.color, CAT_COLOR[p.cat] || '#3c4652')}">${CAT_SYMBOL[p.cat] || '●'}</span>`
          html += `<span class="ml-city-main"><strong>${esc(title)}</strong>`
          if (p.name && p.name !== en) html += `<span class="ml-era">时代名：${esc(p.name)}</span>`
          if (p.from != null && p.to != null) html += `<span class="ml-time">${fmtYear(p.from)} – ${fmtYear(p.to)}</span>`
          if (p.polity) html += `<span class="ml-affil">隶属 <b>${esc(p.polity)}</b></span>`
          html += `</span></div>`
        }
        html += `</div>`
      }
      if (terrs.length) {
        html += `<div class="ml-terr-list">${terrs
          .map(
            (t) =>
              `<span class="ml-terr-item"><span class="ml-swatch" style="background:${safeColor(t.color, '#c9b896')}"></span>${esc(t.name)}</span>`,
          )
          .join('')}</div>`
      }
      // 移动端（触屏）弹窗带关闭按钮 + 限宽：单手可关、不盖满地图；桌面 hover 场景靠点空白关闭
      const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches
      new maplibregl.Popup({ closeButton: isTouch, maxWidth: isTouch ? '264px' : '300px', className: 'ml-popup', offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map)
    })
    map.on('mouseenter', 'territory-fill', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'territory-fill', () => (map.getCanvas().style.cursor = ''))
    // 城市符号与名称层都可点击（点击图例本身或名字均触发 popup 列表）
    for (const hit of ['cities-dot', 'cities-label', 'pleiades-dot', 'pleiades-label']) {
      map.on('mouseenter', hit, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', hit, () => (map.getCanvas().style.cursor = ''))
    }
    map.on('mouseenter', 'focus-places-dot', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'focus-places-dot', () => (map.getCanvas().style.cursor = ''))
    map.on('mouseenter', 'focus-places-dot-active', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'focus-places-dot-active', () => (map.getCanvas().style.cursor = ''))

    applyPeriod(props.activePeriodId)
  })

  // 相机每次移动结束 → 刷新 data-view（实时诊断；仅开发环境注册）
  if (import.meta.env.DEV) map.on('moveend', () => dumpRenderState('moveend'))

  ro = new ResizeObserver(() => map && map.resize())
  ro.observe(mapEl.value)
})

function scheduleDiagnostics() {
  if (!import.meta.env.DEV) return
  setTimeout(() => {
    try {
      mapEl.value?.setAttribute('data-layers', map.getStyle().layers.map((l) => l.id).join(','))
    } catch (e) {}
    dumpRenderState('t1s')
  }, 1000)
  setTimeout(() => dumpRenderState('t5s'), 5000)
}

onBeforeUnmount(() => {
  window.removeEventListener('error', onWinError)
  window.removeEventListener('unhandledrejection', onWinReject)
  if (ro) {
    ro.disconnect()
    ro = null
  }
  if (map) {
    map.remove()
    map = null
  }
})

/* ---- 选中旅程 → 路线渲染 + fitBounds ---- */
watch(
  () => props.activeJourneyId,
  (journeyId) => {
    mapEl.value?.setAttribute('data-route-watch', `hit:${journeyId || 'none'}`)
    if (!map || !map.getSource('routes')) return
    const fc = journeyGeoJSON(journeyId)
    mapEl.value?.setAttribute('data-route', `${journeyId || 'none'} feats:${fc.features?.length || 0}`)
    map.getSource('routes').setData(fc)
    setTimeout(() => {
      try {
        if (!map || !journeyId) return
        const hits = map.queryRenderedFeatures({ layers: ['routes-solid', 'routes-dashed', 'routes-dotted'] })
        mapEl.value?.setAttribute('data-route-rendered', String(hits.length))
      } catch (e) {}
    }, 1500)
    if (journeyId && fc.features.length) {
      const bounds = new maplibregl.LngLatBounds()
      for (const f of fc.features) for (const c of f.geometry.coordinates) bounds.extend(c)
      map.fitBounds(bounds, { padding: 48, maxZoom: 9 })
    } else {
      map.flyTo({ center: [35.2, 31.7], zoom: 6 })
    }
  },
)

/* ---- 时期切换（时间轴 → 瓦片集切换） ---- */
watch(() => props.activePeriodId, (periodId) => applyPeriod(periodId), { immediate: true })

/* ---- 分类显隐 ---- */
watch(() => props.visibleCats, () => applyCatFilter())

/* ---- 信息密度（简洁/标准/详细 → 图层过滤刷新） ---- */
watch(density, () => applyCatFilter())

/* ---- 聚焦地点（brp 本章地点） ---- */
watch(() => props.focusPlaces, syncFocusPlaces)
watch(() => props.activeFocusName, syncFocusActive)
</script>

<template>
  <div class="ml-wrap">
    <div ref="mapEl" class="ml-map" role="img" aria-label="圣经地理地图"></div>
    <!-- 信息密度控制器（地图顶部中央横排；两处地图共用） -->
    <div class="density-ctl" role="group" aria-label="地图信息密度">
      <button
        v-for="d in DENSITY_OPTIONS"
        :key="d.key"
        :class="{ active: density === d.key }"
        :aria-pressed="density === d.key"
        @click="setDensity(d.key)"
      >{{ d.label }}</button>
    </div>
  </div>
</template>

<style>
.ml-wrap {
  position: absolute;
  inset: 0;
}
.ml-map {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #c6d0d6;
}
/* 信息密度控制器：地图顶部中央，横排三档（简洁/标准/详细）——
   left:50%+translateX(-50%) 相对地图容器居中：map 子页收起/展开信息抽屉时
   容器尺寸变化居中自动跟随（移动端底部抽屉为 fixed 浮层不改地图尺寸）；
   顶部中央无其他控件冲突（缩放控件在右上角）；移动端加大触控目标 */
.density-ctl {
  position: absolute;
  top: 0.6rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  flex-direction: row;
  gap: 1px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
}
.density-ctl button {
  border: none;
  background: transparent;
  font-size: 0.74rem;
  line-height: 1.2;
  padding: 0.34rem 0.6rem;
  border-radius: 5px;
  color: var(--muted);
  cursor: pointer;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.density-ctl button:hover {
  background: var(--gold-soft);
}
.density-ctl button.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
@media (max-width: 640px) {
  .density-ctl {
    top: 0.5rem;
  }
  .density-ctl button {
    font-size: 0.76rem;
    padding: 0.44rem 0.66rem;
  }
}
.ml-popup .maplibregl-popup-content {
  border-radius: 8px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.18);
  background: #fffdf9;
  font-family: var(--sans);
  font-size: 13.5px;
  color: #232a33;
}
/* 移动端弹窗：字号/行距加大（小屏阅读），关闭按钮触控区放大 */
@media (max-width: 640px) {
  .ml-popup .maplibregl-popup-content {
    font-size: 14px;
  }
  .ml-popup .maplibregl-popup-close-button {
    width: 30px;
    height: 30px;
    font-size: 18px;
    color: #4a5560;
  }
  .ml-popup .ml-city-item {
    padding: 6px 8px;
  }
  .ml-popup .ml-city-main strong {
    font-size: 14.5px;
  }
  .ml-popup .ml-era,
  .ml-popup .ml-time {
    font-size: 12px;
  }
}
.ml-popup .maplibregl-popup-content span {
  color: #8b7355;
  font-size: 11px;
}
/* 政治归属（隶属政权；来自瓦片 polity 属性） */
.ml-popup .ml-affil {
  margin-top: 4px;
  font-size: 11.5px;
  color: #55606c;
}
.ml-popup .ml-affil b {
  color: #8b5f2a;
  font-weight: 700;
}
/* 时代名（该时期使用名称）与存在窗口起止（英文名/中文名/起始时间/终止时间） */
.ml-popup .ml-era,
.ml-popup .ml-time {
  margin-top: 3px;
  font-size: 11px;
  color: #77828e;
}
.ml-popup .ml-time {
  font-variant-numeric: tabular-nums;
}
/* 疆域列表（重叠实体全部列出：色块 + 国家名） */
.ml-popup .ml-terr-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px dashed #d8cfc0;
}
.ml-popup .ml-terr-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #232a33 !important;
  font-size: 12.5px !important;
  font-weight: 600;
  white-space: nowrap;
}
.ml-popup .ml-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}
/* 城市/地点重叠列表（点击图例或名字 → 重叠的图例全部列出） */
.ml-popup .ml-city-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 46vh;
  overflow-y: auto;
}
.ml-popup .ml-city-item {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 4px 6px;
  border-radius: 6px;
  background: rgba(139, 115, 85, 0.06);
}
.ml-popup .ml-cat-sym {
  flex-shrink: 0;
  width: 1.05rem;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 1px;
}
.ml-popup .ml-city-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ml-popup .ml-city-main strong {
  font-size: 13px;
  color: #232a33;
  font-weight: 700;
}
.ml-popup .ml-city-main .ml-era,
.ml-popup .ml-city-main .ml-time,
.ml-popup .ml-city-main .ml-affil {
  margin-top: 0;
  font-size: 11px;
}
</style>
