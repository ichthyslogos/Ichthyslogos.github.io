# FISH · 读经研究平台

面向中文读经者的轻量研究网站（Bible Research Platform）。Vue 3 + Vite，纯前端静态站，无后端依赖。

> 本文件是项目根目录文档，是后人开发的第一入口。更详细的内容见 [`docs/`](docs/README.md) 索引。

## 快速开始

```bash
npm install        # 安装依赖（首次）
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建，输出 dist/
npm run data       # 数据流水线：素材 → 网站数据库 → 前端数据（详见 docs/DATA.md）
```

## 目录总览

```
site\
├── README.md              ← 本文档
├── docs\                  ← 文档（架构/数据/开发/结构，见下方索引）
├── scripts\               ← 数据流水线脚本（Node 零依赖）
│   ├── bible-books.mjs      标准 66 卷 + 7 卷次经元数据（编号唯一权威）
│   ├── import.mjs           素材库 → data-src\brp\translations\
│   └── build-data.mjs       data-src → public\data\brp\（切片 + manifest）
├── data-src\              ← 网站"数据库"（素材投影，可移植、可扩展）
│   └── brp\translations\    译本 JSON（符合统一格式即可放入）
├── public\data\           ← 运行时数据（构建产物，勿手改）
│   └── brp\
│       ├── manifest.json     译本清单（"放入即自动显示"的核心）
│       └── translations\…    按书卷切片
└── src\
    ├── main.js / App.vue / style.css / router\ / lib\
    ├── views\             ← 子页面（每页一个文件夹）
    │   ├── Home.vue         首页
    │   └── brp\             读经研究平台（第一个功能）
    └── components\        ← 组件（共享组件在根目录，子页面组件按子页面建文件夹）
        ├── AppHeader.vue    共享
        ├── EmptyState.vue   共享
        └── brp\             读经研究子组件
```

## 素材隔离

素材（圣经译本、马太亨利译注等）存放在 `D:\Eyphka\fish\` 素材根目录，与网站 `site\` 同级并列。**网站构建只依赖 `data-src\`（素材投影），不直接读取素材库**；素材库任何改动不影响网站运行。详见 `docs/ARCHITECTURE.md`。

## 部署约定

**部署只能手动，不会自动进行**：日常代码修改只 `git commit`（不推送、不部署）；只有明确要求"部署/上线"时才执行（手动 Run workflow 或手动构建推送）。详见 `docs/DEPLOY.md`。

## 当前功能状态

| 功能 | 状态 | 说明 |
|---|---|---|
| 首页 Homepage | ✅ 已上线 | 品牌 + 功能卡片 + 数据统计（manifest 驱动） |
| 读经研究平台 (brp) | ✅ 已上线 | 书卷/章节导航、多译本切换、次经支持；路由 `/brp` |
| 马太亨利译注（解经面板） | ✅ 已接入 | 经文右侧常驻解经面板，多注释源架构（当前源：马太亨利中文译注 60+ 卷，见 docs/COMMENTARY.md） |
| 护教问答 | ✅ 已上线 | 回应当今世界对基督教信仰的挑战（探索视图：Hero/搜索/主题网格；主题视图：质疑→多回应→证据→相关学习，经文可跳读经研究）；路由 `/apologetics` |
| Strong 原文研究 | 🚧 占位 | 原文/译本数据流隔离架构已预留（manifest original 字段） |

## 文档索引

| 文档 | 内容 |
|---|---|
| [`docs/README.md`](docs/README.md) | 文档导航 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 架构设计：素材隔离、数据流、按子页面组织约定 |
| [`docs/DATA.md`](docs/DATA.md) | 数据流水线：新增译本"放入即显示"步骤、原文/译本隔离、马太亨利接入方案 |
| [`docs/COMMENTARY.md`](docs/COMMENTARY.md) | 注释系统：多源架构、马太亨利转换管线、已知问题 |
| [`docs/APOLOGETICS.md`](docs/APOLOGETICS.md) | 护教页面：使用说明 + 数据编辑指南（三层结构、新增内容示例） |
| [`docs/DEVELOP.md`](docs/DEVELOP.md) | 开发规范：新增子页面四步、代码约定 |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | 部署指南：GitHub Pages 两种部署方式、本地验证、常见问题 |
| [`docs/STRUCTURE.md`](docs/STRUCTURE.md) | 目录结构详解：每个目录/关键文件的职责 |
