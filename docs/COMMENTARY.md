# 注释系统文档（COMMENTARY）

本文档说明 FISH 平台的**解经注释**系统：数据格式、多注释源扩展方法、马太亨利译注的转换管线与已知问题。扩展规划（按传统分类的候选注释源清单）见 [COMMENTARY-ROADMAP.md](COMMENTARY-ROADMAP.md)。

## 1. 多注释源架构

注释按**栏目（解经抽屉层）→ 来源（人/注释集）**两级组织，数据流与译本管线同构：

```
素材（马太亨利译注 PDF/DOCX / CrossWire SWORD 模块）
  │  python scripts/commentary/extract.py（马太亨利中文）
  │  node scripts/commentary/import-calvin.mjs / import-crosswire.mjs（SWORD 模块）
  ▼
data-src/brp/commentary/<category>/<sourceKey>/<bookId>.json
  │    ← 源数据（category 与解经抽屉栏目一一对应：summary 总结 /
  │       interpretation 经文解释 / notes 背景注释 / fullCommentary 完整解经；
  │       当前源：summary+mhcc、interpretation+mhcc、notes+tipnr、
  │       fullCommentary 下 matthew-henry-en、matthew-henry、calvin、rwp、catena、abbott）
  │  npm run data（build-data.mjs 按栏目扫描切片）
  ▼
public/data/brp/commentary/<category>/<key>/<bookId>.json（运行时同构分层）+ manifest.json
  ▼
前端 CommentaryPanel：总结层 = summary 栏目源（mhcc 的 summary 切片）；
  经文解释层 = interpretation 栏目源（mhcc 的 sections 切片，逐节可折叠）；
  背景注释层 = notes 栏目源（tipnr，来源标注显示）；
  「完整解经」层源选择器按宗派（tradition）分组（教父著作/改革宗/浸信会/福音派…）
```

**栏目（category，4 个固定 key）**：`summary` 总结 / `interpretation` 经文解释 / `notes` 背景注释 / `fullCommentary` 完整解经。`data-src/brp/commentary/` 下**只允许这四个栏目目录**（外加 `_template/` 模板与 `en-raw/` 翻译参考，构建时自动跳过），**宗派归属为 manifest 元数据**（`build-data.mjs` 的 `FULL_SOURCE_TRADITIONS` 映射），不再作为目录层级。同一来源可同时属于多个栏目（如 mhcc 的 summary 与 sections 拆分后分别位于 `summary/mhcc/` 与 `interpretation/mhcc/`）。

### 数据总览（按分类 / 宗派 / 作者 / 语言）

| 栏目 | 宗派 | 作者（key） | 语言 | 覆盖 | 状态 |
|---|---|---|---|---|---|
| 完整解经 | 教父著作 | Catena Aurea 金链（`catena`） | en | 四福音 | ✅ 已接入 |
| 完整解经 | 改革宗 | 马太亨利英文原版（`matthew-henry-en`） | en | 66 卷 | ✅ 已接入 |
| 完整解经 | 改革宗 | 马太亨利（`matthew-henry`） | zh | 66 卷 | ✅ 已接入（精校版，暂关闭） |
| 完整解经 | 改革宗 | 加尔文（`calvin`） | en | 47 卷 | ✅ 已接入 |
| 完整解经 | 浸信会 | 罗伯逊字义（`rwp`） | en | 新约 27 卷 | ✅ 已接入 |
| 完整解经 | 福音派 | 雅博特新约（`abbott`） | en | 新约 27 卷 | ✅ 已接入 |
| 总结 | — | 马太亨利简明注释（`mhcc`） | en | 66 卷 | ✅ 已接入（summary 切片） |
| 经文解释 | — | 马太亨利简明注释（`mhcc`） | en | 66 卷 | ✅ 已接入（sections 切片） |
| 背景注释 | — | STEP 专有名词（`tipnr`） | en | 66 卷 | ✅ 已接入（来源标注） |

> manifest.sources 按栏目（summary → interpretation → notes → fullCommentary）→ 宗派（固定顺序）→ 语言（zh 优先）→ key 排序，前端各层菜单/标注顺序与之一致。

