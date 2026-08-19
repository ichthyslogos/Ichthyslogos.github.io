# FISH 搜索系统（第一阶段：纯数据检索）

> Project: FISH / Bible Research Platform
> Module: Global Search
> Version: v1.0（第一阶段）
> Date: 2026-08-18
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
| 地点 | STEP TIPNR + place-coords | CC BY 4.0 | 同上 |
| 政权/区域 | Pleiades + STEP + DARE | 见 `docs/GEOGRAPHY.md` | `public/data/geography/regions.json` |
| 事件 | UBS MARBLE | CC BY-SA 4.0 | `public/data/geography/journeys.json` |
| 时期 | FISH 时期索引 | 内部 | `public/data/geography/periods.json` |
| 注释段落 | MH / Calvin / RWP / Abbott / Catena + MH 简明（总结/经文解释） | 见 `docs/COMMENTARY.md` | `public/data/brp/commentary/{fullCommentary,summary,interpretation}/` |
| 主题专题 | 护教学专题（双语标题 + 标签 + 子问题） | 见 `docs/DATA.md` | `public/data/apologetics/topics/` |
| 教会史 | 教会史五部（章标题 + 时期） | 见 `docs/DATA.md` | `public/data/church-history/part1-5.json` |

**暂不接入**（按架构决策）：Strong 词典、原文字典、古代道路。第一阶段搜索类型 8 类：经文（地址 + 全文多译本）/ 人物 / 地点 / 政权 / 时期 / 事件 / 注释（源 + 段落）/ 主题（护教专题 + 教会史章节）。

---

# 4. 索引结构

## 4.1 产物文件（`public/data/search/`）

| 文件 | 内容 | 大小 | 加载时机 |
| --- | --- | --- | --- |
| `index.json` | 书卷表 + 译本表 + 全部实体轻量索引 | ~810KB | 打开搜索面板即加载 |
| `scripture-{key}.json` ×7 | 各译本全本节文本 `[bookIdx, 章, 节, 文本]` | 3.5–4.9MB/译本 | 首次检索时按所选译本懒加载 |
| `commentary-{file}.json` ×7 | 注释段落 `[bookIdx, 章, ref, heading, 摘录]` | 0.16–2.0MB/源 | 首次注释检索时懒加载全部 7 文件 |

## 4.2 `index.json` 字段

```text
index
├── meta           版本、构建时间、数据源声明、各类计数（含 translations / commentarySections）
├── books[]        id / zh / en / g(组) / cc(章数) / ab(中文简称) / ea(英文缩写)
├── translations[] key / name / lang(zh|latin) / verses —— 经文全文可选译本清单
├── persons[]      id / zh / en / s(trong) / b(rief) / al(iases) / first(首现 书:章) / n(次数) / gender
├── places[]       同上 + lat / lng / cat（坐标缺失可为 null）
├── polities[]     id / en / zh / t(nation|region) / from / to / ps(时期) / lat / lng
├── events[]       id / en / story / type / d(描述) / p(时期) / stops
├── periods[]      id / name / era / year / d(描述) / journeys
├── commentaries[] k / name / lang / cats / n(段数) / files[{file, name, cats, n}]
├── topics[]       id / zh / en / tags / d(描述) / al(子问题标题) / q(子问题数)
└── history[]      id / part(1-5) / no(intro|章号) / t(标题) / period
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
npm run search:build        # = node scripts/search/build-search-index.mjs
```

