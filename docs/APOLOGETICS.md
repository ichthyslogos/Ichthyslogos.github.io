# 护教页面（APOLOGETICS）使用与维护指南

护教页用于**回应社会对基督教的常见质疑**，帮助人理解基督信仰为何具有合理性（不是"赢得辩论"，而是"帮助人理解"）。页面完全数据驱动：所有内容都来自 `data-src/apologetics/topics/` 子数据库，**编辑数据即可改内容，不需要碰代码**。

- 路由：`/#/apologetics`（导航栏"护教"入口）
- 数据：`data-src/apologetics/topics/`（子数据库：按主题分目录，**子命题为最基层**）
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

- **主题卡片**显示：问题（中英双语）、一句话描述、子命题数量、领域标签（哲学/科学/神学…）。
- **搜索**：输入关键词（如"复活""苦难"）后，卡片列表实时过滤；下方"相关问题"区列出命中的子命题，点击可直达。
- 点击"开始探索"或任意主题卡片进入主题视图。

### 2. 主题视图（阅读主界面）

```
← 全部主题
科学与信仰  Science and Faith        ← 主题头（中英标题 + 描述 + 标签）
────────────────────────────────────────────
| 子命题列表       |  科学与基督教信仰真的是水火不容的吗？
| 01 科学与基督教…|  质疑：科学基于事实与实证，信仰只是主观臆测…
| 02 进化论与创造…|  ┌──────────────────────────────┐
|                 |  │ 并非水火不容  Not Irreconcilable│
|                 |  │ 历史学视角 · 历史/科学          │
|                 |  │ 核心思想：哥白尼伽利略事件考辨…   │
|                 |  │ 正文（完整内容）                │
|                 |  │ ┌ 证据支持 ─────────────────┐ │
|                 |  │ │ 📖 圣经 创世记 1:24 … 读经→│ │
|                 |  │ │ 🏛 历史 伽利略事件 …       │ │
|                 |  │ └──────────────────────────┘ │
|                 |  └──────────────────────────────┘
|                 |  继续探索（同主题其他子命题 + 进入读经研究）
```

- 左侧列表点击切换子命题，右侧即时更新。
- **质疑卡**（米白底）：该子命题最强有力的反对意见。
- **内容卡**：子命题即最基层内容——标题（中英）+ 视角徽章 + 核心思想 + 正文 + 证据面板。
- **证据面板**：支撑证据按类别分区（📖圣经 / 📚哲学 / 🏛️历史 / 🔬科学 / ✝️神学 / ⚖️伦理 / 📜文献）。
- **圣经引用可直接跳转读经研究**：点击"创世记 1:24 … 读经 →"即跳转 `/brp/01/1` 对应章节。
- **相关学习**：页面底部列出同主题其他子命题 + "进入读经研究"入口，与 BRP 系统衔接。

### 3. 移动端

- 探索视图：卡片单列排列。
- 主题视图：两段式——先见子命题列表，点子命题进入详情（"← 全部子命题"返回），避免大量文字堆叠。

---

## 二、数据编辑指南（面向开发者）

### 1. 数据流水线（两层子数据库结构）

护教数据是**按主题分目录、子命题为最基层**的子数据库——每个子命题一个 `question.json`，内含完整内容（问题 + 质疑 + 标题 + 正文 + 证据）：

```
data-src/apologetics/
├── content.meta.json                站点元数据（source + 主题顺序列表）
└── topics/                          主题子数据库
    ├── <topicId>/topic.json         主题元数据（含子命题顺序列表）
    └── <topicId>/<sqId>/question.json   子命题 ★（最基层，完整内容）

        │  npm run data（scripts/build-data.mjs 的 buildApologetics()：目录扫描组装）
        ▼
public/data/apologetics/
├── content.json                     索引（主题元数据 + 子命题轻量搜索文本，不含正文）
└── topics/<topicId>.json            主题切片（完整数据，前端按需加载 + 缓存）
        │  前端：fetchApologetics() 加载索引（探索/搜索）
        │        fetchApologeticsTopic(topicId) 按需加载主题切片（进入主题时才请求）
        ▼
        护教页面渲染
```

