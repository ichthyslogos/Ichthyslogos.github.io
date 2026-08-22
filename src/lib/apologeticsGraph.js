/**
 * apologeticsGraph.js — 护教论证图数据模型
 *
 * 把单个主题（topics/<id>.json 的完整结构）映射为 Vue Flow 可消费的
 * 图谱数据（nodes + edges），并按「角色分层」自动布局。
 *
 * 设计依据（FISH 护教论证图谱 v1.0）：
 *   - 图层：核心命题 → 命题(claim) → 质疑(objection) → 回应(response) → 证据(evidence/scripture)
 *   - 关系（有限集合）：contains / refutes / responds_to / supports / evidences
 *   - 知识层与画布层分离：本文只做「渲染层初步布局」，节点数据(data)承载知识内容，
 *     画布坐标(position)独立，后续可做拖拽记忆/分组复用。
 *
 * 证据类别 → 节点类型映射：
 *   bible         → scripture(经文，可深链读经页)
 *   其余类别      → evidence(证据)
 */

import { MarkerType } from '@vue-flow/core'

/** 证据类别元数据（键 → 中文标签） */
export const EVIDENCE_CATS = {
  bible: { label: '圣经', nodeType: 'graph-scripture' },
  philosophy: { label: '哲学', nodeType: 'graph-evidence' },
  history: { label: '历史', nodeType: 'graph-evidence' },
  science: { label: '科学', nodeType: 'graph-evidence' },
  theology: { label: '神学', nodeType: 'graph-evidence' },
  ethics: { label: '伦理', nodeType: 'graph-evidence' },
  literature: { label: '文献', nodeType: 'graph-evidence' },
}

/** 关系类型 → 颜色（边着色） */
export const REL_STYLE = {
  contains: { color: '#a0896a', label: '探讨' },
  refutes: { color: '#b3452e', label: '反驳' },
  supports: { color: '#2f6f4f', label: '支持' },
  responds_to: { color: '#2f5d9e', label: '回应' },
  evidences: { color: '#7a5f9e', label: '提供证据' },
  depends_on: { color: '#3d7a80', label: '依赖' },
}

/** 布局常量 */
const COL_W = 340 // 列间距（含列内卡片宽度 + 空隙）
const ROW_H_MIN = 240 // 每个子命题占据的最小纵向带高
const EV_CARD_W = 200 // 证据卡片宽（两列并排，紧凑）
const EV_COL_GAP = 14 // 证据两列间距
const EV_ROW_H = 112 // 证据网格行高（卡片高 + 行距）
const EV_ROW_PAD = 40 // 证据网格上下留白（并入行带）

/** 依据主题内最大证据数计算行带高，保证证据两列网格纵向不重叠 */
function computeRowHeight(topic) {
  let maxEv = 0
  for (const sq of topic.sub_questions || []) {
    const c = countEvidence(sq.evidence)
    if (c > maxEv) maxEv = c
  }
  const gridRows = Math.ceil(maxEv / 2)
  return Math.max(ROW_H_MIN, gridRows * EV_ROW_H + EV_ROW_PAD)
}

/**
 * 构建主题论证图
 * @param {Object} topic 主题完整数据 { id, title, description, tags, categories, sub_questions }
 * @returns {{ nodes: Array, edges: Array }}
 */
