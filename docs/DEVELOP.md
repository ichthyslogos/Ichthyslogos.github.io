# 开发规范（DEVELOP）

本文档说明如何开发新功能、如何遵守代码约定。新增一个子页面（功能）的完整流程如下。

## 1. 新增子页面四步

以新增子页面 `xxx`（如未来的"原文词典"）为例：

### 第 1 步：视图

```
src\views\xxx\XxxPage.vue     # 页面级组件（kebab-case 文件夹，PascalCase 页面名）
```

页面持有该页状态，子组件通过 props/events 与之通信，**状态不与路由以外的全局共享**。

### 第 2 步：组件

```
src\components\xxx\
├── AComponent.vue
└── BComponent.vue
```

- **子页面组件必须建文件夹**：`src\components\<子页面名>\`
- **共享组件放根目录**：`src\components\AppHeader.vue`、`EmptyState.vue` 等直接放 `src\components\`，**不建 common/shared 文件夹**
- 组件命名：文件夹内短名即可（如 `BookSidebar.vue`），不重复前缀

### 第 3 步：数据

```
data-src\xxx\…                  # 该页源数据（素材投影）
public\data\xxx\…               # 该页运行时数据 + manifest
```

- 运行时数据放 `public\data\<子页面名>\`（构建产物，勿手改）
- 数据访问逻辑放 `src\lib\data.js`（或该页专属模块放 `src\lib\` 根目录）
- 若数据从素材生成：在 `scripts\` 增加生成脚本，并挂到 `package.json` 的 `data:*` scripts

### 第 4 步：路由

在 `src\router\index.js` 注册：

```js
{ path: '/xxx', name: 'xxx', component: XxxPage },
```

路由地址（kebab-case）与 views/components/data 目录同名。首页功能卡片（`src\views\Home.vue` 的 `features` 数组）同步登记。

## 2. 代码约定

| 主题 | 约定 |
|---|---|
| 语言 | 纯 JavaScript（无 TypeScript），Vue 3 `<script setup>` 组合式 API |
| 样式 | 手写 scoped CSS，无 UI 库；全局变量见 `src\style.css`（--accent 等）；滚动条已全局统一处理（style.css 样式 + `src\lib\scrollbars.js` 驱动：默认隐藏、滚动时淡入、停止后自动淡出），勿在各组件内另写 |
| 状态 | URL 为唯一状态源（hash 路由 + query）；组件内 `ref/computed`，跨组件用 props/events |
| 数据访问 | 统一走 `src\lib\data.js`（fetch + 缓存），禁止组件内散落 fetch |
| 文案 | 界面中文，代码注释中文，命名英文 |
| 书卷编号 | 一律使用 `scripts\bible-books.mjs` 的 01–66 / ext-N 体系，禁止另起编号 |

## 3. 组件通信模式（brp 参考）

```
BrpPage（持有 manifest/bookData/panelOpen 等全部状态）
 ├─ BookSidebar      props: translation, activeBookId      emit: select-book
 ├─ ChapterTabs      props: chapterCount, current          emit: select-chapter
 ├─ ScripturePanel   props: book, chapter, verses, …       emit: change-translation / toggle-commentary
 │    └─ VerseItem   props: verse, text, lang              （预留 annotations 插槽）
 └─ CommentaryPanel  props: open, book, chapter            emit: toggle
```

- 页面 → 子组件：props 单向
- 子组件 → 页面：`emit` 事件，由页面统一执行 `router.push`（保证 URL 同步）

## 4. 测试与验证

```bash
npm run data     # 数据变更后重建
npm run dev      # 开发调试
npm run build    # 生产构建（构建前数据必须已生成）
```

> **部署约定**：部署只能手动（见 docs/DEPLOY.md）——日常修改只 commit 不推送；只有明确要求"部署/上线"时才推送并手动触发部署。**不要在无明确要求时自行部署**。

冒烟清单（brp）：默认进创世记第 1 章（和合本）→ 章节/书卷切换 URL 同步 → 译本下拉展开/选择/收起（原文与译本分组）→ 侧栏与经文正文独立滚动、页面本体不滚动 → 次经仅思高本可见 → 解经面板常驻右侧、开关按钮可收起/展开。
