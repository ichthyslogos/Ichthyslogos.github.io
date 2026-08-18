# FISH Historical GIS 架构规范（v1.0）

> FISH 历史动态地图的统一架构标准：时间语义层 + 地名引擎 + 历史数据校验器。
> 本文件把"数据源直连地图"的旧思路收敛为"统一 Historical DB → Temporal Engine → 瓦片"的
> 单向管线（对应 [TEMPORAL-MAP-DB.md](TEMPORAL-MAP-DB.md) 的 v2 数据库 schema 与
> [HISTORICAL-MAP.md](HISTORICAL-MAP.md) 的地图层设计；本文件是它们的架构总纲）。
>
> 状态标记：✅ 已实现（正式版）· 🚧 本次实施 · ⏳ 路线图（未实施）

---

## §0 设计原则（先读这里）

1. **数据源禁止直连 MapLibre**。STEP / Pleiades / Cliopatria / AWMC 等任何来源都必须先经过
   Ingestion → Identity → Temporal → Source → Conflict 五级处理，进入 FISH Historical DB，
   再由 Temporal Engine 查询后才渲染。谁直连，谁就会把"时代错位、同地多点、名称打架"带进地图。
2. **时间不是图层的属性，是数据的属性**。地图上"什么时候出现什么"由统一的 Temporal Filter
   决定，任何图层不得自行决定出现时间。
3. **四类时间必须分离**（§3.2）：地点存在时间 / 名称使用时间 / 政治归属时间 / 考古证据时间，
   绝对不能混成一个字段。
4. **AI 不决定历史事实**。AI 只能辅助整理、匹配、发现冲突；历史窗口、名称、归属的最终判断
   属于人工审定（curated）或来源声明（attestation），系统只负责"按时查询 + 冲突报告"。
5. **冲突不静默覆盖**。多源时间不一致时不得强行取一个值；保存各来源声明，输出 consensus
   （区间交集）+ certainty + sources 列表（§6）。
6. **每个数据必须可溯源**。谁在什么来源、对什么时间/地点提出了什么主张，必须可查（§5/§6）。

---

## §1 总体架构

```text
                    FISH Historical GIS
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
  Temporal Engine                           Gazetteer Engine ⏳
  时间引擎（✅ v2）                            地名引擎（P1，site-test v5 已实现）
        │                                         │
 ┌──────┼──────┐                          ┌────────┼────────┐
 │      │      │                          │        │        │
国家    城市   路线                        古名     英名     别名
（疆域） （地点） （旅程）                    （多语言 × 多时代）
 └──────┼──────┘                          └────────┼────────┘
        └────────────────┬─────────────────────────┘
                         │
                   Historical DB（data-src/geography/）
                         │
               ┌─────────┴─────────┐
               │                   │
            Geometry            Metadata
               │                   │
           GeoJSON             JSON（temporal-v2）
               │                   │
               └─────────┬─────────┘
                         │
                    Vector Tile 构建（build-tiles.mjs）
                         │
                    MapLibre GL JS
```

数据流向（任何数据源都不允许跳过中间环节直达 MapLibre）：

```text
STEP ───┐   Pleiades ──┐   Cliopatria ─┐   DARE ─┐   AWMC ─┐   NE ─┐
        ▼              ▼              ▼         ▼         ▼      ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ Data Ingestion（build-brp-historical.mjs 等导入/构建脚本）        │
   ├────────────────────────────────────────────────────────────────┤
   │ Identity Resolution   —— 同地多点合并（Pleiades↔DARE ≤1km）、    │
   │                          external_ids 多源 ID 保留（§4）         │
   ├────────────────────────────────────────────────────────────────┤
   │ Temporal Resolution   —— 四类时间分离 + 窗口规范化（§3）          │
   ├────────────────────────────────────────────────────────────────┤
   │ Source Resolution     —— 来源优先级 + provenance 头（§2/§5）     │
   ├────────────────────────────────────────────────────────────────┤
   │ Conflict Detection    —— Historical Validator（§7）             │
   └────────────────────────────────────────────────────────────────┘
                         │
                  FISH Historical DB（normalized/ + curated/）
                         │
                  Temporal Engine（src/lib/temporal.js）
                         │
                  Vector Tile Builder（build-tiles.mjs：TIME→ZOOM→RENDER）
                         │
                     MapLibre
```

