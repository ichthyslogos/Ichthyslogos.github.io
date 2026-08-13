# 文档导航

本目录收录 FISH 平台的全部文档，按主题拆分（不限数量，可随功能扩展增补）。

| 文档 | 内容 | 何时查阅 |
|---|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架构设计：素材三层隔离、数据流、按子页面组织约定 | 理解整体设计、决策取舍 |
| [DATA.md](DATA.md) | 数据流水线：新增译本"放入即显示"、原文/译本隔离与 Strong 预留 | 添加/修改数据、接入新数据源 |
| [COMMENTARY.md](COMMENTARY.md) | 注释系统：多注释源架构（传统/来源两级）、马太亨利转换管线、数据格式、已知问题 | 接入/维护注释数据 |
| [COMMENTARY-ROADMAP.md](COMMENTARY-ROADMAP.md) | 注释扩展路线图：9 传统分类 × 候选注释源（许可/数字化来源/优先级） | 规划新增注释源 |
| [APOLOGETICS.md](APOLOGETICS.md) | 护教页面：使用说明（探索/主题视图、搜索、证据、经文跳转）+ 数据编辑指南（三层结构与字段、新增内容示例、注意事项） | 使用护教页、编辑护教数据 |
| [LIBRARY.md](LIBRARY.md) | 图书馆：架构（主站索引 + 多书籍仓库）、存储约束（100MB/1GB 限制）、收录一本书的两步流程、数据格式 | 收录书籍、维护图书馆 |
| [CHURCH-HISTORY.md](CHURCH-HISTORY.md) | 教会史：页面/路由、数据管线（CHM 转换）、版权提示 | 维护教会史内容 |
| [DEPLOY.md](DEPLOY.md) | 部署指南：GitHub Pages 手动/CI 两种方式、子路径验证、仓库文件策略、部署实战记录 | 发布上线、配置 CI |
| [DEVELOP.md](DEVELOP.md) | 开发规范：新增子页面四步流程、路由/组件/数据约定 | 开发新功能、改动代码前 |
| [STRUCTURE.md](STRUCTURE.md) | 目录结构详解：每个目录与关键文件的职责 | 快速定位代码、找文件 |
| [PLAN.md](PLAN.md) | **未来规划**：FISH 综合性基督教平台开发计划（定位/模块架构/阅读-探索-研究三层/开发阶段） | 规划平台方向、评估新功能 |
| [DISCOVERY.md](DISCOVERY.md) | **未来规划**：FISH Discovery 知识发现与智能搜索系统（实体系统/知识图谱/搜索流水线/开发阶段） | 规划搜索与知识关联能力 |
| [GITHUB-REFERENCE.md](GITHUB-REFERENCE.md) | **资料库参考**：GitHub 开源项目归档（STEPBible/SWORD/UBS/KJV Study/Biblos/知识图谱等 12 项目，含优先级/研究顺序/许可原则/研究记录模板） | 评估开源项目、寻找数据源与架构参考 |

## 核心约定速览（全部文档都围绕这几条）

1. **素材与网站隔离**：素材库（`..\bible_databases` 等）只读，网站构建仅消费 `data-src\` 投影。
2. **按子页面组织一切**：一个子页面 = `views\[名]\`（页面）+ `components\[名]\`（组件）+ 数据目录（`data-src\[名]\`、`public\data\[名]\`）+ 路由条目。共享组件/数据直接放对应根目录，**不建共享文件夹**。
3. **数据驱动**：前端不硬编码译本/书卷清单，一切从 `manifest.json` 读取——"放入即自动显示"。
4. **原文与译本隔离**：manifest 中 `original` 字段区分原文与译本，为 Strong 功能预留独立数据流。
