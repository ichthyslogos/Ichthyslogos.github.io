# FISH Discovery 知识发现与智能搜索系统规划

> Project: FISH  
> Module: FISH Discovery  
> Version: v1.0  
> Last Updated: 2026-08-13
>
> 核心理念：**用户只需输入一个关键词，FISH 就能帮助用户发现与该关键词相关的整个基督教知识网络。**

---

# 1. 项目目标

FISH Discovery 不应只是传统的全文搜索系统。

传统搜索：

```text
用户输入关键词
        ↓
匹配文本
        ↓
返回文章列表
```

FISH Discovery：

```text
用户输入关键词
        ↓
理解关键词
        ↓
识别实体 / 主题 / 经文 / 原文
        ↓
扩展相关概念
        ↓
查询多个数据源
        ↓
建立知识关系
        ↓
排序
        ↓
组织为知识发现页面
```

最终目标：

> **Search → Discover**

用户不是在 FISH 中“找一篇文章”，而是在 FISH 中“发现一个知识领域”。

---

# 2. 产品定位

FISH Discovery 是整个 FISH 平台的**统一知识入口**。

用户可以输入：

```text
称义
加尔文
G1344
λόγος
约翰福音 1:1
宗教改革
三位一体
洗礼
苦难
耶稣为什么是神
```

无论输入的是：

- 普通关键词
- 神学主题
- 人物
- 地点
- 历史事件
- 圣经经文
- Strong 编号
- 原文词汇
- 护教问题
- 书籍名称

FISH 都应该尽可能识别其含义，并将用户带入对应的知识网络。

---

# 3. 核心产品理念

## 3.1 用户输入越简单，FISH 返回的信息越丰富

用户只需要输入：

```text
称义
```

系统可以展示：

```text
📖 经文
🔤 原文
🔢 Strong
📚 注释
✝️ 神学
🏛 教会历史
👤 人物
📚 图书馆
🛡 护教
🎵 媒体
```

---

## 3.2 搜索不是终点，而是探索入口

传统搜索的终点：

```text
找到结果
```

FISH Discovery 的终点：

```text
找到结果
 ↓
发现相关知识
 ↓
继续探索
 ↓
建立知识关系
```

---

# 4. 统一知识实体系统

FISH Discovery 的基础不是搜索框，而是：

> **Entity System**

FISH 中的重要对象都应该尽可能成为独立实体。

---

## 4.1 核心实体

```text
Entity
│
├── BibleVerse
├── BibleBook
├── Translation
│
├── Word
├── Strong
├── LexiconEntry
│
├── Commentary
├── CommentarySource
├── Book
│
├── Person
├── Place
├── Event
├── HistoricalEvent
│
├── TheologyTopic
├── Denomination
├── Doctrine
│
├── ApologeticsTopic
│
├── Media
└── Collection
```

---

# 5. Entity 标准结构

所有实体尽量采用统一结构。

```json
{
  "id": "theology.justification",
  "type": "theology_topic",

  "name": {
    "zh_cn": "称义",
    "en": "Justification"
  },

  "aliases": [
    "因信称义",
    "称义论"
  ],

  "description": "...",

  "keywords": [
    "信心",
    "恩典",
    "行为",
    "救恩"
  ],

  "relations": [],

  "sources": [],

  "metadata": {
    "status": "verified"
  }
}
```

---

# 6. 实体类型识别

用户输入关键词后，系统首先需要判断：

> “这个关键词可能是什么？”

例如：

```text
用户：
G1344
```

识别：

```text
Strong
 ↓
Greek Word
 ↓
δικαιόω
```

---

输入：

```text
加尔文
```

识别：

```text
Person
 ↓
John Calvin
```

---

输入：

```text
称义
```

识别：

```text
TheologyTopic
 ↓
Justification
```

---

输入：

```text
罗马书3:28
```

识别：

```text
BibleVerse
 ↓
Romans 3:28
```

---

# 7. Alias 别名系统

同一个概念可能拥有多个名称。

例如：

```json
{
  "canonical_name": "称义",
  "aliases": [
    "因信称义",
    "称义论",
    "Justification",
    "δικαίωσις"
  ]
}
```

用户搜索：

```text
称义
```

或者：

```text
Justification
```

或者：

```text
因信称义
```

都可以进入：

```text
theology.justification
```

---

# 8. Search Pipeline

FISH Discovery 的标准搜索流程：

