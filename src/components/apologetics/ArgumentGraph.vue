<script setup>
/**
 * ArgumentGraph — 护教论证图谱画布（Vue Flow 引擎，图谱优先）
 *
 * 把主题数据以「无限画布 + 逻辑节点 + 关系边」呈现，支持：
 *   拖拽节点 / 缩放平移 / MiniMap / Controls / 双击定位 / 关系图例 /
 *   节点点击 → 右侧详情面板（含全文阅读与经文深链）
 *
 * 图层（自上而下逻辑流）：核心命题 → 命题 → 质疑 → 回应 → 证据/经文
 * 关系：探讨 contains / 反驳 refutes / 支持 supports / 回应 responds_to / 提供证据 evidences
 */
import { ref, computed, nextTick, watch, onMounted, onUnmounted, markRaw } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import { Background } from '@vue-flow/background'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

import { buildTopicGraph } from '../../lib/apologeticsGraph.js'
import ScriptureReference from './ScriptureReference.vue'
import { fetchApologeticsTopic } from '../../lib/data.js'
import GraphTopicNode from './graph/GraphTopicNode.vue'
import GraphClaimNode from './graph/GraphClaimNode.vue'
import GraphObjectionNode from './graph/GraphObjectionNode.vue'
import GraphResponseNode from './graph/GraphResponseNode.vue'
import GraphEvidenceNode from './graph/GraphEvidenceNode.vue'
import GraphScriptureNode from './graph/GraphScriptureNode.vue'

/** 自定义节点注册表（通过 :node-types 显式注册，版本稳定；markRaw 避免组件被 reactive 包装） */
const nodeTypes = markRaw({
  'graph-topic': GraphTopicNode,
  'graph-claim': GraphClaimNode,
  'graph-objection': GraphObjectionNode,
  'graph-response': GraphResponseNode,
  'graph-evidence': GraphEvidenceNode,
  'graph-scripture': GraphScriptureNode,
})

const props = defineProps({
  topicId: { type: String, required: true },
})
const emit = defineEmits(['back'])

/** 主题完整数据（图谱源）；切片加载中显示加载态 */
const topic = ref(null)
const loading = ref(false)
const error = ref('')

/** 完整图谱（含证据层，恒展示；保留节点拖拽状态） */
const allNodes = ref([])
const allEdges = ref([])
/** 当前展示的节点/边（Vue Flow 双向绑定） */
const nodes = ref([])
const edges = ref([])

/** —— 内容筛选（与主题总图谱同款）：关键词 + 角色 —— */
const query = ref('')
const roleFilter = ref('all')
const ARG_ROLES = [
  { key: 'all', label: '全部', color: '#a7adb6' },
  { key: 'claim', label: '命题', color: '#2f5d9e' },
  { key: 'objection', label: '质疑', color: '#b3452e' },
  { key: 'response', label: '回应', color: '#2f6f4f' },
  { key: 'evidence', label: '证据', color: '#7a5f9e' },
]
const ARG_ROLE_MAP = {
  'graph-claim': 'claim',
  'graph-objection': 'objection',
  'graph-response': 'response',
  'graph-evidence': 'evidence',
  'graph-scripture': 'evidence',
}
/** 节点检索文本（多字段合并） */
function argLabel(n) {
  const d = n.data || {}
  return [d.question, d.titleZh, d.titleEn, d.text, d.ref, d.note].filter(Boolean).join(' ')
}

// Vue Flow 实例工具
const { fitView, project, onNodeClick, setViewport, setCenter, onNodesInitialized } = useVueFlow()

/** 节点测量完成后自动适配视口（fitView 需节点已渲染测量，否则静默失败） */
onNodesInitialized(() => fitView({ padding: 0.2, maxZoom: 1.1, duration: 300 }))

/** 加载主题切片并构建图谱 */
let seq = 0
async function load() {
  loading.value = true
  error.value = ''
  const s = ++seq
  try {
    const t = await fetchApologeticsTopic(props.topicId)
    if (s !== seq) return
    topic.value = t
    const g = buildTopicGraph(t)
    allNodes.value = g.nodes
    allEdges.value = g.edges
    originPos.value = new Map(g.nodes.map((n) => [n.id, { ...n.position }]))
    applyFilter()
  } catch (e) {
    if (s === seq) error.value = e.message
  } finally {
    if (s === seq) loading.value = false
  }
}

