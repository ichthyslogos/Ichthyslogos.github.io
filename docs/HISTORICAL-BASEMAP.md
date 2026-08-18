# 历史底图系统设计（HISTORICAL BASEMAP）

> Bible Research Platform (BRP)
> Historical GIS Base Map Design Specification
> Version: 1.0
> 关联文档：[GEOGRAPHY.md](GEOGRAPHY.md)（数据来源/实体模型）· [HISTORICAL-MAP.md](HISTORICAL-MAP.md)（时间轴/疆域/古道）· [TEMPORAL-MAP-DB.md](TEMPORAL-MAP-DB.md)（LOD/动态图例）
>
> **素材约定：所有外部素材一律下载到素材库（`D:\Eyphka\fish\素材\`，只读，禁止人工修改）；网站侧只保存投影与处理产物（`site\data-src\`）。**

---

# 1. 项目目标

## 背景

当前地图底图存在问题：

- 使用现代地图逻辑
- 包含现代道路
- 包含现代城市
- 包含现代行政信息
- 与圣经历史时期不匹配

BRP 需要建立：

> 一个适合古代历史研究的纯自然地理底图系统

目标：

```text
地图底层只提供：
- 海洋
- 陆地
- 山脉
- 河流
- 地形高度
- 自然区域

所有人类信息：
- 国家
- 城市
- 道路
- 路线
- 事件
全部作为独立图层加载。
```

---

# 2. 地图分层架构

最终地图结构：

```text
Historical Map Engine
    Layer 5  Bible Events    圣经事件
    Layer 4  Ancient Routes  古代路线
    Layer 3  Ancient Cities  古代城市
    Layer 2  Historical Borders  历史疆域
    Layer 1  Rivers / Mountains   自然地理
    Layer 0  Base Map        纯自然底图
```

---

# 3. 底图原则

## 必须显示

### 地形

包括：

- 山脉
- 高原
- 平原
- 沙漠
- 河谷

用途：

帮助理解：

- 出埃及路线
- 保罗旅行路线
- 亚伯拉罕迁移路线

### 水系

包括：

- 海洋
- 湖泊
- 河流

重点：

- 尼罗河
- 幼发拉底河
- 底格里斯河
- 约旦河
- 加利利海

## 禁止显示

### 现代政治

禁止：

```text
法国 / 以色列 / 埃及 / 约旦 等现代国家。
```

### 现代交通

禁止：

```text
高速公路 / 铁路 / 城市道路。
```

### 现代城市

禁止：

```text
Paris / Beijing / New York 等现代城市。
```

---

# 4. 推荐底图数据库

## 第一选择：Natural Earth Gray Earth

来源：Natural Earth

用途：BRP 默认历史底图。

特点：

- 中性色调
- 低对比度
- 无现代标签
- 强调地形
- 适合叠加彩色历史图层

Natural Earth 官方说明：Gray Earth 的设计目标是作为一种"中性的地形底图"，让叠加的数据颜色更加突出。

适合：

```text
Gray Earth + Roman Empire Polygon + Bible Route + Ancient Cities
```

## 第二选择：Natural Earth II

用途：自然环境展示。

特点：颜色更自然：

- 森林
- 沙漠
- 草原

适合：展示古代生态环境、地理背景。

缺点：颜色稍丰富，可能降低历史图层突出程度。

## 第三选择：自定义 Physical Layer

使用 Natural Earth Physical 数据，拆分：

```text
physical/
    land.geojson
    coastline.geojson
    rivers.geojson
    mountains.geojson
    elevation.tif
```

自己控制颜色、透明度、显示级别。

---

# 5. 推荐最终方案

BRP 采用：

```text
Base Map:       Natural Earth Gray Earth
Custom River Layer
Custom Mountain Layer
Historical Political Layer
Bible Layer
```

原因：符合圣经研究、神学院地图、历史地图、学术展示。

---

# 6. 地图颜色设计

## 底图

```text
土地：  浅灰米色
海洋：  浅灰蓝
地形：  低对比阴影
```

目的：让历史信息突出。

---

# 7. 历史疆域叠加

国家不能写入底图，单独 `political_layer`。

例如：

```text
Roman Empire
fill:    浅红色
opacity: 0.25
```

示例：

```json
{
  "id": "roman_empire",
  "style": {
    "fill": "#d88c8c",
    "opacity": 0.25
  }
}
```

---

# 8. 河流系统

河流属于自然层（所有时代显示，自然地理基本稳定）。

目录：

```text
素材库\geography\raw\physical\rivers\
    jordan.json
    nile.json
    euphrates.json