```text
User Query
    ↓
Query Normalization
    ↓
Exact Match
    ↓
Entity Detection
    ↓
Alias Expansion
    ↓
Semantic Search
    ↓
Relation Expansion
    ↓
Knowledge Graph Retrieval
    ↓
Result Ranking
    ↓
Result Aggregation
    ↓
Discovery UI
```

---

# 9. Query Normalization

首先处理用户输入本身。

包括：

- 大小写；
- 空格；
- 标点；
- 中英文；
- 经文格式；
- Strong 格式；
- 原文字符；
- 常见别名。

例如：

```text
G 1344
G1344
g1344
```

统一为：

```text
G1344
```

---

# 10. Exact Search

第一层搜索采用精确匹配。

例如：

```text
G1344
```

优先返回：

```text
G1344
δικαιόω
```

---

用户输入：

```text
John 1:1
```

优先返回：

```text
John 1:1
```

---

# 11. Entity Search

如果输入与某个实体高度匹配：

```text
称义
```

系统应该优先进入：

```text
TheologyTopic:
Justification
```

而不是直接展示大量包含“称义”二字的文章。

---

# 12. Semantic Search

第二阶段支持语义搜索。

用户输入：

> 人可以靠自己的行为得救吗？

数据库可能没有完全相同的句子。

但系统应该能够找到：

```text
称义
因信称义
恩典
信心
行为
救恩
Romans 3
Galatians 2
James 2
```

因此 FISH Discovery 需要逐步引入：

> Embedding / Vector Search

---

# 13. 多语言搜索

FISH 是面向全球基督教资源的平台，因此搜索架构需要考虑：

```text
中文
English
Français
Greek
Hebrew
Latin
```

例如：

```text
称义
Justification
δικαίωσις
```

可以被映射到同一个知识主题。

---

# 14. Knowledge Graph

FISH Discovery 的核心长期能力：

> **Christian Knowledge Graph**

例如：

```text
称义
│
├── relatedVerse
│   ├── Romans 3:28
│   ├── Romans 5:1
│   └── Galatians 2:16
│
├── relatedWord
│   └── δικαιόω
│
├── relatedStrong
│   └── G1344
│
├── relatedCommentary
│   ├── Calvin
│   ├── Matthew Henry
│   └── RWP
│
├── relatedPerson
│   ├── Martin Luther
│   └── John Calvin
│
├── relatedHistory
│   └── Reformation
│
├── relatedTheology
│   ├── Grace
│   ├── Faith
│   └── Salvation
│
├── relatedBook
│   └── ...
│
└── relatedApologetics
    └── ...
```

---

# 15. Relation 类型

建议建立标准关系类型。

```text
related_to
contains
references
commentary_on
written_by
authored_by
translated_by
historically_related_to
theologically_related_to
linguistically_related_to
cross_references
part_of
subtopic_of
opposes
supports
explains
```

关系应该尽可能有明确语义。

---

# 16. 关系不是越多越好

禁止为了制造“知识图谱”而随意建立关系。

每条重要关系应该尽量具有：

```text
source
relation_type
target
confidence
verification_status
```

例如：

```json
{
  "source": "theology.justification",
  "relation": "related_verse",
  "target": "Romans.3.28",

  "confidence": 0.95,

  "metadata": {
    "source": "Bible reference database",
    "status": "verified"
  }
}
```

---

# 17. 搜索结果聚合

用户搜索：

```text
称义
```

结果不应该只是：

```text
文章1
文章2
文章3
文章4
```

而应该聚合为：

```text
━━━━━━━━━━━━━━━━━━━━━━
🔎 称义
━━━━━━━━━━━━━━━━━━━━━━

📖 圣经
42 个相关经文

🔤 原文
δικαιόω
G1344

📚 注释
12 个来源

✝️ 神学
称义
信心
恩典
救恩

🏛 教会历史
宗教改革

👤 人物
路德
加尔文

📚 图书馆
18 本相关资料

🛡 护教
6 个相关问题
```

---

# 18. Result Ranking

不同类型结果需要有优先级。

建议初始排序：

```text
1. Exact Entity
2. Exact Bible Verse
3. Strong / Original Word
4. High-confidence Relations
5. Commentary
6. Theology
7. History
8. Books
9. Apologetics
10. Media
```

但实际排序应该逐步根据用户行为调整。

---

# 19. 用户行为反馈

未来可以记录匿名化的交互统计：

```text
搜索关键词
 ↓
点击什么
 ↓
停留多久
 ↓
是否继续探索
```

例如：

```text
用户搜索：
称义

点击：
相关经文

再点击：
Romans 3:28

再点击：
Calvin
```

