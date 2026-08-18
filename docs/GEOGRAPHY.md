# FISH 地理位置与圣经路线数据库整合指导文档

> Project: FISH / Bible Research Platform
> Module: Bible Geography & Route System
> Version: v2.0
> Date: 2026-08-15
> Status: Architecture Guideline

---

# 1. 文档目的

本文件规定 FISH 圣经地理与路线系统的数据来源、数据层级、数据库关系、数据导入方式以及地图展示原则。

FISH 已经采用 **STEP Bible** 作为主要圣经地理位置数据来源。

因此，后续不得重新建立一套与 STEP Bible 平行的主地点数据库。

FISH 地理系统采用以下三层数据架构：

```text
STEP Bible
    ↓
Canonical Biblical Place Layer

UBS MARBLE
    ↓
Biblical Route Layer

Itiner-e
    ↓
Historical / Ancient Road Layer
```

三者通过 FISH 的统一实体 ID 和 Mapping Layer 建立关联。

---

# 2. 核心架构原则

## 2.1 STEP Bible 是主地点来源

FISH 中所有圣经地点默认以 STEP Bible 为 Canonical Place Source。

例如：

```text
Jerusalem
Bethlehem
Nazareth
Capernaum
Damascus
Antioch
Jericho
Bethany
```

如果这些地点已经存在于 STEP Bible：

**不得因为其他数据源再次创建重复地点。**

---

# 3. 三个数据源的职责

| 数据源          | 职责        | 是否作为主数据 |
| ------------ | --------- | ------- |
| STEP Bible   | 圣经地点      | YES     |
| UBS MARBLE   | 圣经人物/事件路线 | YES     |
| Itiner-e     | 古代道路      | YES     |
| OpenBible    | 辅助验证      | NO      |
| Pleiades     | 外部历史地理实体  | NO      |
| Wikidata     | 外部实体关联    | NO      |
| Bible Mapper | 参考/验证     | NO      |

---

# 4. 数据层级

FISH 地理系统采用：

```text
Layer 1
Canonical Place

Layer 2
Biblical Journey

Layer 3
Biblical Route

Layer 4
Historical Road

Layer 5
Map Geometry
```

具体关系：

```text
STEP Bible Place
        ↓
Journey
        ↓
Route Stop
        ↓
Route Segment
        ↓
Ancient Road
        ↓
Geometry
```

---

# 5. Canonical Place

Canonical Place 是 FISH 地理系统最重要的基础实体。

它表示：

> FISH 认可并统一管理的圣经地理实体。

默认来源：

```text
STEP Bible
```

例如：

```text
place_jerusalem
place_bethlehem
place_nazareth
place_capernaum
place_damascus
```

---

# 6. Place ID

FISH 必须拥有自己的稳定 ID。

不要直接把 STEP Bible 的原始 ID 当作 FISH 主键。

推荐：

```text
fish_place_000001
fish_place_000002
fish_place_000003
```

同时保存：

```text
step_id
```

例如：

```json
{
  "id": "fish_place_000001",
  "source": "step_bible",
  "external_ids": {
    "step": "STEP_ORIGINAL_ID"
  }
}
```

这样以后更换数据源不会破坏 FISH 内部关系。

---

# 7. Place External IDs

每个地点可以拥有多个外部 ID。

例如：

```json
{
  "place_id": "fish_place_000001",
  "external_ids": {
    "step": "STEP_ID",
    "pleiades": "PLEIADES_ID",
    "wikidata": "WIKIDATA_ID",
    "openbible": "OPENBIBLE_ID"
  }
}
```

原则：

```text
FISH ID
    ↓
Canonical

External IDs
    ↓
Mapping
```

而不是：

```text
OpenBible ID
    ↓
作为 FISH 主 ID
```

---

# 8. UBS MARBLE 路线数据

UBS MARBLE 用于提供：

> 圣经故事中的人物、群体、事件所经过的路线。

例如：

```text
Abraham Journey
Exodus
Paul First Missionary Journey
Paul Second Missionary Journey
Paul Third Missionary Journey
Paul Journey to Rome
```

数据优先使用 GeoJSON。

SVG 仅作为原始资源保存。

---

# 9. UBS Route 不直接创建 Place

这是整个系统最重要的规则之一。