```

（当前：Natural Earth 河流矢量 `base_map\ne_110m_rivers_lake_centerlines.geojson` 已入库并渲染）

---

# 9. 山脉系统

目录：

```text
素材库\geography\raw\physical\mountains\
    sinai.json
    lebanon.json
    ararat.json
```

作用：解释出埃及、迦南地理、保罗旅行。

（当前：STEP 地点分类含 mountain/range 类山岳标记，已在 LOD 分级中显示）

---

# 10. 时间系统关系

```text
底图：  固定（Natural Geography，不会变化）
历史层：变化
    Time → Political Boundary → Cities → Routes
```

---

# 11. MapLibre 实现（远期参考）

推荐 MapLibre GL JS，图层顺序：

```js
map.addLayer({ id: "base-terrain", type: "raster" })        // Layer 0 底图
map.addLayer({ id: "historical-boundary", type: "fill" })   // Layer 2 疆域
map.addLayer({ id: "ancient-cities", type: "symbol" })      // Layer 3 城市
map.addLayer({ id: "routes", type: "line" })                // Layer 4 路线
```

（当前实现基于 Leaflet + 本地 GeoJSON/Canvas，图层顺序等价；MapLibre 迁移列为后续阶段）

---

# 12. 缩放等级设计

```text
Zoom 0-4    大陆 / 海洋 / 大型地形 / 帝国范围
Zoom 5-8    河流 / 山脉 / 国家 / 主要城市
Zoom 9-12   小城市 / 村庄 / 道路 / 路线节点
Zoom 13+    建筑 / 遗址 / 考古地点
```

---

# 13. 数据目录

**素材一律下载到素材库（只读）；网站侧只保存投影与处理产物。**

```text
素材库（D:\Eyphka\fish\素材\geography\raw\，只读）
├── base_map/                ← 自然底图（ne_110m_land/ocean/rivers/lakes，已入库）
├── natural_earth_gray/      ← Gray Earth 栅格底图（待下载）
├── physical/
│   ├── rivers/              ← 重点河流（约旦河/尼罗河/幼发拉底河…）
│   └── mountains/           ← 重点山脉（西奈/黎巴嫩/亚拉腊…）
├── political_entities/      ← 政治疆域（Cliopatria，已入库）
├── places/                  ← 地点（Pleiades + STEP TIPNR，已入库）
├── historical_roads/        ← 古代道路（Itiner-e，已入库）
└── ubs_marble/              ← 圣经路线（已入库）

网站侧（site\data-src\geography\）
    ├── normalized/          ← 投影（journeys/geometries/territories…）
    ├── mappings/            ← 跨源对应
    └── curated/             ← 人工审定（时期/重要城市…）
```

---

# 14. 最终效果

用户打开地图：

```text
默认：30 AD
底图：浅色地形 + 约旦河 + 黎巴嫩山脉 + 地中海
显示：浅红色 Roman Empire
城市：Jerusalem / Nazareth / Bethlehem
路线：Jesus Ministry Route
```

切换：

```text
1000 BC
自动变化：United Kingdom of Israel / David Kingdom Territory / Ancient Cities
```

---

# 15. 开发原则

必须遵守：

```text
1. 底图永远不包含现代政治信息。
2. 底图永远不包含现代道路。
3. 历史信息全部独立图层。
4. 所有政治边界绑定时间。
5. 所有城市绑定存在时期。
6. 所有路线绑定历史时期。
7. 根据 Zoom 动态加载数据。
8. 素材一律下载到素材库（只读），不可直接修改。
```

最终目标：

```text
建立 Historical Bible Earth，而不是 Modern Map + Bible Markers。
```

---

# 16. 与既有文档的关系与落地状态

| 文档 | 职责 | 当前状态 |
| ---- | ---- | ------- |
| GEOGRAPHY.md | 数据来源职责 / Journey-Stop-Segment / confidence | 第一阶段已落地 |
| HISTORICAL-MAP.md | 时间轴引擎 / 疆域 / 古道 / 底图原则 | Time Engine 已落地；底图按本文档升级 |
| TEMPORAL-MAP-DB.md | LOD / valid_time / 动态图例 | LOD 与图例已落地 |
| 本文档 | 纯自然底图（Gray Earth）/ 分层 / 颜色 / 缩放 | Layer 0-1 已落地（NE 矢量自然层）；Gray Earth 栅格待接入 |