依赖既有数据管线（`npm run data`）先产出运行时数据，再构建搜索索引。

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
2. 👤 人物 → 📍 地点 → 🏛 政权/区域 → ⏳ 时期 → 📜 事件/旅程 → 🧭 主题专题 → ⛪ 教会历史 → 📚 注释源
3. 🔎 经文全文（译本切换条；默认 5 条，可展开至 40 条 + 总计数）
4. 📚 注释段落（heading + 摘录 + 来源名；默认 6 条，展开 20 条；点击跳读经页）
```

高亮（`mark()`）仅当**原文**小写包含查询串时标记；繁简不匹配时不高亮但正常返回——高亮绝不改变文本内容。

---

# 6. 前端组件

| 文件 | 职责 |
| --- | --- |
| `src/lib/searchStore.js` | `searchOpen` 全局状态 + `openSearch()` / `closeSearch()` |
| `src/components/search/SearchPanel.vue` | 全局搜索浮层（Teleport to body） |
| `src/components/AppHeader.vue` | 导航栏 🔍 按钮 → `openSearch()` |
| `src/App.vue` | 挂载 `<SearchPanel />`（全局单例） |

交互要点：

- **移动端全屏 / 桌面居中卡片**；Esc / 遮罩点击 / 取消按钮关闭。
- 输入框 `font-size: 16px`（防 iOS 聚焦缩放）；列表项 `min-height: 48px`（触控目标）；适配 iOS 安全区。
- 防抖 160ms；索引模块级缓存（多面板实例共享、失败不缓存可重试）。

## 6.1 结果跳转（与地图 / 读经 / 专题页直连）

| 结果类型 | 跳转 | 深链参数 |
| --- | --- | --- |
| 地点（有坐标） | `/map?focus=<英文名>&fl=<显示名>` | 地图 `flyTo` 聚焦 + 覆盖层标记 |
| 政权/事件/时期 | `/map?period=<时期id>` | 切换对应历史时期图层 |
| 人物 | `/brp/<书卷>/<章>` | 首次出现处 |
| 经文（地址/全文） | `/brp/<书卷>/<章>?v=<节>` | 定位到节 |
| 注释段落 | `/brp/<书卷>/<章>` | 该章解经抽屉内看完整注释 |
| 主题专题 | `/apologetics` | 护教学页 |
| 教会史章节 | `/history/<部>/<章号或intro>` | 直达该章 |

---

# 7. 质量保障

| 脚本 | 用途 | 命令 |
| --- | --- | --- |
| `scripts/search/search-self-test.mjs` | 检索回归自测（56 用例：归一化 / 地址 / 实体 / 全文多译本 / 注释段落 / 主题 / 教会史 / 显示不被污染） | `node scripts/search/search-self-test.mjs` |
| `scripts/search/verify-search-data.mjs` | 数据准确性核验（63 项：全量经文比对×7 译本 / 实体计数 / 坐标来源 / 注释摘录逐字节前缀 / 主题与教会史计数 / 繁体保留） | `node scripts/search/verify-search-data.mjs` |
| `scripts/search/gen-t2s-table.mjs` | 从 OpenCC 字典再生成繁简表 | `node scripts/search/gen-t2s-table.mjs` |

修改引擎或重建索引后必须依次跑自测与核验，两者全绿才可提交。

---

# 8. 数据准确性红线

1. **经文全量比对**：`verify-search-data.mjs` 从源译本按卷文件重建期望数组，与索引逐节深比较（零采样，7 译本全查）。
2. **实体不虚增**：persons/places 键集必须是 TIPNR 源的子集；polities/events/periods 计数与源 JSON 一致。
3. **坐标可溯源**：places 中每个 lat/lng 必须能在 `place-coords.json` 中找到同值来源。
4. **注释摘录可溯源**：每个段落索引的定位键必须存在于源文件，heading 逐字节相等、摘录为源文本前缀（§4.2.1 取舍）。
5. **主题/教会史不虚增**：条目数与源文件数 / 章数一致，标题与源一致。
6. **展示零转换**：`神愛世人` 等繁体原文在索引与界面中保持原样（自测显式断言）。
7. **源数据只读**：构建管线不改写 `public/data/**` 既有文件，只新增 `public/data/search/`。

已知取舍（记录在案）：

- TIPNR 中同名人物以 Strong 后缀区分（如 `H2148w` 撒迦利亚），构建按「基础码+后缀」独立成条；中文名经基础码回退解析（`zh-names.json` 无后缀变体）。
- brief 描述在索引中截断至 110 字（完整四级描述仍在按卷数据中，点击跳转可读全文）。
- 注释正文仅索引前 180 字符（§4.2.1）；heading 全量原样。
- 教会史检索覆盖部/章标题与时期名，正文全文未入索引。

---

# 9. 后续阶段路线（不在本期范围）

- **第二阶段**：索引迁 PostgreSQL + FTS（zhparser / pg_trgm），`search_vector` 列替代前端匹配域（同时解决注释正文中段检索盲区）；pgvector 语义检索，混合排序。
- **第三阶段**：AI Research Assistant——检索结果（经文/人物/地点/事件/注释/地图）作为上下文的研究问答。
- **数据扩展候选**（按优先级）：Theographic（人物-地点-时期-经文图谱）、OpenBible Geocoding（地点候选位置与置信度）、CrossWire SWORD（注释/串珠 TSK）、Torrey（主题）。

迁移到服务端时，`index.json` 的实体结构与 `searchEngine.js` 的四路分析器可直接映射为数据库表与查询层。
