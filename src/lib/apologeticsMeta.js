/**
 * apologeticsMeta.js — 护教「主题间总图谱」数据模型
 *
 * 在单个主题的论证图之上，构建一张把「主题与主题连接起来」的总体论证图，
 * 用它来论证基督教信仰的客观性：
 *
 *   核心结论  基督教信仰的客观性（客观为真、可查证、可信靠）
 *   论点支柱  神存在 / 圣经默示 / 耶稣复活 / 永生
 *   证据支撑  圣经可靠 / 复活证据 / 创造与进化 / 科学与信仰
 *   反方质疑  苦难问题
 *   应用落地  信仰与生活
 *
 * 主题在论证中的角色 → 节点类型与配色：
 *   thesis     核心结论（金棕，总图根节点）
 *   claim      命题（蓝）
 *   evidence   证据（紫）
 *   objection  反方质疑（红）
 *   application 应用（青）
 *
 * 关系沿用 apologistGraph.js 的有限集合：supports / refutes / responds_to /
 * evidences / depends_on（均带方向与语义标签）。
 */

import { MarkerType } from '@vue-flow/core'
import { REL_STYLE } from './apologeticsGraph.js'

/** 总图核心结论配置 */
export const META_THESIS = {
  id: '__thesis__',
  titleZh: '基督教信仰的客观性',
  titleEn: 'The Objectivity of Christianity',
  claim: '基督教信仰不是主观臆想，而是有历史、考古、理性与生命经验可查证的客观真实。',
}

/** 主题 → 论证角色（用于 node 类型与配色） */
const ROLES = {
  'does-god-exist': { kind: 'claim', label: '命题' },
  'bible-inspired': { kind: 'claim', label: '命题' },
  'jesus-resurrection': { kind: 'claim', label: '命题' },
  'eternal-life': { kind: 'claim', label: '命题' },
  'bible-reliability': { kind: 'evidence', label: '证据' },
  'resurrection-evidence': { kind: 'evidence', label: '证据' },
  'creation-and-evolution': { kind: 'evidence', label: '证据' },
  'science-faith': { kind: 'evidence', label: '证据' },
  'suffering': { kind: 'objection', label: '反方质疑' },
  'faith-life': { kind: 'application', label: '应用落地' },
}

/** 主题间关系（sourceTopic, targetTopic, rel） */
const META_EDGES = [
  // 科学与信仰 → 创造与进化 → 神存在
  { s: 'science-faith', t: 'creation-and-evolution', rel: 'supports' },
  { s: 'creation-and-evolution', t: 'does-god-exist', rel: 'supports' },
  // 圣经可靠 → 神存在；圣经可靠 → 复活证据
  { s: 'bible-reliability', t: 'does-god-exist', rel: 'supports' },
  { s: 'bible-inspired', t: 'does-god-exist', rel: 'supports' },
  { s: 'bible-reliability', t: 'resurrection-evidence', rel: 'supports' },
  // 复活证据 → 耶稣复活 → 总结论
  { s: 'resurrection-evidence', t: 'jesus-resurrection', rel: 'evidences' },
  { s: 'does-god-exist', t: '__thesis__', rel: 'supports' },
  { s: 'jesus-resurrection', t: '__thesis__', rel: 'supports' },
  // 永生 → 复活；永生 → 总结论；信仰与生活 → 永生
  { s: 'eternal-life', t: 'jesus-resurrection', rel: 'depends_on' },
  { s: 'eternal-life', t: '__thesis__', rel: 'supports' },
  { s: 'faith-life', t: 'eternal-life', rel: 'depends_on' },
  // 苦难问题（反方）→ 质疑总结论；神存在 / 复活 → 回应苦难
  { s: 'suffering', t: '__thesis__', rel: 'refutes' },
  { s: 'does-god-exist', t: 'suffering', rel: 'responds_to' },
  { s: 'jesus-resurrection', t: 'suffering', rel: 'responds_to' },
]

/** 手工构图坐标（fitView 会自动适配视口，坐标仅决定相对构图） */
const POS = {
  '__thesis__': { x: 0, y: 0 },
  'bible-inspired': { x: -620, y: -80 },
  'bible-reliability': { x: -360, y: 180 },
  'does-god-exist': { x: -180, y: 150 },
  'creation-and-evolution': { x: -620, y: 320 },
  'science-faith': { x: -880, y: 320 },
  'resurrection-evidence': { x: 120, y: 180 },
  'jesus-resurrection': { x: 380, y: 60 },
  'eternal-life': { x: 380, y: 260 },
  'faith-life': { x: 660, y: 260 },
  'suffering': { x: 120, y: 360 },
}

/**
 * 构建主题间总图谱
 * @param {Array} topics 主题索引（content.json 的 topics 数组）
 * @returns {{ nodes: Array, edges: Array, thesis: Object }}
 */
export function buildTopicGraphMeta(topics) {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const nodes = []
  const edges = []

  // 核心结论节点
  nodes.push({
    id: META_THESIS.id,
    type: 'meta-thesis',
    position: POS[META_THESIS.id],
    data: { ...META_THESIS },
  })

  // 主题节点
  for (const t of topics) {
    const role = ROLES[t.id] || { kind: 'claim', label: '命题' }
    nodes.push({
      id: `topic-${t.id}`,
      type: 'meta-topic',
      position: POS[t.id] || { x: 0, y: 0 },
      data: {
        topicId: t.id,
        role: role.kind,
        roleLabel: role.label,
        titleZh: t.title?.zh || '',
        titleEn: t.title?.en || '',
        tags: t.tags || [],
        sqCount: t.sqCount ?? 0,
      },
    })
  }

  // 关系边（方向遵循语义：source 论证/支撑 target）
  for (const e of META_EDGES) {
    edges.push(makeMetaEdge(`${e.s}->${e.t}`, `topic-${e.s}`, e.t === META_THESIS.id ? META_THESIS.id : `topic-${e.t}`, e.rel))
  }

  return { nodes, edges, thesis: META_THESIS }
}

/** 构造一条总图边（带方向箭头 + 语义标签 + 配色，样式与单主题图一致） */
function makeMetaEdge(id, source, target, rel) {
  const style = REL_STYLE[rel] || { color: '#8b7355', label: rel }
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    label: style.label,
    data: { rel },
    style: { stroke: style.color, strokeWidth: 1.7, opacity: 0.92 },
    labelStyle: { fill: style.color, fontWeight: 700, fontSize: 11 },
    labelBgStyle: { fill: '#fdfbf8', fillOpacity: 0.95 },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 6,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: style.color,
      width: 18,
      height: 18,
    },
  }
}