**新增完整版注释源三步**（放入 `data-src/brp/commentary/fullCommentary/<key>/<bookId>.json` 后）：
1. 生成符合格式的 JSON（模板见 `data-src/brp/commentary/_template/`，含填写说明）
2. 在 `build-data.mjs` 的 `FULL_SOURCE_TRADITIONS` 登记宗派归属
3. 运行 `npm run data` —— 前端自动多出该源（按宗派分组展示，无需改前端代码）

## 2. 数据格式

每卷一个 JSON（`bookId` 复用 bible-books 编号 01-66 / ext-N），**全库统一 MHCC 样式**：2 空格缩进美化 + 字段顺序 `source{key,name,lang}` → `bookId` → `chapters[{chapter, summary, sections[{ref, heading, text}]}]`（ref 在 heading 前；heading 可为空，简要版 MHCC 无 heading 字段）。重排脚本：`scripts/commentary/format-commentary-json.mjs`（237 个 fullCommentary/ 文件，2026-08-14）：

```json
{
  "source": { "key": "matthew-henry", "name": "马太亨利圣经注释", "lang": "zh" },
  "bookId": "01",
  "chapters": [
    {
      "chapter": 1,
      "summary": "本章经文论到三件事：I.创造之工的概览（第 1-2 节）。…",
      "sections": [
        { "ref": "1-2", "heading": "创造（主前 4004 年）", "text": "在这两节经文里，我们看到…" }
      ]
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `summary` | 章引言 + 概要（含罗马数字大纲与经文范围标注的段落） |
| `sections[]` | 小节：`heading` 小节标题（重复栏目标题已去重，可为空）、`ref` 经文节号范围（如 `1-2`）、`text` 注释正文（保留 I./1./（1）/[1.] 层级编号） |
| 经文块原文 | **不保留**（读经功能已提供经文，避免重复存储） |

## 3. 马太亨利译注转换管线

```bash
python scripts/commentary/extract.py              # 全量转换（约 40-60 分钟）
python scripts/commentary/extract.py 1 40 59      # 指定素材编号（断点续传，已转换的自动跳过）
python scripts/commentary/extract.py --force 1    # 强制重转
```

**依赖**：Python + `pypdf`（`pip install pypdf`）。**不可用 pdftotext**——本素材 PDF 的中文为 CID 编码且缺 ToUnicode 映射，pdftotext 提取结果为 0 中文字符；pypdf 自带 cmap 回退可完整提取。

**输出**：
- `data-src/brp/commentary/matthew-henry/<bookId>.json`（每卷注释）
- `data-src/brp/commentary/matthew-henry/_report.json`（转换报告：每卷状态 ok/skipped/mismatch、章节数自检）

**解析规则**（按行状态机）：
1. 清洗：丢弃目录段（首个章节标题之前）、删除页眉行（`马太亨利…第 N 页`）、页脚 URL/页码、脚注行
2. 章节标题 4 种格式探测：`第X章`（中文数字）/ `第X篇`（诗篇）/ `书卷名+第X章` / 阿拉伯数字变体（约翰福音）；命中数对照预期章数自检
3. 章内：引言+概要（含 `I.`+`（第 X 节）` 的段落）→ 小节标题（短行无句号）→ 经文块（行首节号或「」引号续行，**只提取节号范围不存文本**）→ 注释正文
4. 栏目标题去重：原书每小节重复同一栏目标题（如"创造（主前 4004 年）"），连续重复时置空
5. 分册合并：同卷多分册（如 1a+1b、19a-d）按章号合并

**章节数自检表**见脚本内 `EXPECTED_CHAPTERS`（注意诗篇预期 100 篇——素材缺 101-150）。

## 4. 已知问题与素材现状

**当前覆盖：66 卷正典全部章节完整（诗篇 150 篇全），小节 ref 连续无缺口（audit_commentary.py 复扫通过）**。

**缺失章节已从英文原版补充翻译**（2026-08）：中文素材缺失的次经以外章节（加拉太/以弗所/腓立比/歌罗西/帖前/帖后/约一二三/犹大 + 诗篇 101-150，共 86 个翻译单元）从 `Unabridged Matthew Henrys Commentary on the Whole Bible`（英文 EPUB）提取并完整翻译为中文，与中文素材合并。英文原文保留在 `data-src/brp/commentary/en-raw/`（36 万词，供修订参考）。

解析含三层 ref 保障：新经文块自动开新小节、注释中单节引文识别、后处理（倒退小节并入前段 + 相邻缺口补全）。竖排分栏 3 卷（54-55 提摩太、56 提多、57 腓利门）已支持；57 腓利门实为横排无章节标题，走单章书兜底。

工具链：
- `python scripts/commentary/extract.py` — 中文素材转换
- `python scripts/commentary/extract_epub.py` — 英文 EPUB 缺失章节提取（→ en-raw/）
- `python scripts/commentary/audit_commentary.py` — 全站普查（章节完整性 + ref 缺口 + 缺失卷）

| 缺失项 | 说明 |
|---|---|
| **次经/第二正典（ext-1~7）** | 思高本特有的 7 卷次经——马太亨利注释无次经内容，属正常现象（非遗漏） |
| 英文 EPUB | 仅用作缺失章节的翻译来源（en-raw 保留原文），不直接发布 |
| 46/47 编号颠倒 | 素材文件名 46=哥林多后书、47=前书，已显式映射 |
| 小节 ref 精度 | 跨页经文块续行按「」引号/行内节号启发式合并，个别 ref 可能偏窄 |
| 无小节体例卷 | 约翰福音等卷无小节标题结构，整章注释作为 summary 展示（段落换行保留） |

## 5. 前端接入点

- `src/lib/data.js`：`fetchCommentaryManifest()` / `fetchCommentary(sourceKey, bookId)` / `findCommentaryChapter()`（按卷加载 + 缓存）
- `src/lib/text.js`：`flowCommentary()`——渲染前最简排版：除数据中已有的空行分段（换行标记）外，其余换行一律合并；不做额外排版（无上标/脚注样式），summary 与小节正文均经过处理
- `src/components/brp/CommentaryPanel.vue`：按 `book.id + chapter` 渲染 summary + sections；无注释 → 空状态"本卷暂无注释"
- 面板显隐/移动端覆盖层/三面板互斥逻辑与之前一致，不受注释数据影响

## 6. 临时关闭注释（非删除）

### 6.1 按书卷关闭

`src/lib/data.js` 的 `ENABLED_COMMENTARY_BOOKS` 白名单控制哪些书卷**开放注释显示**；不在白名单内的卷，前端视为"该卷注释暂时关闭"（空状态），**数据文件（data-src 源数据与 public 运行时数据）全部保留、不删除**。

- 当前开放：**66 卷正典全部开放**（`ENABLED_COMMENTARY_BOOKS` = 01-66；不含次经 ext-N）
- 恢复显示：把 bookId（01-66 / ext-N）加回 `ENABLED_COMMENTARY_BOOKS` 集合即可，**无需重跑 `npm run data`**，前端刷新即生效

### 6.2 按源关闭（DISABLED_SOURCES）

`scripts/build-data.mjs` 的 `DISABLED_SOURCES` 集合控制**整个注释源**不参与构建与显示（data-src 源数据保留；public 输出目录每次构建前整体重建，被关闭源不残留）。

- 当前关闭：**matthew-henry（马太亨利中文）**（2026-08-13 暂时关闭）；`matthew-henry-en`（英文）不受影响，独立显示
- 恢复显示：从 `DISABLED_SOURCES` 移除该 key 后重跑 `npm run data:build` + `npm run build`
- **语言组合并注意事项**：`data.js` 的 `COMMENTARY_LANG_GROUPS` 把中英文马太亨利合并为一组（菜单只显示主条目 zh，英文经语言标签切换）。主源（langs[0]）被关闭时，`displaySources` / `langGroup` / `langBadge` 自动退化为「不合并组」——英文源独立出现在菜单、语言标签不显示、徽章只显示自身语言（en）。若未来关闭的是组内**非主**语言（如英文），无需改动（主源存在时组行为不变）

## 6.3 解经层结构（无独立 study 数据目录）

**术语约定**：解经 = 对经文本身的解释（FISH 六层结构化解经 + 「完整解经」层 = 马太亨利/加尔文等多来源解经正文）；注释 = 作者/地点/背景等的简要介绍（**解经抽屉「背景注释」层**，TIPNR 专有名词，见 [NOTES.md](NOTES.md)；不单列）。

解经抽屉为**单一视图**（无选项卡）：栏目化结构化解经在上（总结/要点/经文解释/神学意义/应用，**总结层 = summary 栏目源（MHCC 概览段）**、**经文解释层 = interpretation 栏目源（MHCC 分节讲解，逐节折叠）**，其余层「待整理…」占位），**「完整解经」层**在下——即完整版多来源解经正文（马太亨利全文/加尔文/RWP/Abbott/Catena，源选择器**按宗派分组**：教父著作/改革宗/浸信会/福音派；含源选择/概要/小节折叠），与各层同款金棕左线、上方虚线分隔。

**数据**：2026-08-14 目录整理后**无独立 study/notes 目录**——全部数据并入 `data-src/brp/commentary/`，按解经抽屉栏目分文件夹（`summary/` 总结、`interpretation/` 经文解释、`notes/` 背景注释、`fullCommentary/` 完整解经）。总结层与经文解释层由 `CommentaryPanel.vue` 分别加载 `summary/mhcc` 与 `interpretation/mhcc` 两个切片（拆分脚本 `scripts/commentary/split-mhcc.mjs`），背景注释层加载 `notes/tipnr`；其余层无数据管线、静态「待整理…」占位；未来填充时直接在组件内接入数据源即可。

## 6.4 MHCC 注释源（summary + interpretation 栏目，2026-08-14）

MHCC（马太亨利简明注释）按栏目拆分为两个切片，**不进入「完整解经」层源菜单**（完整/简要不混排）：
- **总结层** = `summary/mhcc/`（每章 summary = 概览段）
- **经文解释层** = `interpretation/mhcc/`（每章 sections = 逐节简注，前端逐节折叠展开，与完整解经同款交互）

- 数据：`data-src/brp/commentary/summary/mhcc/<bookId>.json` + `data-src/brp/commentary/interpretation/mhcc/<bookId>.json`（各 66 卷：summary 1189 章 / interpretation 1186 章有分节，原 4070 节段），转换脚本 `素材/crosswire-commentaries/MHCC/convert_mhcc_full.mjs` → `concise/mhcc/` 后由 `scripts/commentary/split-mhcc.mjs` 拆分
- 前端取数：`CommentaryPanel.vue` 从 manifest 按 `category` 筛选（`sourcesOfCategory`），`fetchCommentary(key, bookId, category)` 分别加载两个切片
- 格式：每章 summary = 概览段（总结），sections = 逐节简注（ref 如 "1,2"/"3-5"，前端逐节折叠展开）；箴言同行多段按 `#` 标记全文切分；无 `#` 段章（原文 `- ` 段风格，如创 36、结 41-48，共 114 章）整章单段（ref 空）
- 许可：Public Domain（Moody Press 28 印无版权声明，来源 CCEL）
- **解析与校验（2026-08-14 全库复核 + 修复）**：`convert_mhcc_full.mjs` 与 study 版同源修复——① 章标记兼容 3/4 对（`$-$-$-` / `$-$-$-$`，此前 4 对格式的 83 章漏识别并入上一章 = 用户报告「末段下一章残留」的根因）；② 章边界取标记行**结尾**（`re.lastIndex`），章尾保留标记行供 `\n\s*\$` 识别边界，最终文本清除；③ 概览段/`- ` 段 lookahead 不含裸 `$`（/m 下匹配行尾只取第一行）+ 空行宽匹配（`\n\s*\n` 兼容带空格空行）；④ 清除 RawCom 引文标记残留（`#Ps 22:9|` / `#17:17|` / `ver. #18|` 等，555→0 处）；⑤ `ver.` 清理限独立单词（不误删 passover/believer）。全库校验结果：**1189 章 / 4070 段零缺失**；内容完整性 4070 段首句全部可在原文中找到（0 丢失，仅 2 处为引文清除的预期句法差异）；ref 连贯性——OVERLAP 24 / GAP 13 均为原文标注特征（如申 32 原文 `#3-6` 后直接 `#13,14`、诗 7 段重叠），REF_EMPTY 114 = 原文单段章（`- ` 风格，如创 36、诗 108），非错误。校验脚本：`scripts/commentary/scan-mhcc-refs.mjs`（连贯性）、`scripts/commentary/verify-mhcc-content.mjs`（内容完整性）、`scripts/commentary/scan-mhcc-bleed.mjs`（跨章残留）
- **历史**：2026-08-14 曾将 MHCC 全文放入 study 层「总结」（summary 字段）；同日重构为**迁入 commentary 分类目录**并**删除 study 目录**——`commentary/` 下按解经抽屉栏目分四类：`summary/`（mhcc 切片）、`interpretation/`（mhcc 切片）、`notes/`（tipnr）、`fullCommentary/`（完整：matthew-henry-en、matthew-henry、calvin、catena、rwp、abbott），原宗派目录全部并入 fullCommentary；**同日再调整**：MHCC 重新用于「总结」层（不混入完整解经菜单），完整版源在菜单中**按宗派分组**（`FULL_SOURCE_TRADITIONS` 元数据：catena→教父著作、calvin/matthew-henry/matthew-henry-en→改革宗、rwp→浸信会、abbott→福音派）。中文马太亨利 `matthew-henry` 数据保留在 fullCommentary/ 但 DISABLED 暂不构建