/** 依据证据开关 + 筛选（关键词/角色）重建可见节点/边 */
function applyFilter() {
  let list = allNodes.value
  const q = query.value.trim().toLowerCase()
  const role = roleFilter.value
  list = list.filter((n) => {
    if (n.type === 'graph-topic') return true // 核心命题恒显
    const r = ARG_ROLE_MAP[n.type]
    if (!r) return false
    if (role !== 'all' && r !== role) return false
    if (q && !argLabel(n).toLowerCase().includes(q)) return false
    return true
  })
  nodes.value = list
  const keep = new Set(list.map((n) => n.id))
  edges.value = allEdges.value.filter((e) => keep.has(e.source) && keep.has(e.target))
}

/** 搜索/角色筛选变更：重建图谱并重定位视口 */
watch([roleFilter, query], () => {
  applyFilter()
  nextTick(() => fitView({ padding: 0.15, maxZoom: 1, duration: 200 }))
})

/** 图谱构建完成后自动适配视口 */
watch(
  () => allNodes.value.length,
  async () => {
    await nextTick()
    fitView({ padding: 0.2, maxZoom: 1.1, duration: 300 })
  },
)

/** 选中的节点（右侧详情面板数据） */
const selected = ref(null)

onNodeClick(({ node }) => {
  selected.value = node
})

/** 关闭详情面板 */
function closePanel() {
  selected.value = null
}

/** 图例：关系类型说明 */
const LEGEND = [
  { label: '探讨', color: '#a0896a' },
  { label: '反驳', color: '#b3452e' },
  { label: '回应', color: '#2f5d9e' },
  { label: '支持', color: '#2f6f4f' },
  { label: '提供证据', color: '#7a5f9e' },
]

/** 面板对应子命题（用于 claim/objection/response 关联内容） */
const selectedSQ = computed(() => {
  if (!selected.value || !topic.value) return null
  return topic.value.sub_questions?.find((q) => q.id === selected.value.data?.sqId) || null
})

/** 统计数据：节点数 / 命题数 / 质疑数 / 回应数 / 证据数 */
const stats = computed(() => {
  const count = (type) => allNodes.value.filter((n) => n.type === type).length
  return {
    topic: 1,
    claim: count('graph-claim'),
    objection: count('graph-objection'),
    response: count('graph-response'),
    evidence: allNodes.value.filter((n) => ['graph-evidence', 'graph-scripture'].includes(n.type)).length,
  }
})

/** 面板中经文引用呈显（bible 类 → 可深链读经页） */
function evidenceItems(sq) {
  const out = []
  for (const key of ['bible', 'philosophy', 'history', 'science', 'theology', 'ethics', 'literature']) {
    for (const it of sq?.evidence?.[key] || []) out.push({ category: key, label: CAT_LABEL[key], ...it })
  }
  return out
}
const CAT_LABEL = { bible: '圣经', philosophy: '哲学', history: '历史', science: '科学', theology: '神学', ethics: '伦理', literature: '文献' }

/** —— 复位：节点原始构图位置（复位时还原） —— */
const originPos = ref(new Map())

/** 索引清单：命题 / 质疑 / 回应（按逻辑流排序），点击定位到对应节点并打开详情 */
const INDEX_TYPES = [
  { type: 'graph-claim', roleLabel: '命题', chip: 'chip-claim' },
  { type: 'graph-objection', roleLabel: '质疑', chip: 'chip-objection' },
  { type: 'graph-response', roleLabel: '回应', chip: 'chip-response' },
]
const indexItems = computed(() => {
  const rows = []
  for (const g of INDEX_TYPES) {
    for (const n of allNodes.value.filter((x) => x.type === g.type)) {
      rows.push({
        id: n.id,
        type: g.type,
        roleLabel: g.roleLabel,
        chip: g.chip,
        label: n.data?.question || n.data?.titleZh || n.data?.text || '…',
      })
    }
  }
  return rows
})

/** 索引中应显示的条目 id（与筛选匹配；用于隐藏不匹配项） */
const indexShownIds = computed(() => {
  const s = new Set()
  const q = query.value.trim().toLowerCase()
  const role = roleFilter.value
  for (const n of allNodes.value) {
    const r = ARG_ROLE_MAP[n.type]
    if (!r) continue
    if (role !== 'all' && r !== role) continue
    if (q && !argLabel(n).toLowerCase().includes(q)) continue
    s.add(n.id)
  }
  return s
})

