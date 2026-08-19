# 目录结构详解（STRUCTURE）

逐个说明 FISH 平台每个目录与关键文件的职责，供快速定位代码与数据。
本文对应主站 `site\`（结构与测试站 `site_test\` 一致）。

## 顶层速览

```
D:\Eyphka\fish\site\
├── README.md / index.html / package.json / vite.config.js / .gitignore
├── docs\      全部文档（按主题拆分，见 docs\README.md 导航）
├── scripts\   数据流水线脚本（Node ESM 为主，少量 Python 提取器）
├── data-src\  网站「数据库」：素材投影（源，可移植，随 git 提交）
├── public\    vite 静态目录（data\ 为构建产物，勿手改）
└── src\       前端源码（Vue3 + vite，无 UI 库）
```

## 1. 数据流总览（四层）

```
素材库（fish 根目录，只读，不入 git）
  │  scripts\*.mjs 导入/提取
  ▼
data-src\              源数据（人可维护的最小集合）
  │  npm run data 等构建脚本（校验/切片/manifest/瓦片）
  ▼
public\data\           运行时数据（构建产物，勿手改）
  │  fetch（src\lib\data.js 等访问层，带缓存）
  ▼
src\views + components 页面渲染
```

关键纪律：**public\data 一律构建生成**；要改数据先改 data-src 或素材库再重跑构建；
`public\data\search\` 由 `scripts\search\build-search-index.mjs` 从运行时数据只读抽取生成。

## 2. public\data\ —— 运行时数据域（7 个域，按业务域分类）

| 域 | 内容 | 规模 | 主要消费方 |
| --- | --- | --- | --- |
| `brp\translations\` | 7 译本按卷切片 + manifest（和合本/思高本/NIV/KJV/ASV/DRC/Martin） | ~160MB | 读经页、搜索全文 |
| `brp\commentary\` | 注释四栏目：summary / interpretation / notes（TIPNR 背景注释）/ fullCommentary + manifest | ~74MB | 读经页解经抽屉、搜索注释段 |
| `brp\crossrefs\` | 串珠 01-66.json | 小 | 读经页串珠展开 |
| `geography\` | 底图与图层：base\ glyphs\ tiles\（cities/territories/territory-labels/urban 四图层，z/x/y 标准瓦片）+ regions/journeys/periods/geometries.json | ~121MB | 地图子页、读经页地图、首页预览 |
| `search\` | 搜索索引：index.json（实体）+ scripture-*.json ×7（全文）+ commentary-*.json ×7（注释段） | ~35MB | 全局搜索面板 |
| `apologetics\` | 护教学专题（content.meta + topics\） | 小 | 护教页 |
| `church-history\` | 教会史五部 part1-5.json | 小 | 教会史页 |
| `library\` | 图书馆书目与文本 | 小 | 图书馆页 |

> 2026-08 结构清理：删除孤儿目录 `public\data\brp\notes\`（旧版 TIPNR 残留，
> 运行时零引用，现行数据在 `brp\commentary\notes\tipnr\`）。

## 3. data-src\ —— 源数据域

```
data-src\
├── brp\
│   ├── translations\          译本源 JSON（ChiUn/ChiSB/NIV…）
│   └── commentary\
│       ├── summary\ interpretation\ fullCommentary\   注释源（按 key 分目录）
│       ├── notes\tipnr\       TIPNR 源（entries/books/place-coords/zh-names/name-variants）
│       ├── en-raw\ _template\ 原始导入与模板（不参与构建，_ 前缀跳过）
├── geography\
│   ├── base\                  底图源（Natural Earth 等投影产物）
│   ├── curated\               人工校订数据（时期/政权命名等）
│   └── normalized\            归一化几何（polities.json 超 100MB 不入 git）
├── apologetics\topics\        护教学专题源
├── church-history\            教会史源
└── library\                   图书馆源（books\ + categories + meta）
```

## 4. scripts\ —— 数据流水线

```
scripts\
├── bible-books.mjs            书卷元数据唯一权威（66 卷 + 7 卷次经）
├── import.mjs / import-niv.mjs / rebuild-chiuns.mjs / convert-chiuns.py   译本导入
├── build-data.mjs             data-src → public\data\brp\（校验、切片、manifest）
├── build-crossrefs.mjs        串珠构建
├── verify-highlight.mjs       高亮数据校验
├── fix-commentary-headings.mjs  注释标题修复（一次性工具）
├── serve-dist.mjs             本地模拟静态托管
├── commentary\                注释导入与治理（extract.py/extract_epub.py、
│                              import-tipnr/calvin/crosswire、split/format/scan-mhcc*、
│                              extract/validate-place-coords）
├── geography\                 地理构建（build-geography/regions/tiles/periods/geo-layers/
│                              brp-historical、fetch-pleiades/dare、import-ubs-journeys、
│                              convert-gray-earth）
└── search\                    搜索（build-search-index、search-self-test、
                               verify-search-data、gen-t2s-table）