## 7. Calvin 注释（fullCommentary/calvin，英文）

第二个注释源：加尔文注释合集（改革宗传统，与马太亨利同属 `reformed`）。

### 数据获取（完整记录）

| 项 | 内容 |
|---|---|
| 模块 | CalvinCommentaries **v1.1**（2022-08-01，CrossWire 官方 SWORD 模块） |
| 下载 | `https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/CalvinCommentaries.zip` |
| 内容 | Calvin's Collected Commentaries——**47 卷**（旧约 24 + 新约 23，无约二/约三） |
| 上游 | CCEL（Christian Classics Ethereal Library）文本，Luke Plant 转 SWORD |
| 许可 | **Public Domain**（模块 conf 标注；素材归档见 `../素材/calvin-commentaries/README.md`） |
| 格式 | zCom（bzs 块表 / bzz zlib 流 / bzv 节索引；OSIS 节段按节 `annotateRef` 定位） |

### 转换管线

```bash
node scripts/commentary/import-calvin.mjs   # 素材 → data-src/brp/commentary/fullCommentary/calvin/
npm run data                                # 切片 + manifest（两源共存）
```

### 覆盖与已知问题

- **47 卷 / 770 章 / 13072 节段**（英文原文，逐节 sections，ref 单节）
- **上游覆盖不全**（CCEL 文本特性，如实保留）：诗篇缺 53、70 篇；以赛亚缺 49-66 章；耶利米缺 52 章；以西结缺 22-48 章
- **节段粒度**：加尔文按段注释，缺节（如创 1:7-8）是注释本身未覆盖（annotateRef 只标首节），非数据丢失；创 1:1 注释在模块序言部分、无独立节段
- 白名单（`ENABLED_COMMENTARY_BOOKS`）全局控制所有源显示；源切换 UI 见 §9

