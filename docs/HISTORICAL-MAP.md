# 历史动态圣经地图系统设计（HISTORICAL MAP）

> Bible Research Platform (BRP)
> Historical Dynamic Map System Design
> Version: 1.0
> 关联文档：[GEOGRAPHY.md](GEOGRAPHY.md)（地理数据架构：STEP Bible 主地点 / UBS MARBLE 路线 / Itiner-e 古道）
>
> **素材约定：所有外部素材一律下载到素材库（`D:\Eyphka\fish\素材\`，只读，禁止人工修改）；网站侧只保存投影与处理产物（`site\data-src\`）。**

---

# 1. 系统目标（Vision）

传统圣经地图存在的问题：

- 使用现代国家边界
- 使用现代道路网络
- 使用现代城市名称
- 无法体现政治变化
- 无法体现古代旅行路线

BRP 历史地图系统目标：

创建一个：

> 根据时间自动变化的古代世界地图

用户可以：

- 拖动时间轴
- 查看对应时代地图
- 查看当时政治疆域
- 查看当时道路
- 查看圣经人物路线

例如：

用户选择：

```text
公元 30 年
```

系统显示：

```text
罗马帝国
    |
Judea 省
    |
Jerusalem
    |
Galilee
```

同时显示：

```text
耶稣事工路线
```

---

# 2. 核心设计理念

## 不使用现代地图作为主要地图

错误方式：

```text
OpenStreetMap
    +
圣经地点 Marker
```

结果：

```text
现代道路
现代国界
现代城市
```

导致：

```text
历史错误。
```

---

正确方式：

```text
Historical Base Map
Historical Political Boundary
Historical Road Network
Historical Place Database
Bible Event Layer
```

结构：

```text
时间
    ↓
历史状态
    ↓
地图渲染
    ↓
事件路线
```

---

# 3. 地图数据分层架构

## Layer 1：历史底图（Base Map）

负责：

- 地形
- 河流
- 海洋
- 山脉

不包含：

- 国家
- 道路
- 城市

数据来源：

推荐：

- Natural Earth Historical
- AWMC
- Pleiades

格式：

```text
GeoJSON
```

示例：

```text
素材库\geography\raw\base_map\
    terrain.geojson
    rivers.geojson
    mountains.geojson
```

---

## Layer 2：政治疆域层

负责：

不同年代国家范围。

例如：

```text
United Kingdom of Israel
1000 BC
```

数据：

```text
素材库\geography\raw\political_entities\
    israel_united.geojson
    judah.geojson
    assyria.geojson
    babylon.geojson
    persia.geojson
    roman_empire.geojson
```

JSON：

```json
{
  "id": "roman_empire",
  "time": {
    "start": -27,
    "end": 476
  },
  "territory": {
    "type": "polygon",
    "file": "roman_30.geojson"
  },
  "regions": [
    "Judea",
    "Galatia",
    "Macedonia"
  ]
}
```

## Layer 3：古代道路系统

禁止使用：

```text
现代道路。
```

需要：

```text
Historical Road Network
```

例如：

罗马时期：

```text
Via Maris
Via Augusta
Roman Roads
```

旧约时期：

```text
King's Highway
Way of the Sea
```

数据：

```text
素材库\geography\raw\historical_roads\
    roman_roads.json
    persian_roads.json
    ancient_trade_routes.json
```

结构：

```json
{
  "id": "via_maris",
  "period": {
    "start": -1200,
    "end": 400
  },
  "type": "road",
  "path": [
    [35.1, 31.7],
    [34.9, 32.0]
  ]
}
```

## Layer 4：圣经事件路线

例如：

```text
亚伯拉罕路线
Ur
    ↓
Haran
    ↓
Canaan
```

数据（对应 GEOGRAPHY.md 的 Journey 模型，UBS MARBLE 为 Biblical Route Source）：

```text
素材库\geography\raw\ubs_marble\GeoJsonRoutes\   ← 已入库（179 条，只读）
data-src\geography\normalized\journeys\          ← 投影（import-ubs-journeys.mjs 生成）
```

结构：

```json
{
  "id": "paul_second_journey",
  "time": "50-52",
  "route": [
    { "place": "Antioch" },
    { "place": "Philippi" },
    { "place": "Corinth" }
  ]
}
```

---

# 4. 时间轴系统（Time Engine）

用户：

```text
拖动：
3000 BC  ←————→  2026 AD
```

系统获取：

```text
current_year
```

例如：

输入：

```text
30
```

查询：

```text
政治：  WHERE start <= 30 AND end >= 30
道路：  WHERE period.start <= 30 AND period.end >= 30
地点：  WHERE exist_time <= 30
```

---

# 5. 时间状态模型

所有历史对象必须拥有：

```text
valid_time
```

统一格式：

```json
{
  "time": {
    "from": -586,
    "to": 539
  }
}
```

表示：

```text
巴比伦统治时期。
```

---

# 6. 地图渲染流程

用户拖动：

```text
时间轴
    ↓
Time Engine
    ↓
查询所有有效 Layer
    ↓
Map Renderer
    ↓
重新绘制
```

流程：

```text
            Timeline
                |
                v
         Historical Engine
                |
        ---------------------
        |          |         |
      Nation    Road     Place
        |          |         |
        v          v         v
            Map Display