---

## §2 数据源层级（Source Hierarchy）

| 数据 | 第一用途 | 优先级 | 状态 |
| --- | --- | ---: | --- |
| Cliopatria（Seshat） | 历史政权边界（国家疆域唯一源） | ⭐⭐⭐⭐⭐ | ✅ 已接入（1547 实体 / 14,061 状态） |
| Pleiades | 古代地点身份 + 坐标 + 古名 | ⭐⭐⭐⭐⭐ | ✅ 已接入（31,036 地点） |
| STEP Bible（TIPNR） | 圣经地点 | ⭐⭐⭐⭐⭐ | ✅ 已接入（913 地点） |
| DARE（klokantech/roman-empire） | 罗马地点（城市名/坐标；**行省不接入**——行政区划已删除） | ⭐⭐⭐⭐ | ✅ 已接入（14,737 地点） |
| AWMC urban_areas | 城区（城市建成区） | ⭐⭐⭐⭐ | ✅ 已接入（95 城区） |
| Natural Earth | 自然地理底图（海洋/河流/湖泊；**禁行政边界**） | ⭐⭐⭐⭐⭐ | ✅ 已接入 |
| UBS MARBLE | 圣经旅程路线 | ⭐⭐⭐⭐ | ✅ 已接入（179 旅程） |
| World Historical Gazetteer（WHG） | 历史地点/名称/时间/来源（attestation 参考） | ⭐⭐⭐⭐⭐ | ⏳ 候选（架构 §6 思想已吸收） |
| Historical Basemaps（aourednik） | 历史边界补充（交叉验证用） | ⭐⭐⭐ | ⏳ 测试版已试（v3），正式版未采用 |
| OpenHistoricalMap（OHM） | 历史地图展示补充层 | ⭐⭐⭐ | ⏳ 测试版已试（v4/v5），正式版未采用 |
| DARMC / Mapping Past Societies | 历史社会空间数据交叉验证 | ⭐⭐⭐ | ⏳ 候选 |
| ORBIS（Stanford） | 罗马交通网络（道路+水路+成本模型） | ⭐⭐⭐ | ⏳ 候选（路线系统扩展） |

**优先级裁决规则**（Temporal/Source Resolution 时使用）：

1. 同一实体的**时间窗口**：curated（人工审定）> STEP 圣经时间窗 > Pleiades/DARE 源窗口；
   curated 特例以 `place-eras.json` 为准（§10 白名单）。
2. 同一地点的**身份/坐标**：STEP 优先（主地点源），Pleiades 补位，DARE 在 ≤1km 内并入
   坐标与罗马名。
3. 国家疆域：**Cliopatria 是唯一源**——不再混入任何行政区划层（v2.1 已删除 DARE 行省 /
   NE admin-1，见 [docs/README.md](README.md) 变更记录）。
4. 底图：Natural Earth 纯自然地理，**任何时期都不显示现代行政边界**。

---

## §3 时间数据模型标准

### §3.1 年份表示

- **signed integer year**：1000 BC = `-1000`，30 AD = `30`；**禁止 0 BC / 0 AD**（0 年不存在）。
- 区间为闭区间 `[from, to]`；`from == to` 表示单年；`to: null` 仅用于 curated/gazetteer 的
  开放区间（"至今"），normalized 数据不得含 null 窗口。
- 源数据反置窗口（`startyear > endyear`）由 `normWindow` 自动交换修复（已清零）。

### §3.2 四类时间分离（不可合并为一个字段）

| 类型 | 字段 | 含义 | 实现 |
| --- | --- | --- | --- |
| 地点存在时间 | `existence {from, to}` | 地点作为聚落/实体存在的窗口 | ✅ v2 |
| 名称使用时间 | `names[] {name, from, to}` | 每个名称（时代名）各自的使用窗口 | ✅ v2 |
| 政治归属时间 | `political_affiliations[] {polity, from, to, kind}` | 覆盖该点的政权窗口 | ✅ v2 |
| 考古证据时间 | （未落地） | 考古/文献证据主张的时间 | ⏳ 预留 |

