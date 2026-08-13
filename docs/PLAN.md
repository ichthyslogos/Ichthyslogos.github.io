# FISH 综合性基督教平台开发计划

> Project Name：FISH  
> Project Type：综合性基督教知识与资源平台  
> Version：v1.0  
> Last Updated：2026-08-13

---

# 1. 项目定位

FISH 不定位为单纯的圣经阅读网站，也不定位为单纯的圣经研究工具。

FISH 的目标是建立一个：

> **连接圣经、神学、教会历史、护教、灵修、基督教文献与多媒体资源的综合性基督教知识与资源平台。**

核心理念：

> **Everything starts from the Scripture.**  
> **一切研究从经文开始。**

圣经是 FISH 的重要数据核心，但不是平台唯一内容。

平台最终应形成：

```text
FISH
│
├── 📖 圣经
├── 📚 图书馆
├── ✝️ 神学
├── 🏛 教会历史
├── 🛡 护教
├── 🙏 灵修
├── 🎵 媒体
├── 🗺 圣经地理
├── 👤 人物与事件
└── 🤖 AI
```

各模块之间通过统一的数据关系互相连接，而不是成为互相孤立的独立网站。

---

# 2. 核心产品原则

## 2.1 阅读优先

FISH 首先必须是一个良好的阅读平台。

用户进入圣经页面时：

- 不应该被大量研究资料打断；
- 不应该默认显示长篇解经；
- 不应该出现大量复杂的研究卡片；
- 应该能够像普通圣经阅读器一样自然阅读。

因此：

> **读经是默认状态，研究是按需进入的第二层。**

---

## 2.2 研究随时发生

研究功能不应该消失，而应该隐藏在经文周围。

用户可以：

```text
阅读
 ↓
发现问题
 ↓
点击经文 / 词语 / Strong / 主题
 ↓
打开研究抽屉
 ↓
获取所需资料
 ↓
关闭抽屉
 ↓
继续阅读
```

核心体验：

> **阅读不被打扰，研究随时发生。**

---

## 2.3 短内容优先，长资料按需展开

FISH 不应该将大量解经资料直接拼接成长文章。

解经内容采用分层结构：

```text
Summary
   ↓
Explanation
   ↓
Research
   ↓
Original Sources
```

建议：

| 层级 | 内容 |
|---|---|
| Summary | 一句话或极短摘要 |
| Core Explanation | 简洁的核心解释 |
| Research | 上下文、原文、神学、历史等 |
| Original Sources | 完整注释、原始文献、书籍 |

用户只需要快速理解时，可以停留在第一层。

研究者可以继续深入。

---

# 3. 平台总体架构

```text
FISH
│
├── Home
│
├── Bible
│   └── BRP
│       ├── Bible Reading
│       ├── Translations
│       ├── Original Languages
│       ├── Strong
│       ├── Lexicon
│       ├── Cross References
│       ├── Commentary
│       ├── Geography
│       └── Timeline
│
├── Library
│   ├── Commentary
│   ├── Church Fathers
│   ├── Reformed
│   ├── Theology
│   ├── Devotion
│   ├── History
│   ├── Reference
│   ├── Music
│   └── Images
│
├── Theology
│   ├── Systematic Theology
│   ├── Biblical Theology
│   ├── Topics
│   ├── Denominations
│   └── Theologians
│
├── History
│   ├── Church History
│   ├── People
│   ├── Councils
│   └── Events
│
├── Apologetics
│
├── Devotion
│   ├── Daily Scripture
│   ├── Memorization
│   ├── Reading Plans
│   └── Prayer
│
├── Media
│   ├── Music
│   ├── Audio
│   ├── Video
│   └── Images
│
└── AI
    ├── Bible Research Assistant
    ├── Theology Assistant
    ├── Apologetics Assistant
    ├── History Assistant
    └── General Christian Knowledge Assistant
```

---

# 4. 当前功能定位

## 4.1 首页 `/`

首页是 FISH 的品牌入口。

主要内容：

- 品牌视觉；
- 古典油画风格 Hero；
- “鱼与饼”核心视觉；
- 平台功能介绍；
- 数据统计；
- 译本数量；
- 圣经卷数；
- 主要模块入口。

首页不承担复杂内容功能。

---

# 5. 圣经研究 `/brp`

