# FISH GitHub 项目参考与归档

> Project: FISH
> Document: GitHub Projects Archive
> Version: v1.0
> Last Updated: 2026-08-13
>
> 本文用于归档与 FISH 平台开发相关的 GitHub 开源项目。
>
> 注意：
> - 本文中的项目主要用于「研究、参考、架构借鉴、数据源评估」。
> - 不代表 FISH 将直接复制、嵌入或使用这些项目。
> - 使用任何数据前必须独立确认其 License、版权和再分发条件。
> - GitHub 项目的存在不等于其中全部数据均可自由再分发。

---

# 1. 项目分类

FISH 目前重点关注以下六类 GitHub 项目：

```text
GitHub Resources
│
├── 01. Bible 数据
├── 02. Bible Research / Study Platform
├── 03. Lexicon / Original Language
├── 04. Semantic Search / RAG
├── 05. Knowledge Graph
└── 06. 宗教知识数字化平台
```

# 2. 核心项目总览

| 项目 | 类型 | FISH 用途 | 优先级 |
|---|---|---|---|
| STEPBible-Data | Bible / 原文数据 | 圣经、Strong、词形、词典、形态 | S |
| STEP Bible | Bible Research Platform | 研究型 Bible UI / 数据结构 | S |
| SWORD / CrossWire | Bible Resource Framework | 模块化资源体系 | S |
| UBS Open License | 原文字典 | 希伯来文 / 希腊文词典 | S |
| KJV Study | Bible Research | Bible Research UI 参考 | A |
| Biblos | Semantic Bible Research | Semantic Search / RAG | A |
| obra/knowledge-graph | Knowledge Graph | 本地知识图谱架构 | A |
| Microsoft KG Search | Knowledge Graph Search | KG Search / Query Expansion | A |
| Graphify | Knowledge Graph | Entity / Relation 抽取 | B |
| CCEL | Christian Classics | 历史基督教资料 | A |
| Free Use Bible API | Bible API | API / Commentary 数据参考 | B |
| FoJin | Religious Digital Library | 综合宗教知识平台参考 | A |

# 3. STEPBible-Data

- **GitHub**：https://github.com/STEPBible/STEPBible-Data
- **类型**：Bible Data / Original Language / Lexicon / Strong / Morphology / Cross Reference
- **项目价值**：这是 FISH 最重要的数据项目之一。

重点研究：

```text
Bible Text / Original Language / Strong Number / Morphology / Lexicon / Cross Reference / Translation
```

FISH 可参考方向：

```text
Bible → Verse → Word → Lemma → Morphology → Strong → Lexicon
```

- **适用模块**：/brp、/original-language、/strong、/lexicon、/search、/discovery
- **优先级**：S 级
- **注意**：使用数据前必须再次确认 License、Attribution、Redistribution、Commercial Use、Modification

# 4. STEP Bible

- **GitHub**：https://github.com/STEPBible/step
- **类型**：Bible Research Web Application
- **项目价值**：适合研究完整的 Bible Research 产品架构。

重点观察：

```text
Bible Reading / Search / Original Language / Lexicon / Strong / Cross Reference / Research UI
```

FISH 可参考：

```text
Verse UI / Research UI / Search Architecture / Data Loading / Bible Navigation / Original Language Interaction
```

- **不建议**：不要直接复制 STEP Bible 的 UI。应该：研究 → 提取设计模式 → FISH 重新实现
- **优先级**：S 级

# 5. SWORD / CrossWire

- **GitHub**：https://github.com/crosswire/sword
- **类型**：Bible Software Framework / Resource Module System
- **重要性**：这是 FISH 非常值得长期研究的项目。它的核心理念：

```text
Application → Module System → Bible / Commentary / Lexicon / Dictionary / Devotional
```

这种模块化思想与 FISH 非常契合。

FISH 可以借鉴：

```text
data-src/
│
├── bible/
├── commentary/
├── lexicon/
├── dictionary/
├── theology/
├── history/
├── devotional/
└── reference/
```

- **重点研究**：Module、Resource、Metadata、License、Resource Loading
- **优先级**：S 级
- **现状**：FISH 已实际使用 SWORD 模块体系（crosswire 注释模块素材与导入管线，见素材 `crosswire-commentaries/`）

# 6. UBS Open License

