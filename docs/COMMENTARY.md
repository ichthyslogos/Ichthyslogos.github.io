# 注释系统文档（COMMENTARY）

本文档说明 FISH 平台的**解经注释**系统：数据格式、多注释源扩展方法、马太亨利译注的转换管线与已知问题。扩展规划（按传统分类的候选注释源清单）见 [COMMENTARY-ROADMAP.md](COMMENTARY-ROADMAP.md)。

## 1. 多注释源架构

注释按**传统 → 来源（人/注释集）**两级组织，数据流与译本管线同构：

```
素材（马太亨利译注 PDF/DOCX / CrossWire SWORD 模块）
  │  python scripts/commentary/extract.py（马太亨利中文）
  │  node scripts/commentary/import-calvin.mjs / import-crosswire.mjs（SWORD 模块）
  ▼
data-src/brp/commentary/<tradition>/<sourceKey>/<bookId>.json
  │    ← 源数据（当前 5 源：reformed/matthew-henry、reformed/calvin、
  │       baptist/rwp、church-fathers/catena、evangelical/abbott）
  │  npm run data（build-data.mjs 两级扫描切片）
  ▼
public/data/brp/commentary/manifest.json + <sourceKey>/<bookId>.json（运行时扁平）
  ▼
前端 CommentaryPanel 按 bookId + chapter 渲染（源选择器按 tradition 分组）
```

**传统分类（tradition，9 个固定 key）**：`church-fathers` 教父著作 / `catholic` 天主教传统 / `lutheran` 路德宗 / `reformed` 改革宗 / `baptist` 浸信会 / `methodist` 卫理公会 / `anglican` 圣公会 / `pentecostal` 五旬节派 / `evangelical` 福音派（各传统下的候选源清单见 ROADMAP）。

**新增注释源三步**（放入 `data-src/brp/commentary/<tradition>/<key>/<bookId>.json` 后）：
1. 生成符合格式的 JSON（模板见 `data-src/brp/commentary/_template/`，含填写说明）
2. 运行 `npm run data`
3. 前端自动多出该源（`CommentaryPanel` 源选择器按 tradition 分组展示，无需改前端代码）

## 2. 数据格式

每卷一个 JSON（`bookId` 复用 bible-books 编号 01-66 / ext-N）：

```json
{
  "source": { "key": "matthew-henry", "name": "马太亨利圣经注释", "lang": "zh" },
  "bookId": "01",
  "chapters": [
    {
      "chapter": 1,
      "summary": "本章经文论到三件事：I.创造之工的概览（第 1-2 节）。…",
      "sections": [
        { "heading": "创造（主前 4004 年）", "ref": "1-2", "text": "在这两节经文里，我们看到…" }
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

## 6. 临时关闭某卷注释（非删除）

`src/lib/data.js` 的 `ENABLED_COMMENTARY_BOOKS` 白名单控制哪些书卷**开放注释显示**；不在白名单内的卷，前端视为"该卷注释暂时关闭"（空状态），**数据文件（data-src 源数据与 public 运行时数据）全部保留、不删除**。

- 当前开放：**66 卷正典全部开放**（`ENABLED_COMMENTARY_BOOKS` = 01-66；不含次经 ext-N）
- 恢复显示：把 bookId（01-66 / ext-N）加回 `ENABLED_COMMENTARY_BOOKS` 集合即可，**无需重跑 `npm run data`**，前端刷新即生效

## 7. Calvin 注释（reformed/calvin，英文）

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
node scripts/commentary/import-calvin.mjs   # 素材 → data-src/brp/commentary/reformed/calvin/
npm run data                                # 切片 + manifest（两源共存）
```

### 覆盖与已知问题

- **47 卷 / 770 章 / 13072 节段**（英文原文，逐节 sections，ref 单节）
- **上游覆盖不全**（CCEL 文本特性，如实保留）：诗篇缺 53、70 篇；以赛亚缺 49-66 章；耶利米缺 52 章；以西结缺 22-48 章
- **节段粒度**：加尔文按段注释，缺节（如创 1:7-8）是注释本身未覆盖（annotateRef 只标首节），非数据丢失；创 1:1 注释在模块序言部分、无独立节段
- 白名单（`ENABLED_COMMENTARY_BOOKS`）全局控制所有源显示；源切换 UI 见 §9

## 8. CrossWire 三源接入（baptist/rwp、church-fathers/catena、evangelical/abbott，英文）

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
node scripts/commentary/import-crosswire.mjs   # 三源素材 → data-src/brp/commentary/<tradition>/<key>/
npm run data                                  # 切片 + manifest（五源共存）
```

### 覆盖与已知问题

- **rwp：27 卷 / 260 章 / 7201 节段**；**catena：4 卷（四福音）/ 89 章 / 821 节段**；**abbott：27 卷 / 260 章 / 3340 节段**（章级覆盖与标准一致，audit 通过）
- **节级为选节注释**（英文原作风貌）：RWP 等只注释重点节（如太 1 仅 10 节），未注释节在数据中不存在——非数据丢失
- 内容为英文原文（RWP 含希腊文词形）；sID/eID 成对去重后按唯一 ref 聚合，同节多段以空行连接
- 模块格式注记：cz 变体（czz）与 b 变体同构（zlib 流、无文件头，实测三个 cz 模块均从 offset 0 起即 zlib 魔数）；早期"czz 有 10 字节头"的说法不适用本批模块

## 9. 马太亨利英文原版（reformed/matthew-henry-en，英文）

第六个注释源：马太亨利注释**英文原版全集**（与中文精校版同书同源，互为对照）。

### 数据获取（完整记录）

| 项 | 内容 |
|---|---|
| 数据 | `工作区/解经校验/马太亨利/数据/json_en/`（66 卷，精校工作区整理的英文全量数据） |
| 上游 | Unabridged Matthew Henrys Commentary on the Whole Bible（英文 EPUB，`源文件/` 归档） |
| 许可 | **Public Domain**（马太亨利 1714 年去世，作品公有领域） |
| 结构 | 与中文版完全同构：`{source, bookId, chapters:[{chapter, summary, sections:[{ref, heading, text}]}]}`，英文小节标题（如 "The Creation."） |

### 录入方式

从解经校验**只读复制**（不改动源文件），批量改写 `source.key` 为 `matthew-henry-en`（避免与中文版 key 冲突）落盘到 `data-src/brp/commentary/reformed/matthew-henry-en/`，`npm run data` 自动上架。

### 覆盖与已知问题

- **66 卷 / 1189 章 / 4259 节段**（章数与标准一致，ref 缺口 0，audit 通过）
- 与中文版（`matthew-henry`）同书：中文版为精校译本（含从英文补充翻译的 86 个单元），英文版为原版全文，小节划分一致（创 1 均为 10 小节等）
- 前端默认仍优先中文版（`PREFERRED_COMMENTARY_SOURCE`），英文版供对照阅读

## 10. 前端多源切换

- 源选择器（`CommentarySourceMenu.vue`）按 **tradition 分组**展示所有源（manifest.sources 带 tradition 字段），选择持久化到 `localStorage('brp-commentary-source')`
- 默认源偏好链：`PREFERRED_COMMENTARY_SOURCE = ['matthew-henry', …]`（src/lib/data.js `resolveCommentarySource`）
- 某源在某卷无数据时（如 calvin 无约二/约三），自动回落到该卷可用的下一个源；某卷全源无注释 → 空状态提示（选择器常驻，不影响切换）