export function buildTopicGraph(topic) {
  const nodes = []
  const edges = []
  const sqs = topic.sub_questions || []
  const topicId = topic.id
  const n = sqs.length
  const ROW_H = computeRowHeight(topic)
  const topicNodeId = `topic-${topicId}`

  // 核心命题节点（置于全部子命题带的纵向中心，作为所有命题的汇聚点）
  const topicCenterY = n > 0 ? (n - 1) * ROW_H / 2 + ROW_H / 2 : ROW_H / 2
  nodes.push({
    id: topicNodeId,
    type: 'graph-topic',
    position: { x: 0, y: topicCenterY },
    data: {
      kind: 'topic',
      topicId,
      titleZh: topic.title?.zh || '',
      titleEn: topic.title?.en || '',
      description: topic.description || '',
    },
  })

  sqs.forEach((sq, i) => {
    const sqId = sq.id
    const ty = i * ROW_H + ROW_H / 2 // 命题/质疑/回应在同一带中心

    // ── 命题节点 ──
    const claimId = `claim-${sqId}`
    nodes.push({
      id: claimId,
      type: 'graph-claim',
      position: { x: COL_W, y: ty },
      data: {
        kind: 'claim',
        sqId,
        question: sq.question || '',
        perspective: sq.perspective || '',
        tags: sq.tags || [],
        summary: sq.summary || '',
      },
    })
    edges.push(makeEdge(`${sqId}-contains`, topicNodeId, claimId, 'contains'))

    // ── 质疑节点 ──
    const objId = `obj-${sqId}`
    nodes.push({
      id: objId,
      type: 'graph-objection',
      position: { x: COL_W * 2, y: ty },
      data: { kind: 'objection', sqId, text: sq.objection || '', question: sq.question || '' },
    })
    edges.push(makeEdge(`${sqId}-refutes`, objId, claimId, 'refutes'))

    // ── 回应节点 ──
    const respId = `resp-${sqId}`
    nodes.push({
      id: respId,
      type: 'graph-response',
      position: { x: COL_W * 3, y: ty },
      data: {
        kind: 'response',
        sqId,
        titleZh: sq.title?.zh || '',
        titleEn: sq.title?.en || '',
        perspective: sq.perspective || '',
        tags: sq.tags || [],
        summary: sq.summary || '',
      },
    })
    edges.push(makeEdge(`${sqId}-supports`, respId, claimId, 'supports'))
    edges.push(makeEdge(`${sqId}-responds`, respId, objId, 'responds_to'))

    // ── 证据 / 经文节点（两列网格，垂直居中于行带；列内自上而下填充） ──
    const evCount = countEvidence(sq.evidence)
    const gridRows = Math.ceil(evCount / 2)
    let k = 0
    for (const [catKey, catMeta] of Object.entries(EVIDENCE_CATS)) {
      const items = sq.evidence?.[catKey] || []
      for (const item of items) {
        const col = k % 2
        const row = Math.floor(k / 2)
        const id = `${catKey === 'bible' ? 'scr' : 'ev'}-${sqId}-${k}`
        const nodeType = catMeta.nodeType
        nodes.push({
          id,
          type: nodeType,
          position: {
            x: COL_W * 4 + col * (EV_CARD_W + EV_COL_GAP),
            y: ty + (row - (gridRows - 1) / 2) * EV_ROW_H,
          },
          data: {
            kind: catKey === 'bible' ? 'scripture' : 'evidence',
            category: catKey,
            categoryLabel: catMeta.label,
            sqId,
            ref: item.ref || '',
            note: item.note || '',
          },
        })
        edges.push(makeEdge(`${sqId}-evidences-${k}`, id, respId, 'evidences', catKey === 'bible'))
        k++
      }
    }
  })

  return { nodes, edges }
}

/** 统计证据总数（含圣经） */
function countEvidence(evidence) {
  if (!evidence) return 0
  return Object.keys(EVIDENCE_CATS).reduce((s, key) => s + (evidence[key]?.length || 0), 0)
}

/** 构造一条边：按关系类型着色 + 标记箭头 */
function makeEdge(id, source, target, rel, dashed = false) {
  const style = REL_STYLE[rel] || { color: '#8b7355', label: rel }
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    label: style.label,
    data: { rel },
    style: {
      stroke: style.color,
      strokeWidth: 1.6,
      opacity: 0.92,
      strokeDasharray: dashed ? '5 4' : undefined,
    },
    labelStyle: {
      fill: style.color,
      fontWeight: 700,
      fontSize: 11,
    },
    labelBgStyle: { fill: '#fdfbf8', fillOpacity: 0.95 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 6,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: style.color,
      width: 16,
      height: 16,
    },
  }
}