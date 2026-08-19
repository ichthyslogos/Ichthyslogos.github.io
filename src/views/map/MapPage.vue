<script setup>
/**
 * MapPage — 圣经地理地图页（/map）
 *
 * 布局：左侧旅程面板（时间轴 Time Engine + 搜索 + 动态疆域图例 + 地点分类图例 +
 *        旅程故事分组），右侧全屏地图（MapLibre GL JS + Vector Tile）。
 *
 * 数据栈（重建方案 v2）：
 *   城市  Pleiades + STEP Bible + DARE（罗马时期）→ BRP Historical Database → tiles/cities/<period>/
 *   国家  Cliopatria → tiles/territories/<period>/（10 个圣经时期切换）
 *   城区  AWMC → tiles/urban/<period>/
 *   底图  Natural Earth Gray Earth + NE 自然层
 *   引擎  MapLibre GL JS · 格式 GeoJSON + Vector Tile
 * 时期选择：时间轴（10 个圣经时期 + 全部），切换时地图所有时间相关瓦片集同步切换。
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPlaceCoords, fetchJourneys, fetchGeometries, fetchPeriods } from '../../lib/data.js'
import { loadEntryIndex } from '../../lib/bibleEntries.js'
import { CATS, CAT_DOT_COLOR, CAT_ICON, TYPE_LABELS, journeyZhBridged } from '../../lib/geo.js'
import { setCurrentPeriod } from '../../lib/temporal.js'
import MapLibreMap from '../../components/map/MapLibreMap.vue'

/** 默认时期：耶稣时期（30 AD） */
const DEFAULT_PERIOD = 'jesus'

const route = useRoute()

const places = ref([]) // STEP 913 地点（侧栏统计与地点计数）
const journeys = ref([])
const geometries = ref({})
const periods = ref([])
const loading = ref(true)
const error = ref('')
const activeJourneyId = ref('')
const query = ref('')
/** 地点分类显隐（默认全显；Set 存"显示"的分类） */
const visibleCats = ref(new Set(CATS.map(([c]) => c)))
/** 旅程分组展开状态 */
const expandedStories = ref(new Set())
/** 当前时期（Time Engine；null = 全部） */
const activePeriodId = ref(DEFAULT_PERIOD)
/** 当前时期疆域实体列表（[{ name, color, area }]，地图层按瓦片集 index.json 回传） */
const territoryEntities = ref([])
/** 政治疆域图例展开状态（默认收起——词条式，点击展开） */
const politicsOpen = ref(false)
/** 地点分类图例展开状态（默认收起——词条式，不长期占屏幕；MapPanel 同款） */
const catsOpen = ref(false)
/* ---- 移动端：底部抽屉 + 分区标签（时间轴/图例/旅程）；桌面端不受影响 ---- */
const isMobile = ref(false) // matchMedia 判定（与 CSS 断点 900px 一致）
const mobileTab = ref('timeline') // 移动端当前分区
const sheetOpen = ref(true) // 移动端抽屉展开/收起
/** 桌面信息栏收起（隐藏成地图左上角小按钮；移动端走 sheetOpen） */
const sideCollapsed = ref(false)
/** 小按钮展开信息栏（桌面恢复侧栏；移动端恢复底部抽屉） */
function openPanel() {
  if (isMobile.value) sheetOpen.value = true
  else sideCollapsed.value = false
}
let mq = null
function updateMobile() {
  isMobile.value = mq ? mq.matches : false
  if (!isMobile.value) sheetOpen.value = true
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 900px)')
  updateMobile()
  mq.addEventListener('change', updateMobile)
  // 恢复上次拖拽的宽度/抽屉高度；窗口尺寸变化（旋转/缩放）时重新限制
  const savedW = Number(localStorage.getItem(PANEL_W_STORAGE))
  if (savedW) panelWidth.value = clampSidebarWidth(savedW)
  const savedH = Number(localStorage.getItem(SHEET_H_STORAGE))
  if (savedH) sheetH.value = clampSheetHeight(savedH)
  window.addEventListener('resize', onWinResize)
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', updateMobile)
  window.removeEventListener('resize', onWinResize)
})

