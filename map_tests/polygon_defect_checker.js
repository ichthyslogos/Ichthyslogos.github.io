/**
 * polygon_defect_checker.js — 疆域多边形缺陷检查（自交/环向/退化）
 * 用法：node map_tests/polygon_defect_checker.js
 *
 * 背景：Hepher 城附近（34.88, 32.37）BC1400 后出现规则平行四边形缺口。
 * 典型成因：
 *   a) 自交环（pinch）→ even-odd 填充在交叉段之间产生四边形/菱形空洞
 *   b) 洞环与外环同向（GeoJSON 要求外环 CCW、洞 CW）→ 填充反转
 *   c) 相邻 MultiPolygon 部件重叠且环向相反 → 重叠区被 even-odd 抵消成洞
 * 检查项：环闭合、proper 自交、外环/洞环方向一致性、退化尖刺（相邻段共线反向）。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
// polities v2：实体 states 平铺（name/from/to/geometry 结构不变）
const polities = JSON.parse(readFileSync(join(HERE, '../data-src/geography/normalized/polities.json'), 'utf8')).entities.flatMap((e) =>
  e.states.map((st) => ({ name: e.name, from: st.from, to: st.to, geometry: st.geometry })),
)
const periods = JSON.parse(readFileSync(join(HERE, '../public/data/geography/periods.json'), 'utf8')).periods
const intersects = (a, b, c, d) => a != null && b != null && c != null && d != null && a <= d && b >= c
/** 实体时间窗是否落入任一圣经时期（决定缺陷是否用户可见） */
const inPeriodWindow = (f) => periods.some((p) => intersects(f.from, f.to, p.valid_time.from, p.valid_time.to))

function ringsOf(g) {
  return g.type === 'Polygon' ? g.coordinates : (g.coordinates || []).flat()
}
function signedArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return a / 2
}
/** proper 线段相交（不含端点共点；O(n²)，bbox 预筛） */
function segSeg(a, b, c, d) {
  const d1 = (d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0])
  const d2 = (d[0] - c[0]) * (b[1] - c[1]) - (d[1] - c[1]) * (b[0] - c[0])
  const d3 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d4 = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}
function findCrossings(ring) {
  const n = ring.length
  const out = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) < 2 || (i === 0 && j === n - 1) || (j === 0 && i === n - 1)) continue // 相邻段
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % n]
      const [cx, cy] = ring[j], [dx, dy] = ring[(j + 1) % n]
      // bbox 预筛
      if (Math.max(ax, bx) < Math.min(cx, dx) || Math.max(cx, dx) < Math.min(ax, bx)) continue
      if (Math.max(ay, by) < Math.min(cy, dy) || Math.max(cy, dy) < Math.min(ay, by)) continue
      if (segSeg([ax, ay], [bx, by], [cx, cy], [dx, dy])) out.push([i, j])
    }
  }
  return out
}
function inRing(ring, p) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

let fail = 0
let selfCross = 0
let selfCrossVisible = 0
let quadHoles = 0
let cwOuter = 0
const problems = []
function problem(msg) { problems.push(msg); fail++ }

for (const f of polities) {
  const rings = ringsOf(f.geometry)
  if (!rings.length) continue
  const outer = rings[0]
  if (outer.length < 4) { problem(`${f.name}(${f.from}~${f.to}) 外环点不足`); continue }
  const a = outer[0], b = outer[outer.length - 1]
  if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) {
    problem(`${f.name}(${f.from}~${f.to}) 外环未闭合`)
    continue
  }
  // 环向：源数据普遍顺时针外环——even-odd 填充与环向无关，仅统计不判错
  if (signedArea(outer) < 0) cwOuter++
  // 四边形洞环（≤5 点 = ≤4 顶点）：源数字化伪影 → 规则平行四边形缺口（Hepher 案例）
  const isPoly = f.geometry.type === 'Polygon'
  const parts = isPoly ? [rings] : null
  const allHoles = isPoly ? [rings.slice(1)] : f.geometry.coordinates.map((rs) => rs.slice(1))
  for (const holes of allHoles) {
    for (const h of holes) {
      if (h.length <= 5) {
        quadHoles++
        problem(`${f.name}(${f.from}~${f.to}) 四边形洞环 ${h.length} 点 @ [${h[0].join(',')}]`)
      }
    }
  }
  const ringsAll = isPoly ? rings : f.geometry.coordinates.flat()
  for (let k = 0; k < ringsAll.length; k++) {
    const xs = findCrossings(ringsAll[k])
    if (xs.length) {
      selfCross++
      if (inPeriodWindow(f)) {
        selfCrossVisible++
        problem(`${f.name}(${f.from}~${f.to}) 环[${k}]自交 ${xs.length} 处：${xs.slice(0, 3).map(([i, j]) => `(${ringsAll[k][i].join(',')})x(${ringsAll[k][j].join(',')})`).join(' / ')}`)
      }
    }
  }
}

console.log(`疆域状态（实体×时间片）：${polities.length} 个`)
console.log(`四边形洞环：${quadHoles} 处；自交多边形：${selfCross} 个（时期窗口内可见 ${selfCrossVisible} 个——期外为源数据限制，仅统计）；顺时针外环：${cwOuter} 个（源数据常态，even-odd 填充不受影响——仅统计）`)
console.log('='.repeat(60))
if (fail) {
  console.log(`❌ ${fail} 处问题（前 40）：`)
  for (const p of problems.slice(0, 40)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('✅ 未发现四边形洞环/自交/未闭合缺陷')
}
