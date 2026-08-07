# 护教页面（APOLOGETICS）使用与维护指南

护教页用于**回应社会对基督教的常见质疑**，帮助人理解基督信仰为何具有合理性（不是"赢得辩论"，而是"帮助人理解"）。页面完全数据驱动：所有内容都来自一个 JSON 文件，**编辑数据即可改内容，不需要碰代码**。

- 路由：`/#/apologetics`（导航栏"护教"入口）
- 数据：`data-src/apologetics/content.json`（源数据，唯一需要编辑的文件）
- 页面：`src/views/apologetics/ApologeticsPage.vue` + `src/components/apologetics/`（6 个组件）

---

## 一、页面使用说明（面向读者）

### 1. 探索视图（进入页面看到的第一屏）

```
┌────────────────────────────────────────────┐
│  Hero：大标题 + 副题 + 数据统计 + 开始探索按钮  │
│  ───────────────────────────────────────── │
│  搜索框（关键词 / 问题 / 分类搜索）            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 神存在吗？│ │ 科学与信仰│ │ 苦难为什么│ …  │   ← 主题卡片
│  └─────────┘ └─────────┘ └─────────┘      │
└────────────────────────────────────────────┘
```

- **主题卡片**显示：问题（中英双语）、一句话描述、子问题数量、领域标签（哲学/科学/神学…）。
- **搜索**：输入关键词（如"复活""苦难"）后，卡片列表实时过滤；下方"相关问题"区列出命中的子问题，点击可直达该问题详情。
- 点击"开始探索"或任意主题卡片进入主题视图。

### 2. 主题视图（阅读主界面）

```
← 全部主题
神存在吗？  Does God Exist?      ← 主题头（中英标题 + 描述 + 标签）
────────────────────────────────────────────
| 相关问题        |  如果上帝慈爱又全能，为什么允许世上有苦难和邪恶？
| 01 宇宙为什么…  |  质疑：全善、全能、苦难存在，三者不可能同时成立…
| 02 生命是设计…  |  ─────────────────────────────
| 03 没有神，道德…|  回应 · 2 个观点
                  |  ┌──────────────────────────────┐
                  |  │ 自由意志回应  Free Will Defense│
                  |  │ 哲学视角 · 哲学/神学           │
                  |  │ 核心思想：爱必须建立在自由选择上 │
                  |  │ 正文（完整回应）                │
                  |  │ ┌ 证据支持 ─────────────────┐ │
                  |  │ │ 📖 圣经 申命记 30:19 … 读经→│ │
                  |  │ │ 📚 哲学 自由意志辩护 …     │ │
                  |  │ └──────────────────────────┘ │
                  |  └──────────────────────────────┘
                  |  继续探索（同主题其他问题 + 进入读经研究）
```

- 左侧列表点击切换子问题，右侧即时更新。
- **质疑卡**（米白底）：该问题最有力的反对意见。
- **回应卡**：一个问题可有多个回应（不同视角/论证），自上而下全部展开，方便对照。
- **证据面板**：每个回应下方列出支撑证据，按类别分区（📖圣经 / 📚哲学 / 🏛️历史 / 🔬科学 / ✝️神学 / ⚖️伦理 / 📜文献）。
- **圣经引用可直接跳转读经研究**：点击"申命记 30:19 … 读经 →"即跳转 `/brp/05/30` 对应章节。
- **相关学习**：页面底部列出同主题其他问题 + "进入读经研究"入口，与 BRP 系统衔接。

### 3. 移动端

- 探索视图：卡片单列排列。
- 主题视图：两段式——先见问题列表，点问题进入详情（"← 全部问题"返回），避免大量文字堆叠。

---

## 二、数据编辑指南（面向开发者）

### 1. 数据流水线

```
data-src/apologetics/content.json   ← 唯一编辑入口（源数据）
        │  npm run data（scripts/build-data.mjs 的 buildApologetics()）
        ▼
public/data/apologetics/content.json  ← 运行时数据（构建产物，勿手改）
        │  前端 fetchApologetics()（src/lib/data.js，带缓存）
        ▼
        护教页面渲染
```