```

## 5. src\ —— 前端源码

```
src\
├── main.js / App.vue / style.css
├── router\index.js            路由（hash）：/ /brp /map /history /apologetics /library /sources + 404
├── lib\                       共享逻辑（无 UI）
│   ├── data.js                数据访问层（译本/注释/串珠/TIPNR/护教…，带缓存）
│   ├── searchEngine.js        搜索引擎（四路：地址/实体/经文全文/注释段）
│   ├── searchStore.js + components\search\SearchPanel.vue   全局搜索浮层
│   ├── geo.js / temporal.js   地理与年代工具
│   ├── text.js                文本处理（注释排版、繁简表 t2s-table.mjs 由脚本生成）
│   └── scrollbars.css 相关：scrollbars.js
├── views\                     页面（每子域一个目录）
│   ├── Home.vue               首页（hero + 地图预览 + 搜索入口）
│   ├── brp\BrpPage.vue        读经研究平台（默认页）
│   ├── map\MapPage.vue        历史地图子页（时期图层 + 深链 ?period/?focus）
│   ├── church-history\        教会史五部
│   ├── apologetics\           护教（Page + Closed 收尾页）
│   ├── library\ / sources\    图书馆 / 数据来源页
└── components\                组件（按子域分目录，共享组件放根）
    ├── AppHeader.vue EmptyState.vue（共享）
    ├── brp\      BookSidebar/ChapterTabs/ScripturePanel/TranslationMenu/VerseItem/
    │             CommentaryPanel/CommentarySourceMenu/MapPanel（读经地图抽屉）
    ├── map\      MapLibreMap.vue（地图引擎核心，地图页与读经抽屉共用）
    ├── search\   SearchPanel.vue（全局搜索浮层）
    ├── home\     Hero/Intro/Research/Data/UniversalSearch/BibleMapPreview/FinalCTA/Footer
    ├── apologetics\ SearchBar/TopicCard/QuestionCard/ResponseCard/EvidencePanel/ScriptureReference
    └── library\  BookCard/BookDetail/ReaderPanel
```

## 6. 常见定位速查

| 想找什么 | 看哪里 |
|---|---|
| 读经页整体逻辑 | `src\views\brp\BrpPage.vue` |
| 地图引擎 / 图层标签 | `src\components\map\MapLibreMap.vue` |
| 读经页地图抽屉 | `src\components\brp\MapPanel.vue` |
| 全局搜索 | `src\components\search\SearchPanel.vue` + `src\lib\searchEngine.js` |
| 数据加载/缓存 | `src\lib\data.js` |
| 书卷编号表 | `scripts\bible-books.mjs` |
| 新增译本 | `data-src\brp\translations\` 放入 → `npm run data` |
| 新增注释源 | `data-src\brp\commentary\<栏目>\<key>\` → `npm run data`（见 docs\COMMENTARY.md） |
| 搜索索引重建 | `node scripts\search\build-search-index.mjs` |
| 地理瓦片重建 | `scripts\geography\build-tiles.mjs`（见 docs\GEOGRAPHY.md） |
| 全局配色/字体 | `src\style.css`（CSS 变量） |
| 添加路由 | `src\router\index.js` |
| 目录之外 | 素材库 `D:\Eyphka\fish\` 下各数据库目录（只读，见根 README.md） |

## 7. 维护纪律

1. **勿手改 public\data**：一切经 scripts 构建；改动从 data-src / 素材库发起。
2. **严禁直放产物目录**：数据必须先进 data-src 再构建。若发现 public 有无源数据，
   用 `scripts\backfill-apologetics-src.mjs`（护教专题回填工具，幂等）反向拆分回源并
   登记 content.meta.json，再重跑构建（2026-08 已回填 6 个护教专题，此前索引不可见）。
3. **脚本目录分类**：新脚本按 commentary / geography / search 归组，勿散放根目录。
4. **Python 产物**：`__pycache__/`、`*.pyc` 已 gitignore，不入库。
5. **超限素材**：>100MB 单文件放 data-src 对应目录并在 .gitignore 声明（如 polities.json）。
6. **结构变更**：目录增删后同步更新本文档与 docs\README.md 导航。