> 注意：`political_affiliations` 的窗口端点是**锚点年采样值**
> （`ANCHOR_YEARS = [-2100, -1400, -1000, -722, -586, -539, -63, 30, 50, 70]` 点包含测试后
> 相邻年合并），不是连续真实窗口——校验器对归属段不做存在窗口包含性 ERROR。

### §3.3 precision / certainty（可选字段，标准定义，数据逐步采纳）

历史资料往往只有"约公元前 8 世纪"或"Roman period"级别的时间精度。允许在任意时间窗上附加：

```json
{ "from": -800, "to": -701,
  "precision": "century",          // ∈ {year, decade, century}
  "certainty": "probable" }        // ∈ {certain, probable, uncertain}
```

- `precision` 缺省 = `year`（精确年）；`certainty` 缺省 = `certain`。
- 数据文件在采纳时逐步加入；校验器**接受并验证**这些字段（§7），不因缺失而报错。
- 示例：`place-eras.json` 的 curated 特例可在 `_note` 中声明精度；HBM 的
  `border_precision: 1`（近似）即同类概念。

### §3.4 存在窗口来源链（existence_src）

`existence {from, to}` 的取值来源按优先级（实体字段 `existence_src` 记录来源，供校验器追溯）：

| 优先级 | 来源 | existence_src | 覆盖（2026-08 数据） |
| --- | --- | --- | --- |
| 1 | curated `place-eras.json`（STEP 特例，人工审定） | `curated` | 33 地点 |
| 2 | **Pleiades 数值年**（官方 dumps `minDate`/`maxDate`，带符号整数年、无 0 年；单侧 null 用类型启发式补齐） | `pleiades` | 城市 11,028 / 地区 493 / 国家 193 / 其余 17,800+ |
| 3 | DARE 自带年份（places_medium.geojson） | `dare` | 14,737 地点 |
| 4 | 类型启发式默认窗（`PL_TYPE_CAT`；无任何时间来源时兜底） | `heuristic` | 待人工 curated 补录 |

- **数据版本**：Pleiades 2026-08-17 官方导出（`fetch-pleiades.mjs` 下载 dumps + GIS 包，
  CC BY 4.0；旧版 2021-11-14 归档 `素材/geography/raw/places/legacy-2021/`）。
- **“保证每个城市/国家有数据”**：构建日志输出按「类别|来源」的覆盖率统计；
  `historical_validator.js` 对纯启发式窗口（`existence_src='heuristic'`）的
  city/region/nation/capital 输出 WARNING 补录清单——人工审定后写入 `place-eras.json` 即可。
- **政权窗口修正（curated/polity-eras.json）**：Cliopatria 源数据时间窗错误（如色雷斯
  王国应止于 46 年、二征起义止于 43 年、希腊城邦独立止于前 146 年）由该表 clamp 修正，
  构建期应用、校验器检查引用完整性——源素材只读，修正统一入表。

---

## §4 Entity Identity（实体身份）

**Place ID ≠ Place Name**：Byzantium / Constantinople / İstanbul 是**同一个地点**（P001…P005
等 gazetteer 一体记录）的不同时代名称，不得因名称不同而分裂成多个点。

```json
{
  "id": "fish_place_046258",
  "name": "Jerusalem",
  "external_ids": { "step": "Jerusalem", "pleiades": "687898" }
}
```

- `external_ids` 允许键白名单：`{step, pleiades, whg, wikidata, awmc, dare}`；
  校验器对白名单外键报 WARNING（§7）。
- 目前数据已带 `step` / `pleiades`（DARE 并入地点带 `dare`）键；`whg` / `wikidata` 为预留，
  接入 WHG 数据时回填（P1）。
- 同地多记录合并规则（Identity Resolution）：坐标 ≤1km 且同名 → 合并（Pleiades↔DARE 已实现）；
  同名同窗重复切片 → 去重（Cliopatria 源重复要素已实现）。

---

## §5 Source / Provenance（来源与溯源）

每个 normalized 文件带 source 头（HISTORICAL-GIS v1.0 起扩展）：

**单源文件**（polities.json / urban.json）——扁平字段：

