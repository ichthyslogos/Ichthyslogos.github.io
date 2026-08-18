# 时间历史地图数据库设计（TEMPORAL MAP DB）

> Bible Research Platform (BRP)
> Dynamic Historical GIS System
> Version: 2.0（2026-08-17 数据库重设计落地）
> 关联文档：[GEOGRAPHY.md](GEOGRAPHY.md)（数据来源/实体模型）· [HISTORICAL-MAP.md](HISTORICAL-MAP.md)（时间轴/疆域/古道）
>
> **素材约定：所有外部素材一律下载到素材库（`D:\Eyphka\fish\素材\`，只读，禁止人工修改）；网站侧只保存投影与处理产物（`site\data-src\`）。**

---

# 0. v2 更新：Temporal Historical Map（已落地，2026-08-17）

v2 将库从"每实体一个 valid_time + 一个 importance.major 标记"升级为**实体 + 时间状态**模型。
本文 §3-§16 保留 v1 设计推导过程；**本节为当前实现的权威描述**。

## 0.1 核心原则

> **这个地点在当前时间点是否具有地图显示意义？**
> 存在性 ≠ 意义：existence 决定"是否出现"，importance 决定"何时值得显示"（→ 图例 zoom 表），state 记录历史状态。
> **任何地图实体都不得默认"永久存在"**——每个实体必须携带来源窗口或 curated 特例。

## 0.2 过滤链（TIME → ZOOM → RENDER）

```text
TIME    inSlice 锚点年过滤：实体 existence/state 窗口覆盖时期锚点年才进入该时期瓦片
ZOOM    importance@年份（1-5 星）→ lod（★5→0, ★4→1, ★3→2, ★2/★1→3）→ CITY_BANDS 预裁剪
RENDER  前端 CAT_ZOOM_GATE（图例 zoom 表）+ CAT_SYMBOL_EXPR + polity（隶属政权弹窗）
```

图例 zoom 表编码为 importance 等级（图例标注不变）：

| 等级 | zoom 带 | 分类 |
|---|---|---|
| ★5 | z0-3 | 国家/湖海/沙漠/山脉/海岸 |
| ★4 | z4-5 | 地区/首都 |
| ★3 | z6-8 | 城市/河流/岛屿 |
| ★2 | z9-10 | 村庄/山 |
| ★1 | z11+ | 遗址（前端门控） |

## 0.3 places.json v2（46,686 实体）

```json
{
  "id": "fish_place_046258",
  "name": "Jerusalem",
  "entity_type": "capital",
  "existence": { "from": -1800, "to": 100 },
  "names": [ { "name": "Jebus", "from": -1800, "to": -1000 }, ... ],
  "importance": [ { "from": -1800, "to": -1000, "level": 3 }, ... ],
  "state": [ { "from": ..., "to": ..., "state": "ACTIVE" }, ... ],
  "political_affiliations": [ { "polity": "Roman Empire", "polity_id": "polity_romanempire", "kind": "polity", "from": 30, "to": 70, "polity_area": 3606616 }, ... ],
  "location": { "lng": 35.234, "lat": 31.777 },
  "major": 1,
  "sources": ["step", "pleiades"],
  "external_ids": { "step": "Jerusalem", "pleiades": "687898" }
}
```

- **importance**（1-5 星历史）：分类基线（§0.2 表）+ curated `data-src/geography/curated/place-importance.json`（20 个主要城市逐段曲线，如耶路撒冷 -1800★3→-721★5→-585★2→-62★5→71★2）+ major 城市 +1（上限 5）
- **state**：由 importance 相邻段推导（升→EMERGING、持平→ACTIVE、降→DECLINING、窗口早于 existence 结束→ABANDONED）
- **political_affiliations**：构建期点包含测试（Cliopatria 疆域 × 10 个时期锚点年；bbox 粗过滤 + turf booleanPointInPolygon），相邻锚点年合并为段；候选地点 = STEP 全部 + capital/region/nation 类 + major 城市（1,820 个）；只含国家疆域归属（kind='polity'）——行政区划已删除
- **窗口修复**：DARE 现代名反置窗口 {477,100} → {476,2100}；源数据反置窗口（startyear>endyear 等）由 normWindow 自动交换；全库反置窗口 0

## 0.4 polities.json v2（1,547 实体 / 14,061 状态）

```json
{ "id": "polity_romanempire", "name": "Roman Empire", "color": "#d88c8c",
  "states": [ { "from": -31, "to": 394, "area": 1691504, "geometry": {...} }, ... ],
  "sources": ["cliopatria"] }