系统可以逐渐发现：

> “搜索称义的用户经常进一步阅读 Romans 3:28 和 Calvin。”

然后优化排序。

---

# 20. Discovery UI

搜索结果页面不应设计成传统搜索引擎。

建议：

```text
┌───────────────────────────────────────┐
│ 🔎 称义                               │
└───────────────────────────────────────┘

概览

📖 相关经文
──────────────────
Romans 3:28
Romans 5:1
Galatians 2:16
查看全部 →

🔤 原文
──────────────────
δικαιόω · G1344
查看研究 →

📚 注释
──────────────────
Calvin
Matthew Henry
RWP
查看全部 →

✝️ 神学
──────────────────
恩典
信心
救恩
```

点击任何项目：

> **打开统一 Drawer。**

---

# 21. Drawer 与 Discovery 的结合

FISH 的核心 UI 结构：

```text
Discovery
    ↓
Result
    ↓
Drawer
    ↓
Deep Research
```

例如：

```text
搜索“G1344”
    ↓
点击 G1344
    ↓
Strong Drawer
    ↓
点击“相关经文”
    ↓
Verse Drawer
    ↓
点击“Calvin”
    ↓
Commentary Drawer
```

整个过程不需要离开搜索上下文。

---

# 22. AI Query Understanding

AI 不负责直接决定事实。

AI 的职责：

> **理解用户问题并生成检索计划。**

例如：

```text
用户：

为什么基督徒相信耶稣是神？
```

AI 可以识别：

```json
{
  "intent": [
    "theology",
    "apologetics"
  ],

  "entities": [
    "Jesus",
    "Christology",
    "DeityOfChrist"
  ],

  "suggested_sources": [
    "BibleVerse",
    "Commentary",
    "ChurchFather",
    "History",
    "Theology",
    "Apologetics"
  ]
}
```

然后由 FISH Search Engine 查询真实数据。

---

# 23. AI 数据原则

必须遵守：

> **AI 是检索与组织工具，不是基础事实的唯一来源。**

错误流程：

```text
AI
 ↓
生成神学事实
 ↓
写入数据库
```

正确流程：

```text
Source
 ↓
Structured Data
 ↓
Verification
 ↓
Database
 ↓
Search
 ↓
AI
 ↓
User
```

---

# 24. 信息可信度体系

每一个重要实体都应该尽可能拥有：

```text
source
author
work
edition
language
license
date
verification_status
```

验证状态：

```text
verified
partially_verified
unverified
deprecated
```

---

# 25. Strong 数据原则

Strong 是重要的导航工具，但不能被设计为：

> “Strong 编号 = 这个词的完整含义。”

FISH 必须区分：

```text
Strong Number
Lexical Information
Contextual Meaning
Theological Interpretation
```

用户点击 Strong 后应该能够继续进入：

```text
Strong
 ↓
词典
 ↓
原文
 ↓
词形
 ↓
语境
 ↓
相关经文
 ↓
注释
```

---

# 26. 串珠数据原则

TSK 等串珠资源应该作为：

> **经文发现工具**

而不是仅仅作为数据库名称展示。

用户看到：

```text
🔗 相关经文
```

点击后进入：

```text
相关经文
 ↓
相关主题
 ↓
相关上下文
```

目标：

> 帮助用户发现圣经内部的关联。

---

# 27. 搜索的四层架构

最终 FISH Discovery 采用：

```text
┌─────────────────────────┐
│       User Query        │
└────────────┬────────────┘
             │
     ┌───────┼────────┐
     ↓       ↓        ↓
   Exact   Entity   Semantic
     │       │        │
     └───────┼────────┘
             ↓
      Knowledge Graph
             ↓
        Ranking
             ↓
        Aggregation
             ↓
        Discovery UI
```

四种能力：

### Exact Search

精确查找。

### Entity Search

识别知识实体。

### Semantic Search

理解语义。

### Knowledge Graph

发现关系。

---

# 28. 开发阶段

## Phase 1 — 基础搜索

实现：

```text
全文搜索
经文搜索
书籍搜索
注释搜索
Strong 搜索
```

目标：

> 能够可靠找到已有资料。

---

## Phase 2 — Entity System

实现：

```text
Person
Place
Event
Strong
BibleVerse
Book
TheologyTopic
Commentary
```

目标：

> 搜索不再只是文本，而是实体。

---

## Phase 3 — Alias

实现：

```text
中文
英文
原文
简称
别名
```

目标：

> 不同叫法能够指向同一个实体。

---