/* ---- 抽屉伸缩（解经抽屉同款，CommentaryPanel）：桌面右缘水平调宽 + 移动端底部抓柄垂直调高 ---- */
const PANEL_W_STORAGE = 'brp-map-sidebar-width'
const SHEET_H_STORAGE = 'brp-map-sheet-height'
const panelWidth = ref(null) // null = 默认宽度（CSS 20rem）
const sheetH = ref(null) // null = 默认高度（CSS 46vh）
const dragState = ref(null) // { kind: 'w'|'h', startX/startY, startW/startH }
/** 左侧栏宽度限制：桌面 280px ~ 44vw（给地图留出空间） */
function clampSidebarWidth(w) {
  return Math.min(Math.max(Math.round(w), 280), Math.round(window.innerWidth * 0.44))
}
/** 抽屉高度限制：40vh~92vh（与解经抽屉一致） */
function clampSheetHeight(h) {
  const vh = window.innerHeight
  return Math.min(Math.max(Math.round(h), Math.round(vh * 0.4)), Math.round(vh * 0.92))
}
const sideStyle = computed(() => {
  const s = {}
  if (panelWidth.value && !isMobile.value) s.width = panelWidth.value + 'px'
  if (sheetH.value && isMobile.value) s.height = sheetH.value + 'px'
  return s
})
function onSideResizeStart(e) {
  e.preventDefault()
  dragState.value = { kind: 'w', startX: e.clientX, startW: panelWidth.value ?? 320 }
  document.body.classList.add('panel-resizing')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onSideResizeMove(e) {
  if (dragState.value?.kind !== 'w') return
  const dx = e.clientX - dragState.value.startX // 把手在右缘：向右拖（dx>0）侧栏变宽
  panelWidth.value = clampSidebarWidth(dragState.value.startW + dx)
}
function onSideResizeEnd() {
  if (dragState.value?.kind !== 'w') return
  dragState.value = null
  document.body.classList.remove('panel-resizing')
  if (panelWidth.value) localStorage.setItem(PANEL_W_STORAGE, String(panelWidth.value))
}
function onGrabStart(e) {
  e.preventDefault()
  const el = document.querySelector('.map-side')
  dragState.value = { kind: 'h', startY: e.clientY, startH: sheetH.value ?? el?.getBoundingClientRect().height ?? Math.round(window.innerHeight * 0.46) }
  document.body.classList.add('panel-resizing')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onGrabMove(e) {
  if (dragState.value?.kind !== 'h') return
  const dy = dragState.value.startY - e.clientY // 向上拖（dy>0）抽屉变高
  sheetH.value = clampSheetHeight(dragState.value.startH + dy)
}
function onGrabEnd() {
  if (dragState.value?.kind !== 'h') return
  dragState.value = null
  document.body.classList.remove('panel-resizing')
  if (sheetH.value) localStorage.setItem(SHEET_H_STORAGE, String(sheetH.value))
}
function onWinResize() {
  if (panelWidth.value) panelWidth.value = clampSidebarWidth(panelWidth.value)
  if (sheetH.value) sheetH.value = clampSheetHeight(sheetH.value)
}

/** 时间轴横向滚动：鼠标滚轮（垂直）→ 转换为水平滚动（否则时期选择"无法滚动"） */
function onTimelineWheel(e) {
  const el = e.currentTarget
  if (el.scrollWidth <= el.clientWidth) return // 未溢出不需要横滚
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
}

/** 疆域图例显示项：按面积取前 12 个主要实体，其余合并「其他」 */
const legendPolitics = computed(() => {
  const list = territoryEntities.value
  if (!list.length) return []
  const major = list.slice(0, 12)
  const rest = list.slice(12)
  if (rest.length) major.push({ name: `其他 ${rest.length} 个`, color: '#b8b8b8', rest: true })
  return major
})

function onTerritories(entities) {
  territoryEntities.value = entities || []
}

/* ---- 深链定位（搜索/读经页跳转）：?period=<时期 id> + ?focus=<地点英文名> [&fl=<显示名>] ---- */
const focusPlaces = ref([]) // MapLibreMap 聚焦覆盖层（搜索结果/读经页「全屏地图」携带）
const activeFocusName = ref('') // 选中聚焦地点（金色放大 + flyTo）
/** 应用 URL 深链参数（places 加载完成后有效；period 合法性由 periods 校验） */
function applyDeepLink() {
  const q = route.query
  const pid = typeof q.period === 'string' ? q.period : ''
  if (pid && periods.value.some((p) => p.id === pid)) activePeriodId.value = pid
  const fname = typeof q.focus === 'string' ? q.focus : ''
  if (!fname) return
  const hit = places.value.find((p) => p.name === fname)
  if (!hit) return
  // 地图标签统一英文（中文显示暂时关闭）：忽略 fl 显示名参数，聚焦层标签用英文名；
  // fl 参数在深链中保留（调用方仍传），恢复中文显示时改回 `(q.fl || hit.name)`
  focusPlaces.value = [{ name: hit.name, key: hit.name, lat: hit.lat, lng: hit.lng, cat: hit.cat }]
  activeFocusName.value = hit.name
  // 移动端深链进入时收起底部抽屉，地图全屏可见
  if (isMobile.value) sheetOpen.value = false
}

onMounted(async () => {
  try {
    const [p, j, g, pe] = await Promise.all([fetchPlaceCoords(), fetchJourneys(), fetchGeometries(), fetchPeriods()])
    places.value = Object.entries(p.coords || {}).map(([name, c]) => ({ name, lat: c.lat, lng: c.lng, cat: c.cat || 'city' }))
    journeys.value = j.journeys || []
    geometries.value = g.geometries || {}
    periods.value = pe.periods || []
    applyDeepLink()
  } catch (e) {
    error.value = String(e?.message || e)
  } finally {
    loading.value = false
  }
})

// 已在 /map 页时再次深链（如全局搜索打开 → 在地图中查看）：hash query 变化即应用
watch(
  () => route.query.focus,
  () => {
    if (places.value.length) applyDeepLink()
  },
)

/** 当前时期对象（含 desc/journey_ids/era） */
const activePeriod = computed(() => periods.value.find((p) => p.id === activePeriodId.value) || null)

/** Temporal Engine 同步：时期变化 → currentYear/currentPeriod（TIME→ZOOM→RENDER 链的 TIME 状态） */
watch(activePeriod, (p) => setCurrentPeriod(p), { immediate: true })

/** 时期过滤后的旅程（Time Engine：current_year → 查询有效旅程） */
const periodJourneys = computed(() => {
  if (!activePeriod.value) return journeys.value
  const ids = new Set(activePeriod.value.journey_ids || [])
  return journeys.value.filter((j) => ids.has(j.id))
})

/** 按故事分组（无故事分组归入「其他」） */
const storyGroups = computed(() => {
  const groups = new Map()
  for (const j of periodJourneys.value) {
    const key = j.story?.name || '其他'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(j)
  }
  return [...groups.entries()]
    .map(([name, list]) => ({ name, list }))
    .sort((a, b) => (a.name === '其他' ? 1 : b.name === '其他' ? -1 : a.name.localeCompare(b.name)))
})

/* ---- 统一搜索（地点 + 路线共用一框；词条索引懒加载） ---- */
/** 搜索索引（含 1013 地点：zh/en/cat/lat/lng/ps 时期表） */
const entryIndex = ref(null)
const entryIndexError = ref('')
async function ensureEntryIndex() {
  if (entryIndex.value || entryIndexError.value) return
  try {
    entryIndex.value = await loadEntryIndex()
  } catch (e) {
    entryIndexError.value = String(e?.message || e)
  }
}
watch(query, (q) => {
  if (q.trim()) ensureEntryIndex()
})

/** 路线搜索文本缓存：英文名/故事 + 类型中文名 + 关键词桥接中文版（"保罗" 命中 "Paul's …"） */
const journeyTextCache = new Map()
function journeySearchTextOf(j) {
  let t = journeyTextCache.get(j.id)
  if (t === undefined) {
    const en = [j.name, j.story?.name].filter(Boolean).join(' ').toLowerCase()
    t = `${en} ${TYPE_LABELS[j.type] || ''} ${journeyZhBridged(en)}`
    journeyTextCache.set(j.id, t)
  }
  return t
}

/** 搜索结果：地点（中英文/别名）+ 路线（全量旅程，不限当前时期） */
const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return null
  const placeHits = (entryIndex.value?.places || [])
    .filter((p) =>
      [p.zh, p.en, ...(p.al || [])].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
    .slice(0, 8)
  const journeyHits = journeys.value
    .filter((j) => journeySearchTextOf(j).includes(q))
    .slice(0, 8)
  return { placeHits, journeyHits }
})

/** 地点搜索/时期地点列表点击 → 地图聚焦（金色标记 + flyTo；键 = 英文名） */
function focusPlace(p) {
  if (p.lat == null || p.lng == null) return
  focusPlaces.value = [{ name: p.zh || p.en, key: p.en, lat: p.lat, lng: p.lng, cat: p.cat }]
  activeFocusName.value = p.en
  query.value = ''
  if (isMobile.value) sheetOpen.value = false // 移动端收起抽屉看地图
}

/** 搜索结果点击路线 → 选中旅程（地图 fitBounds 至路线范围） */
function pickJourneyFromSearch(id) {
  activeJourneyId.value = id
  query.value = ''
  if (isMobile.value) {
    mobileTab.value = 'journey'
    sheetOpen.value = false
  }
}

/* ---- 时期地点词条（当前时期的全部地点 + 分类筛选；随时间轴切换） ---- */
const periodPlacesOpen = ref(false)
/** 时期地点分类筛选（'' = 全部；单选，再点同项复位） */
const placeCatFilter = ref('')
/** 时期地点显示条数（分页加载） */
const placeLimit = ref(80)
watch(periodPlacesOpen, (open) => {
  if (open) ensureEntryIndex()
})

/** 当前时期地点（index.places.ps = 地点出现的时期；全部时期 = 全量） */
const periodPlaces = computed(() => {
  const all = entryIndex.value?.places || []
  if (!activePeriodId.value) return all
  return all.filter((p) => (p.ps || []).includes(activePeriodId.value))
})

/** 当前时期出现的分类（按图例 CATS 顺序，只列有地点的分类） */
const periodPlaceCats = computed(() => {
  const present = new Set(periodPlaces.value.map((p) => p.cat))
  return CATS.filter(([c]) => present.has(c))
})

/** 分类筛选 + 分页后的时期地点（出现次数降序——重要地点在前） */
const shownPeriodPlaces = computed(() => {
  let list = periodPlaces.value
  if (placeCatFilter.value) list = list.filter((p) => p.cat === placeCatFilter.value)
  return [...list].sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, placeLimit.value)
})

