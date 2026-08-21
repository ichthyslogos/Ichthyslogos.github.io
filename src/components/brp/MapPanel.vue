<script setup>
/**
 * MapPanel — 地图抽屉（brp 子组件；可读性大改版）
 *
 * 显示当前书卷+章节的地理位置：复用 map 子页面的 MapLibreMap（本地矢量瓦片 + MapLibre GL，
 * 离线可用；按书卷时代自动切换时期瓦片集——时代对应见 lib/data.js BOOK_PERIODS）
 * + 图例地点列表（本章 type=Place 的背景注释词条，单独一份展示；解经抽屉 notes 层原样保留）。
 * 地点坐标来自 TIPNR 源文件提取的经纬度表（place-coords.json，提取脚本
 * scripts/commentary/extract-place-coords.mjs）；无坐标的词条只列名不标点。
 *
 * 本章地点渲染为地图聚焦覆盖层（常显，不受瓦片 LOD 裁剪/zoom 层级表影响）：
 * 地点因 zoom 原因被隐藏时依然可见；点选地点金色放大并 flyTo 定位。
 *
 * 可读性大改版：
 *   1. 中文优先：地点列表与地图标签显示中文名（zh-names.json 按 Strong 码映射），
 *      英文名降为副标题/小字——中文读者一眼可读；
 *   2. 移动端双视图 [地图 | 地点]：地图占满抽屉（不再被列表挤成 36vh 小窗），
 *      列表独占整屏滚动；列表点选自动切回地图并定位；
 *   3. 桌面端地图吸顶（sticky）：滚动浏览地点列表时地图始终可见；
 *   4. 全屏深链：跳转 /map 携带 focus+period 参数，直接定位本章地点；
 *   5. 数据零改动：坐标/瓦片/注释源数据全部只读，展示层重组。
 *
 * 布局与解经面板同款：桌面右侧栏 / 移动端底部抽屉（与解经面板由 BrpPage 互斥控制）。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { fetchNotes, findNotesChapter, fetchPlaceCoords, fetchPeriods, fetchZhNames, periodOfBook } from '../../lib/data.js'
import { CATS, CAT_DOT_COLOR, CAT_ICON } from '../../lib/geo.js'

/** 地图组件按需加载：maplibre-gl 大依赖只在打开抽屉时才拉取（与 /map 页共享分包） */
const MapLibreMap = defineAsyncComponent(() => import('../../components/map/MapLibreMap.vue'))

/** 地点分类显隐（默认全部关闭——只显示本章地点高亮层，避免干扰读经定位；
 *  图例中可手动打开；Set 存"显示"的分类） */
const visibleCats = ref(new Set())
/** 地点分类图例展开状态（默认收起——词条式，不长期占屏幕） */
const catsOpen = ref(false)
/** 移动端当前视图（map = 地图占满抽屉；list = 地点列表滚动） */
const mobileView = ref('map')

const router = useRouter()

/** 全屏深链：跳转 map 子页面，把本抽屉内【所有】有坐标地点一并高亮（?foci=）+
 *  本卷时期。这些高亮在 /map 页可被点击取消 */
function openFullMap() {
  const query = {}
  const pts = mappedPlaces.value
  if (pts.length) query.foci = pts.map((p) => p.name).join(',')
  const pid = periodId.value
  if (pid) query.period = pid
  router.push({ path: '/map', query })
}

const props = defineProps({
  open: { type: Boolean, default: true },
  book: { type: Object, default: null }, // manifest 中的书卷信息（含 bookId/zh）
  chapter: { type: Number, default: 0 },
  focusName: { type: String, default: '' }, // 外部联动（解经面板地点跳转）：定位并高亮该地点
  focusSeq: { type: Number, default: 0 }, // 跳转序号（同名重复跳转也触发重新定位）
})
const emit = defineEmits(['toggle'])

const notesData = ref(null)
const coordsData = ref(null)
const zhNamesData = ref(null) // Strong 码 → 中文名（zh-names.json；地点列表/地图标签中文优先）
const notesError = ref('')
const coordsError = ref('')
const activeName = ref('') // 列表/地图双向高亮（键 = 词条英文名，与解经面板跳转一致）
const periods = ref([]) // 时期索引（显示时代徽章）