例如 UBS Route 中出现：

```text
Jerusalem
```

系统不能直接创建：

```text
ubs_jerusalem
```

而应该：

```text
UBS Jerusalem
      ↓
Place Mapping
      ↓
STEP Bible Jerusalem
      ↓
fish_place_000001
```

---

# 10. Place Mapping

建立独立的：

```text
place_mappings
```

负责解决：

```text
STEP Bible
UBS MARBLE
Itiner-e
Pleiades
OpenBible
Wikidata
```

之间的实体对应。

推荐：

```json
{
  "id": "mapping_000001",
  "canonical_place_id": "fish_place_000001",
  "source": "ubs_marble",
  "external_id": "UBS_PLACE_ID",
  "relationship": "same_place",
  "confidence": 0.95
}
```

---

# 11. Mapping Relationship

支持：

```text
same_place
probable_same_place
possible_same_place
nearby
historical_predecessor
historical_successor
unknown
```

不能默认：

```text
名称相同 = 同一个地点
```

---

# 12. Journey

Journey 表示完整的圣经旅程。

例如：

```text
journey_abraham
journey_exodus
journey_paul_01
journey_paul_02
journey_paul_03
journey_paul_rome
```

推荐字段：

```text
id
name
type
person_ids
event_ids
scripture_refs
source_ids
description
confidence
```

---

# 13. Journey Type

统一使用：

```text
migration
travel
missionary_journey
military_campaign
exile
flight
pilgrimage
ministry
sea_voyage
return_journey
mixed
unknown
```

---

# 14. Journey Stop

Journey Stop 表示：

> 一次旅程中的一个地点节点。

例如：

```text
Paul First Missionary Journey

1 Antioch
2 Seleucia
3 Salamis
4 Paphos
5 Perga
6 Pisidian Antioch
7 Iconium
8 Lystra
9 Derbe
```

推荐：

```json
{
  "id": "stop_000001",
  "journey_id": "journey_paul_01",
  "sequence": 1,
  "place_id": "fish_place_000001",
  "scripture_refs": [
    "Acts.13.1-3"
  ],
  "confidence": 1.0
}
```

---

# 15. Route Segment

Route Segment 表示两个 Stop 之间的路线。

```text
Antioch
   ↓
Seleucia
```

推荐：

```json
{
  "id": "segment_000001",
  "journey_id": "journey_paul_01",
  "from_stop_id": "stop_001",
  "to_stop_id": "stop_002",
  "geometry_id": "geometry_001",
  "transport_type": "walking",
  "environment": "land",
  "confidence": 0.8
}
```

---

# 16. 为什么必须拆分 Stop 和 Segment

不要设计：

```text
Journey
  ↓
一个巨大 LineString
```

必须：

```text
Journey
   ↓
Stops
   ↓
Segments
```

因为：

```text
Stop
=
发生了什么？

Segment
=
从这里怎么到那里？
```

这样以后才能实现：

* 经文关联
* 路线动画
* 距离计算
* 行程分析
* 古代道路匹配
* 路线争议比较

---

# 17. Biblical Route

Biblical Route 是：

> 根据圣经文本及相关研究建立的旅程路线。

它不一定等于历史上实际使用的道路。

例如：

```text
Jerusalem
      ↓
Damascus
```

这是 Biblical Route。

具体经过哪条道路则属于 Historical Reconstruction。

---

# 18. Historical Route

Historical Route 表示：

> 根据历史地理资料推测的实际旅行路径。

例如：

```text
Jerusalem
      ↓
Ancient Road A
      ↓
Ancient Road B
      ↓
Damascus
```

因此：

```text
Biblical Route
≠
Historical Road
```

两者必须独立。

---

# 19. Itiner-e Ancient Roads

Itiner-e 用于提供：

> 古代道路网络。

它不是圣经路线数据库。

例如：

```text
Road A
Road B
Road C
```

可以与：

```text
Paul Journey
```

建立：

```text
possible_match
```

但不能直接认定：

```text
Paul used Road A
```

除非存在可靠来源支持。

---

# 20. Route-Road Mapping

建立：

```text
route_road_links
```

例如：

```json
{
  "route_segment_id": "segment_001",
  "road_id": "itiner_e_road_001",
  "relationship": "possible_match",
  "confidence": 0.72,
  "source_id": "source_001"
}
```