```json
{ "key": "brp_polities", "providers": "cliopatria", "schema": "temporal-v2",
  "url": "https://github.com/Seshat-Global-History-Databank/cliopatria",
  "version": "2024 数据集（3400 BCE–2024 CE，Seshat Global History Databank）",
  "license": "CC BY 4.0", "updated": "2026-08-17" }
```

**多源文件**（places.json）——逐源数组：

```json
{ "key": "brp_places", "providers": "pleiades+step+dare", "schema": "temporal-v2",
  "sources": [
    { "provider": "pleiades", "url": "https://pleiades.stoa.org", "version": "2021-11-14 导出 CSV", "license": "CC BY 4.0" },
    { "provider": "step",     "url": "https://www.stepbible.org", "version": "TIPNR 词表", "license": "CC BY 4.0" },
    { "provider": "dare",     "url": "https://imperium.ahlfeldt.se", "version": "klokantech/roman-empire", "license": "CC BY 4.0" }
  ],
  "updated": "2026-08-17" }
```

实体级 `sources[]`（如 places 每条的 `["pleiades","dare"]`、polities 的 `["cliopatria"]`）
标明该实体来自哪些源；`license: null` 表示该源许可证待核实（见 §10 冲突清单 AWMC 条目）。

---

## §6 Attestation 原则（WHG 思想）

> 数据库保存的不是"绝对事实"，而是"谁在什么来源中，对什么时间/地点提出了什么主张"。

1. 每条时间/名称/归属信息可追溯到来源（`sources[]` / `external_ids` / source 头）。
2. 多源冲突**不静默覆盖**——例如 Pleiades 说 Jerusalem 名称窗口到 -1000、curated 说 -1800，
   系统不强制二选一，而是采用 curated 优先级（§2 规则 1）并把差异记入冲突清单（§10）。
3. 来源声明字段模型（gazetteer 已实现，正式版 places 待 P1 统一）：

```json
{ "name": "Aelia Capitolina", "from": 135, "to": 324,
  "source": "curated", "confidence": 0.9 }
```

4. 冲突汇总为 consensus：`[区间交集] + certainty + sources 列表`，由 Historical Validator
   持续报告（§7），人工审定后进入 curated。

---

## §7 Historical Validator 规范（historical_validator.js 🚧 本次实施）

`npm run data:validate-map` 串联全部地图校验；本规范定义 ERROR / WARNING 两级。

### 分级语义

| 级别 | 含义 | 处理 |
| --- | --- | --- |
| **ERROR** | 数据结构性错误，渲染必然出错 | 必须修复；exit code = 1 |
| **WARNING** | 时间/来源冲突或可疑特例，需人工复核 | 报告但不阻断；白名单特例随附说明 |

### 检查项清单

| # | 检查项 | 级别 | 依据 |
| --- | --- | --- | --- |
| 1 | 窗口反置（existence/names/importance/state/affiliations/urban/polity states `from > to`） | ERROR | §3.1 |
| 2 | 地点缺 existence / 窗口为空 | ERROR | §3.2 |
| 3 | affiliation 悬空引用（polity_id 不存在于 polities） | ERROR | §4 |
| 4 | polity states 窗口重叠 / 未排序 / 非法 | ERROR | TEMPORAL-MAP-DB §0.4 |
| 5 | 名称窗口超出 existence——Pleiades attested names 独立窗口（四类时间分离） | WARNING（聚合统计） | §3.2 |
| 5b | curated place-eras 名称窗口超出 curated valid_time | WARNING（白名单特例逐条） | §10 |
| 6 | 归属窗口超出 existence（锚点年采样粒度端点外溢） | WARNING（聚合统计） | §3.2 注 |
| 7 | curated place-eras `valid_time` ↔ normalized existence 不一致 | WARNING | §2 规则 1 |
| 8 | curated place-importance 段超出 eras 窗口 | WARNING | §10 |
| 9 | `external_ids` 键不在白名单 `{step, pleiades, whg, wikidata, awmc, dare}` | WARNING | §4 |
| 10 | `sources[]` 与 `external_ids` 不一致（如声明 pleiades 却无 pleiades id） | WARNING | §5 |
| 11 | 时期缺 era 元数据 | ERROR | TEMPORAL-MAP-DB §0.5 |
| 12 | precision/certainty 取值非法（若出现） | ERROR | §3.3 |

