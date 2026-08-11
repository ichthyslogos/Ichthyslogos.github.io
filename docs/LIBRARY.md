# 图书馆（LIBRARY）使用与维护指南

图书馆子页（`/#/library`）用于存放与展示**经典文献资料**：注释书、教父著作、神学论著、圣乐音频等（多格式：PDF / EPUB / 音频 / 图片）。

## 1. 架构：主站索引 + 多书籍仓库

上百 GB 的书籍文件**不进主站仓库**，按类别存放在独立 GitHub 仓库，主站只存书目元数据索引：

```
主站仓库（Ichthyslogos.github.io，现有）
  └─ public/data/library/       书目索引（KB 级元数据，入库 + 部署）
       ├── content.json         分类 + 书目轻量索引（书架/搜索用）
       └── books/<id>.json      书目详情（含文件直链清单）
书籍仓库（library-books-<类别>，多个）
  └─ 书籍文件（PDF/EPUB/音频/图片），每仓开 GitHub Pages
     访问 URL：https://ichthyslogos.github.io/<书籍仓库名>/<路径>
```

前端直接加载书籍仓库 Pages 直链（预览/下载），主站与书籍仓库完全解耦：新增书籍 = 传文件到书籍仓库 + 填一条索引。

## 2. 存储约束（GitHub 平台限制）

| 限制 | 数值 | 应对 |
|---|---|---|
| Git 单文件硬限制 | **100MB** | 书籍文件切分 ≤100MB（或不用 Git，另议）；超大扫描件需切分 |
| Pages 单仓库容量 | 约 1GB | 书籍仓库**按类别拆分**，每仓 ≤1GB，多仓横向扩展 |
| 免费 LFS 配额 | 1GB 存储/月 | 不适合上百 GB，不采用；按 ≤100MB/文件设计 |
| raw 直链限速 | 60 次/时/IP | 访问一律走 **Pages 直链**（无速率限制） |
| 版权 | — | 仅收录**公有领域/可公开分发**资料；受限书籍不进公开仓库 |

## 3. 收录一本书（两步）

### 3.1 传文件到书籍仓库

```bash
# 建仓（一次）：GitHub 网页建 library-books-<类别> → Settings → Pages → Deploy from branch (main)
git clone git@github.com:ichthyslogos/library-books-commentaries.git
cp /path/to/book.pdf library-books-commentaries/马太亨利/
git add -A && git commit -m "add: 马太亨利创世记注释 PDF" && git push
# 文件即通过 https://ichthyslogos.github.io/library-books-commentaries/马太亨利/xxx.pdf 访问
```

### 3.2 填书目索引（主站）

1. 在 `data-src/library/books/` 新建 `<id>.json`（参考 `_template.json` 与现有示例 `mh-genesis-1-20.json`；`_` 前缀文件跳过构建）
2. 分类 id 必须是 `data-src/library/categories.json` 已登记值；`content.meta.json` 的 categories 数组决定分类顺序
3. 运行 `npm run data` → 生成 `public/data/library/` 切片
4. `npm run build` 本地验证 → 提交 → 部署（手动 workflow_dispatch）

示例书目 `mh-genesis-1-20`（马太亨利创世记 PDF）暂存于主站 `public/data/library/files/` 供链路验证；正式书籍一律走书籍仓库。

## 4. 数据格式

**索引条目**（`content.json` 的 books[]，轻量）：

```json
{ "id": "mh-genesis-1-20", "category": "commentaries", "title": "…",
  "author": "…", "lang": "zh", "year": "", "tags": [], "cover": "",
  "fileCount": 1, "formats": ["pdf"], "searchText": "…" }
```

**书目详情**（`books/<id>.json`）：

```json
{ "id": "…", "category": "…", "title": "…", "author": "…", "lang": "zh",
  "year": "", "description": "简介", "tags": [], "cover": "封面 URL（可空）",
  "files": [ { "title": "文件说明", "format": "pdf", "size": 1782579,
               "url": "https://ichthyslogos.github.io/library-books-<类别>/路径/文件.pdf" } ] }
```

- `format` 取值：`pdf` / `epub` / `audio` / `image`（决定预览方式）
- `files[]` 可多个（如 PDF + EPUB 两个版本，各显示预览/下载按钮）
- `cover` 封面图 URL 可空（空时显示书名首字占位）

## 5. 前端接入点

- 路由：`/#/library`（书架）、`/#/library/:bookId`（详情，URL 可分享）
- `src/views/library/LibraryPage.vue`：书架（分类筛选/搜索/卡片网格）↔ 详情两态
- `src/components/library/`：`BookCard`（卡片）、`BookDetail`（详情+文件清单）、`ReaderPanel`（预览分发：PDF=iframe 原生、EPUB=epub.js 懒加载、audio/image 原生）
- `src/lib/data.js`：`fetchLibraryIndex()` / `fetchLibraryBook(id)`（复用 fetchJson 缓存）
- 构建：`scripts/build-data.mjs` 的 `buildLibrary()`（仿 buildApologetics 两段式）

## 6. 已知限制

- EPUB 预览依赖 epubjs（懒加载 chunk）；书籍仓库 Pages 需支持 range 请求（GitHub Pages 原生支持）
- 移动端书架分类为顶部横滑 chips；预览区高度 min(72vh, 40rem)
- 音频/图片格式需浏览器原生支持（mp3/wav；jpg/png/webp）
