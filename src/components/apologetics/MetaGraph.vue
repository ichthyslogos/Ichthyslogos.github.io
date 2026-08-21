<script setup>
/**
 * MetaGraph — 护教「主题间总图谱」画布（护教页落地视图）
 *
 * 把全部护教主题按论证角色（核心结论 / 命题 / 证据 / 反方质疑 / 应用）连接成一张
 * 论证「基督教信仰客观性」的整体图谱：
 *   点击任一主题节点 → 下钻到该主题内部的论证图（命题 → 质疑 → 回应 → 证据）。
 * 左侧「主题索引」为可伸缩抽屉（与解经/地图抽屉同款：右缘手柄调宽 + 宽度持久化）：
 *   桌面默认展开、移动端默认收起（点「主题」按钮滑出）。
 * 顶栏「复位」按钮复原全部主题词条：清空过滤 + 节点回到原始构图 + 适配视图。
 */
import { ref, computed, nextTick, watch, onMounted, onUnmounted, markRaw } from 'vue'
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { buildTopicGraphMeta, META_THESIS } from '../../lib/apologeticsMeta.js'
import MetaThesisNode from './graph/MetaThesisNode.vue'
import MetaTopicNode from './graph/MetaTopicNode.vue'

const props = defineProps({
  topics: { type: Array, default: () => [] },
})
const emit = defineEmits(['open-topic'])

/** 节点渲染类目可过滤 */
const ROLE_LIST = [
  { key: 'all', label: '全部', color: '#a7adb6' },
  { key: 'claim', label: '命题', color: '#2f5d9e' },
  { key: 'evidence', label: '证据', color: '#7a5f9e' },
  { key: 'objection', label: '反方质疑', color: '#b3452e' },
  { key: 'application', label: '应用', color: '#3d7a80' },
]

const nodeTypes = markRaw({
  'meta-thesis': MetaThesisNode,
  'meta-topic': MetaTopicNode,
})

/** 完整总图谱 */
const allNodes = ref([])
const allEdges = ref([])
const nodes = ref([])
const edges = ref([])

/** 节点原始构图位置（「复位/复原词条」用） */
const originPos = ref(new Map())

const { fitView, onNodeClick, setCenter } = useVueFlow()

/** 角色过滤 + 搜索 */
const roleFilter = ref('all')
const query = ref('')

const shownTopicIds = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allNodes.value
    .filter((n) => n.type === 'meta-topic')
    .filter((n) => (roleFilter.value === 'all' ? true : n.data.role === roleFilter.value))
    .filter((n) => !q || (n.data.titleZh + ' ' + n.data.titleEn).toLowerCase().includes(q))
    .map((n) => n.id)
})

/** 依据过滤重建可见节点/边 */
function applyFilter() {
  const s = new Set(shownTopicIds.value)
  s.add('__thesis__')
  nodes.value = allNodes.value.filter((n) => s.has(n.id))
  const keep = new Set(nodes.value.map((n) => n.id))
  edges.value = allEdges.value.filter((e) => keep.has(e.source) && keep.has(e.target))
}

watch([roleFilter, query], () => { applyFilter(); nextTick(() => fitView({ padding: 0.15, maxZoom: 1, duration: 200 })) })

function buildGraph() {
  const g = buildTopicGraphMeta(props.topics)
  allNodes.value = g.nodes
  allEdges.value = g.edges
  originPos.value = new Map(g.nodes.map((n) => [n.id, { ...n.position }]))
  applyFilter()
}

watch(
  () => props.topics.length,
  async () => {
    if (!props.topics.length) return
    buildGraph()
    await nextTick()
    fitView({ padding: 0.2, maxZoom: 1.1, duration: 300 })
  },
)

onNodeClick(({ node }) => {
  if (node.data?.topicId) emit('open-topic', node.data.topicId)
})

/** 下钻主题 */
function openTopic(id) {
  emit('open-topic', id)
}