- **GitHub**：https://github.com/ubsicap/ubs-open-license
- **类型**：Original Language Dictionary / Lexicon / Biblical Language Resources
- **价值**：尤其适合 FISH 的 Hebrew、Greek、Lexicon、Original Language Research

可重点研究：

```text
Lemma / Definition / Gloss / Semantic Domain / Scripture Reference / Language
```

FISH 可应用：

```text
Strong → Lemma → Lexicon → Definition → Semantic Domain → Bible References
```

- **优先级**：S 级

# 7. KJV Study

- **GitHub**：https://github.com/kennethreitz/kjvstudy.org
- **类型**：Bible Study Application / Bible Research UI / Search / Strong / Interlinear / Cross Reference
- **FISH 研究重点**：Bible Reading、Search、Original Language、Strong、Cross Reference、Topical Index、Genealogy、Research Interface
- **适合研究**：如何将多个研究工具整合到一个 Bible Research 页面
- **优先级**：A 级

# 8. Biblos

- **GitHub**：https://github.com/dssjon/biblos
- **类型**：Semantic Bible Search / RAG / Vector Search / Bible Research / AI
- **价值**：与 FISH Discovery 的方向高度相关。

重点研究：

```text
Keyword → Semantic Search → Related Scripture → Lexicon → Church Fathers → AI
```

FISH 可参考：

```text
Embedding / Vector Database / Semantic Search / RAG / Context Retrieval / AI Research
```

- **注意**：FISH 不应直接把 AI 当作知识源。正确结构：Verified Data → Retrieval → AI Organization → Citation
- **优先级**：A 级

# 9. obra/knowledge-graph

- **GitHub**：https://github.com/obra/knowledge-graph
- **类型**：Knowledge Graph / Semantic Search / Full Text Search / Vector Search
- **价值**：特别适合研究单人开发如何实现轻量级 Knowledge Graph。

重点：

```text
Entities / Relations / Full Text Search / Vector Search / Path Finding / N-hop Relations
```

FISH 可借鉴：

```text
Entity → Relation → Related Entity → Semantic Search
```

- **优先级**：A 级

# 10. Microsoft Knowledge Graph Search

- **GitHub**：https://github.com/microsoft/dstoolkit-kg-search
- **类型**：Knowledge Graph / Search / Query Expansion / Entity Search
- **与 FISH Discovery 的关系**：FISH 的目标是用户输入「称义」→ Entity → Knowledge Graph → 相关经文/原文/Strong/注释/历史/人物/书籍
- 这类项目可以帮助研究：Query Understanding、Entity Expansion、Knowledge Graph Search、Result Ranking
- **优先级**：A 级

# 11. Graphify

- **GitHub**：https://github.com/rhanka/graphify
- **类型**：Entity Extraction / Entity Reconciliation / Ontology / Knowledge Graph
- **FISH 可参考**：当 FISH 收集大量书籍和资料时，「John Calvin / Calvin / Jean Calvin / 加尔文」应该最终统一成 `person.john_calvin`。
- Graphify 类项目可以帮助研究：Entity Extraction、Entity Matching、Entity Reconciliation、Ontology、Relation Extraction
- **优先级**：B 级

# 12. Christian Classics Ethereal Library（CCEL）

- **网站**：https://www.ccel.org/
- **GitHub / 开发资料**：CCEL 的部分 Web Tools / API 与数据访问方式可作为研究对象
- **类型**：Christian Classics / Church History / Theology / Commentary / Devotional / Historical Literature
- **FISH 用途**：特别适合 Church Fathers、Historical Theology、Reformation、Classic Christian Literature、Historical Commentary
- **与 Library 的关系**：CCEL → Resource → FISH Library → Discovery
- **优先级**：A 级
- **注意**：具体作品必须单独确认版权、License、地区限制、再分发条件

# 13. Free Use Bible API

- **网站**：https://bible.helloao.org/
- **类型**：Bible API / Commentary API / Bible Data
- **价值**：可以研究 Bible API、Commentary API、Resource Metadata；尤其关注 `available_commentaries`、`commentary`、`book`、`chapter` 等数据组织方式
- **FISH 用途**：主要作为 API 架构参考、数据格式参考、Commentary 数据来源候选
- **优先级**：B 级

# 14. FoJin

- **GitHub**：https://github.com/xr843/fojin
- **类型**：Religious Digital Library / Semantic Search / Knowledge Graph / RAG / AI / MCP
- **为什么值得研究**：虽然 FoJin 是佛教数字文本项目，但其技术方向与 FISH 的长期目标高度相似：