```

同名 Cliopatria 切片分组为一个政权实体，`states[]` 为随时间变化的疆域状态（排序、不重叠）。
瓦片层平铺回 Feature（含 polity_id）——瓦片管线逻辑不变。affiliations 的 `polity_id` 即实体 id。

## 0.5 其他 v2 修复与新增

- **urban.json**：timeperiod ARK URI → 时期窗口（PeriodO 实测：`p03wskdxnzf` = Pleiades **roman** -30~300、`p03wskd389m` = **classical** -550~-330；null 默认 roman）。95 条窗口全非空
- **periods.json**：+ `era` 时代元数据（如「铁器时代早期」「罗马帝国早期」），时间轴副标题显示
- **Temporal Engine**：`src/lib/temporal.js`（existsAt/nameAt/importanceAt/affiliationAt/polityAt/stateAt + setCurrentPeriod）；瓦片构建端同款查询逻辑（build-tiles.mjs）
- **弹窗**：点击地点显示「隶属：<政权>」（瓦片 polity 属性，取最小面积即最具体政权）
- **行政区划删除（v2.1）**：DARE 行省 + NE admin-1 已从构建端（admins 层/瓦片）与前端（行省图层）全部移除，`places.json` 中 kind='province' 归属清零——正式版只保留国家疆域（Cliopatria）；疆域与全部 10 个时期瓦片由 Cliopatria 源重新生成。DARE 素材（provinces.geojson 等）保留在只读素材库作参考，不再被任何构建脚本消费

---

# 1. 系统目标

建立一个：

```text
"时间 + 地理 + 政治 + 圣经事件"
四维历史地图系统。
```

用户拖动时间轴：

例如：

```text
1000 BC
```

系统自动加载：

- 大卫王国疆域
- 当时存在城市
- 当时道路
- 当时名称

用户调整：

```text
30 AD
```

自动切换：

- 罗马帝国
- 犹太省
- 耶路撒冷
- 加利利城市
- 保罗路线

---

# 2. 当前地图问题

## 问题1：现代地图污染

错误：

```text
OpenStreetMap
    +
圣经地点 Marker
```

导致：

```text
显示：
- 现代道路
- 现代国家
- 现代城市
```

解决：

```text
采用 Historical Base Map
```

## 问题2：城市全部显示

错误：

```text
数据库 cities.json：
Jerusalem / Rome / Nineveh / Babylon / Athens
全部加载
```

结果（公元 30 年）：

- 出现已不存在城市
- 出现尚未建立城市
- 不同时期名称混乱

解决：

```text
所有地点必须拥有 valid_time。
```

---

# 3. 城市数据库设计

## City Entity

路径（素材库原始 → 网站侧投影）：

```text
素材库\geography\raw\places\          ← 原始数据（Pleiades 等，只读）
data-src\geography\normalized\places\ ← 投影（STEP 主地点 + valid_time 标注）
```

结构：

```json
{
  "id": "jerusalem",
  "type": "city",
  "names": [
    { "period": "Iron Age", "name": "耶路撒冷" },
    { "period": "Roman", "name": "Aelia Capitolina" }
  ],
  "existence": {
    "start": -1000,
    "end": 999
  },
  "importance": {
    "ancient": 5,
    "biblical": 5
  },
  "coordinates": [35.2137, 31.7683]
}
```

---

# 4. 城市显示规则

根据时间过滤：

```text
当前：30 AD

city.start <= 30 AND city.end >= 30

只有符合才显示。
```

---

# 5. 城市等级系统（LOD，Level Of Detail）

避免地图混乱：

```text
Level 0   全球视角（Zoom 0-4）
          显示：帝国、大城市（Rome / Jerusalem / Babylon）

Level 1   区域（Zoom 5-8）
          显示：主要城市、省份、重要道路（犹太：Jerusalem / Caesarea / Bethlehem / Nazareth）

Level 2   详细（Zoom 9-12）
          显示：小城、村庄、道路节点

Level 3   城市内部（Zoom 13+）
          显示：建筑、遗迹、圣殿
