# 背景注释系统文档（NOTES）

## 术语约定

**注释** = 作者/地点/背景等的简要介绍（与「解经」= 对经文本身的解释区分，见 COMMENTARY.md §6.3）。
2026-08-14 起，注释层已实现：**解经抽屉新增「背景注释」层**（位于「应用」与「完整解经」之间，可折叠，不单列）。

## 数据来源：STEP Bible TIPNR

- **名称**：TIPNR（Translators Individualised Proper Names with all References）——圣经专有名词词典
- **内容**：4262 个人名/地名/其他专名（PERSON/PLACE/OTHER），每条含：
  - 统一名 + 唯一 uStrong 编号 + 希伯来/希腊原文形式
  - 全部出现经节（`– Total` 子行，省略书缩写时承接上一引用）
  - **四级描述**：`@Briefest`（≤3 词）/ `@Brief`（≤10 词）/ `@Short`（单句）/ `@Article`（成段，`<BR>` 分隔段落）
- **许可**：**CC BY 4.0**（`Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)`）
  - 需**署名 STEP Bible** 并链接 www.STEPBible.org；请勿自行再分发（引导至 GitHub 源）
- **获取**：`素材/stepbible-tipnr/TIPNR.txt`（raw GitHub 下载，8.6MB，见素材 README）

## 数据结构（data-src/brp/commentary/notes/tipnr/）

- `entries.json`：全量轻量索引 `{ source, count, entries: [{ name, strong, type }] }`（供将来词条高亮匹配）
- `books/<bookId>.json`：按卷分片（当前章词条列表）：

```json
{ "source": { "key": "tipnr", "name": "STEP 专有名词注释 (TIPNR)", "lang": "en" },
  "bookId": "05",
  "chapters": [
    { "chapter": 34, "entries": [
      { "name": "Abraham", "strong": "H0085", "type": "Male",
        "briefest": "Son of Terah", "brief": "…", "short": "…", "article": "…",
        "refs": [34] }
    ]}
  ]}
```

- `type`：Male/Female/Group/Place/Language/Time/Supernatural/Musical/Star/Title/Other（前端徽章：人名/群体/地名/其他）
- `refs`：该词条**在本章**的出现节（列表展示用；全量出现经节不存，词条详情按需扩展）
- **描述清理**：TIPNR 原文描述含 HTML 标记（`<ref="1Ki.1.7">…</ref>` / `<strong=…>` / `<br>`），导入时由 `cleanDesc()` 剥除——`<br>` 转段落分隔、其余标签删除保留内部文本（全库校验 0 残留，2026-08-14）

## 上架流程

1. 素材已归档（`素材/stepbible-tipnr/`，只读）
2. `node scripts/commentary/import-tipnr.mjs` → 重写 `data-src/brp/commentary/notes/tipnr/`（4259 词条 / 66 卷 / 1088 章）
3. `npm run data` → `buildCommentary()` 的 notes 栏目处理复制到 `public/data/brp/commentary/notes/tipnr/` + manifest（category='notes'）
4. 前端 `data.js`：`fetchNotes(bookId)` / `findNotesChapter(book, chapter)`（no-store）；`CommentaryPanel.vue`「背景注释」层

## 已接入范围

- 66 卷正典全覆盖（1088 章有词条，其余章节显示「本章暂无背景注释」）
- 前端：词条名 + 类型徽章，点击展开 `short` + `article` + 本章出现节

## 后续规划（待实现，2026-08-14 立项）

1. **经文中词条高亮点击**：用 `entries.json` 词条名匹配经文文本（和合本/英文），高亮人名/地名，点击弹出注释卡片——本次只做「按章列表」，高亮留待后续
2. **中文翻译**：TIPNR 描述为英文，后续 AI 批量翻译 + 人名/地名对照和合本译名映射（词条名如 Abraham → 亚伯拉罕）
3. 词条详情可扩展显示全量出现经节（数据里已有解析基础）
