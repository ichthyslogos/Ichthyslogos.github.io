# 注释系统文档（COMMENTARY）

本文档说明 FISH 平台的**解经注释**系统：数据格式、多注释源扩展方法、马太亨利译注的转换管线与已知问题。

## 1. 多注释源架构

注释按**来源（人/注释集）**组织，数据流与译本管线同构：

```
素材（马太亨利译注 PDF/DOCX）
  │  python scripts/commentary/extract.py（pypdf 提取 + 解析）
  ▼
data-src/brp/commentary/<sourceKey>/<bookId>.json   ← 源数据（第一个源：matthew-henry）
  │  npm run data（build-data.mjs 扫描切片）
  ▼
public/data/brp/commentary/manifest.json + <sourceKey>/<bookId>.json
  ▼
前端 CommentaryPanel 按 bookId + chapter 渲染
```

**新增注释源三步**（未来增加第二个人/注释集）：
1. 生成符合格式的 JSON 放入 `data-src/brp/commentary/<key>/<bookId>.json`
2. 运行 `npm run data`
3. 前端自动多出该源（`CommentaryPanel` 显示来源标识；面板已预留多源切换结构）

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
- `src/components/brp/CommentaryPanel.vue`：按 `book.id + chapter` 渲染 summary + sections；无注释 → 空状态"本卷暂无注释"
- 面板显隐/移动端覆盖层/三面板互斥逻辑与之前一致，不受注释数据影响

## 6. 临时关闭某卷注释（非删除）

`src/lib/data.js` 的 `ENABLED_COMMENTARY_BOOKS` 白名单控制哪些书卷**开放注释显示**；不在白名单内的卷，前端视为"该卷注释暂时关闭"（空状态），**数据文件（data-src 源数据与 public 运行时数据）全部保留、不删除**。

- 当前开放：`01`（创世记，人工精校版）
- 恢复显示：把 bookId（01-66 / ext-N）加回 `ENABLED_COMMENTARY_BOOKS` 集合即可，**无需重跑 `npm run data`**，前端刷新即生效