`/brp` 是当前 FISH 最成熟、最重要的核心模块之一。

但需要注意：

> `/brp` 是 FISH 的一个核心模块，而不是 FISH 本身。

当前能力：

```text
66卷圣经
+
7卷次经
+
7个译本
+
Strong
+
原文词典
+
TSK串珠
+
多来源注释
```

未来逐步扩展：

```text
经文
 ↓
译本
 ↓
原文
 ↓
Strong
 ↓
词典
 ↓
串珠
 ↓
注释
 ↓
人物
 ↓
地点
 ↓
事件
 ↓
历史
 ↓
神学主题
 ↓
图书馆
```

---

# 6. BRP 的阅读模式

默认状态为：

## Reading Mode

页面重点只有：

```text
书卷导航
章节导航
译本
经文
阅读设置
```

研究功能不直接铺满页面。

示意：

```text
┌──────────────┬────────────────────────────┐
│ 书卷 / 章节   │                            │
│              │        圣经经文             │
│              │                            │
│              │        ……                  │
│              │                            │
└──────────────┴────────────────────────────┘
```

用户可以完整、连续、不受干扰地阅读。

---

# 7. BRP 的研究模式

研究功能采用：

> **Drawer / Drawer Panel / Bottom Sheet**

而不是默认显示大量内容。

桌面端：

```text
┌───────────────────────────────┬──────────────┐
│                               │              │
│            经文               │   Research   │
│                               │    Drawer    │
│                               │              │
│                               │              │
└───────────────────────────────┴──────────────┘
```

移动端：

```text
┌───────────────────────┐
│                       │
│        经文            │
│                       │
│                       │
└───────────────────────┘

        ↓ 点击

┌───────────────────────┐
│     Research Drawer   │
│                       │
│     原文              │
│     Strong            │
│     串珠              │
│     注释              │
│     历史              │
└───────────────────────┘
```

---

# 8. 全局 Drawer 架构

Drawer 不应该只用于 BRP。

它应该成为 FISH 的统一交互模式。

例如：

```text
点击 Strong
→ Strong Drawer

点击人物
→ Person Drawer

点击地点
→ Geography Drawer

点击历史事件
→ History Drawer

点击神学主题
→ Theology Drawer

点击书籍
→ Book Drawer

点击注释来源
→ Commentary Drawer

点击护教问题
→ Apologetics Drawer
```

核心要求：

> **用户永远不需要为了查看关联资料而失去当前上下文。**

---

# 9. 解经系统设计

解经必须避免：

> 一节经文 = 一篇几千字文章。

采用分层设计。

```text
Verse
│
├── Summary
│
├── Key Points
│
├── Context
│
├── Interpretation
│
├── Theology
│
├── Application
│
└── Full Commentary
```

默认只展示：

```text
Summary
+
少量核心解释
```

用户点击：

> 深入研究

再进入完整研究内容。

---

# 10. 解经与注释必须分离

## 解经

FISH 自己组织的结构化解释。

例如：

```text
一句话总结
上下文
关键词
经文解释
神学意义
应用
```

## 注释

来自具体作者、传统或资料来源。

例如：

```text
Matthew Henry
Calvin
RWP
Abbott
Catena
...
```

不能简单地把所有注释合并成一篇“AI大文章”。

---

# 11. 注释系统

注释采用多来源架构。

例如：

```text
📚 Commentary

[马太亨利]
[Calvin]
[RWP]
[Abbott]
[Catena]
...
```

默认：

- 显示简短摘要；
- 用户主动展开；
- 完整内容独立阅读；
- 标明作者与来源；
- 保留不同传统之间的差异。

未来支持：

```text
教父
改革宗
福音派
天主教
东正教
卫斯理/圣洁传统
浸信会
路德宗
现代学术传统
其他
```

宗派分类不能用于强行判断某个解释“正确或错误”，而应该帮助用户理解不同传统的解释方式。

---

# 12. Strong 与原文研究

Strong 不应仅仅作为：

> “显示 G3056 / H7225”

的开关。

未来应发展成完整的原文研究系统。

例如：

```text
G3056
λόγος

词形
音译
词性
基本词义
出现次数
词形变化
相关词
相关经文
词典
注释
神学主题
```

支持：

- 希腊文；
- 希伯来文；
- 亚兰文；
- Strong；
- Lexicon；
- BDB 等合法可用资料。

