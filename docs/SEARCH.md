# FISH 搜索系统（第一阶段：纯数据检索）

> Project: FISH / Bible Research Platform
> Module: Global Search
> Version: v1.2（第一阶段：词条子页面 + 地图侧栏检索）
> Date: 2026-08-19
> Status: Implemented

---

# 1. 文档目的

本文件规定 FISH 全局搜索系统的架构、数据来源、索引结构、检索逻辑、前端交互与质量保障流程。

第一阶段的核心原则：**核心检索全部用数据完成，AI 不参与检索**。AI 搜索（语义检索 / 研究问答）留给第二、三阶段。

---

# 2. 架构总览

```text
                 FISH SEARCH ENGINE
                         │
                         ▼
                  Query Analyzer（前端，searchEngine.js）
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
 Reference Parser    Entity Resolver   Full Text
 经文地址解析          实体检索           经文全文
        │                │                │
        │         ┌──────┼──────┐         │
        │         ▼      ▼      ▼         │
        │      人物   地点   政权         │
        │            时期   事件          │
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                  Result Fusion（内存索引）
                         │
                         ▼
                     Rank
                         │
                     ▼
              SearchPanel（分组展示）
```

当前实现为**前端内存索引**（数据量约 8MB，按需懒加载），后续迁移 PostgreSQL FTS 时检索逻辑与数据结构可平移。

---

# 3. 数据来源与许可

| 类型 | 来源 | 许可 | 运行时位置 |
| --- | --- | --- | --- |
| 经文（7 译本） | 和合本/思高本/NIV/KJV/ASV/DRC/法语 Martin | 见 `docs/DATA.md` | `public/data/brp/translations/<key>/` |
| 人物 | STEP TIPNR | CC BY 4.0 | `public/data/brp/commentary/notes/tipnr/` |
| 人物增强（生卒年/亲属/词典摘录） | Theographic Bible Metadata | CC BY-SA 4.0 | `public/data/theographic/persons.json` |
| 地点 | STEP TIPNR + place-coords | CC BY 4.0 | 同上 |
| 政权/区域 | Pleiades + STEP + DARE | 见 `docs/GEOGRAPHY.md` | `public/data/geography/regions.json` |
| 事件 | UBS MARBLE | CC BY-SA 4.0 | `public/data/geography/journeys.json` |
| 编年时间线（450 事件） | Theographic Bible Metadata | CC BY-SA 4.0 | `public/data/theographic/events.json` |
| 时期 | FISH 时期索引 | 内部 | `public/data/geography/periods.json` |
| 注释段落 | MH / Calvin / RWP / Abbott / Catena + MH 简明（总结/经文解释） | 见 `docs/COMMENTARY.md` | `public/data/brp/commentary/{fullCommentary,summary,interpretation}/` |
| 主题专题 | 护教学专题（双语标题 + 标签 + 子问题） | 见 `docs/DATA.md` | `public/data/apologetics/topics/` |
| 教会史 | 教会史五部（章标题 + 时期） | 见 `docs/DATA.md` | `public/data/church-history/part1-5.json` |