/* ---- 抽屉拖拽拉伸（桌面端左缘把手调宽度） ---- */
const panelEl = ref(null)
const panelWidth = ref(null) // 拖拽后的固定宽度（null = CSS 默认 min(24rem, 34vw)）
const resizeState = ref(null) // { startX, startWidth }
const MIN_W = 300
const MAX_W = 560

function onResizeStart(e) {
  if (e.button !== 0 || !panelEl.value) return
  resizeState.value = {
    startX: e.clientX,
    startWidth: panelWidth.value || panelEl.value.getBoundingClientRect().width,
  }
  document.body.classList.add('panel-resizing')
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
  // pointercancel（系统手势打断触控/笔）不会跟 pointerup，缺监听会卡死拖拽状态
  window.addEventListener('pointercancel', onResizeEnd)
}
function onResizeMove(e) {
  const rs = resizeState.value
  if (!rs) return
  // 把手在抽屉左缘：向左拖（dx<0）变宽
  const w = rs.startWidth - (e.clientX - rs.startX)
  panelWidth.value = Math.round(Math.min(MAX_W, Math.max(MIN_W, w)))
}
function onResizeEnd() {
  resizeState.value = null
  document.body.classList.remove('panel-resizing')
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('pointercancel', onResizeEnd)
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('pointercancel', onResizeEnd)
  window.removeEventListener('pointermove', onGrabMove)
  window.removeEventListener('pointerup', onGrabEnd)
  window.removeEventListener('pointercancel', onGrabEnd)
  window.removeEventListener('resize', onWinResize)
})

/* ---- 移动端底部抽屉抓柄（解经抽屉同款，CommentaryPanel）：顶部抓柄上下拖拽调整高度（40vh~92vh） ---- */
const SHEET_H_STORAGE = 'brp-map-panel-sheet-height'
const sheetH = ref(null) // null = 默认高度（CSS 70vh）
const grabState = ref(null) // { startY, startH }
/** 抽屉高度限制：40vh~92vh（给经文留出可见空间） */
function clampSheetHeight(h) {
  const vh = window.innerHeight
  return Math.min(Math.max(Math.round(h), Math.round(vh * 0.4)), Math.round(vh * 0.92))
}
function onGrabStart(e) {
  if (e.button !== 0 || !panelEl.value) return
  grabState.value = {
    startY: e.clientY,
    startH: sheetH.value || panelEl.value.getBoundingClientRect().height || Math.round(window.innerHeight * 0.7),
  }
  document.body.classList.add('panel-resizing')
  window.addEventListener('pointermove', onGrabMove)
  window.addEventListener('pointerup', onGrabEnd)
  window.addEventListener('pointercancel', onGrabEnd)
}
function onGrabMove(e) {
  const gs = grabState.value
  if (!gs) return
  const dy = gs.startY - e.clientY // 向上拖（dy>0）抽屉变高
  sheetH.value = clampSheetHeight(gs.startH + dy)
}
function onGrabEnd() {
  grabState.value = null
  document.body.classList.remove('panel-resizing')
  window.removeEventListener('pointermove', onGrabMove)
  window.removeEventListener('pointerup', onGrabEnd)
  window.removeEventListener('pointercancel', onGrabEnd)
  if (sheetH.value) localStorage.setItem(SHEET_H_STORAGE, String(sheetH.value))
}
/** 响应式移动端判定（matchMedia 直读无响应性：跨 900px 断点后 panelStyle 不会重算） */
const isMobileView = ref(window.matchMedia('(max-width: 900px)').matches)
function onWinResize() {
  isMobileView.value = window.matchMedia('(max-width: 900px)').matches
  if (sheetH.value) sheetH.value = clampSheetHeight(sheetH.value)
}
// 恢复上次拖拽的抽屉高度；窗口尺寸变化（旋转/缩放）时重新限制
const savedH = Number(localStorage.getItem(SHEET_H_STORAGE))
if (savedH) sheetH.value = clampSheetHeight(savedH)
window.addEventListener('resize', onWinResize)
/** 面板样式：桌面固定宽度 / 移动端底部抽屉高度（解经抽屉同款伸缩） */
const panelStyle = computed(() => {
  const s = {}
  if (panelWidth.value) s.width = panelWidth.value + 'px'
  if (sheetH.value && isMobileView.value) s.height = sheetH.value + 'px'
  return s
})