/** 复位：复原该主题全部词条（清空筛选 + 节点回原始构图 + 关闭详情 + 适配视图） */
function resetTopic() {
  query.value = ''
  roleFilter.value = 'all'
  for (const n of allNodes.value) {
    const p = originPos.value.get(n.id)
    if (p) n.position = { x: p.x, y: p.y }
  }
  selected.value = null
  applyFilter()
  nextTick(() => fitView({ padding: 0.2, maxZoom: 1.1, duration: 300 }))
}

/** 索引点击：定位到该节点（居中）并打开详情面板 */
function jumpTo(id) {
  const n = allNodes.value.find((x) => x.id === id)
  if (!n) return
  selected.value = n
  const w = n.type === 'graph-topic' ? 300 : n.type === 'graph-claim' || n.type === 'graph-response' ? 280 : 200
  setCenter(n.position.x + w / 2, n.position.y + 96, { zoom: 0.9, duration: 320 })
}

/** —— 可伸缩索引抽屉（与解经/地图/主题索引抽屉同款）：右缘手柄调宽 + 宽度持久化 —— */
const INDEX_WIDTH_STORAGE = 'apologetics-topic-index-width'
const indexWidth = ref(null)
const indexResizing = ref(false)
const INDEX_DEFAULT_WIDTH = 312
let idxStartX = 0
let idxStartW = 0

function clampIndexWidth(w) {
  return Math.min(Math.max(Math.round(w), 264), Math.round(window.innerWidth * 0.6))
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
  const dx = e.clientX - idxStartX
  indexWidth.value = clampIndexWidth(idxStartW + dx)
}
function endIndexResize() {
  if (!indexResizing.value) return
  indexResizing.value = false
  document.body.classList.remove('panel-resizing')
  if (indexWidth.value) localStorage.setItem(INDEX_WIDTH_STORAGE, String(indexWidth.value))
}

/** 响应式移动端判定 + 抽屉默认：桌面展开 / 移动收起 */
const isMobileView = ref(window.matchMedia('(max-width: 900px)').matches)
const indexOpen = ref(!window.matchMedia('(max-width: 900px)').matches)

/** —— 移动端底部抽屉（地图信息栏同款）：顶部抓柄垂直调高 + 持久化 —— */
const SHEET_H_STORAGE = 'apologetics-arg-sheet-height'
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

/** 图例左偏移：桌面抽屉展开时向右避开抽屉 */
const legendLeft = computed(() => {
  if (isMobileView.value || !indexOpen.value) return '0.9rem'
  return (indexWidth.value ?? INDEX_DEFAULT_WIDTH) + 14 + 'px'
})

onMounted(() => {
  const saved = Number(localStorage.getItem(INDEX_WIDTH_STORAGE))
  if (saved) indexWidth.value = clampIndexWidth(saved)
  const savedH = Number(localStorage.getItem(SHEET_H_STORAGE))
  if (savedH) sheetH.value = clampSheetHeight(savedH)
  window.addEventListener('resize', onWindowResize)
  load()
})
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})
function onWindowResize() {
  isMobileView.value = window.matchMedia('(max-width: 900px)').matches
  if (indexWidth.value) indexWidth.value = clampIndexWidth(indexWidth.value)
  if (sheetH.value) sheetH.value = clampSheetHeight(sheetH.value)
}
</script>