```

---

# 6. 城市重要性评分

> **v2 已落地实现（§0.3）**：importance 从三维评分改为 1-5 星历史段数组
> `[{from, to, level}]`，由 curated 曲线 + 分类基线生成；§6 以下为 v1 设计推导过程。

v1 设计稿（保留推导过程）：

每个地点增加：

```json
{
  "importance": {
    "biblical": 5,
    "historical": 4,
    "population": 3
  }
}
```

显示权重：

```text
score = biblical + historical + zoom
```

---

# 7. 国家疆域数据库

路径：

```text
素材库\geography\raw\political_entities\   ← 原始疆域 GeoJSON（只读）
data-src\geography\normalized\territories\  ← 投影（按时期切片）
```

例如：

```text
roman_empire.json / babylonian_empire.json / persian_empire.json / judah.json / israel.json
```

结构：

```json
{
  "id": "roman_empire",
  "name": {
    "zh": "罗马帝国",
    "en": "Roman Empire"
  },
  "time": {
    "start": -27,
    "end": 476
  },
  "boundary": {
    "type": "geojson",
    "file": "roman_30.geojson"
  },
  "style": {
    "fill": "#c8d8ff",
    "opacity": 0.35
  }
}
```

---

# 8. 国家显示规则

禁止：

```text
固定国家层。
```

必须：

```text
Time
    ↓
Political Engine
    ↓
Load Boundary
    ↓
Render Polygon
```

例如：

```text
586 BC  显示 Babylon Empire（浅蓝）
539 BC  切换 Persian Empire（浅黄）
30 AD   切换 Roman Empire（浅红）
```

---

# 9. 推荐数据库

| 数据源 | 用途 | 说明 |
| ------ | ---- | ---- |
| Pleiades（核心） | 城市、地点、历史名称 | 古代地点数据库；支持历史名称/时间信息；JSON/CSV/RDF 下载；模型区分 Place / Name / Location / Temporal Attestation |
| AWMC | 古代道路、城市、古代地图 | Ancient World Mapping Center |
| Digital Atlas of Roman Empire | 新约时期 0-400 AD | 罗马省份、道路、城市 |
| WHG | 全球历史地点 | 用于统一不同来源（World Historical Gazetteer） |

---

# 10. 动态图例系统

禁止：

```text
固定 Legend：
  国家：罗马
  城市：全部城市
```

正确：根据当前地图生成。

例如（时间 30 AD）：

```text
政治实体
🟥 Roman Empire

城市
● Jerusalem
● Bethlehem
● Nazareth

道路
━ Via Maris
```

---

# 11. 数据加载架构

```text
Timeline
    ↓
Historical Query Engine
    ↓
-------------------------------
Places    Political Boundary    Roads    Events
-------------------------------
    ↓
Map Renderer
    ↓
Legend Generator
```

---

# 12. 前端实现

推荐：

```text
MapLibre GL JS（Vector Tile）
```

不要：

```text
一次加载所有 JSON。
```

---

# 13. 数据切片

目录：

```text
tiles/
  z0/
  z5/
  z10/
```

根据 Zoom 加载不同精度。

---

# 14. 最终用户体验

打开地图：

```text
默认 30 AD
```

显示：

```text
浅红色：Roman Empire
城市：Jerusalem / Nazareth / Bethlehem
路线：Jesus Ministry Route
```

拖动：

```text
1000 BC
```

立即变化：

```text
浅黄色：United Kingdom
城市：Jerusalem / Hebron / Gibeon
路线：David's Kingdom
```

---

# 15. 开发原则

必须：

```text
1. 所有城市绑定时间（valid_time）。
2. 所有名称绑定时代。
3. 所有疆域绑定时间。
4. 所有道路绑定时间。
5. 所有显示根据 Zoom 过滤（LOD）。
6. Legend 动态生成。
7. 禁止现代地图元素干扰。
8. 素材一律下载到素材库（只读），不可直接修改。
```

最终目标：

```text
建立 Bible Temporal GIS，而不是 Bible Location Map。
```

---

# 16. 与既有文档的关系与落地顺序

| 文档 | 职责 | 当前状态 |
| ---- | ---- | ------- |
| GEOGRAPHY.md | 数据来源职责 / Journey-Stop-Segment / confidence / 五阶段路线图 | 第一阶段已落地（STEP 913 地点 + UBS 179 旅程 + 路线渲染） |
| HISTORICAL-MAP.md | 时间轴引擎 / 政治疆域 / 古代道路 / 历史底图 | Time Engine 已落地（10 时期 + 旅程过滤 + 默认 30 AD）；疆域/古道待素材 |
| 本文档 | 地点 valid_time / LOD 等级 / 疆域渲染 / 动态图例 | LOD 与动态图例待落地；地点时间标注依赖 Pleiades 素材（待下载） |

数据流（三层，共用同一管线）：

```text
素材库（D:\Eyphka\fish\素材\geography\raw\，只读）
    ↓ import 脚本
data-src\geography\normalized\（投影）
    ↓ build 脚本
public\data\geography\（运行时数据）
    ↓ fetch
前端地图页（/map）
```