> 分工：本校验器管**跨文件冲突检测**（curated ↔ normalized ↔ periods ↔ polities）；
> 单文件结构校验（环闭合、坐标范围、几何缺陷等）仍在 `temporal_consistency.js` /
> `geojson_validator.js` / `polygon_defect_checker.js` 等既有测试中。

---

## §8 数据管线（现状对照）

| 阶段 | 实现 | 状态 |
| --- | --- | --- |
| Ingestion（导入脚本） | `scripts/import.mjs`、`fetch-dare.mjs`、`import-ubs-journeys.mjs` → 素材库 | ✅ |
| Identity Resolution | Pleiades↔DARE ≤1km 合并；Cliopatria 同名同窗去重 | ✅ |
| Temporal Resolution | `normWindow` 反置修复；curated 覆盖；锚点年点包含测试 | ✅ |
| Source Resolution | source 头 + 实体级 `sources[]`；Cliopatria 疆域唯一源 | ✅（头升级 🚧 本次） |
| Conflict Detection | `historical_validator.js` | 🚧 本次 |
| Historical DB | `data-src/geography/normalized/`（places/polities/urban）+ `curated/` | ✅ |
| Temporal Engine | `src/lib/temporal.js`（existsAt/nameAt/importanceAt/affiliationAt/polityAt/stateAt） | ✅ |
| Vector Tile Builder | `build-tiles.mjs`（TIME→ZOOM→RENDER 过滤链） | ✅ |
| MapLibre 渲染 | `MapLibreMap.vue`（时期瓦片集切换 + 弹窗隶属） | ✅ |

---

## §9 P0–P4 路线图状态表

| 优先级 | 项目 | 内容 | 状态 |
| --- | --- | --- | --- |
| **P0** | ① Temporal Data Model | `valid_from/valid_to + precision + certainty` 标准（§3） | 🚧 标准本次入文档，数据逐步采纳 |
| **P0** | ② Entity Identity | 多源 ID（STEP/Pleiades/WHG/Wikidata）规范（§4） | 🚧 白名单本次由校验器强制 |
| **P0** | ③ Source / Provenance | source 头 url/version/license（§5） | 🚧 本次升级 + 重建 |
| **P0** | ④ Historical Validator | ERROR/WARNING 分级冲突检测（§7） | 🚧 本次实施 |
| **P1** | ⑤ Historical Gazetteer | 多语言 × 多时代地名解析（Byzantium→Constantinople→İstanbul） | ⏳ site-test v5 已完整实现，待移植 |
| **P2** | ⑥ Political affiliation | 地点→政权归属（Kingdom of Judah→Persian→Hasmonean→Roman） | ✅ v2 已实现 |
| **P3** | ⑦ Roads/Routes temporalization | 道路/旅程进入时间系统 | ⏳ 道路数据 2026-08-16 已按决定删除；UBS 旅程按时期过滤已实现 |
| **P4** | ⑧ MapLibre Vector Tile | MVT + zoom + symbol + label | ✅ v2 已实现 |

---

## §10 已知冲突清单与 curated 特例白名单

### 10.1 白名单特例（人工审定有意为之，**不修改数据**，校验器输出 WARNING）

| 实体 | 冲突 | 白名单理由 |
| --- | --- | --- |
| Jerusalem | 名称段 `Aelia Capitolina [135, 324]` 超出 existence `[-1800, 100]` | STEP 存在窗口覆盖圣经时期；Aelia 是罗马殖民地时代名（curated 特例） |
| Babylon | 名称段 `Babel [-2300, -600]` 起点早于 curated valid_time `[-2300, 100]`（相邻等界，无实质冲突） | 等界特例 |
| place-importance 全表（20 段） | importance 段超出 eras valid_time（Rome `[-30,476]`、Athens `[-3000,-800]` 等） | curated 全历史重要性曲线，超出 STEP 窗口属有意 |
| 归属段端点外溢（93 段） | 归属窗口超出 existence（如 `Gutian Dynasty [-2100,-2100]` vs existence `[-2000,640]`） | 10 锚点年采样粒度（§3.2 注），端点外溢属预期 |
| 名称窗口超出 existence（22,214 段） | Pleiades/DARE attested names 独立窗口（如中世纪阿拉伯名 `[1500,1599]` vs 启发式 existence `[-3000,640]`） | 四类时间分离（§3.2）：名称使用窗口与存在窗口独立 |
| AWMC urban | 素材库 `awmc/LICENSE.md` 为失效 404 记录，`license: null` | 官方为 CC BY-NC 4.0，待核实后回填（§5） |