Relationship：

```text
exact_match
probable_match
possible_match
nearby
intersects
unknown
```

---

# 21. Route Variants

圣经地理路线可能存在不同观点。

因此：

```text
Journey
    ↓
Route Variant A
Route Variant B
Route Variant C
```

例如：

```text
Exodus
 ├── Traditional Route
 ├── Northern Route
 └── Alternative Route
```

每一个 Variant 独立保存：

```text
variant_id
name
description
source_ids
confidence
geometry_id
```

---

# 22. 不确定性模型

FISH 不允许将推测路线显示为确定事实。

每一个：

```text
Place Identification
Journey
Stop
Segment
Road Mapping
Route Variant
```

都可以拥有：

```text
confidence
```

推荐：

```text
0.90–1.00 Very High
0.75–0.89 High
0.50–0.74 Medium
0.25–0.49 Low
0.00–0.24 Very Low
```

confidence 只表示：

> 地理识别或路线重建的证据强度。

不表示：

> 圣经经文本身的可信度。

---

# 23. Geometry

所有地图几何数据统一采用 GeoJSON。

支持：

```text
Point
MultiPoint
LineString
MultiLineString
Polygon
MultiPolygon
```

路线主要：

```text
LineString
MultiLineString
```

地点：

```text
Point
```

地区：

```text
Polygon
MultiPolygon
```

---

# 24. Geometry 与业务数据分离

不要把大型 GeoJSON 直接嵌入 Journey。

错误：

```json
{
  "journey": {
    "geometry": [
      ...
    ]
  }
}
```

正确：

```json
{
  "journey_id": "journey_paul_01",
  "geometry_id": "geometry_001"
}
```

实际 Geometry 独立存储：

```text
geometries/
    geometry_001.geojson
```

---

# 25. Route Environment

路线环境：

```text
land
sea
river
mixed
unknown
```

---

# 26. Transport Type

支持：

```text
walking
horse
donkey
camel
cart
military
ship
boat
unknown
```

不要因为数据库中存在某种交通方式，就自动推断圣经人物使用了该交通工具。

---

# 27. 时间维度

古代道路和地点需要支持时间。

推荐：

```text
start_year
end_year
date_precision
```

date_precision：

```text
exact
approximate
year
decade
century
period
unknown
```

例如：

```json
{
  "start_year": -100,
  "end_year": 300,
  "date_precision": "approximate"
}
```

---

# 28. 数据来源层

所有数据必须保存来源。

推荐：

```text
sources
```

字段：

```text
id
provider
dataset
version
license
author
url
download_date
attribution
```

例如：

```json
{
  "id": "source_step",
  "provider": "STEP Bible",
  "dataset": "STEP Geography",
  "version": "...",
  "license": "...",
  "url": "..."
}
```

---

# 29. Raw / Normalized / Linked / Curated

数据处理必须分层。

```text
RAW
 ↓
NORMALIZED
 ↓
LINKED
 ↓
CURATED
 ↓
APPLICATION
```

**素材一律下载到素材库（`D:\Eyphka\fish\素材\`，只读），且不可修改。** 素材库只存放原始下载数据（RAW），FISH 网站侧（`site\data-src\geography\`）只保存素材投影与处理产物（normalized / mappings / curated）。

目录：

```text
素材库（D:\Eyphka\fish\素材\geography\，只读，禁止人工修改）
└── raw/
    ├── step/          ← STEP Bible 原始素材（TIPNR.txt 等）
    ├── ubs_marble/    ← UBS MARBLE 原始 GeoJSON / SVG
    └── itiner_e/      ← Itiner-e 原始道路数据

网站侧（site\data-src\geography\，素材投影 + 处理产物）
    ├── normalized/
    │   ├── places/
    │   ├── journeys/
    │   ├── stops/
    │   ├── segments/
    │   ├── roads/
    │   └── geometries/
    │
    ├── mappings/
    │   ├── place_mappings/
    │   └── route_road_links/
    │
    └── curated/
        ├── journeys/
        ├── routes/
        └── variants/