## 8. CrossWire 三源接入（fullCommentary/rwp、fullCommentary/catena、fullCommentary/abbott，英文）

第三至第五个注释源，均来自 CrossWire 官方 SWORD 模块，由通用脚本 `scripts/commentary/import-crosswire.mjs` 导入（一次导入三源，幂等）。

### 数据获取（完整记录）

| 源 | 模块（版本） | 内容 | 许可 | 传统 |
|---|---|---|---|---|
| **rwp** | RWP v2.0（2013-01-10） | Robertson's Word Pictures in the New Testament（A.T. Robertson）新约 27 卷逐节 | conf 标注 "Copyrighted; Free non-commercial distribution"；第 5/6 卷版权 2006/2007 到期（conf 自注），现属公有领域 | `baptist` 浸信会 |
| **catena** | Catena v1.0.1 | Catena Aurea 金链——托马斯·阿奎那汇集教父（奥古斯丁、金口约翰、耶柔米等）四福音逐节注解 | **Public Domain** | `church-fathers` 教父 |
| **abbott** | Abbott v1.1 | Illustrated New Testament（John S.C. Abbott & Jacob Abbott, 1878）新约 27 卷逐节 | **Public Domain** | `evangelical` 福音派 |

下载（2026-08-10）：`https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/<Key>.zip`（Key ∈ {RWP, Catena, Abbott}）。素材归档（只读）见 `../素材/crosswire-commentaries/README.md`——其中还记录了 Geneva / Luther / Lightfoot / TSK 四个**评估未采用**模块的原因（边注型/选篇/纯文本流/引用集，不适配 sections 结构）。