<template>
  <div class="arg-graph">
    <!-- 顶部工具条 -->
    <header class="ag-topbar" :class="{ 'ag-collapsed': topCollapsed }">
      <button class="ag-back" @click="emit('back')">← 所有主题</button>
      <div v-if="topic" class="ag-title-wrap" v-show="!topCollapsed">
        <span class="ag-title">{{ topic.title?.zh }}</span>
        <span class="ag-title-en">{{ topic.title?.en }}</span>
      </div>
      <div class="ag-tools">
        <span class="ag-stats">命题 {{ stats.claim }} · 质疑 {{ stats.objection }} · 回应 {{ stats.response }} · 证据 {{ stats.evidence }}</span>
        <button
          class="ag-toggle ag-immersive"
          :aria-pressed="topCollapsed"
          :title="topCollapsed ? '展开标题栏' : '收起标题栏，扩大图谱区'"
          @click="topCollapsed = !topCollapsed"
        >
          <span class="ag-im-icon" aria-hidden="true">{{ topCollapsed ? '⤡' : '⤢' }}</span>{{ topCollapsed ? '展开' : '收起' }}
        </button>
        <button class="ag-toggle" :class="{ on: indexOpen }" @click="indexOpen = !indexOpen" title="打开/收起论证索引">
          ☰ 索引
        </button>
        <button class="ag-toggle" @click="resetTopic" title="复原该主题全部词条（节点回原始构图）">
          复位
        </button>
        <button class="ag-toggle" @click="fitView({ padding: 0.2, maxZoom: 1.1, duration: 260 })">适配视图</button>
      </div>
    </header>

    <!-- 画布区 -->
    <div class="ag-canvas">
      <div v-if="loading" class="ag-state">图谱加载中…</div>
      <div v-else-if="error" class="ag-state">加载失败：{{ error }}</div>

      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.12"
        :max-zoom="2.5"
        :delete-key-code="null"
        :nodes-draggable="!isMobileView"
        :nodes-connectable="false"
        :fit-view-on-init="false"
        :node-types="nodeTypes"
        class="ag-flow"
      >
        <Background :gap="22" :size="1.4" pattern-color="#e4dfd6" />

        <!-- 迷你地图 + 控制按钮 -->
        <MiniMap
          :node-color="(n) => ({ 'graph-topic':'#8b7355', 'graph-claim':'#2f5d9e', 'graph-objection':'#b3452e', 'graph-response':'#2f6f4f', 'graph-evidence':'#7a5f9e', 'graph-scripture':'#9a6b2f' }[n.type] || '#c9c4bb')"
          :node-stroke-color="(n) => ({ 'graph-topic':'#8b7355', 'graph-claim':'#2f5d9e', 'graph-objection':'#b3452e', 'graph-response':'#2f6f4f', 'graph-evidence':'#7a5f9e', 'graph-scripture':'#9a6b2f' }[n.type] || '#c9c4bb')"
          pannable
          zoomable
          mask-color="rgba(250, 249, 247, 0.65)"
        />
        <Controls :show-interactive="false" />
      </VueFlow>

      <!-- 移动端索引抽屉打开时的遮罩 -->
      <div v-if="indexOpen && isMobileView" class="ag-scrim" @click="indexOpen = false"></div>

      <!-- 论证索引抽屉（可伸缩，同解经/地图/主题索引抽屉款） -->
      <aside
        class="ag-index"
        :class="{ closed: !indexOpen }"
        :style="drawerStyle"
      >
        <!-- 移动端底部抽屉抓柄（地图信息栏同款；桌面隐藏） -->
        <div
          class="ag-sheet-grab"
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
          class="ag-index-resize"
          :class="{ dragging: indexResizing }"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整论证索引宽度"
          @pointerdown="startIndexResize"
          @pointermove="onIndexResizeMove"
          @pointerup="endIndexResize"
          @pointercancel="endIndexResize"
        ></div>
        <header class="ag-index-head">
          <div class="ag-index-title">论证索引</div>
          <div class="ag-index-head-actions">
            <button class="ag-index-reset" @click="resetTopic" title="复原该主题全部词条">复位</button>
            <button class="ag-index-close" @click="indexOpen = false" aria-label="收起论证索引">✕</button>
          </div>
        </header>
        <!-- 搜索 / 筛选 / 列表并入同一滚动容器（地图信息栏同款：整个内容区可滚动） -->
        <div class="ag-scroll">
          <input v-model="query" class="ag-search" type="search" placeholder="搜索本主题词条…" />
          <div class="ag-roles">
            <button
              v-for="r in ARG_ROLES"
              :key="r.key"
              class="ag-role"
              :class="{ on: roleFilter === r.key }"
              @click="roleFilter = r.key"
            >
              <span class="ag-role-dot" :style="{ background: r.color }"></span>{{ r.label }}
            </button>
          </div>
          <div class="ag-index-list">
            <button
              v-for="(it, i) in indexItems"
              :key="it.id"
              class="ag-item"
              :class="{ hidden: !indexShownIds.has(it.id), dim: indexOpen && selected && selected.id === it.id }"
              @click="jumpTo(it.id)"
            >
              <span class="ag-index-num">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="ag-role-chip" :class="it.chip">{{ it.roleLabel }}</span>
              <span class="ag-item-title">{{ it.label }}</span>
            </button>
          </div>
          <p class="ag-index-tip">点条目定位该节点并查看论证详情</p>
        </div>
      </aside>

      <!-- 关系图例（左下角浮层；桌面抽屉展开时右移避让） -->
      <div class="ag-legend" :style="{ left: legendLeft }">
        <span v-for="lg in LEGEND" :key="lg.label" class="ag-legend-item">
          <span class="ag-legend-line" :style="{ background: lg.color }"></span>{{ lg.label }}
        </span>
      </div>

      <!-- 提示浮层：引导用户交互 -->
      <div class="ag-hint">{{ isMobileView ? '滚轮缩放 · 点击节点查看论证详情' : '拖拽移动节点 · 滚轮缩放 · 点击节点查看论证详情' }}</div>

      <!-- 右侧详情面板 -->
      <aside v-if="selected" class="ag-panel">
        <div class="ag-panel-head">
          <span class="ag-panel-kind">{{ { topic: '核心命题', claim: '命题', objection: '质疑', response: '回应', evidence: '证据', scripture: '经文' }[selected.data?.kind] }}</span>
          <button class="ag-panel-close" aria-label="关闭" @click="closePanel">×</button>
        </div>
        <div class="ag-panel-body">
          <!-- 命题 -->
          <template v-if="selected.data?.kind === 'claim'">
            <h3 class="ap-q">{{ selected.data.question }}</h3>
            <div class="ap-meta">{{ selected.data.perspective }}<template v-if="selected.data.tags?.length"> · {{ selected.data.tags.join(' · ') }}</template></div>
            <p v-if="selected.data.summary" class="ap-summary">{{ selected.data.summary }}</p>
            <div v-if="selectedSQ?.objection" class="ap-block">
              <span class="ap-block-label c-obj">对象质疑</span>
              <p class="ap-block-text">{{ selectedSQ.objection }}</p>
            </div>
          </template>

          <!-- 质疑 -->
          <template v-else-if="selected.data?.kind === 'objection'">
            <h3 class="ap-q">{{ selected.data.question || '质疑' }}</h3>
            <p class="ap-obj">{{ selected.data.text }}</p>
          </template>

          <!-- 回应（含全文阅读 / 证据清单） -->
          <template v-else-if="selected.data?.kind === 'response'">
            <h3 class="ap-q">{{ selected.data.titleZh }}</h3>
            <div v-if="selected.data.titleEn" class="ap-en">{{ selected.data.titleEn }}</div>
            <div v-if="selected.data.tags?.length" class="ap-meta">{{ selected.data.perspective }} · {{ selected.data.tags.join(' · ') }}</div>
            <p v-if="selected.data.summary" class="ap-summary">{{ selected.data.summary }}</p>
            <div v-if="selectedSQ?.text" class="ap-fulltext">{{ selectedSQ.text }}</div>
          </template>

          <!-- 证据 / 经文 -->
          <template v-else-if="selected.data?.kind === 'evidence' || selected.data?.kind === 'scripture'">
            <h3 class="ap-q">{{ selected.data.kind === 'scripture' ? '经文' : selected.data.categoryLabel + ' · 证据' }}</h3>
            <div class="ap-ref">{{ selected.data.ref }}</div>
            <p v-if="selected.data.note" class="ap-note">{{ selected.data.note }}</p>
            <ScriptureReference v-if="selected.data.kind === 'scripture'" class="ap-scr-link" :ref-text="selected.data.ref" :note="'跳转读经研究'"></ScriptureReference>
          </template>

          <!-- 核心命题 -->
          <template v-else>
            <h3 class="ap-q">{{ selected.data.titleZh }}</h3>
            <div class="ap-en">{{ selected.data.titleEn }}</div>
            <p class="ap-desc">{{ selected.data.description }}</p>
            <p class="ap-stat-hint">该主题下共 {{ stats.claim }} 个命题、{{ stats.evidence }} 条证据，可在画布中逐一展开查看。</p>
          </template>

          <!-- 证据支撑列表（命题/回应共用：展示其所属证据） -->
          <div v-if="selectedSQ && ['claim', 'response', 'objection'].includes(selected.data?.kind) && evidenceItems(selectedSQ).length" class="ap-evidence">
            <div class="ap-ev-title">证据支撑</div>
            <p v-for="(it, i) in evidenceItems(selectedSQ)" :key="i" class="ap-ev-item">
              <span class="ap-ev-cat">{{ it.label }}</span>
              <span class="ap-ev-ref-t">{{ it.ref }}</span>
              <span v-if="it.note" class="ap-ev-note">{{ it.note }}</span>
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.arg-graph {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.ag-topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.7rem 1.2rem;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(6px);
  z-index: 10;
}
.ag-back {
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--text);
  font-size: var(--fs-sm);
  padding: 0.3rem 1rem;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ag-back:hover { border-color: var(--gold); color: var(--gold); }