### 10.2 待人工复核清单（校验器持续发现，非白名单）

| 实体 | 冲突 | 建议动作 |
| --- | --- | --- |
| Babylon / Alexandria / Memphis / Thessalonica / Pergamum / Nazareth / Bethlehem / Hebron / Jericho / Gaza（10 处） | curated `place-eras.json` valid_time 与 normalized existence 不一致（如 Babylon curated `[-2300,100]` vs normalized `[-330,640]`） | curated 窗口应优先——检查 STEP 名称匹配为何未命中（实体名差异/合并丢失） |
| Carthage / Persepolis / Ugarit | curated 条目无对应 normalized 地点 | 核对拼写（如 Carthago vs Carthage）或地点合并关系 |

校验器输出的完整清单以 `npm run data:validate-map` 实际报告为准；白名单随 curated 审定
持续增补（在 `historical_validator.js` 的 `CURATED_EXCEPTIONS` 表维护）。

---

## §11 常用命令

```bash
npm run data:build          # 素材 → data-src → public（完整重建）
npm run data:validate-map   # 全部地图校验（含 historical_validator）
node map_tests/historical_validator.js   # 仅冲突检测器
node map_tests/temporal_consistency.js   # 仅时间一致性
```

## §12 地区数据库（regions.json）

**地区地点**（`places.json` 中 `entity_type ∈ {region, nation}`，共 960 个）的权威时空库，
由 `scripts/geography/build-regions.mjs` 生成（`data:build` 中位于 build-periods 之后）：

```json
{ "source": { "key": "fish_regions", "providers": "pleiades+step+dare", "schema": "temporal-v2", "updated": "2026-08-17" },
  "count": 960,
  "periods": ["abraham", "exodus", "david", "assyria", "babylon", "persia", "rome_entry", "jesus", "paul", "temple_fall"],
  "regions": [
    { "id": "fish_place_000001", "en": "Gallia", "zh": "", "entity_type": "region",
      "from": -2000, "to": 640,
      "location": { "lng": 1.670614, "lat": 46.360953 },
      "periods": ["exodus", "david", "assyria", "babylon", "persia", "rome_entry", "jesus", "paul", "temple_fall"] }
  ] }
```

- **`from`/`to`**：出现/灭亡时间 = 地点 `existence` 窗口（Pleiades/STEP 源窗口 + curated 覆盖）。
- **`periods`**：时期映射——**时期锚点年 `period.year ∈ [from, to]` 才显示，否则不显示**，
  与瓦片构建 `build-tiles.mjs` 的 `inSlice` 完全一致（防"数据库与地图显示脱节"由
  `map_tests/regions_test.js` 抽样比对保证）。
- **`zh`**：中文名槽位，来自 `data-src/geography/curated/region-names.json`
  （`{ en: "中文名" }` 人工审定表）。未录入为空串，前端显示回退英文。
  录入方式：编辑 curated 表 → 重跑 `npm run data:build` 即自动合并进 regions.json 与瓦片。
- **显示**：地图弹窗显示「中文名（英文名）」（瓦片属性 `zh` 烘焙；无中文名回退英文名）。
- 运行时副本 `public/data/geography/regions.json` 供前端直接查询。

## 变更记录

- **2026-08-17**：v1.0 初版——吸收 WHG attestation 思想与 Historical GIS 架构建议；
  P0 四项落地（时间模型标准 / Entity Identity 白名单 / provenance source 头升级 /
  historical_validator.js）；P1 gazetteer 与 WHG 接入列入路线图。
- **2026-08-17（v1.1）**：新增 §12 地区数据库（regions.json）——960 个 region/nation
  地点时空库（出现/灭亡时间 + 英文名 + 中文名槽位 + 时期映射），映射规则与瓦片锚点年
  一致；`build-regions.mjs` 入 data:build；`regions_test.js` 入 data:validate-map。