```

---

# 7. 前端地图设计

推荐：

```text
MapLibre GL JS
```

原因：

- 开源
- 支持 Vector Tile
- 可以动态切换 Style

不要：

```text
Google Map
```

原因：

- 现代信息太强
- 无法控制历史图层

---

# 8. 地图样式

古代地图模式：

隐藏：

```text
现代道路
现代行政边界
现代 POI
```

显示：

```text
河流
山脉
古代城市
古代道路
历史疆域
```

---

# 9. 数据目录设计

**素材一律下载到素材库（只读，禁止人工修改）；网站侧（`site\data-src\`）只保存投影与处理产物。**

```text
素材库（D:\Eyphka\fish\素材\geography\，只读）
└── raw/
    ├── base_map/             ← 历史底图（地形/河流/山脉）
    ├── political_entities/   ← 政治疆域（kingdoms / empires）
    ├── historical_roads/     ← 古代道路（ancient / roman）
    ├── places/               ← 地点（biblical；主地点以 STEP TIPNR 为准）
    └── ubs_marble/           ← 圣经事件路线（UBS MARBLE 原始 GeoJSON/SVG，已入库）

网站侧（site\data-src\geography\，素材投影 + 处理产物）
    ├── normalized/
    │   ├── places/           ← 地点投影（STEP，place-coords.json）
    │   ├── journeys/         ← 旅程投影（UBS MARBLE，import-ubs-journeys.mjs）
    │   ├── geometries/       ← 路线几何（独立存储）
    │   ├── roads/            ← 古代道路（Itiner-e / AWMC，待接入）
    │   └── territories/      ← 政治疆域（按时期切片，待接入）
    │
    ├── mappings/
    │   └── place_mappings/   ← 跨数据源地点对应（same_place 等，见 GEOGRAPHY.md）
    │
    └── curated/
        ├── journeys/
        └── variants/
```

---

# 10. 圣经时期优先支持

第一阶段：

```text
旧约
2100 BC  亚伯拉罕时期
1400 BC  出埃及
1000 BC  大卫王国
722 BC   亚述灭北国
586 BC   巴比伦灭犹大
539 BC   波斯时期

新约
63 BC    罗马进入犹太
30 AD    耶稣时期
50 AD    保罗宣教时期
70 AD    圣殿毁灭
```

---

# 11. 推荐数据源

| 类别     | 数据源                            | 角色（对齐 GEOGRAPHY.md）                        |
| ------- | -------------------------------- | ------------------------------------------- |
| 地点     | STEP Bible Geography（TIPNR）    | **主地点来源**（已接入，913 地点）               |
| 地点     | Pleiades                         | 辅助验证 / 外部 ID                            |
| 古代道路 | AWMC                             | 古代道路参考                                   |
| 古代道路 | Itiner-e                         | **Historical Road Source**（第三阶段）        |
| 罗马时期 | Digital Atlas of Roman Empire    | 罗马道路/疆域参考                              |
| 古代近东 | ORACC / Digital Atlas of Ancient Near East | 古代近东疆域参考                    |
| 圣经路线 | UBS MARBLE                       | **Biblical Route Source**（已接入，179 旅程） |

---

# 12. 最终用户体验

用户打开：

```text
圣经地图
默认：30 AD
```

显示：

```text
罗马帝国
犹太省
耶路撒冷
加利利
耶稣路线
```

用户拖动：

```text
586 BC
```

地图自动变化：

```text
巴比伦帝国
犹大亡国
耶路撒冷被毁
被掳路线出现
```

用户拖动：

```text
1000 BC
```

显示：

```text
联合王国
扫罗 / 大卫 / 所罗门
疆域
```

---

# 13. 开发原则

必须遵守：

```text
1. 不使用现代国界解释古代政治。
2. 不使用现代道路表示古代路线。
3. 所有地图对象必须绑定时间（valid_time）。
4. 所有路线必须绑定时代。
5. 所有地点必须支持历史名称变化。
6. 地图数据与经文数据分离。
7. 素材一律下载到素材库（只读），不可直接修改。
```

最终形成：

```text
Bible + History + Geography + Timeline
四维研究系统。
```

---

# 14. 与 GEOGRAPHY.md 的关系

- **GEOGRAPHY.md**（v2.0）规定数据来源职责与实体模型：STEP Bible = Canonical Place Source、UBS MARBLE = Biblical Route Source、Itiner-e = Ancient Road Source；Journey → Stop → Segment 分离；confidence 模型；五阶段路线图。
- **本文档**在其之上补充**时间维度**：历史底图 / 政治疆域 / 古代道路 / 时间轴引擎 / valid_time 模型 / 按时期渲染。
- 两者共用同一素材库与数据管线：外部素材 → `素材\geography\raw\`（只读）→ 投影 `data-src\geography\` → 构建 `public\data\geography\`。
- 实施阶段划分：GEOGRAPHY.md 第一阶段（STEP Places + UBS Basic Journey + Map Rendering）已落地；政治疆域（Layer 2）、古代道路（Layer 3）、时间轴（§4–§6）在后续阶段按本文档接入。