原文研究属于 FISH 的深度研究能力，但不应影响普通读经体验。

---

# 13. 串珠系统

TSK 是当前重要的关联数据。

未来不只显示：

```text
相关经文列表
```

而应逐渐形成：

```text
Verse A
   ↓
Cross Reference
   ↓
Verse B
   ↓
Verse C
```

进一步可以关联：

```text
经文
→ 主题
→ 原文
→ 注释
→ 历史
→ 神学
```

最终形成 FISH 的经文知识网络。

---

# 14. 教会史 `/history`

当前：

> 《历史的轨迹》50章在线阅读器

作为第一阶段内容继续保留。

未来不要让教会史成为孤立电子书。

应该逐渐建立：

```text
历史事件
│
├── 时间
├── 人物
├── 地点
├── 神学背景
├── 相关经文
├── 相关书籍
└── 相关教派
```

例如：

```text
宗教改革
│
├── 马丁·路德
├── 加尔文
├── 路德宗
├── 改革宗
├── 宗教改革时期经文解释
└── 相关图书
```

---

# 15. 图书馆 `/library`

图书馆目标是成为 FISH 的基督教资源中心。

当前框架：

```text
9类资源
├── 注释
├── 教父
├── 改革宗
├── 神学
├── 灵修
├── 历史
├── 工具
├── 音乐
└── 图片
```

未来建议采用三个主要来源类别：

```text
Public Domain
Open License
External Resources
```

对于版权状态不明确或受版权保护的资料：

> 不应为了丰富书库而未经授权保存和分发。

图书馆的长期价值不是“文件数量最多”，而是：

> **资料组织、检索、关联与研究体验最好。**

---

# 16. 护教 `/apologetics`

护教模块保留，但暂时不作为 FISH 的第一核心开发方向。

建议最终结构：

```text
问题
 ↓
子命题
 ↓
回应
 ↓
论证
 ↓
证据
 ↓
经文
 ↓
历史资料
 ↓
神学资料
 ↓
相关书籍
```

护教内容应该能够反向连接 BRP。

例如：

```text
护教问题
 ↓
相关经文
 ↓
原文
 ↓
Strong
 ↓
注释
 ↓
教会历史
```

---

# 17. 全局搜索

全局搜索是 FISH 后续非常重要的基础设施。

搜索对象不应只有经文。

应该支持：

```text
经文
译本
原文
Strong
词典
注释
人物
地点
事件
历史
神学主题
书籍
护教问题
媒体
```

例如搜索：

```text
“宗教改革”
```

应该得到：

```text
📖 相关经文

👤 相关人物

🏛 历史事件

✝️ 神学主题

📚 相关书籍

🛡 护教内容

🎵 相关媒体
```

最终形成：

> **FISH Knowledge Search**

---

# 18. FISH 知识关联架构

FISH 的长期核心不是页面数量，而是数据之间的关系。

核心实体：

```text
BibleVerse
Translation
Word
Strong
Lexicon
Commentary
Book
Person
Place
Event
History
TheologyTopic
ApologeticsTopic
Media
```

核心关系：

```text
Verse
 ├── hasTranslation
 ├── containsWord
 ├── containsStrong
 ├── hasCrossReference
 ├── hasCommentary
 ├── relatedPerson
 ├── relatedPlace
 ├── relatedEvent
 ├── relatedHistory
 ├── relatedTheology
 ├── relatedBook
 └── relatedApologetics
```

最终形成 FISH 的知识网络。

---

# 19. AI 的定位

AI 不应该成为 FISH 最先开发的核心。

开发顺序：

```text
可靠数据
 ↓
结构化数据
 ↓
数据关联
 ↓
搜索
 ↓
研究工作区
 ↓
AI
```

AI 的核心任务不是：

> “凭自己的知识写一篇看起来像解经的文章。”

而应该：

> **调用 FISH 的结构化资料进行辅助研究。**

例如：

```text
用户问题
 ↓
AI
 ↓
检索 FISH 数据
 ├── 经文
 ├── 原文
 ├── Strong
 ├── 注释
 ├── 教父
 ├── 历史
 ├── 神学
 └── 图书馆
 ↓
组织回答
 ↓
显示来源
```

最终 AI 应该成为：

> **FISH Research Assistant**

