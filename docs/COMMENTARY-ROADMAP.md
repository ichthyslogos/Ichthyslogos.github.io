# 注释数据库扩展路线图（COMMENTARY-ROADMAP）

按传统/宗派分类的**多注释源扩展规划**。注释源按两级目录组织：`data-src/brp/commentary/<传统>/<源>/`（9 个传统，见下），放入即自动上架（docs/COMMENTARY.md）。

> **现实约束**：注释作品的**版权状态**决定可否合法接入。✅ = 公有领域（Public Domain，可直接接入）；⚠️ = 版权保护（需授权或放弃）。标注"e-Sword/SWORD"表示已有现成模块，可复用 strongsgreek 的模块解析经验。

## 传统分类（tradition key）

| 传统 | key | 说明 |
|---|---|---|
| 教父著作 | `church-fathers` | 早期教会注释/布道 |
| 天主教传统 | `catholic` | 天主教注释 |
| 路德宗 | `lutheran` | 路德及路德宗注释 |
| 改革宗 | `reformed` | 加尔文/马太亨利等 |
| 浸信会 | `baptist` | 浸信会注释 |
| 卫理公会 | `methodist` | 卫斯理/克拉克等 |
| 圣公会 | `anglican` | 圣公会注释 |
| 五旬节派 | `pentecostal` | 五旬节/灵恩注释 |
| 福音派 | `evangelical` | 现代福音派学术注释 |

## 一、Church Fathers 教父著作

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Nicene & Post-Nicene Fathers（NPNF） | 多位教父 | 逐节布道（Chrysostom 新约布道集等） | ✅ PD | CCEL / New Advent / e-Sword |
| Ante-Nicene Fathers（ANF） | 多位教父 | 神学著作（非逐节注释） | ✅ PD | CCEL / New Advent |
| Catena Aurea（金链） | 阿奎那 | 四福音合参（逐节汇集教父注解） | ✅ PD | CCEL / e-Sword ✅ **已接入**（CrossWire 模块 → `church-fathers/catena`，四福音 821 节段，2026-08） |

- **优先级 P2**：Chrysostom 布道集最接近"逐节注释"格式；ANF 多为神学论著，与现有 sections 结构差异大；Catena 已先行接入（同一素材源的教父注解）

## 二、Catholic Tradition 天主教传统

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Haydock's Catholic Commentary | Haydock 等 | 全 66 卷逐节 | ✅ PD | e-Sword / SWORD |
| 思高圣经注释（中文） | 思高圣经学会 | 中文逐节 | ⚠️ 版权 | — |

- **优先级 P2**（Haydock 有模块；思高注释需授权）

## 三、Lutheran 路德宗

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Luther's Works 英文版（55 卷） | 路德 | 逐书注释/布道 | ⚠️ 版权（1955-1986 出版） | — |
| 圣路易斯德语版（St. Louis Edition） | 路德 | 德语逐书（含创世记大注释） | ✅ PD | archive.org 扫描 |
| Concordia Commentary | CPH | 现代注释 | ⚠️ 版权 | — |

- **优先级 P3**：德语 PD 版需 OCR 与翻译，成本高；英文版版权

## 四、Reformed 改革宗

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Calvin's Commentaries（加尔文注释） | 加尔文 | 全 66 卷逐节 | ✅ PD | CCEL / e-Sword / SWORD ★ |
| Matthew Henry（马太亨利） | 马太亨利 | 全 66 卷（已接入中文精校版） | ✅ PD | 已上线 ✅ 另有**英文原版**（`reformed/matthew-henry-en`，66 卷，2026-08 接入，与中文版对照） |
| Banner of Truth 资源 | 多位 | 现代重印 | ⚠️ 版权 | — |

- **优先级 P1 ★**：Calvin 是改革宗第二源，模块化获取成熟

## 五、Baptist 浸信会

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Expositor's Bible Commentary | 多位 | 现代注释 | ⚠️ 版权 | — |
| Baker Commentary | Baker | 现代注释 | ⚠️ 版权 | — |
| Robertson's Word Pictures | A.T. Robertson | 新约 27 卷逐节（浸信会经典字义注释） | ✅ PD（第 5/6 卷版权 2006/2007 已到期） | CrossWire ✅ **已接入**（`baptist/rwp`，7201 节段，2026-08） |
| Gill's Exposition of the Bible | John Gill | 全 66 卷逐节（浸信会经典） | ✅ PD | e-Sword / CCEL ★ |
| Treasury of David | Spurgeon | 诗篇逐节 | ✅ PD | CCEL / e-Sword |

- **优先级 P1 ★**（Gill；RWP 已先行接入）/ **P2**（Spurgeon 仅诗篇 1 卷）

## 六、Methodist 卫理公会

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Wesley's Explanatory Notes | 卫斯理 | 全 66 卷逐节 | ✅ PD | CCEL / e-Sword ★ |
| Adam Clarke's Commentary | Adam Clarke | 全 66 卷逐节 | ✅ PD | e-Sword / archive.org ★ |