/** 本章地点词条（type=Place），匹配坐标/中文名/分类后供地图/图例使用 */
const chapterPlaces = computed(() => {
  const ch = findNotesChapter(notesData.value, props.chapter)
  if (!ch || !ch.entries) return []
  const coords = coordsData.value?.coords || {}
  const zhOf = zhNamesData.value || {}
  return ch.entries
    .filter((n) => n.type === 'Place')
    .map((n) => {
      const c = coords[n.name]
      // 中文名按 Strong 码查 zh-names（TIPNR 词条均带 strong；查不到回退英文名）
      const zh = (n.strong && zhOf[n.strong]) || ''
      return c
        ? { ...n, zh, lat: c.lat, lng: c.lng, cat: c.cat || 'city' }
        : { ...n, zh, lat: null, lng: null, cat: 'city' }
    })
})

/** 有坐标的地点（地图绘制） */
const mappedPlaces = computed(() => chapterPlaces.value.filter((p) => p.lat != null && p.lng != null))

/** 地图地点格式（MapLibreMap focusPlaces props；地图标签统一英文——中文显示暂时关闭，
 *  name = 标签文本英文名，key = 选中键；地点列表仍显示中文名） */
const mapPlaces = computed(() =>
  mappedPlaces.value.map((p) => ({ name: p.name, key: p.name, lat: p.lat, lng: p.lng, cat: p.cat })),
)

/** 当前书卷对应的圣经时期（时代对应：疆域/城市瓦片集按此切换） */
const periodId = computed(() => periodOfBook(props.book?.id))

/** 时期徽章（名称 + 年份；periods.json 加载后显示） */
const periodInfo = computed(() => {
  const p = periods.value.find((x) => x.id === periodId.value)
  return p ? { name: p.name, year: p.year } : null
})

/** 年代显示（负值 = BC）：-2100 → "2100 BC"，30 → "30 AD" */
function fmtYear(y) {
  return y < 0 ? `${-y} BC` : `${y} AD`
}

let prevBookId = null
let seq = 0
watch(
  () => [props.book?.id, props.chapter, props.open],
  async ([bookId, ch], oldV) => {
    // 注意：immediate 首次执行时 oldV 为 undefined，不能直接解构旧值数组
    const prevCh = oldV?.[1]
    if (bookId !== prevBookId) {
      prevBookId = bookId
      notesData.value = null
    }
    if (!bookId || !props.open) return
    // 切章才清空高亮；首次打开抽屉（常携带解经面板跳转焦点）不清空——
    // 否则本 watch 的异步加载回调会覆盖 focusSeq watch 刚设置的 activeName（竞态）
    const isChapterChange = prevCh !== undefined && prevCh !== ch
    const s = ++seq
    try {
      const [nd, cd, zn] = await Promise.all([fetchNotes(bookId), fetchPlaceCoords(), fetchZhNames()])
      if (s !== seq) return
      notesData.value = nd
      coordsData.value = cd
      zhNamesData.value = zn
      notesError.value = ''
      coordsError.value = ''
      if (isChapterChange) activeName.value = ''
    } catch (e) {
      if (s !== seq) return
      notesData.value = null
      notesError.value = String(e?.message || e)
    }
  },
  { immediate: true },
)

// 时期索引一次加载（时代徽章）；失败静默（徽章不显示，地图仍按 periodId 切换瓦片集）
fetchPeriods()
  .then((d) => {
    periods.value = d.periods || []
  })
  .catch(() => {})

// 解经面板地点跳转联动：focusSeq 递增保证同名重复跳转也重新定位
watch(
  () => props.focusSeq,
  async () => {
    if (!props.focusName || !props.open) return
    // 跳转即看地图：移动端自动切到地图视图
    if (isMobileView.value) mobileView.value = 'map'
    // 同名重复跳转：先清空再选中（activeName 两次变化），确保地图 flyTo 重新定位
    if (activeName.value === props.focusName) {
      activeName.value = ''
      await nextTick()
    }
    activeName.value = props.focusName
  },
)

function pickPlace(name) {
  const next = activeName.value === name ? '' : name
  activeName.value = next
  // 列表点选 → 移动端切回地图视图看定位效果
  if (next && isMobileView.value) mobileView.value = 'map'
}

/** 地点分类显隐切换（与 map 子页面图例同款交互） */
function toggleCat(cat) {
  const s = new Set(visibleCats.value)
  if (s.has(cat)) s.delete(cat)
  else s.add(cat)
  visibleCats.value = s
}
</script>