.ag-title-wrap { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; min-width: 0; }
.ag-title { font-family: var(--serif); font-weight: 700; font-size: 1.15rem; color: var(--text); }
.ag-title-en { font-size: 0.82rem; color: #a7adb6; letter-spacing: 0.03em; }
.ag-tools { margin-left: auto; display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; min-width: 0; }
.ag-stats { font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; }
.ag-toggle {
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--panel);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease), background var(--dur) var(--ease);
}
.ag-toggle:hover { border-color: var(--gold); color: var(--gold); }
.ag-toggle.on { background: var(--gold-soft); border-color: var(--gold); color: var(--gold); }
/* 标题栏折叠按钮（读经页沉浸阅读同款，仅移动端显示） */
.ag-immersive { display: none; align-items: center; gap: 0.3rem; }
.ag-im-icon { font-size: 0.85rem; line-height: 1; }

/* 画布容器：flex 填满剩余高度 */
.ag-canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  background: radial-gradient(circle at 15% 20%, #fdfcfa 0%, var(--bg) 70%);
}
.ag-flow { width: 100%; height: 100%; }
.ag-state {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted); font-size: var(--fs-md);
  background: var(--bg);
}

/* 覆盖 Vue Flow 默认节点框样式（自定义节点自带卡片，去掉默认高亮框） */
.ag-canvas :deep(.vue-flow__node) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}
.ag-canvas :deep(.vue-flow__edge-textbg) { animation: none; }