### 转换管线

```bash
node scripts/commentary/import-crosswire.mjs   # 三源素材 → data-src/brp/commentary/<category>/<key>/（2026-08-14 起统一归 fullCommentary/）
npm run data                                  # 切片 + manifest（五源共存）
```

### 覆盖与已知问题

- **rwp：27 卷 / 260 章 / 7201 节段**；**catena：4 卷（四福音）/ 89 章 / 821 节段**；**abbott：27 卷 / 260 章 / 3340 节段**（章级覆盖与标准一致，audit 通过）
- **节级为选节注释**（英文原作风貌）：RWP 等只注释重点节（如太 1 仅 10 节），未注释节在数据中不存在——非数据丢失
- 内容为英文原文（RWP 含希腊文词形）；sID/eID 成对去重后按唯一 ref 聚合，同节多段以空行连接
- 模块格式注记：cz 变体（czz）与 b 变体同构（zlib 流、无文件头，实测三个 cz 模块均从 offset 0 起即 zlib 魔数）；早期"czz 有 10 字节头"的说法不适用本批模块

## 9. 马太亨利英文原版（fullCommentary/matthew-henry-en，英文）

第六个注释源：马太亨利注释**英文原版全集**（与中文精校版同书同源，互为对照）。

### 数据获取（完整记录）

