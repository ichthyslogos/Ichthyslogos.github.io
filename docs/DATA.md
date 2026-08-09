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

## 7. 简体译本（ChiUns，SWORD 模块解包）

素材：`bible_databases/sources/zh-hans/ChiUns.zip`（e-Sword/SWORD zText 模块，和合本简体，zh-Hans，Public Domain，来源 bible.fhl.net）。

解包流程（**只读素材，全部工作在副本 `D:/Eyphka/fish/chiuns-copy/` 进行**）：
1. 解压 zip → `modules/texts/ztext/chiuns/{ot,nt}.bzz/.bzv`
2. `.bzz` 为 ZIP 压缩（BlockType=BOOK，每卷一个 zlib 流，流 0 为模块标记）
3. `.bzv` 为节索引：每条 10 字节 `{块号(4), 块内字节偏移(4), 大小(2)}`，记录顺序 = 书卷头(div book sID) → 章头(chapter n=) → 各节内容（OSIS 片段，含 Strong `<w>` 标签）
4. `python scripts/convert-chiuns.py`：按 bzv 索引切节 → 去标签/碎片 → 标准译本 JSON → `data-src/brp/translations/ChiUns.json`（66 卷 / 31103 节）

说明：
- 模块无 `<verse>` 标记，节的边界以 bzv 索引为准（信望爱版分节）
- 已知差异：约翰福音 7 章为 52 节（7:53 内容并入 8 章开头，源版本如此，如实保留）
- 经文含 Strong 编号（`<w lemma="strong:Hxxxx">`），当前版本已剥离；未来 Strong 功能可直接复用源数据

## Strong 逐词标注（和合本简体）

读经研究页在和合本简体（chiuns）译本下显示**逐词 Strong 码**（每词右上角，悬停显示全部码与形态码）。经文面板头部提供「原文标注」开关（仅该译本有数据时可见）：可随时隐藏/显示 Strong 码，偏好持久化于 localStorage（`brp-strong`，默认开）。

### 数据流

```
素材（只读）：chiuns-copy/modules/texts/ztext/chiuns/{ot,nt}_full.txt
  （SWORD OSIS 逐词：<w lemma="strong:H07225">起初</w> + robinson 形态码）
        │  npm run data 前置脚本 scripts/import-strong.mjs（手动/CI 均可跑，幂等）
        ▼
data-src/brp/strong/<bookId>.json     按卷逐词数据（与 chiuns 译本逐字符对齐后按节切分）
        │  build-data.mjs 的 buildStrong()
        ▼
public/data/brp/strong/books/<bookId>.json   运行时切片（按需加载 + 缓存）
        │  前端 fetchStrong(bookId)
        ▼
VerseItem 逐词渲染（词 + <sup>Strong 码</sup>）
```

### 数据结构

```json
{ "key": "chiuns",
  "book": { "id": "01",
    "chapters": [ { "chapter": 1,
      "verses": [ { "verse": 1,
        "words": [ { "t": "起初", "s": "H09002 H07225", "m": null },
                   { "t": "，", "s": null, "m": null } ] } ] } ] } }
```

- `t` 词/标点片段（含间隙标点，保证与译本文本逐字符对齐）；`s` Strong 码（空格分隔多个）；`m` Robinson 形态码
- **对齐**：OSIS 无节标记，脚本按章节与 chiuns 译本文本做字符对齐后按节切分；含 `<note>` 脚注的个别章节因文本差异跳过（约 9 处警告，不影响其余章节）
- **显示规则**：主码过滤希伯来词缀码段（H08xxx/H09xxx，介词/连词/直接宾语标记），悬停 title 显示全部码与形态码
- 仅 chiuns 有标注；思高本/KJV 等无数据 → 纯文本渲染

## Strong 词典（文中解码）

点击经文中任意 Strong 码弹出**词义卡片**（原形 / 音译 / 发音 / 词性 / 释义 / 用法 / 交叉引用），"文中解码"。

### 数据流

```
素材（只读）：
  StrongsGreek/modules/lexdict/zld/strongsgreek/   希腊文词典（SWORD zLD，Public Domain）
  HebrewLexicon/HebrewStrong.xml                   希伯来词典（OSHB HebrewLexicon，CC BY 4.0）
        │  node scripts/import-strong-lexicon.mjs / import-strong-lexicon-hebrew.mjs
        │    （npm run data:strong-lexicon / data:strong-lexicon-hebrew，幂等；素材缺失跳过）
        ▼
data-src/brp/strong/lexicon-greek.json / lexicon-hebrew.json
        │  build-data.mjs 的 buildStrongLexicon()（按 1000 编号段切片，每次清空重建）
        ▼
public/data/brp/strong/lexicon/<g|h><seg>.json   运行时切片（g*6 段 + h*9 段，按需加载 + 缓存）
        │  前端 fetchStrongLexicon(code)
        ▼
LexiconPopup 弹层（点击 Strong 码打开；滚动/切换章节/点外部关闭）
```

### 说明

- **码归一化**：chiuns 逐词码带前导零（`H0430`/`H07225`），词典 key 无填充（`H430`/`H7225`）；`normalizeStrongCode()` 去前导零后匹配（G 码本无前导零）
- **希腊词条**（G 码，5489 条）：`{ orth, translit, pron, def, see }`——原形/转写/发音/释义/交叉引用；**希伯来词条**（H 码，8673 条）另有 `pos` 词性与 `usage` 用法
- 词条 `see` 为交叉引用（G/H 码均可点击跳转）
- 释义为英文原文；希伯来数据来源 OSHB 项目（CC BY 4.0，`source.attribution` 字段署名：Open Scriptures Hebrew Bible Project）
- 希腊素材块结构（zLD 格式）：`dict.zdx` 块表 → `dict.zdt` 串联 zlib 流 → 块内 `[count][off0][(size,nextOff)…]` + TEI 条目文本；占位条目（`@@@@`）解析时丢弃