```

---

# 30. RAW 数据不可修改

例如：

```text
D:\Eyphka\fish\素材\geography\raw\step\
D:\Eyphka\fish\素材\geography\raw\ubs_marble\
D:\Eyphka\fish\素材\geography\raw\itiner_e\
```

**素材库只读：所有外部素材一律下载到素材库，不直接修改；网站构建只消费 `data-src\` 投影，不直接读取素材库。**

只允许：

```text
下载
校验
更新
版本化
```

禁止人工直接修改。

如果需要修正：

```text
RAW
 ↓
Transformation
 ↓
Curated Override
```

---

# 31. 数据导入顺序

严格按照：

```text
1. STEP Bible
       ↓
2. 建立 Canonical Places
       ↓
3. 导入 UBS MARBLE
       ↓
4. UBS Place → STEP Place Mapping
       ↓
5. 建立 Journeys
       ↓
6. 建立 Stops
       ↓
7. 建立 Segments
       ↓
8. 导入 Itiner-e
       ↓
9. Ancient Road Mapping
       ↓
10. 建立 Route Variants
       ↓
11. 建立 Scripture Links
       ↓
12. 生成地图索引
```

---

# 32. 地点匹配优先级

地点匹配不能只使用名称。

推荐：

```text
Priority 1
External ID

Priority 2
Exact geographic coordinates

Priority 3
Historical / geographic identity

Priority 4
Name + language + region

Priority 5
Manual scholarly review
```

最终：

```text
Automatic Match
        ↓
Confidence
        ↓
Manual Review
```

---

# 33. 地点匹配禁止事项

禁止：

```text
同名
=
同地点
```

禁止：

```text
坐标接近
=
同地点
```

禁止：

```text
地图上看起来接近
=
历史上就是同一路线
```

所有推断必须记录：

```text
method
confidence
source
```

---

# 34. 地图显示层

前端地图根据数据类型分别显示：

```text
STEP Place
    ↓
Marker

Biblical Route
    ↓
Route Line

Possible Route
    ↓
Dashed Line

Uncertain Route
    ↓
Dotted Line

Ancient Road
    ↓
Historical Road Layer
```

具体颜色、线宽、透明度由 FISH UI Design System 统一控制。

---

# 35. 经文与路线联动

最终实现：

```text
Bible Verse
    ↓
Place
    ↓
Journey Stop
    ↓
Route Segment
    ↓
Map
```

例如用户打开：

```text
Acts 13:4
```

系统可以：

```text
Acts 13:4
 ↓
Seleucia
 ↓
Paul First Missionary Journey
 ↓
Route Segment
 ↓
地图定位
```

---

# 36. 人物与路线联动

例如：

```text
Paul
 ↓
First Missionary Journey
 ↓
Second Missionary Journey
 ↓
Third Missionary Journey
 ↓
Journey to Rome
```

每次旅程都有：

```text
Start
Stops
Segments
End
Scriptures
Sources
Variants
```

---

# 37. 路线播放

前端最终支持：

```text
[▶ Play]

Antioch
   ↓
Seleucia
   ↓
Cyprus
   ↓
Paphos
   ↓
Perga
   ↓
Pisidian Antioch
   ↓
Iconium
   ↓
Lystra
   ↓
Derbe
```

每到一个 Stop：

```text
Place
+
Scripture
+
Event
+
Historical Information
+
Route Source
```

同步显示。

---

# 38. 数据库核心实体

最终至少包含：

```text
places
place_aliases
place_external_ids
place_sources
place_mappings

journeys
journey_people
journey_events
journey_sources
journey_variants

journey_stops
route_segments
route_sources
route_variants

ancient_roads
road_sources
route_road_links

geometries
geometry_sources

scripture_place_links
scripture_route_links
```

---

# 39. 核心关系

```text
                 STEP Bible
                     │
                     ↓
                  Places
                     │
          ┌──────────┼──────────┐
          ↓          ↓          ↓
       People      Events    Scripture
          │          │          │
          └──────────┼──────────┘
                     ↓
                  Journey
                     │
                     ↓
               Journey Stops
                     │
                     ↓
               Route Segments
                     │
              ┌──────┴──────┐
              ↓             ↓
        UBS MARBLE       Route Variants
              │
              ↓
       Route-Road Mapping
              │
              ↓
          Itiner-e
              │
              ↓
        Ancient Roads
              │
              ↓
          FISH Map
