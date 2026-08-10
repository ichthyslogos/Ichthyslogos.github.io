# 新增注释源模板（_template）

复制本模板生成新注释源，三步完成（本目录不参与构建，可放心修改）。

## 目录结构

```
data-src/brp/commentary/_template/
├── _README.md                         ← 本文档
└── your-tradition/your-key/01.json    ← 模板 JSON（复制 → 改名 → 填写）
```

## 新增注释源三步

1. **建目录**：`data-src/brp/commentary/<tradition>/<key>/`
   - `<tradition>`：9 个固定传统之一（`church-fathers` / `catholic` / `lutheran` / `reformed` / `baptist` / `methodist` / `anglican` / `pentecostal` / `evangelical`，见 docs/COMMENTARY-ROADMAP.md）
   - `<key>`：源唯一标识（如 `calvin`、`gill`；同一传统可多个源）
2. **放数据**：复制 `01.json` 模板到该目录，改名 `<bookId>.json`（01-66 / ext-N，编号见 scripts/bible-books.mjs），每卷一个文件；填写字段（见下）
3. **上架**：`npm run data` → manifest 自动收录 → 前端解经面板自动多出该源（来源徽章显示 `name`，按 `tradition` 分组）

## 字段说明

| 字段 | 说明 |
|---|---|
| `source.key` | 源唯一标识，**必须与目录名一致** |
| `source.name` | 显示名（解经面板来源徽章） |
| `source.lang` | BCP47 语言码（`zh` / `en` / `fr` …） |
| `bookId` | 书卷编号，与文件名一致（01-66 / ext-N） |
| `chapters[].chapter` | 章号 |
| `chapters[].summary` | 章引言+概要（可选，可空字符串） |
| `chapters[].sections[]` | 小节：`heading` 标题（可选）、`ref` 节号范围（如 `1-2`）、`text` 正文（段落间空行分隔，其余换行渲染时自动合并） |

## 规范

- 每卷 JSON 结构：`{ source, bookId, chapters: [...] }`；文件命名 `<bookId>.json`
- **不要放置** `_report.json` 之类的自检文件（构建跳过 `_report.json`，但建议保持目录干净）
- 源 JSON 内可含 `source.tradition` 字段作为参考标注（构建以**目录名**为准）
- 许可与素材：素材（PDF/EPUB/模块）只读存放素材根（如 `strong-lexicons/`、`马太亨利译注/`），转换脚本放 `site/scripts/`，产物入库提交
- 接入后更新 `docs/COMMENTARY.md`（源记录）与 `docs/COMMENTARY-ROADMAP.md`（候选清单勾选）