- **改数据只动 `data-src/apologetics/topics/`**，然后运行 `npm run data` 再 `npm run dev` 预览。
- `public/data/apologetics/` 是构建产物，提交仓库（部署 CI 依赖），但**不要手改**——改了也会被 `npm run data` 覆盖。
- **顺序约定**：主题顺序在 `content.meta.json` 的 `topics` 列表中显式声明；子命题顺序在 `topic.json` 的 `sub_questions` 中声明（目录扫描是字母序，顺序一律以列表为准）。

### 2. 目录结构与字段说明

```
data-src/apologetics/topics/suffering/          ← 主题目录（一级：一类质疑）
├── topic.json                                  ← 主题元数据
│     { id, title{zh,en}, description, tags[],
│       sub_questions: ["evil", "natural-disaster", "prayer"] }   ← 子命题顺序
└── evil/                                       ← 子命题目录（二级：最基层）
      └── question.json                         ← 子命题完整内容 ★
            { id, question, objection,
              title{zh,en}, perspective, tags[],
              summary, text, evidence }
```

| 文件 | 字段 | 说明 |
|---|---|---|
| `topic.json` | `id` | 唯一标识，**必须与目录名一致**（构建时校验，不一致会报错） |
| | `title { zh, en }` | 主题标题（中英双语，卡片显示） |
| | `description` | 一句话描述（卡片 + 主题头显示） |
| | `tags[]` | 领域标签（卡片与主题头显示） |
| | `sub_questions[]` | 子命题 id 列表（**顺序 + 完整性**：列表中的 id 必须有对应目录，未登记的目录会被忽略） |
| `question.json` | `id` | 唯一标识，与目录名一致 |
| | `question` | 子命题问题全文（列表与详情标题） |
| | `objection` | 质疑陈述（该问题最强反对意见，显示在米白"质疑"卡） |
| | `title { zh, en }` | 内容标题（中英双语，如"并非水火不容 / Not Irreconcilable"） |
| | `perspective` | 视角徽章（可选，如"历史学视角"） |
| | `tags[]` | 领域标签（可选） |
| | `summary` | 核心思想（一句话，斜体显示；**同时进入搜索索引**） |
| | `text` | 正文（完整论述，支持换行） |
| | `evidence` | 证据面板（可选）：`bible[] / philosophy[] / history[] / science[] / theology[] / ethics[] / literature[]`，每项 `{ "ref": "引用名/出处", "note": "一句话说明" }` |

> 运行时（前端）看到的结构不变：索引 `content.json` 的 `topics[]` 含 `sqCount / questions[{id, question, searchText}]`；主题切片 `<topicId>.json` 为 `{ id, title, description, tags, sub_questions[] }`（完整数据）。

### 3. 新增 / 编辑一个子命题

> **更省事的方式**：`data-src/apologetics/topics/_template/` 提供了可直接复制的模板（topic.json / question.json + `_README.md` 填写说明）。复制 → 改名 → 填写 → 登记顺序 → `npm run data`，三步完成。`_template` 不会被构建。

在目标主题下新建/编辑子命题目录（如 `data-src/apologetics/topics/suffering/evil/`）的 `question.json`：

```json
{
  "id": "evil",
  "question": "如果上帝慈爱又全能，为什么允许世上有苦难和邪恶？",
  "objection": ""全善、全能、苦难存在"三者不可能同时成立——这是无神论最有力的论证。",
  "title": { "zh": "自由意志回应", "en": "Free Will Defense" },
  "perspective": "哲学视角",
  "tags": ["哲学", "神学"],
  "summary": "爱必须建立在自由选择之上；邪恶是滥用自由意志的后果。",
  "text": "经典的"邪恶问题"可这样回应：第一，邪恶不是上帝创造的……（正文按需写足，建议三段式结构）",
  "evidence": {
    "bible": [
      { "ref": "启示录 21:4", "note": "神要擦去他们一切的眼泪。" },
      { "ref": "罗马书 8:18", "note": "现在的苦楚不足介意。" }
    ]
  }
}
```

然后把子命题 id 追加到 `topic.json` 的 `sub_questions` 列表末尾。保存后执行 `npm run data`，刷新页面即可看到：左列表多一项，详情区展示完整内容。

### 4. 新增一个主题

新建目录 `data-src/apologetics/topics/<新主题id>/`，内含 `topic.json`（`sub_questions` 至少 1 个）：