/* 图例浮层 */
.ag-legend {
  position: absolute; left: 0.9rem; bottom: 0.9rem; z-index: 6;
  display: flex; flex-direction: column; gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
  font-size: 0.7rem; color: var(--muted);
}
.ag-legend-item { display: flex; align-items: center; gap: 0.45rem; }
.ag-legend-line { width: 18px; height: 3px; border-radius: 2px; }

/* 交互提示浮层 */
.ag-hint {
  position: absolute; right: 0.9rem; bottom: 0.9rem; z-index: 6;
  font-size: 0.7rem; color: #a8ae; color: #a6adb8;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-pill);
  padding: 0.3rem 0.85rem;
  pointer-events: none;
}

/* 图例左偏移过渡（抽屉开合时平滑移动） */
.ag-legend { transition: left var(--dur) var(--ease); }

/* ===== 左侧论证索引抽屉（可伸缩，同解经/地图/主题索引抽屉款） ===== */
.ag-index {
  position: absolute; left: 0; top: 0.35rem; bottom: 0.35rem;
  width: 19.5rem;
  z-index: 20;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(6px);
  box-shadow: 4px 0 18px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.22s var(--ease), opacity 0.22s var(--ease), box-shadow 0.22s var(--ease), visibility 0.22s var(--ease);
}
.ag-index.closed {
  transform: translateX(-105%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  box-shadow: none;
}
/* 右缘调宽手柄（同解经/地图抽屉） */
.ag-index-resize {
  position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
  cursor: col-resize; z-index: 21; touch-action: none; background: transparent;
  transition: background var(--dur) var(--ease), opacity var(--dur) var(--ease);
}
.ag-index-resize:hover, .ag-index-resize.dragging { background: var(--accent); opacity: 0.35; }
/* 移动端底部抽屉抓柄（地图信息栏同款；桌面隐藏） */
.ag-sheet-grab {
  display: none;
  position: relative;
  flex-shrink: 0;
  height: 20px;
  cursor: ns-resize;
  touch-action: none;
}
.ag-sheet-grab::after {
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
.ag-sheet-grab:hover::after, .ag-sheet-grab.dragging::after { background: var(--gold); }

.ag-index-head { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.9rem 0.4rem; }
.ag-index-head-actions { display: flex; align-items: center; gap: 0.35rem; }
.ag-index-title { font-size: 0.72rem; font-weight: 700; color: #a7adb6; letter-spacing: 0.16em; }
.ag-index-reset {
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel);
  color: var(--muted); font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.6rem; cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ag-index-reset:hover { border-color: var(--gold); color: var(--gold); }
.ag-index-close {
  border: none; background: transparent; color: var(--muted); font-size: 0.85rem;
  width: 1.55rem; height: 1.55rem; display: grid; place-items: center; border-radius: 50%; cursor: pointer;
}
.ag-index-close:hover { color: var(--gold); background: var(--gold-soft); }

.ag-scroll { flex: 1; min-height: 0; overflow-y: auto; scrollbar-gutter: stable; -webkit-overflow-scrolling: touch; }
.ag-index-list { padding: 0.15rem 0.6rem 0.3rem; }
.ag-item {
  display: flex; align-items: flex-start; gap: 0.5rem; width: 100%;
  border: none; background: transparent; border-radius: var(--radius-sm);
  padding: 0.5rem 0.5rem; text-align: left; cursor: pointer;
  transition: background var(--dur) var(--ease), opacity var(--dur) var(--ease);
}
.ag-item:hover { background: var(--gold-soft); }
.ag-item.dim { opacity: 0.45; }
.ag-item.hidden { display: none; }
.ag-search {
  margin: 0.2rem 0.9rem 0.6rem; border: 1px solid var(--line); border-radius: 999px;
  background: var(--panel); color: var(--text); font-size: 0.82rem;
  padding: 0.42rem 0.85rem; outline: none;
}
.ag-search:focus { border-color: var(--gold); }
.ag-roles { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0 0.9rem 0.7rem; border-bottom: 1px solid var(--line-soft); }
.ag-role {
  display: inline-flex; align-items: center; gap: 0.35rem;
  border: 1px solid var(--line); border-radius: 999px; background: var(--panel);
  color: var(--text); font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem;
  transition: all var(--dur) var(--ease);
}
.ag-role:hover { border-color: var(--gold); color: var(--gold); }
.ag-role.on { border-color: var(--gold); background: var(--gold-soft); color: var(--gold); }
.ag-role-dot { width: 8px; height: 8px; border-radius: 50%; }
.ag-index-num { flex-shrink: 0; font-size: 0.68rem; font-weight: 700; color: #c9b894; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; padding-top: 0.05rem; }
.ag-role-chip {
  flex-shrink: 0; font-size: 0.62rem; font-weight: 700; color: #fff;
  border-radius: 999px; padding: 0.08rem 0.45rem; letter-spacing: 0.04em; margin-top: 0.05rem;
}
.chip-claim { background: var(--accent); }
.chip-objection { background: #b3452e; }
.chip-response { background: #2f6f4f; }
.ag-item-title { flex: 1; min-width: 0; font-size: 0.84rem; line-height: 1.5; color: var(--text); }

.ag-index-tip { margin: 0; padding: 0.6rem 0.9rem; border-top: 1px solid var(--line-soft); font-size: 0.7rem; color: var(--muted); }

/* 移动端索引抽屉遮罩 */
.ag-scrim { position: fixed; inset: 0; z-index: 19; background: rgba(20, 18, 16, 0.35); transition: opacity 0.22s var(--ease); }

/* 窄屏：顶栏收紧、索引抽屉改底部抽屉（地图信息栏同款） */
@media (max-width: 900px) {
  .ag-topbar { flex-wrap: wrap; gap: 0.5rem; padding: 0.6rem 0.9rem; }
  /* 收起后：隐藏「所有主题」与标题，整条工具条缩成一行按钮，最大化图谱阅读区 */
  .ag-topbar.ag-collapsed { padding: 0.4rem 0.9rem; }
  .ag-topbar.ag-collapsed .ag-back { display: none; }
  .ag-stats { display: none; }
  .ag-tools { gap: 0.45rem; }
  /* 按钮尺寸与主题总图谱 mg-btn 对齐（避免文字拥挤） */
  .ag-toggle { font-size: 0.72rem; padding: 0.28rem 0.75rem; }
  /* 标题栏折叠按钮于移动端显示（读经页沉浸阅读同款） */
  .ag-immersive { display: inline-flex; }
  /* 索引抽屉 → 底部抽屉：收起时滑出屏幕下方 */
  .ag-index {
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
  .ag-index.closed {
    transform: translateY(100%);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    box-shadow: none;
  }
  .ag-index-resize { display: none; }
  .ag-sheet-grab { display: block; }
  /* 遮罩置于抽屉之下 */
  .ag-scrim { z-index: 39; }
}
@media (max-width: 640px) {
  .ag-title-en { display: none; }
  .ag-hint { display: none; }
}
@media (max-width: 480px) {
  .ag-title { font-size: 1rem; }
}

/* ===== 右侧详情面板 ===== */
.ag-panel {
  position: absolute; top: 0.7rem; right: 0.7rem; bottom: 0.7rem; z-index: 20;
  width: 26rem; max-width: 86%;
  display: flex; flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.ag-panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line-soft);
  background: var(--gold-soft);
}
.ag-panel-kind { font-size: 0.72rem; font-weight: 700; color: var(--gold); letter-spacing: 0.12em; }
.ag-panel-close {
  border: none; background: transparent; font-size: 1.3rem; line-height: 1;
  color: #a7adb6; padding: 0 0.2rem;
  transition: color var(--dur) var(--ease);
}
.ag-panel-close:hover { color: var(--text); }
.ag-panel-body { flex: 1; min-height: 0; overflow-y: auto; scrollbar-gutter: stable; padding: 1.1rem 1.2rem 1.4rem; -webkit-overflow-scrolling: touch; }
.ap-q { margin: 0 0 0.5rem; font-size: 1.18rem; font-weight: 700; line-height: 1.55; color: var(--text); }
.ap-en { font-size: 0.85rem; color: #a7adb6; letter-spacing: 0.04em; margin-bottom: 0.6rem; }
.ap-meta { font-size: var(--fs-xs); font-weight: 600; color: var(--gold); background: var(--gold-soft); border-radius: var(--radius-pill); padding: 0.12rem 0.7rem; display: inline-block; margin-bottom: 0.7rem; }
.ap-summary { margin: 0.6rem 0 0; padding-left: 0.8rem; border-left: 3px solid var(--gold); font-size: 0.9rem; line-height: 1.9; color: #5c6676; font-style: italic; }
.ap-desc { margin: 0.6rem 0 0; font-size: 0.92rem; line-height: 1.9; color: #5c6676; }
.ap-stat-hint { margin: 0.9rem 0 0; font-size: 0.8rem; color: var(--muted); }

.ap-block { margin-top: 1rem; background: #fdf7f5; border: 1px solid #e4bdb3; border-radius: var(--radius-sm); padding: 0.7rem 0.9rem; }
.ap-block-label { font-size: 0.68rem; font-weight: 700; color: #fff; background: #b3452e; border-radius: var(--radius-pill); padding: 0.1rem 0.6rem; letter-spacing: 0.08em; }
.ap-block-text { margin: 0.55rem 0 0; font-size: 0.88rem; line-height: 1.8; color: #7a4a3c; font-style: italic; }
.ap-obj { margin: 0; font-size: 0.96rem; line-height: 1.9; color: #7a4a3c; font-style: italic; }

.ap-fulltext { margin-top: 0.9rem; padding-top: 0.9rem; border-top: 1px solid var(--line-soft); font-size: 0.92rem; line-height: 2; color: #4a5462; white-space: pre-wrap; }

.ap-ref { font-size: 1.05rem; font-weight: 700; color: var(--text); }
.ap-note { margin: 0.6rem 0 0; font-size: 0.9rem; line-height: 1.8; color: #5c6676; }
.ap-scr-link { margin-top: 0.9rem; display: block; }

/* 证据清单 */
.ap-evidence { margin-top: 1.2rem; border-top: 1px solid var(--line-soft); padding-top: 0.9rem; }
.ap-ev-title { font-size: 0.72rem; font-weight: 700; color: var(--gold); letter-spacing: 0.14em; margin-bottom: 0.5rem; }
.ap-ev-item { display: block; margin: 0; padding: 0.4rem 0; font-size: 0.85rem; line-height: 1.65; }
.ap-ev-cat { display: inline-block; font-size: 0.68rem; font-weight: 700; color: #fff; border-radius: var(--radius-pill); padding: 0.05rem 0.5rem; margin-right: 0.45rem; background: var(--gold); vertical-align: 1px; }
.ap-ev-ref-t { font-weight: 700; color: var(--text); margin-right: 0.45rem; }
.ap-ev-note { color: var(--muted); }

@media (max-width: 900px) {
  .ag-tools .ag-stats { display: none; }
  .ag-panel { width: 92%; }
}
</style>