/** 切换时期：复位地点筛选与分页 */
watch(activePeriodId, () => {
  placeCatFilter.value = ''
  placeLimit.value = 80
})

function catLabelOf(cat) {
  return CATS.find(([c]) => c === cat)?.[1] || cat
}

/** 年代显示（负值 = BC）：-2100 → "2100 BC"，30 → "30 AD" */
function fmtYear(y) {
  return y < 0 ? `${-y} BC` : `${y} AD`
}

function toggleStory(name) {
  const s = new Set(expandedStories.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  expandedStories.value = s
}

function isStoryOpen(name) {
  return expandedStories.value.has(name)
}

/** 切换时期（Time Engine）：清空选中旅程与搜索 */
function pickPeriod(id) {
  activePeriodId.value = id
  activeJourneyId.value = ''
  query.value = ''
}

function pickJourney(id) {
  activeJourneyId.value = activeJourneyId.value === id ? '' : id
}

function toggleCat(cat) {
  const s = new Set(visibleCats.value)
  if (s.has(cat)) s.delete(cat)
  else s.add(cat)
  visibleCats.value = s
}

function segmentCount(j) {
  return j.segments?.length || 0
}
</script>

<template>
  <main class="map-page">
    <!-- 左：信息栏（桌面抽屉：右缘把手水平调宽；移动端底部抽屉：顶部抓柄垂直调高，解经抽屉同款） -->
    <aside
      v-show="!(!isMobile && sideCollapsed)"
      class="map-side"
      :class="{ 'sheet-collapsed': isMobile && !sheetOpen }"
      :style="sideStyle"
      aria-label="地图信息"
    >
      <!-- 桌面右缘调宽把手（移动端隐藏） -->
      <div
        class="map-side-handle"
        :class="{ dragging: dragState?.kind === 'w' }"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整信息栏宽度"
        @pointerdown="onSideResizeStart"
        @pointermove="onSideResizeMove"
        @pointerup="onSideResizeEnd"
        @pointercancel="onSideResizeEnd"
      ></div>
      <!-- 移动端底部抽屉抓柄（桌面隐藏）：上下拖拽调整抽屉高度 -->
      <div
        v-if="isMobile"
        class="sheet-grabber"
        :class="{ dragging: dragState?.kind === 'h' }"
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖动调整抽屉高度"
        @pointerdown="onGrabStart"
        @pointermove="onGrabMove"
        @pointerup="onGrabEnd"
        @pointercancel="onGrabEnd"
      ></div>
      <header class="side-head">
        <h1 class="side-title">圣经地图</h1>
        <p class="side-sub">
          <span>{{ places.length }} STEP 地点</span>
          <span> · {{ periodJourneys.length }} 旅程</span>
        </p>
        <!-- 桌面收起信息栏：隐藏成地图左上角小按钮（读经页头部信息栏同款交互） -->
        <button
          v-if="!isMobile"
          class="side-collapse-btn"
          aria-label="收起信息栏"
          title="收起信息栏"
          @click="sideCollapsed = true"
        >«</button>
      </header>

      <!-- 移动端分区标签（时间轴/图例/旅程）：地图阅读无障碍，一次只看一个分区 -->
      <nav v-if="isMobile" class="side-tabs" aria-label="面板分区">
        <button :class="{ active: mobileTab === 'timeline' }" @click="mobileTab = 'timeline'; sheetOpen = true">时间轴</button>
        <button :class="{ active: mobileTab === 'legend' }" @click="mobileTab = 'legend'; sheetOpen = true">图例</button>
        <button :class="{ active: mobileTab === 'journey' }" @click="mobileTab = 'journey'; sheetOpen = true">旅程</button>
        <button
          class="side-tab-toggle"
          :aria-expanded="sheetOpen"
          aria-label="展开或收起面板"
          @click="sheetOpen = !sheetOpen"
        >{{ sheetOpen ? '▾' : '▴' }}</button>
      </nav>

      <!-- 时间轴（Time Engine）：按圣经时期切换全图层（HISTORICAL-MAP.md §4/§10） -->
      <div v-show="!isMobile || mobileTab === 'timeline'" class="timeline" aria-label="圣经时期时间轴">
        <div
          class="timeline-track"
          role="tablist"
          aria-label="选择时期"
          @wheel="onTimelineWheel"
        >
          <button
            class="timeline-pill"
            :class="{ active: activePeriodId === null }"
            role="tab"
            :aria-selected="activePeriodId === null"
            @click="pickPeriod(null)"
          >
            <span class="tl-year">全部</span>
          </button>
          <button
            v-for="p in periods"
            :key="p.id"
            class="timeline-pill"
            :class="{ active: activePeriodId === p.id }"
            role="tab"
            :aria-selected="activePeriodId === p.id"
            @click="pickPeriod(p.id)"
          >
            <span class="tl-year">{{ fmtYear(p.year) }}</span>
            <span class="tl-name">{{ p.name }}</span>
          </button>
        </div>
        <p v-if="activePeriod" class="timeline-info">
          <span class="tl-info-year">{{ fmtYear(activePeriod.year) }}</span>
          <span v-if="activePeriod.era" class="tl-info-era">{{ activePeriod.era }}</span>
          {{ activePeriod.desc }}
        </p>
      </div>

      <div class="side-body">
        <!-- 统一搜索（地点 + 路线共用一框；支持中英文，词条索引懒加载） -->
        <input
          v-model="query"
          class="journey-search"
          type="search"
          placeholder="搜索地点或路线…"
          aria-label="搜索地点或路线"
        />
        <!-- 搜索结果：地点（点击聚焦地图）+ 路线（点击选中旅程） -->
        <div v-if="query.trim() && searchResults" class="search-results">
          <template v-if="entryIndex">
            <div v-if="searchResults.placeHits.length" class="sr-group">
              <p class="sr-label">地点</p>
              <button v-for="p in searchResults.placeHits" :key="p.id" class="sr-item" @click="focusPlace(p)">
                <span class="sr-dot" :style="{ color: CAT_DOT_COLOR[p.cat] || '#3c4652' }" aria-hidden="true">{{ CAT_ICON[p.cat] || '●' }}</span>
                <span class="sr-main">
                  <span class="sr-name">{{ p.zh || p.en }}</span>
                  <span class="sr-sub">{{ p.en }} · {{ catLabelOf(p.cat) }}</span>
                </span>
                <span class="sr-arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <div v-if="searchResults.journeyHits.length" class="sr-group">
              <p class="sr-label">路线</p>
              <button v-for="j in searchResults.journeyHits" :key="j.id" class="sr-item" @click="pickJourneyFromSearch(j.id)">
                <span class="sr-dot route" aria-hidden="true">⤳</span>
                <span class="sr-main">
                  <span class="sr-name">{{ j.name }}</span>
                  <span class="sr-sub">{{ j.story?.name || '' }}{{ j.story?.name ? ' · ' : '' }}{{ TYPE_LABELS[j.type] || j.type }}</span>
                </span>
                <span class="sr-arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <p v-if="!searchResults.placeHits.length && !searchResults.journeyHits.length" class="side-empty">无匹配地点或路线</p>
          </template>
          <p v-else-if="entryIndexError" class="side-empty">索引加载失败：{{ entryIndexError }}</p>
          <p v-else class="side-empty">索引加载中…</p>
        </div>

        <!-- 动态图例：当前时期疆域实体（词条式，默认收起；展开后按面积排序显示） -->
        <section v-show="!isMobile || mobileTab === 'legend'" class="legend-sec" aria-label="疆域图例">
          <button
            class="sec-title politics-toggle"
            :aria-expanded="politicsOpen"
            @click="politicsOpen = !politicsOpen"
          >
            <span class="politics-caret" aria-hidden="true">{{ politicsOpen ? '▾' : '▸' }}</span>
            政治疆域
            <span v-if="activePeriod" class="sec-period">{{ fmtYear(activePeriod.year) }}</span>
            <span class="sec-count">{{ territoryEntities.length }} 实体</span>
          </button>
          <template v-if="politicsOpen">
            <ul v-if="legendPolitics.length" class="legend-politics">
              <li v-for="pe in legendPolitics" :key="pe.name" class="legend-politic">
                <span class="politic-swatch" :style="{ background: pe.color }" aria-hidden="true"></span>
                <span class="politic-name">{{ pe.name }}</span>
              </li>
            </ul>
            <p v-else class="side-empty">全部时期：无固定政治实体</p>
          </template>
        </section>

        <!-- 地点分类图例（词条式，默认收起——不长期占屏幕；分类过滤作用于瓦片图层） -->
        <section v-show="!isMobile || mobileTab === 'legend'" class="legend-sec" aria-label="地点分类图例">
          <button
            class="sec-title politics-toggle cats-toggle"
            :aria-expanded="catsOpen"
            @click="catsOpen = !catsOpen"
          >
            <span class="politics-caret" aria-hidden="true">{{ catsOpen ? '▾' : '▸' }}</span>
            地点分类
            <span class="sec-count">{{ visibleCats.size }}/{{ CATS.length }}</span>
          </button>
          <template v-if="catsOpen">
            <ul class="legend-cats">
              <li v-for="[cat, label] in CATS" :key="cat" class="legend-cat">
                <button class="legend-btn" :class="{ off: !visibleCats.has(cat) }" @click="toggleCat(cat)">
                  <span class="legend-dot" :style="{ color: CAT_DOT_COLOR[cat] }" aria-hidden="true">{{ CAT_ICON[cat] }}</span>
                  <span class="legend-name">{{ label }}</span>
                  <span class="legend-check" aria-hidden="true">{{ visibleCats.has(cat) ? '✓' : '' }}</span>
                </button>
              </li>
            </ul>
          </template>
        </section>

        <!-- 时期地点词条（当前时期的全部地点；分类定向筛选；点击聚焦地图） -->
        <section v-show="!isMobile || mobileTab === 'legend'" class="legend-sec" aria-label="时期地点">
          <button
            class="sec-title politics-toggle"
            :aria-expanded="periodPlacesOpen"
            @click="periodPlacesOpen = !periodPlacesOpen"
          >
            <span class="politics-caret" aria-hidden="true">{{ periodPlacesOpen ? '▾' : '▸' }}</span>
            时期地点
            <span v-if="activePeriod" class="sec-period">{{ activePeriod.name }}</span>
            <span v-else class="sec-period">全部</span>
            <span class="sec-count">{{ periodPlaces.length }} 地点</span>
          </button>
          <template v-if="periodPlacesOpen">
            <template v-if="entryIndex">
              <!-- 分类筛选 chips（只列当前时期出现的分类；单选，再点复位） -->
              <div v-if="periodPlaceCats.length" class="place-cat-chips">
                <button class="place-cat-chip" :class="{ on: !placeCatFilter }" @click="placeCatFilter = ''">全部</button>
                <button
                  v-for="[cat, label] in periodPlaceCats"
                  :key="cat"
                  class="place-cat-chip"
                  :class="{ on: placeCatFilter === cat }"
                  @click="placeCatFilter = placeCatFilter === cat ? '' : cat"
                >{{ label }}</button>
              </div>
              <ul v-if="shownPeriodPlaces.length" class="place-list">
                <li v-for="p in shownPeriodPlaces" :key="p.id">
                  <button class="place-item" @click="focusPlace(p)">
                    <span class="sr-dot" :style="{ color: CAT_DOT_COLOR[p.cat] || '#3c4652' }" aria-hidden="true">{{ CAT_ICON[p.cat] || '●' }}</span>
                    <span class="sr-main">
                      <span class="sr-name">{{ p.zh || p.en }}</span>
                      <span class="sr-sub">{{ p.en }}</span>
                    </span>
                    <span class="place-n" aria-hidden="true">{{ p.n || 0 }}</span>
                  </button>
                </li>
              </ul>
              <p v-else class="side-empty">无匹配地点</p>
              <button
                v-if="(placeCatFilter ? periodPlaces.filter((p) => p.cat === placeCatFilter).length : periodPlaces.length) > placeLimit"
                class="place-more"
                @click="placeLimit += 80"
              >显示更多</button>
            </template>
            <p v-else-if="entryIndexError" class="side-empty">索引加载失败：{{ entryIndexError }}</p>
            <p v-else class="side-empty">索引加载中…</p>
          </template>
        </section>

        <!-- 旅程列表（按故事分组；随时间轴时期过滤；点击选中 → 地图绘制路线） -->
        <section
          v-show="!isMobile || mobileTab === 'journey'"
          class="journey-sec"
          aria-label="圣经旅程"
        >
          <h2 class="sec-title">
            圣经旅程
            <span v-if="activePeriod" class="sec-period">{{ fmtYear(activePeriod.year) }}</span>
            <span class="sec-tag">UBS MARBLE</span>
          </h2>
          <template v-if="loading">
            <p class="side-empty">加载中…</p>
          </template>
          <template v-else-if="error">
            <p class="side-empty">加载失败：{{ error }}</p>
          </template>
          <template v-else-if="storyGroups.length">
            <div v-for="g in storyGroups" :key="g.name" class="story-group">
              <button class="story-head" :aria-expanded="isStoryOpen(g.name)" @click="toggleStory(g.name)">
                <span class="story-caret" aria-hidden="true">{{ isStoryOpen(g.name) ? '▾' : '▸' }}</span>
                <span class="story-name">{{ g.name }}</span>
                <span class="story-count">{{ g.list.length }}</span>
              </button>
              <ul v-show="isStoryOpen(g.name)" class="journey-list">
                <li v-for="j in g.list" :key="j.id">
                  <button
                    class="journey-item"
                    :class="{ active: j.id === activeJourneyId }"
                    @click="pickJourney(j.id)"
                  >
                    <span class="journey-name">{{ j.name }}</span>
                    <span class="journey-meta">
                      <span class="journey-type">{{ TYPE_LABELS[j.type] || j.type }}</span>
                      <span class="journey-segs">{{ segmentCount(j) }} 段</span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </template>
          <p v-else class="side-empty">当前时期无旅程</p>
        </section>
      </div>

      <footer v-if="!isMobile" class="side-foot">
        <p class="source-line">城市：Pleiades + STEP Bible + DARE · 国家：Cliopatria · 城区：AWMC</p>
        <p class="source-line">路线：UBS MARBLE</p>
        <p class="source-line license">CC BY 4.0 / CC BY-SA 4.0</p>
      </footer>
    </aside>

    <!-- 右：地图 -->
    <div class="map-main">
      <!-- 信息栏收起时的小按钮（桌面：地图左上角；移动端：地图底部居中）——
          读经页头部信息栏同款：收起后只留一个可展开的小按钮 -->
      <button
        v-if="(!isMobile && sideCollapsed) || (isMobile && !sheetOpen)"
        class="side-reopen"
        :class="{ 'on-mobile': isMobile }"
        aria-label="展开信息栏"
        @click="openPanel"
      >☰ 地图信息</button>
      <MapLibreMap
        :visible-cats="visibleCats"
        :journeys="journeys"
        :geometries="geometries"
        :active-journey-id="activeJourneyId"
        :active-period-id="activePeriodId"
        :focus-places="focusPlaces"
        :active-focus-name="activeFocusName"
        @territories="onTerritories"
      />
    </div>
  </main>
</template>

<style scoped>
.map-page {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
}
/* 左：信息栏（桌面抽屉：右缘把手水平调宽；移动端底部抽屉：顶部抓柄垂直调高） */
.map-side {
  width: 20rem;
  flex-shrink: 0;
  position: relative; /* 右缘调宽把手定位基准 */
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--line-soft);
  background: var(--panel);
}
.side-head {
  position: relative;
  padding: 1rem 1.1rem 0.8rem;
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(180deg, rgba(139, 115, 85, 0.06), transparent);
}
/* 收起信息栏按钮（桌面；side-head 右上角） */
.side-collapse-btn {
  position: absolute;
  top: 0.55rem;
  right: 0.7rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1;
  width: 1.7rem;
  height: 1.7rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.side-collapse-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.side-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
}
.side-sub {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
/* 时间轴（Time Engine）：时期胶囊条，横向滚动 */
.timeline {
  padding: 0.6rem 1.1rem 0.55rem;
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(180deg, rgba(47, 93, 158, 0.05), transparent);
}
.timeline-track {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  /* 滚动条可见（全局细条样式）：时期多时可拖动/触控板横滑选择 */
  padding-bottom: 0.3rem;
}
.timeline-pill {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.05rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  padding: 0.3rem 0.55rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.timeline-pill:hover {
  border-color: var(--accent);
}
.timeline-pill.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.tl-year {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.tl-name {
  font-size: 0.68rem;
  color: var(--muted);
  white-space: nowrap;
}
.timeline-pill.active .tl-name {
  color: var(--accent);
}
.timeline-info {
  margin: 0.45rem 0 0;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.5;
}
.tl-info-year {
  font-weight: 700;
  color: var(--accent);
  margin-right: 0.3rem;
}
/* 时代元数据（era：青铜时代晚期/罗马帝国早期…） */
.tl-info-era {
  border: 1px solid var(--gold);
  border-radius: var(--radius-pill);
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 0.66rem;
  font-weight: 600;
  padding: 0.04rem 0.5rem;
  margin-right: 0.3rem;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.side-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0.85rem 1.1rem 1.5rem;
}
.journey-search {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.85rem;
  padding: 0.42rem 0.7rem;
  margin-bottom: 0.9rem;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.journey-search:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.sec-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
/* 政治疆域图例：词条式标题按钮（默认收起，点击展开） */
.politics-toggle {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.2rem 0;
  cursor: pointer;
  text-align: left;
  transition: color var(--dur) var(--ease);
}
.politics-toggle:hover {
  color: var(--gold);
}
.politics-caret {
  font-size: 0.7rem;
  width: 0.9rem;
  flex-shrink: 0;
  color: var(--gold);
}
.sec-tag {
  border: 1px solid var(--accent);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.62rem;
  font-weight: 600;
  padding: 0.05rem 0.45rem;
  letter-spacing: 0.02em;
}
.sec-period {
  border: 1px solid var(--gold);
  border-radius: var(--radius-pill);
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.05rem 0.45rem;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.sec-count {
  font-size: 0.62rem;
  color: var(--muted);
  margin-left: auto;
}
.legend-sec {
  margin-bottom: 1.1rem;
}
/* 动态图例：政治实体（随时期变化） */
.legend-politics {
  list-style: none;
  margin: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  background: rgba(47, 93, 158, 0.05);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.legend-politic {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.politic-swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
}
.politic-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
}
.legend-cats {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  background: rgba(139, 115, 85, 0.04);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.1rem 0.6rem;
}
.legend-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.22rem 0.2rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.legend-btn:hover {
  background: var(--gold-soft);
}
.legend-btn.off .legend-name {
  color: var(--muted);
  opacity: 0.55;
}
.legend-btn.off .legend-dot {
  opacity: 0.35;
}
/* 分类符号（几何形状；颜色随类别，关闭时淡化） */
.legend-dot {
  width: 1.1rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.82rem;
  line-height: 1;
  letter-spacing: -0.12em; /* 双符号（▴▴）收紧 */
  transition: opacity var(--dur) var(--ease);
}
.legend-name {
  font-size: 0.74rem;
  color: var(--text);
  flex: 1;
  text-align: left;
  white-space: nowrap;
}
.legend-check {
  font-size: 0.72rem;
  color: var(--gold);
}
/* 旅程列表 */
.story-group {
  margin-bottom: 0.3rem;
}
.story-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.35rem 0.2rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--dur) var(--ease);
}
.story-head:hover {
  background: var(--gold-soft);
}
.story-caret {
  font-size: 0.7rem;
  color: var(--muted);
  width: 0.9rem;
  flex-shrink: 0;
}
.story-name {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--ink);
  flex: 1;
  text-align: left;
}
.story-count {
  font-size: 0.7rem;
  color: var(--muted);
  background: var(--line-soft);
  border-radius: var(--radius-pill);
  padding: 0.02rem 0.45rem;
}
.journey-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0.35rem 1.1rem;
}
.journey-item {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.32rem 0.4rem;
  border-radius: 6px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.journey-item:hover {
  background: var(--gold-soft);
}
.journey-item.active {
  background: var(--gold-soft);
  border-left-color: var(--gold);
}
.journey-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}
.journey-item.active .journey-name {
  color: var(--gold);
}
.journey-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.journey-type {
  font-size: 0.68rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 0 0.4rem;
}
.journey-segs {
  font-size: 0.68rem;
  color: var(--muted);
}
.side-empty {
  margin: 0.4rem 0;
  font-size: 0.82rem;
  color: var(--muted);
  font-style: italic;
}
.side-foot {
  padding: 0.6rem 1.1rem 0.8rem;
  border-top: 1px solid var(--line-soft);
}
.source-line {
  margin: 0;
  font-size: 0.68rem;
  color: var(--muted);
  line-height: 1.5;
}
.source-line.license {
  font-size: 0.62rem;
  opacity: 0.8;
}
/* 右：地图区 */
.map-main {
  flex: 1;
  position: relative;
  min-width: 0;
}
/* 信息栏收起时的小按钮（读经页头部信息栏同款）：
   桌面 = 地图左上角浮动；移动端 = 地图底部居中（sheet 完全收起后出现） */
.side-reopen {
  position: absolute;
  z-index: 30;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: #fff;
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.5rem 0.95rem;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.side-reopen:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.side-reopen:not(.on-mobile) {
  /* 左上角：缩放控件（NavigationControl）已移至右上角，这里保留给信息按钮 */
  top: 0.9rem;
  left: 0.9rem;
}
/* 移动端分区标签（时间轴/图例/旅程）；桌面端隐藏 */
.side-tabs {
  display: none;
}
/* 桌面右缘调宽把手（解经抽屉同款交互；移动端隐藏） */
.map-side-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  transition: background var(--dur) var(--ease);
}
.map-side-handle:hover,
.map-side-handle.dragging {
  background: var(--accent);
  opacity: 0.35;
}
/* 移动端底部抽屉抓柄（解经抽屉同款；桌面隐藏） */
.sheet-grabber {
  display: none;
}
/* 拖拽中禁止文本选中 + 拉伸光标（与解经/地图抽屉共用 body class） */
:global(body.panel-resizing) {
  user-select: none;
  cursor: col-resize;
}
/* 移动端：底部抽屉 + 分区标签，地图占满全屏（阅读无障碍，一次只看一个分区） */
@media (max-width: 900px) {
  .map-page {
    flex-direction: column;
  }
  .map-main {
    flex: 1;
    min-height: 0;
  }
  .map-side {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    z-index: 40;
    width: 100%;
    max-height: none;
    height: 46vh;
    border-right: none;
    border-top: 1px solid var(--line-soft);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
    transition: transform 0.25s var(--ease);
  }
  /* 收起：完全移出屏幕（隐藏成地图底部小按钮 .side-reopen），地图全屏 */
  .map-side.sheet-collapsed {
    transform: translateY(100%);
  }
  .side-head {
    padding: 0.5rem 0.9rem 0.45rem;
  }
  /* 移动端小按钮：地图底部居中（浮动，展开后消失） */
  .side-reopen.on-mobile {
    left: 50%;
    bottom: 1.1rem;
    top: auto;
    transform: translateX(-50%);
  }
  .map-side-handle {
    display: none;
  }
  /* 底部抽屉抓柄：置顶（标签栏之上），上下拖拽调高（40vh~92vh） */
  .sheet-grabber {
    display: block;
    position: relative;
    order: -2;
    flex-shrink: 0;
    height: 20px;
    cursor: ns-resize;
    touch-action: none;
    background: transparent;
  }
  .sheet-grabber::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 8px;
    width: 44px;
    height: 4px;
    transform: translateX(-50%);
    border-radius: 2px;
    background: var(--line);
    transition: background var(--dur) var(--ease);
  }
  .sheet-grabber:hover::after,
  .sheet-grabber.dragging::after {
    background: var(--gold);
  }
  .side-tabs {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    order: -1; /* 标签栏置顶——收起时仍可见，可随时切回 */
    flex-shrink: 0;
    padding: 0.35rem 0.7rem 0.3rem;
    border-bottom: 1px solid var(--line-soft);
    background: linear-gradient(180deg, rgba(47, 93, 158, 0.06), transparent);
  }
  .side-tabs button {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--panel);
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.28rem 0.4rem;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease), color var(--dur) var(--ease);
  }
  .side-tabs button.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .side-tab-toggle {
    flex: 0 0 auto !important;
    width: 2.1rem;
  }
  .side-body {
    overflow-y: auto;
  }
  .timeline {
    padding: 0.5rem 0.9rem 0.45rem;
  }
}
</style>