/** 复位：复原全部主题词条（清空过滤 + 节点回到原始构图 + 适配视图） */
function resetAll() {
  query.value = ''
  roleFilter.value = 'all'
  for (const n of allNodes.value) {
    const p = originPos.value.get(n.id)
    if (p) n.position = { x: p.x, y: p.y }
  }
  applyFilter()
  nextTick(() => fitView({ padding: 0.2, maxZoom: 1.1, duration: 300 }))
}

/** —— 可伸缩抽屉（与解经/地图抽屉同款）：右缘手柄调宽 + 宽度持久化 —— */
const INDEX_WIDTH_STORAGE = 'apologetics-index-width'
const indexWidth = ref(null) // null = CSS 默认宽度
const indexResizing = ref(false)
const INDEX_DEFAULT_WIDTH = 320
let idxStartX = 0
let idxStartW = 0

function clampIndexWidth(w) {
  const min = 264
  const max = Math.round(window.innerWidth * 0.6)
  return Math.min(Math.max(Math.round(w), min), max)
}
function startIndexResize(e) {
  e.preventDefault()
  indexResizing.value = true
  idxStartX = e.clientX
  idxStartW = indexWidth.value ?? INDEX_DEFAULT_WIDTH
  document.body.classList.add('panel-resizing')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onIndexResizeMove(e) {
  if (!indexResizing.value) return
  const dx = e.clientX - idxStartX // 向右拖（dx>0）抽屉变宽
  indexWidth.value = clampIndexWidth(idxStartW + dx)
}
function endIndexResize() {
  if (!indexResizing.value) return
  indexResizing.value = false
  document.body.classList.remove('panel-resizing')
  if (indexWidth.value) localStorage.setItem(INDEX_WIDTH_STORAGE, String(indexWidth.value))
}

/** —— 移动端底部抽屉（地图信息栏同款）：顶部抓柄垂直调高 + 持久化 —— */
const SHEET_H_STORAGE = 'apologetics-index-sheet-height'
const sheetH = ref(null)
const sheetResizing = ref(false)
let sY = 0
let sH = 0
function clampSheetHeight(h) {
  const vh = window.innerHeight
  return Math.min(Math.max(Math.round(h), Math.round(vh * 0.4)), Math.round(vh * 0.92))
}
function startSheetResize(e) {
  e.preventDefault()
  sheetResizing.value = true
  sY = e.clientY
  sH = sheetH.value ?? Math.round(window.innerHeight * 0.46)
  document.body.classList.add('panel-resizing')
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onSheetResizeMove(e) {
  if (!sheetResizing.value) return
  const dy = sY - e.clientY // 向上拖（dy>0）抽屉变高
  sheetH.value = clampSheetHeight(sH + dy)
}
function endSheetResize() {
  if (!sheetResizing.value) return
  sheetResizing.value = false
  document.body.classList.remove('panel-resizing')
  if (sheetH.value) localStorage.setItem(SHEET_H_STORAGE, String(sheetH.value))
}

/** 抽屉容器样式：桌面受宽（调宽手柄）、移动端受高（底部抓柄） */
const drawerStyle = computed(() => {
  const s = {}
  if (isMobileView.value) {
    if (sheetH.value) s.height = sheetH.value + 'px'
  } else if (indexWidth.value) {
    s.width = indexWidth.value + 'px'
  }
  return s
})

/** 标题栏折叠（读经页沉浸阅读同款，仅移动端）：隐藏标题区，画布扩大 */
const topCollapsed = ref(false)

/** 响应式移动端判定 */
const isMobileView = ref(window.matchMedia('(max-width: 900px)').matches)

/** 抽屉默认：桌面展开 / 移动收起 */
const indexOpen = ref(!window.matchMedia('(max-width: 900px)').matches)

/** 图例左偏移量避免被展开的抽屉遮挡（桌面抽屉展开时右移抽屉宽度） */
const legendLeft = computed(() => {
  if (isMobileView.value || !indexOpen.value) return '12px'
  return (indexWidth.value ?? INDEX_DEFAULT_WIDTH) + 12 + 'px'
})

onMounted(() => {
  const saved = Number(localStorage.getItem(INDEX_WIDTH_STORAGE))
  if (saved) indexWidth.value = clampIndexWidth(saved)
  const savedH = Number(localStorage.getItem(SHEET_H_STORAGE))
  if (savedH) sheetH.value = clampSheetHeight(savedH)
  window.addEventListener('resize', onWindowResize)
  if (props.topics.length) {
    buildGraph()
    nextTick(() => fitView({ padding: 0.2, maxZoom: 1.1, duration: 0 }))
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})
function onWindowResize() {
  isMobileView.value = window.matchMedia('(max-width: 900px)').matches
  if (indexWidth.value) indexWidth.value = clampIndexWidth(indexWidth.value)
  if (sheetH.value) sheetH.value = clampSheetHeight(sheetH.value)
}

const LEGEND = [
  { label: '支持', color: '#2f6f4f' },
  { label: '提供证据', color: '#7a5f9e' },
  { label: '依赖', color: '#3d7a80' },
  { label: '回应', color: '#2f5d9e' },
  { label: '反驳', color: '#b3452e' },
]
</script>

<template>
  <div class="meta-graph">
    <!-- 顶部工具条 -->
    <header class="mg-topbar">
      <div class="mg-title-wrap" v-show="!topCollapsed">
        <span class="mg-flag">总论证图谱</span>
        <span class="mg-title">{{ META_THESIS.titleZh }}</span>
        <span class="mg-title-en">{{ META_THESIS.titleEn }}</span>
      </div>
      <div class="mg-tools">
        <span class="mg-theme" v-show="!topCollapsed">{{ META_THESIS.claim }}</span>
        <div class="mg-btn-group">
          <button
            class="mg-btn mg-immersive"
            :aria-pressed="topCollapsed"
            :title="topCollapsed ? '展开标题栏' : '收起标题栏，扩大图谱区'"
            @click="topCollapsed = !topCollapsed"
          >
            <span class="mg-im-icon" aria-hidden="true">{{ topCollapsed ? '⤡' : '⤢' }}</span>{{ topCollapsed ? '展开' : '收起' }}
          </button>
          <button class="mg-btn" :class="{ on: indexOpen }" @click="indexOpen = !indexOpen" title="打开/收起主题索引抽屉">
            ☰ 主题
          </button>
          <button class="mg-btn" @click="resetAll" title="复原全部主题词条（清空过滤、节点回到原始构图）">
            复位
          </button>
          <button class="mg-btn" @click="fitView({ padding: 0.2, maxZoom: 1.1, duration: 260 })" title="缩放以完整显示图谱">适配视图</button>
        </div>
      </div>
    </header>

    <div class="mg-body">
      <!-- 移动端抽屉打开时的遮罩 -->
      <div v-if="indexOpen && isMobileView" class="mg-scrim" @click="indexOpen = false"></div>

      <!-- 主题索引抽屉（可伸缩；常驻 DOM，closed 类控制滑入/滑出） -->
      <aside
        class="mg-index"
        :class="{ closed: !indexOpen }"
        :style="drawerStyle"
      >
        <!-- 移动端底部抽屉抓柄（地图信息栏同款；桌面隐藏） -->
        <div
          class="mg-sheet-grab"
          :class="{ dragging: sheetResizing }"
          role="separator"
          aria-orientation="horizontal"
          aria-label="拖动调整索引抽屉高度"
          @pointerdown="startSheetResize"
          @pointermove="onSheetResizeMove"
          @pointerup="endSheetResize"
          @pointercancel="endSheetResize"
        ></div>
        <div
          class="mg-index-resize"
          :class="{ dragging: indexResizing }"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整主题索引宽度"
          @pointerdown="startIndexResize"
          @pointermove="onIndexResizeMove"
          @pointerup="endIndexResize"
          @pointercancel="endIndexResize"
        ></div>
        <header class="mg-index-head">
          <div class="mg-index-title">主题索引</div>
          <div class="mg-index-head-actions">
            <button class="mg-index-reset" @click="resetAll" title="复原全部主题词条（清空过滤、显示全部）">复位</button>
            <button class="mg-index-close" @click="indexOpen = false" aria-label="收起主题索引">✕</button>
          </div>
        </header>
        <!-- 搜索 / 筛选 / 列表并入同一滚动容器（地图信息栏同款：整个内容区可滚动） -->
        <div class="mg-scroll">
          <input v-model="query" class="mg-search" type="search" placeholder="搜索主题…" />
          <div class="mg-roles">
            <button
              v-for="r in ROLE_LIST"
              :key="r.key"
              class="mg-role"
              :class="{ on: roleFilter === r.key }"
              @click="roleFilter = r.key"
            >
              <span class="mg-role-dot" :style="{ background: r.color }"></span>{{ r.label }}
            </button>
          </div>
          <div class="mg-list">
            <button
              v-for="n in allNodes.filter((x) => x.type === 'meta-topic')"
              :key="n.id"
              class="mg-item"
              :class="{ hidden: !shownTopicIds.includes(n.id) }"
              @click="openTopic(n.data.topicId)"
            >
              <span class="mg-role-chip" :class="'chip-' + n.data.role">{{ n.data.roleLabel }}</span>
              <span class="mg-item-title">{{ n.data.titleZh }}</span>
              <span class="mg-arrow">→</span>
            </button>
          </div>
          <p class="mg-tip">点任意主题节点或条目，展开其内部论证图</p>
        </div>
      </aside>

      <!-- 画布 -->
      <div v-if="nodes.length" class="mg-canvas">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :min-zoom="0.1"
          :max-zoom="3"
          :delete-key-code="null"
          :nodes-draggable="true"
          :nodes-connectable="false"
          :fit-view-on-init="false"
          :node-types="nodeTypes"
          class="mg-flow"
        >
          <Background :gap="24" :size="1.4" pattern-color="#e4dfd6" />
          <MiniMap
            :node-color="(n) => ({ 'meta-thesis':'#8b7355', 'meta-topic': ({ claim:'#2f5d9e', evidence:'#7a5f9e', objection:'#b3452e', application:'#3d7a80' }[n.data?.role] || '#c9c4bb') }[n.type] || '#c9c4bb')"
            pannable
            zoomable
            mask-color="rgba(250, 249, 247, 0.65)"
          />
          <Controls :show-interactive="false" />
        </VueFlow>

        <!-- 图例 -->
        <div class="mg-legend" :style="{ left: legendLeft }">
          <span v-for="lg in LEGEND" :key="lg.label" class="mg-legend-item">
            <span class="mg-legend-line" :style="{ background: lg.color }"></span>{{ lg.label }}
          </span>
        </div>
        <div class="mg-hint">拖拽移动节点 · 滚轮缩放 · 点击主题节点查看其论证细节</div>
      </div>
      <div v-else class="mg-empty">暂无主题数据</div>
    </div>
  </div>
</template>

<style scoped>
.meta-graph {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mg-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  padding: 0.75rem 1.2rem;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(6px);
  z-index: 10;
}
.mg-title-wrap { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; min-width: 0; }
.mg-flag {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; color: #fff;
  background: var(--gold); border-radius: 999px; padding: 0.14rem 0.7rem; flex-shrink: 0;
}
.mg-title { font-family: var(--serif); font-weight: 700; font-size: 1.28rem; color: var(--text); line-height: 1.3; }
.mg-title-en { font-size: 0.84rem; color: #a7adb6; letter-spacing: 0.04em; }
.mg-tools { margin-left: auto; display: flex; align-items: center; gap: 1rem; min-width: 0; }
.mg-theme { max-width: 26rem; font-size: var(--fs-xs); color: var(--muted); line-height: 1.7; }
.mg-btn-group { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.mg-btn {
  flex-shrink: 0; border: 1px solid var(--line); border-radius: 999px; background: var(--panel);
  color: var(--text); font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.85rem;
  cursor: pointer; white-space: nowrap;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.mg-btn:hover { border-color: var(--gold); color: var(--gold); }
.mg-btn.on { border-color: var(--gold); background: var(--gold-soft); color: var(--gold); }
/* 标题栏折叠按钮（读经页沉浸阅读同款，仅移动端显示） */
.mg-immersive { display: none; align-items: center; gap: 0.3rem; }

.mg-body { flex: 1; min-height: 0; display: flex; position: relative; }
.mg-canvas { position: relative; flex: 1; min-width: 0; background: radial-gradient(circle at 15% 20%, #fdfcfa 0%, var(--bg) 70%); }
.mg-flow { width: 100%; height: 100%; }
.mg-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); }

/* 主题索引抽屉 */
.mg-index {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 20rem;
  z-index: 30;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(6px);
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.22s var(--ease), opacity 0.22s var(--ease), box-shadow 0.22s var(--ease), visibility 0.22s var(--ease);
}
/* 收起态：滑出左侧并隐藏（常驻 DOM，仅控制可见性） */
.mg-index.closed {
  transform: translateX(-105%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  box-shadow: none;
}
/* 右缘调宽手柄（与解经/地图抽屉同款） */
.mg-index-resize {
  position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
  cursor: col-resize; z-index: 20; touch-action: none; background: transparent;
  transition: background var(--dur) var(--ease), opacity var(--dur) var(--ease);
}
.mg-index-resize:hover, .mg-index-resize.dragging { background: var(--accent); opacity: 0.35; }
/* 移动端底部抽屉抓柄（地图信息栏同款；桌面隐藏） */
.mg-sheet-grab {
  display: none;
  position: relative;
  flex-shrink: 0;
  height: 20px;
  cursor: ns-resize;
  touch-action: none;
}
.mg-sheet-grab::after {
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
.mg-sheet-grab:hover::after, .mg-sheet-grab.dragging::after { background: var(--gold); }
:global(.panel-resizing) { user-select: none; cursor: col-resize; }

.mg-index-head { display: flex; align-items: center; justify-content: space-between; padding: 0.8rem 1rem 0.4rem; }
.mg-index-head-actions { display: flex; align-items: center; gap: 0.35rem; }
.mg-index-title { font-size: 0.72rem; font-weight: 700; color: #a7adb6; letter-spacing: 0.16em; }
.mg-index-reset {
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel);
  color: var(--muted); font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.6rem; cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.mg-index-reset:hover { border-color: var(--gold); color: var(--gold); }
.mg-index-close {
  border: none; background: transparent; color: var(--muted); font-size: 0.85rem;
  width: 1.55rem; height: 1.55rem; display: grid; place-items: center; border-radius: 50%; cursor: pointer;
}
.mg-index-close:hover { color: var(--gold); background: var(--gold-soft); }

.mg-search {
  margin: 0 1rem 0.6rem; border: 1px solid var(--line); border-radius: 999px;
  background: var(--panel); color: var(--text); font-size: 0.82rem;
  padding: 0.42rem 0.85rem; outline: none;
}
.mg-search:focus { border-color: var(--gold); }
.mg-roles { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0 1rem 0.7rem; border-bottom: 1px solid var(--line-soft); }
.mg-role {
  display: inline-flex; align-items: center; gap: 0.35rem;
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel);
  color: var(--text); font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem;
  transition: all var(--dur) var(--ease);
}
.mg-role:hover { border-color: var(--gold); color: var(--gold); }
.mg-role.on { border-color: var(--gold); background: var(--gold-soft); color: var(--gold); }
.mg-role-dot { width: 8px; height: 8px; border-radius: 50%; }

.mg-scroll { flex: 1; min-height: 0; overflow-y: auto; scrollbar-gutter: stable; -webkit-overflow-scrolling: touch; }
.mg-list { padding: 0.15rem 0.6rem 0.3rem; }
.mg-item {
  display: flex; align-items: center; gap: 0.5rem; width: 100%;
  border: none; background: transparent; border-radius: var(--radius-sm);
  padding: 0.5rem 0.6rem; text-align: left; font-size: 0.84rem; color: var(--text);
  transition: background var(--dur) var(--ease);
}
.mg-item:hover { background: var(--gold-soft); }
.mg-item.hidden { display: none; }
.mg-role-chip {
  flex-shrink: 0; font-size: 0.64rem; font-weight: 700; color: #fff;
  border-radius: 999px; padding: 0.08rem 0.5rem; letter-spacing: 0.04em;
}
.chip-claim { background: var(--accent); }
.chip-evidence { background: #7a5f9e; }
.chip-objection { background: #b3452e; }
.chip-application { background: #3d7a80; }
.mg-item-title { flex: 1; min-width: 0; line-height: 1.45; }
.mg-arrow { flex-shrink: 0; color: var(--gold); font-size: 0.85rem; }

.mg-tip { margin: 0; padding: 0.7rem 1rem; border-top: 1px solid var(--line-soft); font-size: 0.72rem; color: var(--muted); }

/* 移动端抽屉遮罩 */
.mg-scrim { position: fixed; inset: 0; z-index: 29; background: rgba(20, 18, 16, 0.35); transition: opacity 0.22s var(--ease); }

/* 图例 */
.mg-legend {
  position: absolute; bottom: 0.9rem; z-index: 6;
  display: flex; flex-direction: column; gap: 4px; transition: left var(--dur) var(--ease);
  background: rgba(255, 255, 255, 0.92); border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm); padding: 0.5rem 0.7rem;
  font-size: 0.7rem; color: var(--muted);
}
.mg-legend-item { display: flex; align-items: center; gap: 0.45rem; }
.mg-legend-line { width: 18px; height: 3px; border-radius: 2px; }
.mg-hint {
  position: absolute; right: 0.9rem; bottom: 0.9rem; z-index: 6;
  font-size: 0.7rem; color: #a6adb8; background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--line-soft); border-radius: 999px; padding: 0.3rem 0.85rem;
  pointer-events: none;
}

/* 窄屏（≤900px）：顶栏收紧标题、隐藏说明；抽屉改左侧 fixed 覆盖层 */
@media (max-width: 900px) {
  .mg-topbar { padding: 0.6rem 0.9rem; gap: 0.6rem; }
  .mg-theme { display: none; }
  .mg-title { font-size: 1.05rem; }
  .mg-title-en { font-size: 0.74rem; }
  .mg-flag { font-size: 0.62rem; padding: 0.12rem 0.6rem; }
  .mg-btn { font-size: 0.72rem; padding: 0.28rem 0.75rem; }
  /* 标题栏折叠按钮于移动端显示（读经页沉浸阅读同款） */
  .mg-immersive { display: inline-flex; }
  .mg-im-icon { font-size: 0.85rem; line-height: 1; }
  /* 索引抽屉 → 底部抽屉（地图信息栏同款）：收起时滑出屏幕下方 */
  .mg-index {
    position: fixed;
    left: 0; right: 0; top: auto; bottom: 0;
    width: 100%;
    height: 46vh;
    z-index: 40;
    border-right: none;
    border-top: 1px solid var(--line-soft);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18);
    transition: transform 0.25s var(--ease), opacity 0.22s var(--ease), box-shadow 0.25s var(--ease), visibility 0.25s var(--ease);
  }
  .mg-index.closed {
    transform: translateY(100%);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    box-shadow: none;
  }
  .mg-index-resize { display: none; }
  .mg-sheet-grab { display: block; }
  /* 遮罩置于抽屉之下 */
  .mg-scrim { z-index: 39; }
}
@media (max-width: 640px) {
  .mg-title-en { display: none; }
  .mg-hint { display: none; }
}
@media (max-width: 480px) {
  .mg-flag { display: none; }
  .mg-title { font-size: 0.98rem; }
}
</style>