```text
大量宗教文献 → 数据标准化 → 全文搜索 → Semantic Search → Knowledge Graph → RAG → AI Research → Source Citation
```

- **FISH 可参考**：Religious Knowledge Platform、Digital Library、Knowledge Graph、Semantic Search、RAG、Citation、AI Research
- **优先级**：A 级

# 15. GitHub 项目与 FISH 模块对应关系

```text
                         FISH
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
      Data              Search            Platform
        │                  │                  │
        ↓                  ↓                  ↓
 STEP Bible            Biblos            STEP Bible
 SWORD                 KG Search         KJV Study
 UBS                   Knowledge Graph   SWORD
        │                  │
        └─────────┬────────┘
                  ↓
           Knowledge Layer
                  │
          ┌───────┴────────┐
          ↓                ↓
       Entity           Relation
          │                │
          └───────┬────────┘
                  ↓
            FISH Discovery
                  │
                  ↓
                 AI
```

# 16. FISH 数据来源架构

建议最终形成：

```text
External Resources
│
├── STEPBible
├── SWORD
├── UBS
├── CCEL
├── Public Domain Books
├── Open APIs
└── Licensed Resources
        │
        ↓
Data Acquisition
        │
        ↓
Data Normalization
        │
        ↓
Data Validation
        │
        ↓
FISH Resource Database
        │
        ├── Bible
        ├── Lexicon
        ├── Commentary
        ├── Dictionary
        ├── Theology
        ├── History
        ├── Books
        └── Reference
```

# 17. FISH Knowledge Layer

所有数据最终尽可能进入统一知识层：

```text
Entity
│
├── BibleVerse
├── BibleBook
├── Word
├── Strong
├── LexiconEntry
├── Commentary
├── DictionaryEntry
├── TheologyTopic
├── Person
├── Place
├── Event
├── HistoricalEvent
├── Book
└── ApologeticsTopic
```

关系：

```text
Relation
│
├── related_to
├── references
├── explains
├── commentary_on
├── written_by
├── authored_by
├── translated_by
├── historically_related_to
├── theologically_related_to
├── linguistically_related_to
├── cross_references
├── part_of
├── subtopic_of
├── supports
└── opposes
```

# 18. FISH Discovery

最终所有资源进入：

```text
User Query → Query Understanding → Exact Search → Entity Search → Alias Expansion
→ Semantic Search → Knowledge Graph → Result Ranking → Result Aggregation → FISH Discovery
```

例如用户输入「称义」：

```text
用户：称义
  ↓
TheologyTopic: Justification
  ↓
┌─────────────────────┐
│ 称义                │
├─────────────────────┤
│ 📖 相关经文         │
│ 🔤 原文             │
│ 🔢 Strong           │
│ 📚 注释             │
│ 📕 圣经辞典         │
│ ✝️ 神学             │
│ 🏛 教会历史         │
│ 👤 相关人物         │
│ 📚 图书馆           │
│ 🛡 护教             │
└─────────────────────┘
```

# 19. Library 与 Discovery 的关系

FISH Library 和 Discovery 不应拥有两套独立的数据。应该：

```text
                         Resource
                            │
                 ┌──────────┴──────────┐
                 ↓                     ↓
              Library              Discovery
                 │                     │
             阅读资源              发现资源
                 │                     │
                 └──────────┬──────────┘
                            ↓
                     Knowledge Graph
```

例如《圣经辞典》：

- 在 **Library**：作者、简介、分类、阅读
- 在 **Discovery**：「洗礼」→《圣经辞典》→ 相关词条

# 20. 数据许可原则

这是 FISH 必须遵守的核心规则。

**A 级** —— 明确开放许可（优先使用）：

```text
CC0 / CC BY / Public Domain / 明确 Open License
```

**B 级** —— 允许研究但再分发条件复杂（正式上线前人工审核）：

```text
需要确认 License / 需要署名 / 需要保留版权声明
```

**C 级** —— 现代版权作品（不直接抓取、不直接复制全文、不默认进入数据库）：

```text
可以保存：Book Metadata / Title / Author / Publisher / ISBN / Description / External Link
如果取得明确授权，再考虑全文
```

# 21. AI 使用原则

GitHub 项目不能改变 FISH 的核心原则：