- **优先级 P1 ★**：两者均有 SWORD/e-Sword 模块

## 七、Anglican 圣公会

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Tyndale Commentary | IVP | 现代注释 | ⚠️ 版权 | — |
| Expository Thoughts | J.C. Ryle | 四福音+部分新约逐节 | ✅ PD | CCEL |
| Barnes' Notes | Albert Barnes | 全 66 卷逐节 | ✅ PD | e-Sword / CCEL |

- **优先级 P1**（Barnes 模块化）/ **P2**（Ryle 覆盖不全）

## 八、Pentecostal 五旬节派

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| Full Life Study Bible | Zondervan | 现代研读圣经 | ⚠️ 版权 | — |

- **优先级 P3**：无成熟 PD 候选（可考虑以 Gill/Clarke 作为圣灵工作注释的替代）

## 九、Evangelical 福音派

| 作品 | 作者 | 性质 | 许可 | 数字化来源 |
|---|---|---|---|---|
| IVP Background Commentary | IVP | 现代 | ⚠️ 版权 | — |
| WBC（Word Biblical Commentary） | 多位 | 现代学术 | ⚠️ 版权 | — |
| NICNT / NICOT | Eerdmans | 现代学术 | ⚠️ 版权 | — |
| Abbott's Illustrated NT | J.S.C. & J. Abbott | 新约 27 卷逐节（1878） | ✅ PD | CrossWire ✅ **已接入**（`evangelical/abbott`，3340 节段，2026-08） |
| Jamieson-Fausset-Brown（JFB） | 三位作者 | 全 66 卷逐节 | ✅ PD | e-Sword / CCEL ★ |
| Keil & Delitzsch | 德利茨施等 | 旧约全卷逐节（学术经典） | ✅ PD | e-Sword / CCEL ★ |
| Pulpit Commentary | 多位 | 全 66 卷（讲道+注释双层） | ✅ PD | e-Sword |

- **优先级 P1 ★**（JFB / Keil-Delitzsch / Pulpit；Abbott 已先行接入）

## 十、接入优先级总览

| 优先级 | 源 | 传统 | 说明 |
|---|---|---|---|
| **P0** | Matthew Henry（中文） | reformed | ✅ 已上线，66 卷全开放 |
| **P0** | **Calvin（英文）** | reformed | ✅ **已接入**（2026-08，47 卷，CrossWire 模块 → `reformed/calvin/`，见 docs/COMMENTARY.md §7） |
| **P0** | **RWP / Catena / Abbott（英文）** | baptist / church-fathers / evangelical | ✅ **已接入**（2026-08，CrossWire 模块 → `baptist/rwp` 27 卷、`church-fathers/catena` 四福音、`evangelical/abbott` 27 卷，见 docs/COMMENTARY.md §8） |
| **P1** | Gill / JFB / Keil-Delitzsch / Pulpit | baptist / evangelical | ✅ PD；⚠️ **CrossWire 版 Wesley/Clarke/Barnes 模块为无逐节结构文本流（节号缺失/内嵌不连续），不可直接接入**——需走 CCEL 结构化 HTML 或 e-Sword 模块路径 |
| **P2** | Chrysostom（NPNF）/ Haydock / Spurgeon / Ryle / Lange | 教父/各传统 | ✅ PD，但需结构调整或覆盖不全 |
| **P3** | Luther 德语版 | lutheran | ✅ PD 但 OCR+翻译成本高 |
| **放弃** | Banner / EBC / Baker / Tyndale / Full Life / IVP / WBC / NICNT / NICOT / Concordia / LW 英文 | 各传统 | ⚠️ 版权保护，需授权 |
| **评估未采用** | Geneva（日内瓦边注）/ Luther 英文选篇 / Lightfoot / TSK | 各传统 | ✅ PD 但结构不适配：边注型/仅 6 卷选篇/纯文本流/引用集（详见 `../素材/crosswire-commentaries/README.md`） |

## 十一、架构建议（随源增多逐步落地）

1. **前端多源切换 UI**：✅ **已实现**（2026-08）——`CommentarySourceMenu.vue` 按 tradition 分组选择源，持久化 `localStorage('brp-commentary-source')`，默认偏好链 `PREFERRED_COMMENTARY_SOURCE`（src/lib/data.js）
2. **数据格式不变**：仍为 `{source, bookId, chapters:[{chapter, summary, sections}]}`；教父类已按此格式接入（catena 逐节）
3. **获取管线**：e-Sword/SWORD 模块 → 解析脚本（`import-calvin.mjs` / `import-crosswire.mjs`）→ data-src → 人工抽查精校 → `npm run data` 自动上架
4. **素材只读、产物入库**的约定适用于所有新源；每个源接入时在 `docs/COMMENTARY.md` 补记录（源 key、传统、许可、管线、已知问题）
