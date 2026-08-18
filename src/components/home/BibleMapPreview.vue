<script setup>
/**
 * BibleMapPreview — 首页地图预览（HOMEPAGE_DESIGN.md §31-35）
 * 嵌入真实 MapLibre 地图（懒加载 maplibre-gl），只加载轻量预览数据：
 *  - 疆域瓦片（现有 territories 瓦片集，低 zoom）
 *  - 7 个圣经城市点（STEP place-coords，缺失回退内置坐标）
 *  - 时间轴滑块：1000 BC（大卫）→ 70 AD（圣殿毁灭），拖动同步切换疆域瓦片集
 * 地图是 FISH 的重要视觉资产（§Principle 04），时间感知是差异化（§Principle 05）。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchPlaceCoords, fetchBaseLayer } from '../../lib/data.js'

const mapEl = ref(null)
let map = null
let ml = null // maplibregl 命名空间（懒加载）
let previewIo = null // 懒加载观察器（组件作用域持有，卸载时 disconnect）

/** 预览时期（锚点年升序；与 /map 时期一致） */
const PREVIEW_PERIODS = [
  { id: 'david', year: -1000, label: '1000 BC' },
  { id: 'assyria', year: -722, label: '722 BC' },
  { id: 'babylon', year: -586, label: '586 BC' },
  { id: 'persia', year: -539, label: '539 BC' },
  { id: 'rome_entry', year: -63, label: '63 BC' },
  { id: 'jesus', year: 30, label: '30 AD' },
  { id: 'temple_fall', year: 70, label: '70 AD' },
]
const slider = ref(0) // 0 = david（1000 BC）
const curPeriod = ref(PREVIEW_PERIODS[0])

/** 7 个圣经城市（预览显示；STEP place-coords 优先，缺失回退内置坐标） */
const CITY_FALLBACK = {
  Jerusalem: [35.234, 31.777],
  Hebron: [35.093, 31.532],
  Bethel: [35.222, 31.93],
  Jericho: [35.431, 31.856],
  Samaria: [35.19, 32.276],
  Damascus: [36.291, 33.51],
  Gaza: [34.467, 31.502],
}
const CITY_NAMES = Object.keys(CITY_FALLBACK)

const TILE_ROOT = new URL('data/geography/tiles/', window.location.href).href

function fmtYear(y) {
  return y < 0 ? `${-y} BC` : `${y} AD`
}

/** 切换时期：更新疆域瓦片集 + 时间轴标签 */
function onSlider() {
  const p = PREVIEW_PERIODS[slider.value]
  curPeriod.value = p
  const src = map?.getSource('territories')
  if (src) src.setTiles([`${TILE_ROOT}territories/${p.id}/{z}/{x}/{y}.pbf`])
}