- **改数据只动 `data-src/apologetics/content.json`**，然后运行 `npm run data` 再 `npm run dev` 预览。
- `public/data/apologetics/` 是构建产物，提交仓库（部署 CI 依赖），但**不要手改**——改了也会被 `npm run data` 覆盖。

### 2. 数据结构（三层）

```
content.json
└── topics[]                    主题（一级：一类质疑，如"苦难为什么存在？"）
    ├── id                      唯一标识（英文 slug，如 suffering）
    ├── title { zh, en }        主题标题（中文 / 英文，卡片双语显示）
    ├── description             一句话描述（卡片 + 主题头显示）
    ├── tags[]                  领域标签（卡片与主题头显示）
    └── sub_questions[]         子问题（二级：该主题下的具体问题）
        ├── id                  唯一标识（英文 slug）
        ├── question            问题全文（列表与详情标题）
        ├── objection           质疑陈述（该问题最强反对意见，显示在米白"质疑"卡）
        └── responses[]         回应（三级：同一问题的多个回答，自上而下全部展开）
            ├── id              唯一标识
            ├── title { zh, en }回应标题（中英双语，如"自由意志回应 / Free Will Defense"）
            ├── perspective     视角徽章（可选，如"哲学视角"）
            ├── tags[]          支持领域（可选，如 哲学、神学）
            ├── summary         核心思想（一句话，斜体显示）
            ├── text            回应正文（完整论述，支持换行）
            └── evidence        证据面板（可选，见下）
                ├── bible[]        圣经经文
                ├── philosophy[]   哲学著作/论证
                ├── history[]      历史事件/史料
                ├── science[]      科学事实
                ├── theology[]     神学观点
                ├── ethics[]       伦理依据
                └── literature[]   文献学证据
                （每项 { "ref": "引用名/出处", "note": "一句话说明" }）
```

### 3. 新增一条回应的完整示例

在 `content.json` 中找到目标子问题（如 `suffering → evil`），在 `responses` 数组末尾追加：

```json
{
  "id": "eternal-perspective",
  "title": { "zh": "末世盼望回应", "en": "Eschatological Hope" },
  "perspective": "神学视角",
  "tags": ["神学"],
  "summary": "今生的苦难不是终局，上帝应许将一切更新。",
  "text": "圣经不把苦难看作故事的全部……（正文 150–300 字为宜）",
  "evidence": {
    "bible": [
      { "ref": "启示录 21:4", "note": "神要擦去他们一切的眼泪。" },
      { "ref": "罗马书 8:18", "note": "现在的苦楚不足介意。" }
    ]
  }
}
```

保存后执行 `npm run data`，刷新页面即可看到：左列表该问题"回应"计数 +1，详情区多一张回应卡。

### 4. 新增一个子问题

在目标主题的 `sub_questions` 数组末尾追加（`objection` 必填——它驱动详情页的"质疑"卡；`responses` 至少 1 条，否则页面显示"回答整理中"空状态）：

```json
{
  "id": "why-hide-god",
  "question": "如果上帝存在，为什么看不到他？",
  "objection": "看不见、摸不着的东西就等同于不存在。",
  "responses": [ { … 至少一条回应 … } ]
}
```

### 5. 新增一个主题

在 `topics` 数组末尾追加（`sub_questions` 至少 1 个）：

```json
{
  "id": "evil-and-free-will",
  "title": { "zh": "自由意志与邪恶", "en": "Evil and Free Will" },
  "description": "自由意志、预定与邪恶来源的讨论。",
  "tags": ["神学", "哲学"],
  "sub_questions": [ { … } ]
}
```

探索视图的卡片网格会自动显示（数据驱动，无需改代码）。卡片数量多时自动换行（桌面 3 列 / 窄屏 2 列 / 移动端 1 列）。

### 6. 编辑注意事项

