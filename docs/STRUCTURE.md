# 目录结构详解（STRUCTURE）

逐个说明 FISH 平台每个目录与关键文件的职责，供快速定位代码。

```
D:\Eyphka\fish\site\
├── README.md                     项目根文档：目录总览、快速开始、文档索引（开发第一入口）
│
├── docs\                         全部文档（不限数量，按主题拆分）
│   ├── README.md                   文档导航
│   ├── ARCHITECTURE.md             架构：四层数据流、按子页面组织、决策记录
│   ├── DATA.md                     数据流水线、新增译本流程、Strong/马太亨利接入方案、故障记录
│   ├── DEVELOP.md                  新增子页面四步、代码约定、组件通信模式
│   └── STRUCTURE.md                本文档
│
├── scripts\                      数据流水线脚本（Node ESM，零第三方依赖；注释提取为 Python）
│   ├── bible-books.mjs             书卷元数据唯一权威：66 卷 + 7 卷次经（id/zh/en/srcName/group）
│   ├── import.mjs                  素材库 → data-src\brp\translations\（复制）
│   ├── build-data.mjs              data-src → public\data\brp\（校验、去空格净化、按卷切片、manifest；含注释切片）
│   ├── commentary\
│   │   └── extract.py              马太亨利注释提取（pypdf，详见 docs/COMMENTARY.md）
│   └── serve-dist.mjs              本地模拟静态托管（子路径验证，见 docs/DEPLOY.md）
│
├── data-src\                     网站"数据库"：素材投影，可移植；新增译本/注释源放这里
│   └── brp\
│       ├── translations\
│       │   ├── ChiUn.json          和合本（繁体）
│       │   └── ChiSB.json          思高本（含 7 卷次经）
│       └── commentary\
│           └── matthew-henry\      第一个注释源（马太亨利圣经注释）
│               ├── 01.json …       按卷注释（bookId 对齐 bible-books）
│               └── _report.json    转换报告（状态/章节自检）
│
├── public\                        vite 静态目录：内容原样复制到 dist\
│   └── data\
│       └── brp\                    brp 子页面运行时数据（构建产物，勿手改）
│           ├── manifest.json         译本清单（前端一切数据驱动的起点）
│           ├── translations\
│           │   ├── chiun\books\01.json … 66 卷切片
│           │   └── chisb\books\01.json … 73 卷切片
│           └── commentary\           注释数据（多注释源）
│               ├── manifest.json      注释源清单
│               └── matthew-henry\01.json … 按卷注释
│           └── apologetics\          护教子数据库（content.meta.json 元数据/顺序 + topics\：主题 → 分类 → 子命题三级目录，子命题为最基层——每子命题一个 question.json 含完整内容）
│
├── src\
│   ├── main.js                    入口：createApp + router + 全局样式
│   ├── App.vue                    根组件：AppHeader + router-view 布局
│   ├── style.css                  全局样式变量与基础样式（无 UI 库）
│   ├── router\
│   │   └── index.js               路由（hash 模式）：/、/brp、/brp/:bookId/:chapter、/apologetics
│   ├── lib\
│   │   └── data.js                数据访问层：fetchManifest/fetchBook/缓存、默认译本偏好、书卷解析、分组名、fetchApologetics
│   ├── views\
│   │   ├── Home.vue               首页：品牌 hero、护教入口、页脚说明
│   │   ├── brp\
│   │   │   └── BrpPage.vue        读经研究平台页：全部状态 + 布局 + 数据加载
│   │   └── apologetics\
│   │       └── ApologeticsPage.vue 护教页：探索视图（Hero + 搜索 + 主题卡片网格 + 相关问题直达）与主题视图（质疑 → 多回应 → 证据面板 → 相关学习；两栏），移动端两段式；色板灰黑/米白/金棕
│   └── components\
│       ├── AppHeader.vue          共享：顶栏品牌与导航（components 根目录）
│       ├── EmptyState.vue         共享：空状态占位（占位功能复用）
│       └── brp\                   子页面组件文件夹
│           ├── BookSidebar.vue       书卷列表（manifest 驱动，新旧约+次经分组）
│           ├── ChapterTabs.vue       章节导航（自动滚动到当前章）
│           ├── ScripturePanel.vue    经文面板：标题、译本切换（展开式下拉）、经文列表
│           ├── TranslationMenu.vue   展开式译本选择器（分组：译本/原文；列表过长时内部滚动）
│           ├── VerseItem.vue         单节经文（串珠 🔗 展开/跳转；和合本简体下逐词 Strong 码上标渲染）
│           └── CommentaryPanel.vue  解经面板（常驻经文右侧；多注释源渲染：来源标识+概要+小节注释，无注释显示空状态）
│       └── apologetics\             护教子页面组件文件夹
│           ├── SearchBar.vue           搜索框（关键词/问题/分类搜索）
│           ├── TopicCard.vue           主题卡片（中英标题/描述/子问题数/领域标签）
│           ├── QuestionCard.vue        子问题列表项（序号/问题/回应数，激活灰黑底）
│           ├── ResponseCard.vue        回应卡片（中英标题/视角徽章/核心思想/正文 + 证据面板）
│           ├── EvidencePanel.vue       证据面板（圣经/哲学/历史/科学/神学/伦理/文献分类展示）
│           └── ScriptureReference.vue  经文引用（解析「书卷 章:节」跳转读经研究 /brp）
│
├── package.json                  脚本入口：dev/build/preview/data（数据流水线）
├── vite.config.js                vite 配置（vue 插件，base: './'）
├── index.html                    HTML 入口
└── node_modules\                 依赖（勿入库）
```

## 常见定位速查

| 想找什么 | 看哪里 |
|---|---|
| 网站首页 | `src\views\Home.vue` |
| 读经页面整体逻辑 | `src\views\brp\BrpPage.vue` |
| 护教页面 | `src\views\apologetics\ApologeticsPage.vue` + `data-src\apologetics\content.json` |
| 书卷编号表 | `scripts\bible-books.mjs` |
| 新增译本 | `data-src\brp\translations\` + `npm run data` |
| 译本清单/数据加载 | `src\lib\data.js`、`public\data\brp\manifest.json` |
| 解经占位与未来接口 | `src\components\brp\CommentaryPanel.vue` |
| 添加路由 | `src\router\index.js` |
| 全局配色/字体 | `src\style.css`（CSS 变量） |
| 目录之外 | 素材库 `D:\Eyphka\fish\` 下：`bible_databases\`、`马太亨利译注\`、`bible-cross-references-1.0\`（均只读） |