async function initMap(cities) {
  if (!mapEl.value || map) return
  ml = (await import('maplibre-gl')).default
  // await 期间组件可能已卸载（mapEl 置空 / map 已清理），复查防止向 null 容器建图
  if (!mapEl.value || map) return
  map = new ml.Map({
    container: mapEl.value,
    attributionControl: false,
    style: {
      version: 8,
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e4da' } }],
    },
    center: [35.3, 31.9],
    zoom: 6,
    maxZoom: 10,
    interactive: false, // 预览页不交互（避免与滑块/滚动冲突）
    dragPan: false,
    scrollZoom: false,
    boxZoom: false,
    keyboard: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
  })
  map.on('load', () => {
    try {
      map.setGlyphs(new URL('data/geography/glyphs/', window.location.href).href + '{fontstack}/{range}.pbf')
    } catch (e) {}
    // 海洋底图（NE 简化层）
    fetchBaseLayer('ocean')
      .then((ocean) => {
        if (ocean?.features && map) {
          map.addSource('ocean', { type: 'geojson', data: ocean })
          map.addLayer({ id: 'ocean', type: 'fill', source: 'ocean', paint: { 'fill-color': '#c9d4dc' } })
        }
      })
      .catch(() => {})
    // 疆域：用当前滑块时期（懒加载窗口期拖过滑块时不能回退到默认时期）
    map.addSource('territories', {
      type: 'vector',
      tiles: [`${TILE_ROOT}territories/${(curPeriod.value || PREVIEW_PERIODS[0]).id}/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 7,
    })
    map.addLayer({
      id: 'territory-fill',
      type: 'fill',
      source: 'territories',
      'source-layer': 'territories',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.5 },
    })
    map.addLayer({
      id: 'territory-line',
      type: 'line',
      source: 'territories',
      'source-layer': 'territories',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.7 },
    })
    // 7 个圣经城市（圆点 + 名称）
    const feats = cities
      .map(([name, lng, lat]) => ({
        type: 'Feature',
        properties: { name },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      }))
      .filter(Boolean)
    map.addSource('cities', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } })
    map.addLayer({
      id: 'city-dot',
      type: 'circle',
      source: 'cities',
      paint: { 'circle-radius': 4, 'circle-color': '#405d82', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
    })
    map.addLayer({
      id: 'city-label',
      type: 'symbol',
      source: 'cities',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, -1.3],
        'text-anchor': 'top',
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#2f3b49', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.2 },
    })
  })
}

onMounted(async () => {
  // 城市坐标：STEP place-coords 优先，缺失用内置表
  let coords = {}
  try {
    coords = (await fetchPlaceCoords()).coords || {}
  } catch (e) {}
  const cities = CITY_NAMES.map((name) => {
    const c = coords[name]
    const [lng, lat] = c ? [c.lng, c.lat] : CITY_FALLBACK[name]
    return lng != null ? [name, lng, lat] : null
  }).filter(Boolean)
  // 进入视口才初始化（节省首屏加载；页面滚动到地图区时加载）
  previewIo = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        previewIo?.disconnect()
        initMap(cities)
      }
    },
    { threshold: 0.1 },
  )
  if (mapEl.value) previewIo.observe(mapEl.value)
})

onBeforeUnmount(() => {
  previewIo?.disconnect()
  previewIo = null
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <section class="map-preview" aria-label="圣经世界地图预览">
    <header class="sec-head">
      <p class="sec-kicker">THE BIBLE WORLD</p>
      <h2 class="sec-title">圣经世界</h2>
      <p class="sec-sub">在时间与空间中重新阅读圣经。</p>
    </header>

    <div class="map-frame">
      <div ref="mapEl" class="map-canvas" role="img" aria-label="古代地中海世界地图：疆域与圣经城市随时期变化"></div>
      <!-- 时间轴：拖动切换时期（疆域/城市同步变化） -->
      <div class="timeline">
        <input
          v-model.number="slider"
          type="range"
          min="0"
          :max="PREVIEW_PERIODS.length - 1"
          step="1"
          aria-label="历史时期时间轴"
          @input="onSlider"
        />
        <div class="timeline-scale" aria-hidden="true">
          <span v-for="p in PREVIEW_PERIODS" :key="p.id" class="tl-tick" :class="{ active: p.id === curPeriod.id }">
            {{ p.label }}
          </span>
        </div>
        <p class="timeline-cur" aria-live="polite">
          {{ curPeriod.label }}<template v-if="curPeriod.id === 'david'"> · 大卫王国</template>
        </p>
      </div>
      <!-- 地图 CTA -->
      <RouterLink to="/map" class="map-cta">探索完整地图 →</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.map-preview {
  background: #f8f7f3;
  padding: 20px 2rem 140px;
}
.sec-head {
  max-width: 1200px;
  margin: 0 auto 3rem;
  text-align: center;
}
.sec-kicker {
  margin: 0 0 0.8rem;
  font-size: 12px;
  font-weight: 700;
  color: #405d82;
  letter-spacing: 0.3em;
}
.sec-title {
  margin: 0 0 0.8rem;
  font-family: var(--serif);
  font-size: 2.2rem;
  font-weight: 500;
  color: #171717;
}
.sec-sub {
  margin: 0;
  font-size: 0.92rem;
  color: #6b6b68;
}

.map-frame {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
  border: 1px solid #e4e1da;
  border-radius: 14px;
  overflow: hidden;
  background: #e9e4da;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
}
.map-canvas {
  height: 480px;
}
/* 时间轴：滑块 + 刻度标签 */
.timeline {
  padding: 0.9rem 1.4rem 1rem;
  background: #fff;
  border-top: 1px solid #e4e1da;
}
.timeline input[type='range'] {
  width: 100%;
  accent-color: #405d82;
  cursor: pointer;
}
.timeline-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 0.4rem;
}
.tl-tick {
  font-size: 0.66rem;
  color: #a8a49b;
  font-variant-numeric: tabular-nums;
  transition: color var(--dur) var(--ease);
}
.tl-tick.active {
  color: #405d82;
  font-weight: 700;
}
.timeline-cur {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  color: #405d82;
  font-weight: 600;
}
/* 地图 CTA：右下角胶囊 */
.map-cta {
  position: absolute;
  right: 1.2rem;
  bottom: 6.6rem;
  padding: 0.55rem 1.2rem;
  border-radius: 999px;
  background: #171717;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.map-cta:hover {
  text-decoration: none;
  background: #000;
  transform: translateY(-1px);
}

/* 响应式 */
@media (max-width: 700px) {
  .map-preview {
    padding: 20px 1.2rem 90px;
  }
  .map-canvas {
    height: 300px;
  }
  .timeline-scale {
    gap: 0.2rem;
  }
  .tl-tick {
    font-size: 0.58rem;
  }
  .map-cta {
    bottom: 6.2rem;
    right: 0.8rem;
    font-size: 0.76rem;
    padding: 0.45rem 0.9rem;
  }
}
</style>
