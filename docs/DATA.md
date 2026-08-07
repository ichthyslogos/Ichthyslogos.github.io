# 数据流水线（DATA）

本文件说明 FISH 平台的数据如何从素材库进入网站、如何扩展，以及未来功能的接入方案。

## 1. 译本"放入即自动显示"

### 1.1 统一格式约定

`data-src\brp\translations\` 下每个译本是一个 JSON 文件，必须符合素材库 bible_databases 的统一格式：

```json
{
  "translation": "ChiUn: 和合本 (繁體字)",
  "books": [
    {
      "name": "Genesis",
      "chapters": [
        { "chapter": 1, "verses": [ { "verse": 1, "text": "起初，神創造天地。" } ] }
      ]
    }
  ]
}
```

### 1.2 新增译本三步

1. **放入**：把符合上述格式的 JSON 复制到 `data-src\brp\translations\`，例如 `KJV.json`
2. **运行**：`npm run data`（= import + build-data）
3. **完成**：网站自动出现该译本（manifest 更新，前端零改动）

可选：在 `scripts\build-data.mjs` 的 `META_BY_KEY` 中补充 `lang`（BCP47 语言码，决定是否做中文去空格）与 `original` 标记（原文）；未补充时默认 `lang: 'und'`、`original: false`，功能不受影响，仅净化规则不生效。

### 1.3 前端如何发现译本

`build-data.mjs` 扫描数据库目录生成 `public\data\brp\manifest.json`：

```json
{
  "generatedAt": "…",
  "translations": [
    { "key": "chiun", "name": "和合本 (繁體字)", "original": false, "lang": "zh-Hant",
      "books": [ { "id": "01", "zh": "创世记", "en": "Genesis", "group": "ot", "chapterCount": 50 } ] }
  ]
}
```

- `key`：文件名小写（URL 中 `?trans=<key>` 使用）
- 排序：非原文在前按 key 排序、原文（original=true）在后，保证 UI 顺序稳定
- 前端 `src\lib\data.js` 按需 fetch 切片 `translations\<key>\books\<id>.json` 并缓存

## 2. 原文与译本隔离（Strong 预留）

**现状（已落架构）**：

- manifest 中每条译本带 `original: true|false`。`true` 表示原文（原语言圣经：希伯来文 WLC、希腊文 Byz/TR 等）。
- 前端 `ScripturePanel` 的译本切换器把原文与译本**分区展示**（译本区 + 「原文」区），`resolveTranslation` 的默认偏好只回退译本。
- 原文与译本在数据流上完全独立：各自的 JSON 独立切片、独立 manifest 条目。

**未来 Strong 功能接入点**：

- `src\components\brp\VerseItem.vue` 已预留具名插槽 `annotations`（当前为注释掉的 `<slot name="annotations">`），Strong 编号高亮与词义注解从此插槽注入，经文渲染不变。
- 建议的 Strong 数据形态：独立 JSON（词条表 `{ strongNo, hebrew/greek, gloss }` + 每节经文 Strong 编号映射表），按 `bookId + chapter + verse` 对齐，与译本数据流平行——**不要写入译本切片**。

## 3. 注释数据（马太亨利等）

注释系统为**多注释源架构**（当前源：马太亨利圣经注释）。数据格式、转换管线、已知问题等详见 **`docs/COMMENTARY.md`**：

- 源数据：`data-src/brp/commentary/<sourceKey>/<bookId>.json`
- 转换：`python scripts/commentary/extract.py`（pypdf，全量约 40-60 分钟，断点续传）
- 构建：`npm run data` 自动切片到 `public/data/brp/commentary/` + manifest
- 新增注释源：放 JSON 进 `data-src/brp/commentary/<key>/` → 重跑 data → 前端自动显示

## 4. 故障记录（重要！）

### 4.1 Windows 大小写残留导致 vite 不服务数据文件

- **现象**：`data/brp/translations/chiun/books/01.json` 请求返回 index.html（SPA fallback），而 `manifest.json` 正常。
- **根因**：早期版本 build-data 用原始大小写生成目录（`translations/ChiUn/`）。Windows 文件系统大小写不敏感，之后小写 key（`chiun`）写入同一物理目录，**磁盘目录名仍是 `ChiUn`**。vite dev server 启动时构建的 public 文件集合是**大小写敏感的字符串匹配**，小写 URL 全部 miss → fallback 到 index.html。
- **修复**：build-data 每次构建前 `rmSync` 清空 `translations` 输出目录，保证目录名与 key 完全一致。
- **教训**：在 Windows 上生成目录前先清理；manifest 中的 key 与目录名必须精确一致。

## 5. 数据规模参考

| 译本 | 卷数 | 章数 | 源文件 | 切片后单卷 |
|---|---|---|---|---|
| chiun（和合本繁体） | 66 | 1189 | ~7.4MB | ~100–200KB |
| chisb（思高本，含 7 卷次经） | 73 | 1328 | ~8.3MB | ~100–200KB |
| kjv（英王钦定本 KJV） | 66 | 1189 | ~8.0MB | ~100–200KB |

素材库 bible_databases 共 140 种译本（含 WLC/Byz 等原文、其他英文译本等），均可按第 1 节流程接入（`node scripts/import.mjs <KEY>`）；英文译本在 `META_BY_KEY` 中登记 `lang: 'en'` 即不被中文空格净化，可加 `name` 覆盖展示名。

## 6. 串珠（交叉引用）数据

素材：`bible-cross-references-1.0/.../kjv/crossreferences_kjv.tsv`（TSK 系短语级串珠，KJV 锚短语，CC BY 4.0，素材只读）。

```
素材 TSV（book/chapter/verse/anchor/references，目标用 | 分隔）
  │  node scripts/build-crossrefs.mjs（npm run data 内含 data:crossrefs）
  ▼
public/data/brp/crossrefs/<bookId>.json   ← 按卷切片（66 卷 / 29060 节含串珠）
  ▼
前端 VerseItem 按节显示 🔗 串珠按钮（锚短语 + 引用目标列表，点击跳转）
```

- 每卷 JSON：`{ source, bookId, chapters: [{ chapter, verses: [{ verse, refs: [{ anchor, targets: [{ id, ch, vs }] }] }] }] }`，目标 `vs` 为字符串（支持 `22-24`、`6,9`）
- 书卷缩写映射在 `scripts/bible-books.mjs` 的 `KJV_ABBR`（66 卷 KJV 标准缩写）
- 前端接入：`src/lib/data.js` 的 `fetchCrossrefs(bookId)` / `findCrossrefChapter()`；引用目标显示名由 ScripturePanel 用当前译本的中文书卷名拼装（`箴言 8:22-24`）