```text
AI ≠ Source
AI ≠ Authority
AI ≠ Database
```

正确：

```text
Source → Verified Data → FISH Database → Search / Retrieval → AI → Answer → Citation
```

# 22. 单人开发的 GitHub 研究方法

**禁止**：

```text
看到项目 → Clone → 复制代码 → 拼接
```

**推荐**：

```text
GitHub Project → 阅读 README → 阅读 License → 阅读 Architecture → 寻找核心数据结构
→ 寻找核心算法 → 记录设计思想 → 写入 FISH Architecture → 自己实现
```

# 23. GitHub 研究记录模板

以后发现新的项目，统一使用：

```yaml
project:
  name: ""
  github: ""
  category: ""

purpose:
  description: ""
  relevance_to_fish: ""

architecture:
  frontend: ""
  backend: ""
  database: ""
  search: ""
  graph: ""
  ai: ""

data:
  types: []
  sources: []
  format: []

license:
  software: ""
  data: ""
  redistribution: ""

fish_usage:
  direct_use: false
  reference_only: true
  modules: []

priority:
  level: "A"

notes:
  - ""
```

# 24. 优先级定义

**S 级** —— 直接影响 FISH 核心基础设施：

```text
STEPBible-Data / STEP Bible / SWORD / UBS Open License
```

**A 级** —— 对 FISH 的核心产品体验有重要参考价值：

```text
Biblos / KJV Study / obra/knowledge-graph / Microsoft KG Search / CCEL / FoJin
```

**B 级** —— 特定功能或技术参考：

```text
Graphify / Free Use Bible API
```

# 25. 第一阶段建议研究项目

不要一次研究全部项目。优先：

```text
01. STEPBible-Data
        ↓
02. SWORD
        ↓
03. UBS Open License
        ↓
04. STEP Bible
        ↓
05. KJV Study
        ↓
06. Biblos
```

研究完这 6 个项目，已经足够帮助 FISH 完成：Bible、Original Language、Strong、Lexicon、Commentary、Search、Semantic Search、Research UI、Resource System

# 26. 第二阶段研究

当 FISH 基础数据体系完成以后：

```text
07. obra/knowledge-graph
        ↓
08. Microsoft KG Search
        ↓
09. Graphify
        ↓
10. FoJin
```

重点解决：Entity、Relation、Knowledge Graph、Semantic Search、Query Expansion、RAG

# 27. 第三阶段资料扩充

之后再研究：

```text
CCEL / Internet Archive / Free Use Bible API / 其他开放 Bible / Theology 数据集
```

重点：Dictionary、Encyclopedia、Church History、Theology、Background、Classical Christian Literature

# 28. 最终技术愿景

FISH 不应该成为「项目A + 项目B + 项目C + 项目D」，而应该成为：

```text
                    FISH
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     Resources    Knowledge     Search
        │            │            │
        ↓            ↓            ↓
     Bible         Entity       Exact
     Lexicon       Relation     Semantic
     Commentary    Ontology     Entity
     Dictionary       │            │
     History           └────┬───────┘
     Books                   ↓
                         Discovery
                            │
                            ↓
                           AI
                            │
                            ↓
                     Source Citation
```

# 29. FISH 的核心原则

- 借鉴开源项目的思想，而不是简单复制项目。
- 优先使用可靠、结构化、许可证明确的数据。
- 数据来源优先于 AI。
- 实体关系优先于简单全文堆积。
- Search 是入口，Discovery 是核心体验。
- Library 是资源层，Discovery 是知识层。
- Strong、串珠、原文、注释、教会史、书籍不是孤立功能，而应该成为同一个知识网络中的节点。

# 30. 最终目标

```text
                 一个关键词
                     │
                     ↓
               Query Understanding
                     │
                     ↓
                 Entity
                     │
                     ↓
             Knowledge Graph
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
      Bible        Language     Theology
        ↓            ↓            ↓
   Commentary      Strong       History
        ↓            ↓            ↓
      Books       Lexicon      People
        │            │            │
        └────────────┼────────────┘
                     ↓
                 Discovery
                     │
                     ↓
                  Research
                     │
                     ↓
                    AI
                     │
                     ↓
              Source / Citation
```

FISH 的目标不是拥有互联网最多的基督教资料，而是让已有的高质量资料彼此连接，并让用户能够通过一个关键词进入整个知识网络。