**Theographic 说明**：生卒年与事件年份为 **Ussher 式传统编年**（非考古学定年），界面统一以「约前 N 年 / 约公元 N 年」标注；人物词典摘录来自 Easton's Bible Dictionary（公有领域），导入时清洗源数据的 `'=` 乱码前缀。导入脚本 `scripts/search/import-theographic.mjs` 通过四阶段匹配（唯一名直配 → 多词专名组 → 节级首现消歧 → 经文重合度兜底）将 Theographic 人物对齐到 TIPNR 强码（匹配率 81.7%，2489/3045），冲突一律放弃（宁缺毋滥）。事件参与者（`ppl`）全部转为强码（425/450 个事件带强码参与者），**同名人物（如 7 位马利亚 G3137\*）的事件经强码精确归属，互不混淆**；少量无对应强码的参与者以 `pplName` 英文名兜底。

**暂不接入**（按架构决策）：Strong 词典、原文字典、古代道路。第一阶段搜索类型 9 类：经文（地址 + 全文多译本）/ 人物（含生卒年、亲属、词典增强）/ 地点 / 政权 / 时期 / 事件 / 编年时间线 / 注释（源 + 段落）/ 主题（护教专题 + 教会史章节）。

---

# 4. 索引结构

## 4.1 产物文件（`public/data/search/`）

| 文件 | 内容 | 大小 | 加载时机 |
| --- | --- | --- | --- |
| `index.json` | 书卷表 + 译本表 + 全部实体轻量索引（含 timeline） | ~880KB | 打开搜索面板即加载 |
| `scripture-{key}.json` ×7 | 各译本全本节文本 `[bookIdx, 章, 节, 文本]` | 3.5–4.9MB/译本 | 首次检索时按所选译本懒加载 |
| `commentary-{file}.json` ×7 | 注释段落 `[bookIdx, 章, ref, heading, 摘录]` | 0.16–2.0MB/源 | 首次注释检索时懒加载全部 7 文件 |

人物详情数据（Theographic 词典摘录 + 亲属名单）单独存放于 `public/data/theographic/persons.json`（~470KB），点击人物条目 ⓘ 按钮时才懒加载。

## 4.2 `index.json` 字段

```text
index
├── meta           版本、构建时间、数据源声明、各类计数（含 translations / commentarySections / timeline）
├── books[]        id / zh / en / g(组) / cc(章数) / ab(中文简称) / ea(英文缩写)
├── translations[] key / name / lang(zh|latin) / verses —— 经文全文可选译本清单
├── persons[]      id / zh / en / s(trong) / b(rief) / al(iases) / first(首现 书:章:节) / n(次数) / gender
│                  + by(生年，Theographic，可缺省) / dy(卒年) / rel(亲属计数) / ps(时期列表)
├── places[]       同上 + lat / lng / cat（坐标缺失可为 null）/ ps(时期归属列表)
├── polities[]     id / en / zh / t(nation|region) / from / to / ps(时期) / lat / lng
├── events[]       id / en / story / type / d(描述) / p(时期) / stops
├── timeline[]     id / t(英文标题) / z(中文标题) / y(年份) / dur(时长) / first(首节 书:章:节) / nv(节数)
│                  / ppl(参与者强码数组，同名人物精确归属) / pplName(未匹配强码的兜底英文名)
├── periods[]      id / name / era / year / d(描述) / journeys
├── commentaries[] k / name / lang / cats / n(段数) / files[{file, name, cats, n}]
├── topics[]       id / zh / en / tags / d(描述) / al(子问题标题) / q(子问题数)
└── history[]      id / part(1-5) / no(intro|章号) / t(标题) / period
```

`theographic/persons.json` 结构（懒加载的详情数据）：

```text
{ source, chronology: "traditional (Ussher-style)", persons: { 强码: {
    by / dy          生卒年（负数 = 公元前；仅核心人物有）
    rel              { fa(父) / mo(母) / sp[](配偶) / ch[](子女) / sb[](兄弟姊妹) }，值为强码或英文显示名
    vc               该人物经文提及次数
    dict             Easton 词典摘录（≤600 字符）
} } }
```

## 4.2.1 注释段落索引的取舍（准确性优先）

五个完整解经源合计 73MB，全量入前端不可行。索引每段保留：

- `heading`：源文件标题**逐字节原样**（检索强信号）
- `text`：源文本**前 180 字符摘录**（原样前缀，加 `…` 结尾标记截断）

因此**正文中段的关键词检索不到**（如某段第 500 字的词）；命中后点击跳读经页查看完整注释。这是第一阶段的明确取舍，全文覆盖留给第二阶段后端 FTS（§9）。

设计原则：

- **统一 search_documents 思想的轻量版**：每类实体一个数组，字段短名压缩体积；新增实体类型 = 加一个数组 + 一组检索分支。
- **源数据只读**：构建脚本从 `public/data/**` 只读抽取，绝不改写任何既有数据文件。
- **文本原样复制**：索引中的经文 / 人名 / 描述 / 注释标题均为源文本逐字节复制（见 §8 数据准确性）。

## 4.3 构建与再生成

```bash
node scripts/search/import-theographic.mjs   # 素材 → data-src/theographic/（人物增强 + 事件中文标题）
npm run data                                 # = node scripts/build-data.mjs（data-src/theographic → public/data）
npm run search:build                         # = node scripts/search/build-search-index.mjs
```

依赖既有数据管线（`npm run data`）先产出运行时数据，再构建搜索索引。事件中文标题映射维护于 `scripts/search/event-titles-zh.json`（键 = Theographic 原文标题，含源数据拼写变体；译名采用和合本标准用语），导入时零翻译遗漏即通过。

---

# 5. 检索引擎（`src/lib/searchEngine.js`）

## 5.1 归一化（匹配域专用）

```text
lowercase → 繁体转简体（OpenCC 单字表）→ 折叠变音符 → 折叠花式引号 → 压缩空白
```

关键决策：

- **繁→简仅作用于匹配域**。结果展示永远使用源文本原文——简体查询可命中繁体经文，但显示的仍是繁体原文，绝不发生显示层转换。
- 对照表由 OpenCC `TSCharacters.txt` 机器生成（`src/lib/t2s-table.mjs`，3,222 对单字），生成器 `scripts/search/gen-t2s-table.mjs`。禁止手写对照表（历史上手写表出现过错位映射）。
- 英文引号折叠（`'` `’` `‘` `` ` `` → `'`）保证 "God's" 类查询稳定命中。

## 5.2 四路检索

| 函数 | 职责 | 说明 |
| --- | --- | --- |
| `buildBookLookup(books)` | 别名 → 书卷索引 | 中文书名 / 英文书名 / 中文简称 / 英文缩写，全部经 norm 归一化后入表；按别名长度降序匹配（「约翰福音」优先于「约」） |
| `parseReference(q, lookup)` | 地址解析 | 支持 `约3:16` / `約3:16`（繁） / `约翰福音 3 章 16 节` / `John 3:16` / `gen 3:16` / `诗23` / `43:3:16`（书卷号）；普通文本返回 null 不误报 |
| `searchEntities(q, index, limit)` | 实体检索 | 在预归一化的 title/sub/alias 域上打分：完全命中 ≥900，前缀次之，包含再次；按类别分组返回（含主题 tags / 子问题标题、教会史章标题） |
| `prepareScripture(data)` | 全文索引预处理 | 为每节生成归一化匹配域（一次性，懒加载后执行） |
| `searchScripture(q, data, {limit})` | 经文全文 | 在匹配域上做子串检索；返回原文（非归一化文本）；多译本由面板切换后重跑 |
| `countScripture(q, data)` | 命中计数 | 「显示全部 N 处」用 |
| `prepareCommentary(data)` | 注释索引预处理 | 为每段生成 heading+摘录的归一化匹配域（一次性） |
| `searchCommentary(q, data, {limit})` | 注释段落检索 | 子串匹配；多源结果按书卷顺序合并 |

触发阈值：中文 ≥1 字即检索；拉丁 ≥2 字符（避免单字母全量扫）；输入法组合期间（compositionstart/end）不触发。

## 5.3 结果融合与排序（SearchPanel）

```text
1. 📖 地址跳转卡（parseReference 命中时置顶）
2. 👤 人物 → 📍 地点 → 🏛 政权/区域 → ⏳ 时期 → 📜 事件/旅程 → ⏱ 编年时间线 → 🧭 主题专题 → ⛪ 教会历史 → 📚 注释源
3. 🔎 经文全文（译本切换条；默认 5 条，可展开至 40 条 + 总计数）
4. 📚 注释段落（heading + 摘录 + 来源名；默认 6 条，展开 20 条；点击跳读经页）
```

- 人物条目 sub 行显示生卒年（`约 前1997–前1821`）与亲属计数；点击条目右侧 **ⓘ** 展开详情：亲属名单（父/母/配偶/子女/兄弟姊妹，中文名优先回退强码）+ Easton 词典摘录（懒加载 `theographic/persons.json`）。
- 编年时间线条目显示中文标题（无译名回退英文）+ 年份标签（`约前 4003 年 · 34 节`）；中英文查询均可命中（中文标题域 + 英文标题域双打分）。
- 高亮（`mark()`）仅当**原文**小写包含查询串时标记；繁简不匹配时不高亮但正常返回——高亮绝不改变文本内容。

---

# 6. 前端组件

| 文件 | 职责 |
| --- | --- |
| `src/lib/searchStore.js` | `searchOpen` 全局状态 + `openSearch()` / `closeSearch()` |
| `src/components/search/SearchPanel.vue` | 全局搜索浮层（Teleport to body） |
| `src/components/AppHeader.vue` | 导航栏 🔍 按钮 → `openSearch()`；圣经菜单（经文/地图/人物/事件） |
| `src/App.vue` | 挂载 `<SearchPanel />`（全局单例） |
| `src/lib/bibleEntries.js` | 词条共享数据层：索引/词典懒加载、强码→人物解析（双形态）、书卷引用格式化、事件→时期推导 |
| `src/views/persons/PersonsPage.vue` | 人物词条子页面（`/persons` 列表 · `/persons/:id` 详情） |
| `src/views/events/EventsPage.vue` | 事件词条子页面（`/events` 列表 · `/events/:id` 详情） |

交互要点：

- **移动端全屏 / 桌面居中卡片**；Esc / 遮罩点击 / 取消按钮关闭。
- 输入框 `font-size: 16px`（防 iOS 聚焦缩放）；列表项 `min-height: 48px`（触控目标）；适配 iOS 安全区。
- 防抖 160ms；索引模块级缓存（多面板实例共享、失败不缓存可重试）。

## 6.1 结果跳转（与地图 / 读经 / 专题页直连）

| 结果类型 | 跳转 | 深链参数 |
| --- | --- | --- |
| 地点（有坐标） | `/map?focus=<英文名>&fl=<显示名>` | 地图 `flyTo` 聚焦 + 覆盖层标记 |
| 政权/事件/时期 | `/map?period=<时期id>` | 切换对应历史时期图层 |
| 人物 | 先在面板内**展开详情**（生卒年/亲属/词典），详情内提供「人物词条页」按钮跳 `/persons/<强码>` 与「首处经文」跳读经页 | — |
| 编年时间线事件 | `/brp/<书卷>/<章>?v=<节>` | 事件首节经文 |
| 经文（地址/全文） | `/brp/<书卷>/<章>?v=<节>` | 定位到节并高亮 |
| 注释段落 | `/brp/<书卷>/<章>` | 该章解经抽屉内看完整注释 |
| 主题专题 | `/apologetics` | 护教学页 |
| 教会史章节 | `/history/<部>/<章号或intro>` | 直达该章 |

经文跳转统一携带 `?v=<节>`（人物首现、时间线事件、经文全文三路一致）：读经页 `BrpPage.vue` 按 `v` 定位滚动并高亮该节。地址解析与全文命中的书卷名显示**按译本语言统一**（拉丁字母译本显示英文书名 + 英文章节格式）。

## 6.2 圣经词条子页面（人物 / 事件）

导航「圣经」菜单下的两个人物/事件词条页，复用搜索索引与 Theographic 详情数据，设计语言与护教/教会史页一致（现代出版风浅色 + 金棕学术点缀）：

**人物词条页（`/persons`）**

- 探索视图：Hero → 搜索（中英名/别名/强码）+ 时期/性别筛选 → 人物卡片网格（出现次数排序，60 条分页加载）。
- 详情视图（`/persons/<强码>`，如 `/persons/G3972G`）：人物头（中英名/强码/性别/别名）→ 生平速览（生卒年/出现次数/首处经文深链 `?v=` 高亮/时期标签）→ 亲属关系（父/母/配偶/兄弟姊妹/子女，点击互跳）→ **同名人物**（同强码基底互列，事件互不混淆）→ Easton 词典（懒加载 `theographic/persons.json`，剥除 markdown 链接）→ 相关事件（按 `ppl` 强码精确归属，时间升序，链到事件词条页）。

**事件词条页（`/events`）**

- 探索视图：Hero → 搜索（标题中英/参与者名）+ 时期筛选 → 时期分组折叠列表（太古 + 10 时期 + 未定年；组内年份升序）。
- 详情视图（`/events/<序号>`，如 `/events/2`）：事件头（中英标题/年份/时长）→ 速览（年份/时长/时期/首处经文深链/节数）→ 参与者（强码解析为人物词条链接）→ 邻近事件（全时间线前后各 3）。

**数据契约**（`bibleEntries.js`）：人物强码两种形态（id 无零填充 `H175` / s 零填充 `H0175`）双表解析；事件/亲属字段的编码形态混用，解析时两者都试。事件时期按时期年份锚点推导（早于首时期 → 太古；无年份 → 未定年）。

## 6.3 地图侧栏检索（MapPage）

地图页信息栏复用搜索索引实现三块检索能力（`loadEntryIndex()` 懒加载，与搜索面板共享模块缓存）：

- **统一搜索框**：地点（中英名/别名，点击 `flyTo` 聚焦 + 覆盖层标记）+ 路线（全量旅程，不限当前时期，点击选中旅程并绘制）联合检索。路线名/故事名为英文（UBS MARBLE），中文查询经 `geo.js` 的 `JOURNEY_ZH_BRIDGE` 关键词桥（人名/地名/常用词英→中映射，词边界替换）命中，如「保罗」→ "Paul's Voyage to Rome"。
- **时期地点词条**：按当前时间轴时期（`places[].ps` 时期归属，随时间轴切换联动）展开该时期全部地点，支持分类定向筛选（城市/河流/山/沙漠等 13 类，单选复位），按出现次数排序，点击聚焦地图。
- **路线显示**：旅程选中后按 confidence 分层绘制（实线 ≥0.75 / 虚线 0.5–0.75 / 点线 <0.5）。

---

# 7. 质量保障

| 脚本 | 用途 | 命令 |
| --- | --- | --- |
| `scripts/search/search-self-test.mjs` | 检索回归自测（82 用例：归一化 / 地址 / 实体 / 全文多译本 / 注释段落 / 主题 / 教会史 / 人物生卒年与亲属 / 时间线中英文检索 / 年份格式化 / 显示不被污染） | `node scripts/search/search-self-test.mjs` |
| `scripts/search/verify-search-data.mjs` | 数据准确性核验（72 项：全量经文比对×7 译本 / 实体计数 / 坐标来源 / 注释摘录逐字节前缀 / 主题与教会史计数 / 繁体保留 / Theographic 生卒年与亲属计数逐条比对 / 时间线标题年份跳转键比对） | `node scripts/search/verify-search-data.mjs` |
| `scripts/search/gen-t2s-table.mjs` | 从 OpenCC 字典再生成繁简表 | `node scripts/search/gen-t2s-table.mjs` |

修改引擎或重建索引后必须依次跑自测与核验，两者全绿才可提交。

---

# 8. 数据准确性红线

1. **经文全量比对**：`verify-search-data.mjs` 从源译本按卷文件重建期望数组，与索引逐节深比较（零采样，7 译本全查）。
2. **实体不虚增**：persons/places 键集必须是 TIPNR 源的子集；polities/events/periods 计数与源 JSON 一致。
3. **坐标可溯源**：places 中每个 lat/lng 必须能在 `place-coords.json` 中找到同值来源。
4. **注释摘录可溯源**：每个段落索引的定位键必须存在于源文件，heading 逐字节相等、摘录为源文本前缀（§4.2.1 取舍）。
5. **主题/教会史不虚增**：条目数与源文件数 / 章数一致，标题与源一致。
6. **Theographic 逐条比对**：索引人物生卒年、亲属计数与 `theographic/persons.json` 源逐条一致；timeline 标题/年份/跳转键与 `theographic/events.json` 源逐条一致，年份限定传统编年范围（前 4004 ~ 公元 100），跳转书卷号合法。
7. **展示零转换**：`神愛世人` 等繁体原文在索引与界面中保持原样（自测显式断言）。
8. **源数据只读**：构建管线不改写 `public/data/**` 既有文件，只新增 `public/data/search/` 与 `public/data/theographic/`。

已知取舍（记录在案）：

- TIPNR 中同名人物以 Strong 后缀区分（如 `H2148w` 撒迦利亚），构建按「基础码+后缀」独立成条；中文名经基础码回退解析（`zh-names.json` 无后缀变体）。
- brief 描述在索引中截断至 110 字（完整四级描述仍在按卷数据中，点击跳转可读全文）。
- 注释正文仅索引前 180 字符（§4.2.1）；heading 全量原样。
- 教会史检索覆盖部/章标题与时期名，正文全文未入索引。
- Theographic 匹配冲突一律放弃（556 人无增强数据，宁缺毋滥）；生卒年仅采用 `birthYear/deathYear` 字段，不采用语义为「经文提及范围」的 minYear/maxYear；亲属名单未匹配 TIPNR 的少数关系人显示英文名；词典摘录截断至 600 字符（源 `'=` 乱码前缀已清洗）。
- 同名人物以强码后缀独立成条并全链路（索引/事件参与者/亲属/词条页）按强码精确归属；人物词条页「同名人物」区块按强码基底（去尾部大写字母）+ 同显示名互列。
- 人物首现 `first` 绝大多数带节号（2817/3045）支持 `?v=` 节级高亮；63 人仅到章级（源数据无节），跳转定位到章不高亮。
- 编年为 Ussher 式传统纪年（如创造于前 4004 年），界面统一加「约」字标注，与考古学定年并行不悖。

---

# 9. 后续阶段路线（不在本期范围）

- **第二阶段**：索引迁 PostgreSQL + FTS（zhparser / pg_trgm），`search_vector` 列替代前端匹配域（同时解决注释正文中段检索盲区）；pgvector 语义检索，混合排序。
- **第三阶段**：AI Research Assistant——检索结果（经文/人物/地点/事件/注释/地图）作为上下文的研究问答。
- **数据扩展候选**（按优先级）：MetaV（词级「谁/哪里/什么时候」关联，读经点击人物弹资料）、OpenBible Geocoding（地点候选位置与置信度）、Gnosis Bible Knowledge Graph（人物-地点-事件-Strong 统一图谱，3,000+ 人物）、BibleData（结构化 Person/Event/Place/Epoch 表）、CrossWire SWORD（注释/串珠 TSK）、Torrey（主题）。Theographic（人物/时间线）已于 v1.1 接入。

迁移到服务端时，`index.json` 的实体结构与 `searchEngine.js` 的四路分析器可直接映射为数据库表与查询层。