<template>
  <aside
    v-show="open"
    ref="panelEl"
    class="map-panel"
    :style="panelStyle"
    aria-label="本章地图"
  >
    <!-- 移动端底部抽屉抓柄（解经抽屉同款；桌面隐藏）：上下拖拽调整抽屉高度 -->
    <div
      class="sheet-grabber"
      :class="{ dragging: grabState }"
      role="separator"
      aria-orientation="horizontal"
      aria-label="拖动调整地图抽屉高度"
      @pointerdown="onGrabStart"
      @pointermove="onGrabMove"
      @pointerup="onGrabEnd"
      @pointercancel="onGrabEnd"
    ></div>
    <!-- 左缘拖拽把手：桌面端拉伸抽屉宽度 -->
    <div class="map-resize-handle" aria-hidden="true" @pointerdown="onResizeStart"></div>
    <header class="map-head">
      <h2 class="map-title">
        <span class="map-title-label">本章地图</span>
        <span v-if="book" class="map-title-ref">{{ book.zh }} · 第 {{ chapter }} 章</span>
        <span v-if="chapterPlaces.length" class="map-title-count">{{ chapterPlaces.length }} 地点</span>
      </h2>
      <div class="map-head-actions">
        <!-- 全屏：跳转 map 子页面（深链定位本章地点 + 时期） -->
        <button class="map-full" @click="openFullMap" aria-label="全屏地图（跳转地图子页面）" title="全屏地图">⛶</button>
        <!-- 关闭按钮：固定在抽屉右上角 -->
        <button class="map-close" @click="emit('toggle')" aria-label="收起地图抽屉">✕</button>
      </div>
    </header>

    <!-- 移动端双视图切换（可读性核心改动：地图不再被列表挤成小窗，两视图各占整屏） -->
    <nav v-if="isMobileView && chapterPlaces.length" class="view-tabs" role="tablist" aria-label="地图视图">
      <button
        role="tab"
        :aria-selected="mobileView === 'map'"
        :class="{ active: mobileView === 'map' }"
        @click="mobileView = 'map'"
      >🗺 地图</button>
      <button
        role="tab"
        :aria-selected="mobileView === 'list'"
        :class="{ active: mobileView === 'list' }"
        @click="mobileView = 'list'"
      >📍 地点列表</button>
    </nav>

    <div class="map-body" :class="{ 'view-list': isMobileView && mobileView === 'list' }">
      <!-- ============ 地图视图（移动端整屏 / 桌面在列表上方） ============ -->
      <section
        v-show="chapterPlaces.length && (!isMobileView || mobileView === 'map')"
        class="view-map"
        aria-label="本章地点地图"
      >
        <p v-if="periodInfo" class="map-period-row">
          <span class="map-period-tag" :title="'本卷对应时期：' + periodInfo.name">
            {{ periodInfo.name }} · {{ fmtYear(periodInfo.year) }}
          </span>
        </p>
        <div v-if="open" class="map-frame">
          <MapLibreMap
            :visible-cats="visibleCats"
            :active-period-id="periodId"
            :focus-places="mapPlaces"
            :active-focus-name="activeName"
            :locked="true"
            @select-focus="pickPlace"
          />
        </div>
        <p v-if="mappedPlaces.length < chapterPlaces.length" class="map-hint">
          {{ chapterPlaces.length - mappedPlaces.length }} 个地点暂无坐标（见地点列表）
        </p>
        <p class="map-attrib">底图 Pleiades · STEP · DARE · Cliopatria · AWMC（CC BY 4.0）</p>
      </section>

      <!-- ============ 列表视图（移动端整屏滚动 / 桌面在地图下方） ============ -->
      <section
        v-show="chapterPlaces.length && (!isMobileView || mobileView === 'list')"
        class="view-listsec"
        aria-label="本章地点列表"
      >
        <!-- 地点分类图例（词条式，默认收起——不长期占屏幕；13 类几何符号 + 色点，可切换显示） -->
        <section class="legend-sec" aria-label="地点分类图例">
          <button
            class="sec-title cats-toggle"
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
        <!-- 地点列表：中文名主行 + 英文名/简介副行（中文读者一眼可读） -->
        <ul class="map-legend">
          <li v-for="p in chapterPlaces" :key="p.name" class="map-item">
            <button
              class="map-item-btn"
              :class="{ active: p.name === activeName }"
              :disabled="p.lat == null"
              @click="pickPlace(p.name)"
            >
              <span class="item-symbol" :style="{ color: CAT_DOT_COLOR[p.cat] || '#3c4652' }" aria-hidden="true">{{ CAT_ICON[p.cat] || '●' }}</span>
              <span class="map-item-main">
                <span class="map-item-name">{{ p.zh || p.name }}</span>
                <span v-if="p.zh" class="map-item-en">{{ p.name }}</span>
                <span v-if="p.brief" class="map-item-brief">{{ p.brief }}</span>
              </span>
              <span v-if="p.lat != null" class="map-item-go" aria-hidden="true">📍</span>
            </button>
          </li>
        </ul>
      </section>

      <p v-if="!chapterPlaces.length" class="map-empty">本章暂无地点注释<template v-if="notesError">（{{ notesError }}）</template></p>
    </div>
  </aside>