而不是 FISH 的内容来源本身。

---

# 20. 研究工作区

长期建议增加：

```text
FISH Research Workspace
```

用户可以：

- 收藏经文；
- 添加笔记；
- 保存 Strong；
- 保存注释；
- 添加标签；
- 创建研究主题；
- 保存资料；
- 建立经文关联；
- 导出研究内容。

例如：

```text
研究项目：三位一体

├── 约翰福音 1:1
├── 约翰福音 1:18
├── 创世记 1:1
├── G3056
├── Calvin
├── Augustine
└── 我的笔记
```

这将使 FISH 从“资源网站”进一步成为“研究环境”。

---

# 21. 推荐开发阶段

## Phase 1 — 阅读体验

优先完善：

```text
/BRP
├── 译本
├── 阅读
├── 章节导航
├── 阅读设置
└── Drawer Framework
```

目标：

> FISH 首先成为一个优秀的圣经阅读器。

---

## Phase 2 — 经文研究

完善：

```text
Strong
原文
Lexicon
TSK
Commentary
```

目标：

> 用户可以从任意经文进入深度研究。

---

## Phase 3 — 知识关联

建立：

```text
人物
地点
事件
历史
神学主题
书籍
```

目标：

> FISH 各模块开始真正互相连接。

---

## Phase 4 — 搜索

建立统一：

```text
FISH Search
```

目标：

> 用户可以通过一个入口搜索整个 FISH。

---

## Phase 5 — 综合内容

逐步完善：

```text
Library
History
Theology
Apologetics
Devotion
Media
```

目标：

> 从圣经研究平台扩展为综合性基督教平台。

---

## Phase 6 — Research Workspace

增加：

```text
收藏
笔记
标签
研究项目
资料管理
导出
```

目标：

> 用户可以在 FISH 内完成完整的个人研究流程。

---

## Phase 7 — AI

最后加入：

```text
AI Bible Research
AI Theology
AI History
AI Apologetics
AI General Assistant
```

目标：

> AI 成为 FISH 知识库的智能入口，而不是替代知识库。

---

# 22. UI 总体原则

FISH UI 应保持：

```text
简洁
克制
典雅
现代
有基督教文化气质
```

避免：

- 信息过载；
- 大量卡片；
- 默认显示长文章；
- 过多按钮；
- 复杂研究界面直接暴露给普通用户。

核心交互：

```text
阅读
 ↓
点击
 ↓
Drawer
 ↓
研究
 ↓
关闭
 ↓
继续阅读
```

---

# 23. 最终产品模型

FISH 最终不是：

```text
圣经网站
+
图书馆
+
护教网站
+
教会史网站
```

而应该是：

```text
                    FISH
                     │
              ┌──────▼──────┐
              │  Christian  │
              │  Knowledge  │
              │   Network   │
              └──────┬──────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
    Bible         Theology        History
      │              │              │
      ├── Strong     ├── Topics     ├── People
      ├── Lexicon    ├── Traditions ├── Events
      ├── TSK        └── Theology   └── Councils
      └── Commentary
      │
      ├──────── Library
      │
      ├──────── Apologetics
      │
      ├──────── Devotion
      │
      ├──────── Media
      │
      └──────── AI
```

---

# 24. 核心设计结论

FISH 的开发不应该追求：

> **功能越多越好。**

而应该追求：

> **内容越丰富，连接越自然；功能越复杂，界面越简单。**

最终形成三个层次：

```text
第一层：阅读
────────────
简单、安静、连续

第二层：探索
────────────
Drawer
原文
Strong
串珠
注释
历史
人物
主题

第三层：研究
────────────
完整资料
图书馆
知识网络
Research Workspace
AI
```

用户可以永远停留在第一层，也可以随时进入第二、第三层。

---

# 25. FISH 的最终产品原则

> ### **Read simply. Explore naturally. Research deeply.**
>
> **简单阅读，自然探索，深入研究。**

FISH 不应该要求每一个用户成为研究者。

普通用户可以把它当作圣经、灵修和基督教资源平台；

进阶用户可以把它当作神学、历史和圣经研究工具；

研究者则可以把它当作一个连接经文、原文、注释、历史、神学与文献的综合研究环境。

**这三类用户应该共享同一个平台，而不是被迫使用三个不同的网站。**