```

---

# 40. 数据源定位原则

FISH 必须始终保持：

```text
STEP Bible
=
Where?

UBS MARBLE
=
Which Biblical Journey?

Itiner-e
=
Which Ancient Road?

FISH
=
How are they related?
```

这是整个架构的核心。

---

# 41. 为什么不再使用 OpenBible 作为主地点数据库

由于 FISH 已经采用 STEP Bible，因此：

```text
OpenBible
```

不再承担：

```text
Canonical Place Source
```

但仍可以作为：

```text
辅助验证
交叉检查
外部 ID
数据质量检查
```

使用。

因此：

```text
STEP Bible
    ↓
Primary

OpenBible
    ↓
Secondary
```

---

# 42. 第一阶段开发范围

第一阶段只完成：

```text
STEP Bible
    ↓
Canonical Places
    ↓
UBS MARBLE
    ↓
Basic Journey
    ↓
Basic Route
    ↓
Map Rendering
```

暂时不要实现：

```text
AI Route Reconstruction
Automatic Ancient Road Matching
Scholarly Debate Engine
Travel Time Simulation
```

---

# 43. 第二阶段

加入：

```text
Route Variants
Confidence
Historical Reconstruction
Scripture Linking
```

---

# 44. 第三阶段

加入：

```text
Itiner-e
    ↓
Ancient Roads
    ↓
Pleiades Mapping
    ↓
Route-Road Relationship
```

---

# 45. 第四阶段

加入：

```text
Route Playback
Distance Calculation
Travel Time Estimation
Historical Period Filtering
Multiple Route Comparison
```

---

# 46. 第五阶段

最终可以实现：

```text
用户输入：

“保罗第二次宣教旅程”

        ↓

FISH Search

        ↓

Journey

        ↓

地图

        ↓

所有 Stops

        ↓

对应经文

        ↓

可能的古代道路

        ↓

不同学术路线

        ↓

距离

        ↓

历史背景
```

---

# 47. 最终架构原则

FISH 地理系统必须遵守以下原则：

```text
1. STEP Bible 是 Canonical Place Source。

2. UBS MARBLE 是 Biblical Route Source。

3. Itiner-e 是 Ancient Road Source。

4. 不重复创建已有 STEP Bible 地点。

5. 所有外部地点通过 Mapping Layer 关联。

6. Biblical Route 与 Ancient Road 必须分离。

7. Route Stop 与 Route Segment 必须分离。

8. 所有推测数据必须具有 Confidence。

9. 所有路线争议必须允许 Route Variant。

10. RAW 数据不可直接修改。

11. 所有外部数据必须保存 Source。

12. Geometry 与业务实体分离。

13. 名称不能作为唯一实体匹配依据。

14. 不把推测路线显示为确定事实。

15. 不把古代道路自动等同于圣经人物实际使用的道路。

16. 不允许 AI 自动创造未经来源支持的地理事实。
```

---

# 48. 最终数据模型

最终 FISH 地理系统形成：

```text
STEP Bible
     │
     ▼
Canonical Places
     │
     ├───────────────┐
     │               │
     ▼               ▼
Scriptures        Journeys
                     │
                     ▼
                Journey Stops
                     │
                     ▼
                Route Segments
                     │
             ┌───────┴────────┐
             ▼                ▼
        UBS MARBLE       Route Variants
             │
             ▼
      Route-Road Mapping
             │
             ▼
         Itiner-e
             │
             ▼
       Ancient Roads
             │
             ▼
         GeoJSON
             │
             ▼
        FISH Map Engine
```

---

# 49. 最终目标

FISH 最终不是简单制作：

> “一张圣经地图”。

而是建立一个：

> **Bible Geographic Information System**

即：

```text
圣经文本
+
地点
+
人物
+
事件
+
旅程
+
路线
+
古代道路
+
历史时期
+
经文
+
学术观点
+
地理不确定性
+
互动地图
```

最终形成：

```text
Bible
   ↓
Geography
   ↓
Journey
   ↓
Route
   ↓
Ancient World
   ↓
Interactive Research
```

这套架构应作为 FISH 后续所有“圣经地图 / 地理 / 路线 / 人物旅程”功能的基础规范。