</template>

<style scoped>
/* 桌面：右侧栏（与解经面板同款布局；由 BrpPage 互斥控制显示） */
.map-panel {
  position: relative;
  width: min(24rem, 34vw);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--line-soft);
  background: var(--panel);
}
.map-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.8rem 5.6rem 0.7rem 1rem; /* 右侧留出按钮区（全屏 + 关闭） */
  border-bottom: 1px solid var(--line-soft);
  background: linear-gradient(180deg, rgba(139, 115, 85, 0.06), transparent);
}
.map-title {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  min-width: 0;
  margin: 0;
}
.map-title-label {
  font-family: var(--serif);
  font-size: 1.08rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.map-title-ref {
  font-size: 0.82rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.map-title-count {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.08rem 0.5rem;
}
/* 右上角按钮区：全屏跳转 + 关闭抽屉（固定右上角，不随标题流式布局） */
.map-head-actions {
  position: absolute;
  top: 0.7rem;
  right: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.map-close,
.map-full {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 0.9rem;
  width: 1.7rem;
  height: 1.7rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.map-close:hover,
.map-full:hover {
  color: var(--gold);
  background: var(--gold-soft);
  border-color: var(--gold-soft);
}
/* 时期徽章：书卷对应时代（位于地图上方；与 MapLibreMap 瓦片集同步切换） */
.map-period-row {
  margin: 0 0 0.6rem;
}
.map-period-tag {
  display: inline-block;
  border: 1px solid var(--gold);
  border-radius: var(--radius-pill);
  background: var(--gold-soft);
  color: var(--gold);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  white-space: nowrap;
}
.map-body {
  flex: 1;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0.9rem 1.1rem 2rem;
}
/* 地图容器：相对定位 + 固定高度（MapLibre 画布绝对定位铺满） */
.map-frame {
  position: relative;
  height: 340px;
  margin-bottom: 0.7rem;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  overflow: hidden;
}
/* 桌面端地图吸顶：滚动浏览地点列表时地图不离开视野 */
.view-map {
  position: sticky;
  top: -0.9rem; /* 抵消 map-body 的 padding-top，吸顶时贴齐抽屉上缘 */
  z-index: 3;
  background: var(--panel);
  padding-top: 0.9rem;
  margin-top: -0.9rem;
}
.map-hint {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  font-style: italic;
}
/* 数据来源署名（准确性可溯） */
.map-attrib {
  margin: 0.45rem 0 0.8rem;
  font-size: 0.68rem;
  color: var(--muted);
  opacity: 0.75;
  letter-spacing: 0.02em;
}
/* 左缘拖拽把手：桌面端拉伸抽屉宽度 */
.map-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 20;
  transition: background var(--dur) var(--ease);
}
.map-resize-handle:hover,
.map-resize-handle:active {
  background: var(--accent);
  opacity: 0.35;
}
/* 移动端底部抽屉抓柄（解经抽屉同款；桌面隐藏） */
.sheet-grabber {
  display: none;
}
/* 拖拽中禁止文本选中 + 全屏拉伸光标（与解经抽屉共用 body class） */
:global(body.panel-resizing) {
  user-select: none;
  cursor: col-resize;
}
/* 双视图切换条：仅移动端显示（基础隐藏，900px 下媒体查询内开启 flex） */
.view-tabs {
  display: none;
}
/* 地点分类图例（与 map 子页面同款：13 类符号 + 色点 + 切换勾选；词条式默认收起） */
.legend-sec {
  margin: 0 0 0.7rem;
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
/* 词条式标题按钮（与 map 子页面政治疆域同款；点击展开/收起分类图例） */
.cats-toggle {
  width: 100%;
  border: none;
  background: transparent;
  padding: 0.2rem 0;
  cursor: pointer;
  text-align: left;
  transition: color var(--dur) var(--ease);
}
.cats-toggle:hover {
  color: var(--gold);
}
.politics-caret {
  font-size: 0.7rem;
  width: 0.9rem;
  flex-shrink: 0;
  color: var(--gold);
}
.sec-count {
  font-size: 0.62rem;
  color: var(--muted);
  margin-left: auto;
}
.legend-cats {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: rgba(139, 115, 85, 0.04);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.1rem 0.6rem;
}
.legend-cat {
  min-width: 0;
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
/* 地点列表条目符号（与图例同一套几何符号/色点） */
.item-symbol {
  width: 1.1rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.82rem;
  line-height: 1;
  letter-spacing: -0.12em;
}
/* 图例：地点列表（中文名主行 + 英文/简介副行） */
.map-legend {
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
  border-top: 1px dashed var(--line);
}
.map-item {
  border-bottom: 1px solid var(--line-soft);
}
.map-item-btn {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.55rem 0.35rem;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.map-item-btn:hover {
  background: var(--gold-soft);
}
.map-item-btn:disabled {
  cursor: default;
  opacity: 0.85;
}
.map-item-btn.active {
  background: var(--gold-soft);
  box-shadow: inset 3px 0 0 var(--gold);
}
.map-item-main {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}
.map-item-name {
  font-weight: 700;
  color: var(--ink);
  font-size: 0.92rem;
  line-height: 1.4;
}
.map-item-en {
  font-size: 0.72rem;
  color: var(--muted);
  font-style: italic;
}
.map-item-brief {
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
}
.map-item-go {
  flex-shrink: 0;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity var(--dur) var(--ease);
}
.map-item-btn:hover .map-item-go,
.map-item-btn.active .map-item-go {
  opacity: 0.9;
}
.map-empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
  font-style: italic;
}

/* 移动端：底部抽屉（与解经面板同款 bottom sheet 形态） */
@media (max-width: 900px) {
  .map-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    z-index: 45;
    width: 100%;
    max-width: none;
    height: 70vh;
    border-left: none;
    border-top: 1px solid var(--line-soft);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
  }
  /* 移动端底部抽屉宽度固定，隐藏拖拽把手 */
  .map-resize-handle {
    display: none;
  }
  /* 顶部抓柄：上下拖拽调整抽屉高度（40vh~92vh，解经抽屉同款） */
  .sheet-grabber {
    display: block;
    position: relative;
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
  /* 双视图切换（可读性核心改动）：地图整屏 / 列表整屏，不再上下挤在一屏 */
  .view-tabs {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 0.4rem 0.8rem 0.5rem;
    border-bottom: 1px solid var(--line-soft);
  }
  .view-tabs button {
    flex: 1;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-pill);
    background: #fff;
    color: var(--muted);
    font-size: 0.88rem;
    font-weight: 600;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    transition: background var(--dur) var(--ease), color var(--dur) var(--ease), border-color var(--dur) var(--ease);
  }
  .view-tabs button.active {
    background: var(--gold-soft);
    border-color: var(--gold);
    color: var(--gold);
  }
  .map-body {
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 双视图各自内部滚动 */
    padding: 0.7rem 0.9rem 1.2rem;
  }
  .view-map {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    position: static; /* 桌面 sticky 在移动端关闭 */
    padding-top: 0;
    margin-top: 0;
    background: transparent;
  }
  .map-frame {
    flex: 1;
    min-height: 0;
    height: auto; /* 高度随抽屉自适应（整屏地图） */
    margin-bottom: 0.5rem;
  }
  .view-listsec {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  /* 列表视图下隐藏地图区（v-show 已隐藏 view-map，此处保证 body 不留白） */
  .map-body.view-list {
    display: block;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .map-body.view-list .view-listsec {
    overflow: visible;
  }
  /* 列表条目：移动端加大触控行高（可读性） */
  .map-item-btn {
    padding: 0.7rem 0.4rem;
  }
  .map-item-name {
    font-size: 1rem;
  }
  .map-item-brief {
    font-size: 0.84rem;
  }
  .map-item-go {
    opacity: 0.55; /* 触屏无 hover：常显定位提示 */
    align-self: center;
  }
  .map-period-row {
    margin-bottom: 0.5rem;
  }
  .map-attrib {
    margin-bottom: 0.4rem;
  }
}
</style>