| 项 | 内容 |
|---|---|
| 数据 | `工作区/解经校验/马太亨利/数据/json_en/`（66 卷，精校工作区整理的英文全量数据） |
| 上游 | Unabridged Matthew Henrys Commentary on the Whole Bible（英文 EPUB，`源文件/` 归档） |
| 许可 | **Public Domain**（马太亨利 1714 年去世，作品公有领域） |
| 结构 | 与中文版完全同构：`{source, bookId, chapters:[{chapter, summary, sections:[{ref, heading, text}]}]}`，英文小节标题（如 "The Creation."） |

### 录入方式

从解经校验**只读复制**（不改动源文件），批量改写 `source.key` 为 `matthew-henry-en`（避免与中文版 key 冲突）落盘到 `data-src/brp/commentary/fullCommentary/matthew-henry-en/`（2026-08-14 重构：按解经抽屉栏目分文件夹，英文全文版归 `fullCommentary`，MHCC 简明版归 `summary/interpretation`），`npm run data` 自动上架。

### 覆盖与已知问题

- **66 卷 / 1189 章 / 4259 节段**（章数与标准一致，ref 缺口 0，audit 通过）
- 与中文版（`matthew-henry`）同书：中文版为精校译本（含从英文补充翻译的 86 个单元），英文版为原版全文，小节划分一致（创 1 均为 10 小节等）
- 前端默认仍优先中文版（`PREFERRED_COMMENTARY_SOURCE`），英文版供对照阅读

## 10. 前端多源切换

- 源选择器（`CommentarySourceMenu.vue`）按 **宗派（tradition）分组**展示**完整版源**（manifest.sources 的 tradition 字段：教父著作/改革宗/浸信会/福音派…），选择持久化到 `localStorage('brp-commentary-source')`
- summary/interpretation/notes 栏目源**不进入源菜单**——分别由「总结」「经文解释」「背景注释」层专用（`CommentaryPanel` 按 `category` 筛选）
- 默认源偏好链：`PREFERRED_COMMENTARY_SOURCE = ['matthew-henry', …]`（src/lib/data.js `resolveCommentarySource`）
- 某源在某卷无数据时（如 calvin 无约二/约三），自动回落到该卷可用的下一个源；某卷全源无注释 → 空状态提示（选择器常驻，不影响切换）
- 开发期注意：`fetchCommentaryManifest` / `fetchCommentary` 均使用 `cache: 'no-store'`（数据重建频繁，避免 304 命中陈旧 manifest/切片）
