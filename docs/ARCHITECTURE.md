# 架构说明（ARCHITECTURE）

## 1. 设计目标

- **素材与框架隔离**：圣经素材（译本数据库、注释 PDF）与网站代码彻底分离，素材更新不破坏网站，网站可独立移植。
- **数据驱动**：任何符合统一格式的译本，放入数据库目录即可自动上架，前端零改动。
- **按子页面组织**：每个子页面（功能）拥有独立的视图、组件、数据文件夹；共享内容放根目录，不建共享文件夹。
- **为未来预留**：马太亨利译注（经文右侧解经面板）、Strong 原文研究只落架构，不实现功能。

## 2. 四层数据流

```
素材库（D:\Eyphka\fish\，只读）
   │  scripts\import.mjs （复制所选译本）
   ▼
data-src\brp\translations\*.json   ← 网站"数据库"（素材投影，可移植）
   │  scripts\build-data.mjs （校验 → 净化 → 按卷切片 → 生成 manifest）
   ▼
public\data\brp\                   ← 运行时数据（部署时随 dist\ 一起发布）
   │  manifest.json + translations\<key>\books\<id>.json
   ▼
src\lib\data.js                    ← 前端数据访问层（按需 fetch + 缓存）
```

**分层职责：**

| 层 | 位置 | 职责 | 何时改动 |
|---|---|---|---|
| 素材库 | `..\bible_databases\formats\json\` 等 | 原始数据（140 译本、注释 PDF） | 永不直接在网站内引用 |
| 数据库 | `data-src\brp\translations\` | 网站持有、可扩展的译本 JSON | 添加新译本时 |
| 运行时数据 | `public\data\brp\` | 浏览器加载的切片数据（构建产物） | 仅由 build-data 生成，勿手改 |
| 前端 | `src\` | 视图 + 组件 + 数据访问层 | 开发功能时 |

## 3. 书卷编号体系

`scripts\bible-books.mjs` 是书卷编号的唯一权威：

- `01–66`：新教正典标准顺序（与和合本一致）
- `ext-1 … ext-7`：次经/第二正典（仅部分译本存在，如思高本）
- 匹配规则：**按素材 JSON 中的原始英文名（srcName）匹配**，不能按数组位置对齐——因为天主教译本（思高本 73 卷）的正典排序与新教不同（如 Esther 位置不同）。

前端通过 manifest 拿到 `{ id, zh, en, group, chapterCount }` 元数据，路由 `/brp/:bookId/:chapter` 中的 bookId 即此编号。

## 4. 按子页面组织的约定

一个子页面（如 brp）的完整零件：

| 零件 | 路径 | 说明 |
|---|---|---|
| 视图 | `src\views\<子页面名>\<Name>Page.vue` | 页面级组件，持有该页状态 |
| 组件 | `src\components\<子页面名>\*.vue` | 页面内部组件，通过 props/events 与页面通信 |
| 数据源 | `data-src\<子页面名>\` | 该页专属的源数据 |
| 运行时数据 | `public\data\<子页面名>\` | 该页专属的运行时数据 + manifest |
| 路由 | `src\router\index.js` | 注册 `/子页面名` 路由 |

**共享内容不建文件夹**：共享组件（如 `AppHeader.vue`、`EmptyState.vue`）直接放 `src\components\` 根目录；共享逻辑放 `src\lib\` 根目录。同理，数据共享（如有）直接放 `public\data\` 根目录。

## 5. 路由与状态设计

- 路由使用 **hash 模式**（`createWebHashHistory`），纯静态托管零配置，URL 可直接分享（如 `#/brp/19/1?trans=chisb`）。
- **URL 是状态的唯一来源**：书卷/章节/译本全部体现在 URL 中（`/brp/:bookId/:chapter?trans=<key>`），页面内不再维护重复状态；切译本时 URL 变化 → `watch` 重新拉取数据。
- 默认译本由 `src\lib\data.js` 的 `PREFERRED_TRANS` 偏好链决定（当前和合本简体 chiuns 优先），不依赖 manifest 顺序。

## 6. 关键技术决策记录

| 决策 | 原因 |
|---|---|
| Vue 3 + Vite + vue-router，无 TS、无 UI 库 | 保持零额外依赖、手写轻量 CSS，节省维护成本 |
| 按卷切片（而非整本 JSON） | 7MB+ 整本 JSON 全量加载不可接受；按卷约 100–200KB，按需 fetch |
| 视口固定高度布局（.app-shell 100vh + overflow hidden） | brp 页侧栏/章节/经文三区各自独立滚动，页面本体不滚动；Home 页在 main 容器内滚动 |
| 译本切换用展开式下拉（TranslationMenu） | 译本数量可达 140 种，平铺列全会撑爆面板；下拉分组展示并支持列表内部滚动 |
| 切片数据以 `public\data\` 静态文件提供 | 无后端也能部署；构建时随 dist 发布 |
| 中文译本文本去空格 | 素材库分词排版（"起初， 神 創造…"）不适合阅读展示；按 lang 前缀 `zh` 判断，英文等语言保留空格 |
| build-data 每次清空 `translations` 输出目录 | Windows 文件系统大小写不敏感，key 大小写曾变化（ChiUn→chiun）会残留旧目录名，导致 vite 的 public 文件集合（大小写敏感匹配）失效（详见 DATA.md 故障记录） |