| 事项 | 说明 |
|---|---|
| 字段必须完整 | 顶层 `source`、每个主题的 `id/title/description/tags`、子问题的 `id/question/objection/responses`、回应的 `id/title/text` 缺一不可（页面有防御性回退，但缺字段会显示不全） |
| `id` 全局唯一 | 主题与子问题、回应的 id 各自域内唯一即可；一旦上线被引用（收藏/分享/搜索直达），不要随意改名 |
| 引号 | 内容中的引号请使用中文引号「"…"」，**不要用英文双引号**（会破坏 JSON 结构） |
| JSON 合法性 | 编辑后先 `node -e "JSON.parse(require('fs').readFileSync('data-src/apologetics/content.json','utf8'))"` 或直接 `npm run data`（解析失败会报错） |
| 标签枚举 | `tags` 建议从「哲学/神学/科学/历史/圣经/文献/考古/伦理/牧养/实践/文化/解经」中选取，证据类别固定为 `bible/philosophy/history/science/theology/ethics/literature` 七种 key（多了不会显示） |
| 经文格式 | `bible` 的 `ref` 必须形如"书卷名 章:节"（如"创世记 1:1"），ScriptureReference 会解析书卷名并生成读经跳转；书卷名不在 66 卷映射表内则只显示文本、无跳转 |

---

## 三、前端结构与扩展约定

```
src/views/apologetics/ApologeticsPage.vue   页面：持有全部状态（view/activeTopic/搜索词/移动端视图）
src/components/apologetics/
├── SearchBar.vue            搜索框（v-model 受控，父级持有 query）
├── TopicCard.vue            主题卡片（props: topic；emit: select）
├── QuestionCard.vue         子问题列表项（props: q/active/index；emit: select）
├── ResponseCard.vue         回应卡（props: r；内含 EvidencePanel）
├── EvidencePanel.vue        证据面板（props: evidence；按类别分区渲染）
└── ScriptureReference.vue   经文引用（解析「书卷 章:节」→ /brp/{id}/{章}，内置 66 卷映射表）
```

- **状态流**：页面持有全部状态（`view`/`activeTopicId`/`activeSQId`/`query`/`mobileView`），子组件 props 只读 + emit 上抛，与 brp 模式一致。
- **配色**（页面级 CSS 变量，定义在 ApologeticsPage 的 `<style>` 中）：`--p: #1F2937`（灰黑，标题/激活）、`--sec: #F8F5EF`（米白，Hero/面板底）、`--acc: #8B7355`（金棕，标签/强调）、`--line: #EAE5DB`（分隔线）。改配色只需改这几处变量。
- **新增证据类别**：在 `EvidencePanel.vue` 的 `CATS` 数组加一项（key/label/icon）即可，`visibleCats` computed 会自动过滤空类别。

### 已踩过的坑（修改时避免重犯）

1. **`v-if` 与 `v-for` 不要放同一元素**：v-if 优先级高于 v-for，条件里引用 v-for 变量会得到 `undefined`（曾导致整个页面渲染中断）。用 computed 过滤代替。
2. **不要用 `#锚点` 做页内跳转**：本站是 hash 路由，`href="#topics"` 会把路由改成不存在的 `/topics` 导致空白页。页内滚动用 `@click.prevent` + `scrollIntoView`。
3. **页面滚动容器是 `.app-main`**（`overflow-y: auto`），`window.scrollTo` 无效；视图切换回顶部要用 `document.querySelector('.app-main').scrollTo(0, 0)`（页面内已封装为 `scrollMainTop()`）。

---

## 四、验证步骤（每次改完必做）

```bash
npm run data     # 1. 数据解析 + 生成运行时数据（JSON 语法错误会在此暴露）
npm run dev      # 2. 本地预览
npm run build    # 3. 生产构建（提交前确认能通过）
```

冒烟清单：

- [ ] 探索视图：Hero 统计数字正确（N 主题 · N 问题 · N 回应）、主题卡片数量与 `topics` 一致
- [ ] 搜索：关键词能过滤卡片并列出"相关问题"直达
- [ ] 主题视图：左列表子问题数量与"回应 · N 个观点"正确
- [ ] 回应卡：标题/视角徽章/核心思想/正文/证据面板齐全
- [ ] 圣经引用：点击跳转 `/brp/{卷}/{章}` 对应章节
- [ ] 移动端（≤900px）：主题视图两段式（列表 ↔ 详情）切换正常
- [ ] 无横向溢出（`document.documentElement.scrollWidth` 不超过视口宽）

> **部署约定**：日常修改只 `git commit` 不推送；只有明确要求"部署/上线"时才推送并手动触发部署（见 docs/DEPLOY.md）。