```json
{
  "id": "evil-and-free-will",
  "title": { "zh": "自由意志与邪恶", "en": "Evil and Free Will" },
  "description": "自由意志、预定与邪恶来源的讨论。",
  "tags": ["神学", "哲学"],
  "sub_questions": [ "…子命题id…" ]
}
```

以及对应的子命题目录（每目录一个 `question.json`）。最后把主题 id 追加到 `content.meta.json` 的 `topics` 列表（决定卡片顺序）。探索视图的卡片网格会自动显示（数据驱动，无需改代码）。卡片数量多时自动换行（桌面 3 列 / 窄屏 2 列 / 移动端 1 列）。

### 5. 写作规范（给内容编辑者）

| 要点 | 说明 |
|---|---|
| 立场 | 目标是"帮助人理解基督信仰为何具有合理性"，不是"赢得辩论"——尊重提问者，诚实面对，不回避、不嘲讽 |
| 结构 | 三段式：① 承认问题的合理性 / 区分概念（如"需要区分两种进化论"）；② 正面回应（论证、事实或经文）；③ 指向盼望、行动或邀请（十字架、证据、继续探索） |
| 篇幅 | 不设字数限制，以把问题讲清楚为准；`summary` 一句话；`title` 概括核心主张 |
| 语气 | 中文书面语，清晰平和；适度引用经文（全称"书卷 章:节"），可引哲学/历史/科学证据 |
| 视角徽章 | `perspective` 标明内容的论证立场（哲学视角 / 圣经视角 / 历史学视角 / 牧养视角…） |
| 证据 | 每个子命题**至少一条圣经引用**（`bible`，ref 形如"书卷 章:节"，可跳转读经研究）；其余类别（philosophy/history/science/theology/ethics/literature）按论证需要补充；`ref` 具体可查、`note` 一句话说明与内容的关系；没有证据的类别省略不写；**不要虚构经文出处** |
| 范例 | `topics/suffering/evil/question.json`（自由意志回应）是结构与证据搭配的完整范例 |

### 6. 编辑注意事项

| 事项 | 说明 |
|---|---|
| id 与目录/文件名一致 | `topic.json` 的 id = 主题目录名；`question.json` 的 id = 子命题目录名（构建时校验，不一致会报错） |
| 顺序与完整性 | 顺序一律以列表为准：`content.meta.json → topics`、`topic.json → sub_questions` |
| `id` 全局唯一 | 主题与子命题的 id 各自域内唯一即可；一旦上线被引用（收藏/分享/搜索直达），不要随意改名 |
| 引号 | 内容中的引号请使用中文引号「"…"」，**不要用英文双引号**（会破坏 JSON 结构） |
| JSON 合法性 | 编辑后直接 `npm run data`（解析失败会报错并指明文件） |
| 标签枚举 | `tags` 建议从「哲学/神学/科学/历史/圣经/文献/考古/伦理/牧养/实践/文化/解经」中选取，证据类别固定为 `bible/philosophy/history/science/theology/ethics/literature` 七种 key（多了不会显示） |

---

## 三、前端结构与扩展约定

```
src/views/apologetics/ApologeticsPage.vue   页面：持有全部状态（view/activeTopic/搜索词/移动端视图）
src/components/apologetics/
├── SearchBar.vue            搜索框（v-model 受控，父级持有 query）
├── TopicCard.vue            主题卡片（props: topic；emit: select）
├── QuestionCard.vue         子命题列表项（props: q/active/index；emit: select）
├── ResponseCard.vue         内容卡（props: r；渲染子命题的标题/视角/核心思想/正文 + 证据面板）
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

- [ ] 探索视图：Hero 统计数字正确（N 主题 · N 问题）、主题卡片数量与 `topics` 一致
- [ ] 搜索：关键词能过滤卡片并列出"相关问题"直达
- [ ] 主题视图：左列表子命题数量与 `topic.json` 的 `sub_questions` 一致
- [ ] 内容卡：标题/视角徽章/核心思想/正文/证据面板齐全
- [ ] 圣经引用：点击跳转 `/brp/{卷}/{章}` 对应章节
- [ ] 移动端（≤900px）：主题视图两段式（列表 ↔ 详情）切换正常
- [ ] 无横向溢出（`document.documentElement.scrollWidth` 不超过视口宽）

> **部署约定**：日常修改只 `git commit` 不推送；只有明确要求"部署/上线"时才推送并手动触发部署（见 docs/DEPLOY.md）。