## Phase 4 — Knowledge Graph

实现：

```text
Entity
 ↓
Relations
 ↓
Related Entities
```

目标：

> 搜索结果开始形成知识网络。

---

## Phase 5 — Discovery UI

实现：

```text
概览
经文
原文
Strong
注释
神学
历史
人物
书籍
护教
媒体
```

目标：

> 从 Search 转向 Discovery。

---

## Phase 6 — Semantic Search

加入：

```text
Embedding
Vector Search
Semantic Ranking
```

目标：

> 用户可以用自然语言寻找概念。

---

## Phase 7 — AI Query Understanding

加入：

```text
Intent Detection
Entity Extraction
Query Expansion
Search Planning
```

目标：

> AI 理解用户真正想找什么。

---

# 29. 一个人 Vibecoding 的开发原则

由于 FISH 当前主要由单人开发，必须控制复杂度。

不要一开始实现：

```text
Graph Database
+
Vector Database
+
LLM Agent
+
Complex Recommendation
```

建议：

```text
JSON / PostgreSQL
 ↓
Full Text Search
 ↓
Entity
 ↓
Relation
 ↓
Search Aggregation
 ↓
Vector Search
 ↓
AI
```

逐层升级。

---

# 30. 数据质量优先于功能数量

开发优先级：

```text
数据准确
   >
数据来源
   >
数据结构
   >
数据关系
   >
搜索体验
   >
AI
```

宁可：

> 1000 条高质量数据

也不要：

> 100 万条无法确认来源的数据。

---

# 31. FISH Discovery 的最终目标

用户输入：

```text
“称义”
```

FISH 应该让用户自然经历：

```text
关键词
 ↓
概念
 ↓
经文
 ↓
原文
 ↓
Strong
 ↓
串珠
 ↓
注释
 ↓
神学
 ↓
教会历史
 ↓
人物
 ↓
图书馆
 ↓
护教
 ↓
进一步研究
```

用户输入：

```text
“加尔文”
```

可以：

```text
人物
 ↓
生平
 ↓
著作
 ↓
注释
 ↓
神学观点
 ↓
宗教改革
 ↓
相关经文
 ↓
相关书籍
```

用户输入：

```text
“G1344”
```

可以：

```text
Strong
 ↓
δικαιόω
 ↓
词典
 ↓
出现经文
 ↓
语境
 ↓
注释
 ↓
称义
 ↓
神学
```

---

# 32. 产品核心指标

FISH Discovery 不应该只统计：

> 搜索次数。

更重要的是：

### Discovery Depth

用户一次搜索进行了多少层探索。

例如：

```text
搜索
 ↓
经文
 ↓
Strong
 ↓
注释
 ↓
历史
```

深度 = 4

---

### Discovery Success

用户搜索后是否找到了真正需要的信息。

---

### Exploration Rate

搜索后是否继续点击相关内容。

---

### Search Zero Rate

搜索后没有找到有效结果的比例。

这个指标应该持续降低。

---

# 33. 最终产品定义

FISH Discovery 不应该成为：

> **一个更漂亮的 Google。**

也不应该成为：

> **一个简单的 Bible 全文搜索。**

它应该成为：

> **一个基督教知识发现系统。**

用户只需要提供一个词、一个概念、一节经文，甚至一个自然语言问题。

FISH 负责：

```text
理解
 ↓
定位
 ↓
关联
 ↓
扩展
 ↓
组织
 ↓
展示
```

最终形成：

> **Keyword → Knowledge → Discovery → Research**

---

# 34. 最终设计原则

### Principle 01

> **Search less. Discover more.**

### Principle 02

> **One keyword, many connections.**

### Principle 03

> **AI understands; verified data answers.**

### Principle 04

> **Reading stays simple; research stays available.**

### Principle 05

> **Every important piece of knowledge should be traceable to a source.**

### Principle 06

> **FISH's competitive advantage is not the amount of information, but the connections between information.**

---

# 35. 最终愿景

FISH Discovery 的最终目标是：

> **让用户不需要知道“应该去哪个网站寻找什么”。**

用户只需要输入：

> **一个词。**

FISH 就负责告诉他：

> **这个词是什么、圣经在哪里谈到它、原文是什么、Strong 是什么、有哪些注释、不同传统如何理解、它与哪些人物和历史事件有关、有哪些书籍可以继续阅读，以及还有什么值得探索。**

这将成为 FISH 从“基督教资源网站”走向：

> **基督教知识平台 / Christian Knowledge Platform**

的核心基础设施。