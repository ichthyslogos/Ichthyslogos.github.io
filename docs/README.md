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
| [HISTORICAL-MAP.md](HISTORICAL-MAP.md) | **历史动态地图系统**：基于时间变化的古代世界地图（历史底图/政治疆域/古代道路/事件路线四层、时间轴引擎、valid_time 模型、MapLibre GL 选型、圣经时期优先支持、素材库只读约定） | 开发历史地图功能、接入疆域/古道数据 |
| [TEMPORAL-MAP-DB.md](TEMPORAL-MAP-DB.md) | **时间历史地图数据库**：地点 valid_time 过滤、LOD 城市等级（按 Zoom 分级显示）、城市重要性评分、国家疆域渲染（按时期切换 Polygon）、动态图例、Pleiades/AWMC/DARE 数据源选型 | 开发地点时间标注、LOD 显示、疆域图层 |
| [HISTORICAL-GIS.md](HISTORICAL-GIS.md) | **历史地理信息系统架构规范**：时间语义层（四类时间分离/precision/certainty）、数据源层级与 Source Hierarchy、Entity Identity、Source/Provenance 溯源标准、Attestation 原则、Historical Validator（ERROR/WARNING 分级冲突检测）、数据管线、P0-P4 路线图 | 架构决策、接入新数据源、冲突检测与白名单维护 |
| [HISTORICAL-BASEMAP.md](HISTORICAL-BASEMAP.md) | **历史底图系统**：纯自然地理底图（海洋/陆地/山脉/河流/地形，禁现代政治/交通/城市）、六层地图架构、Natural Earth Gray Earth 底图选型、颜色设计、缩放等级（0-4/5-8/9-12/13+）、数据目录 | 开发/维护地图底图与分层 |
| [GEOGRAPHY.md](GEOGRAPHY.md) | **圣经地理系统（v2.0 架构规范）**：三层数据源（STEP Bible 地点 / UBS MARBLE 路线 / Itiner-e 古道）、五层数据层级、Place ID 与 Mapping、Journey/Stop/Segment 模型、Raw→Curated 分层、confidence 不确定性模型、五阶段路线图、16 条最终架构原则 | 开发地图/地理/路线/人物旅程功能、接入地理数据源 |

## 核心约定速览（全部文档都围绕这几条）

1. **素材与网站隔离**：素材库（`..\bible_databases` 等）只读，网站构建仅消费 `data-src\` 投影。
2. **按子页面组织一切**：一个子页面 = `views\[名]\`（页面）+ `components\[名]\`（组件）+ 数据目录（`data-src\[名]\`、`public\data\[名]\`）+ 路由条目。共享组件/数据直接放对应根目录，**不建共享文件夹**。
3. **数据驱动**：前端不硬编码译本/书卷清单，一切从 `manifest.json` 读取——"放入即自动显示"。
4. **原文与译本隔离**：manifest 中 `original` 字段区分原文与译本，为 Strong 功能预留独立数据流。

## 变更记录

- **2026-08-18（v2.5.8）**：**NIV 书卷目录语言一致**——NIV 译本书卷列表从中文（创世记）改为英文（Genesis/Exodus…），与正文语言一致（此前 `books-i18n.mjs` 漏登记 NIV 的英文书卷名，KJV/ASV/DRC 均有登记）。
- **2026-08-18（v2.5.7）**：**疆域标签独立层 + 避免蓝字重叠**——国家名改独立瓦片层 `territory-labels`（每实体一个质心 label 点，与疆域多边形分离——解决混合几何中空 polygon symbol 与 label 点同质心碰撞导致蓝字消失的问题）；蓝字之间参与标签碰撞（`allow-overlap:false` + `symbol-sort-key` 按面积：大国优先保留、小国重叠处让位），位置固定在质心不移动；**读经页地图地点高亮同款重叠修复**——`focus-places-label` 改用 `text-variable-anchor`（8 锚点避让，本章重叠地点名扇形展开全部显示）；**map 子页面时期选择可滚动**——时间轴滚动条可见 + 鼠标滚轮垂直转水平横滚（此前滚动条隐藏无法滚动）。瓦片版本参数更新（?v=20260818b）。
- **2026-08-18（v2.5.6）**：**疆域单标签 + 位置固定**——同一政权多切片只显示一个蓝字国家名：`build-tiles.mjs` territoriesFC 对同名实体聚合，附加一个 label 点（面积最大切片质心，`is_label` 属性）；前端 `territory-label` 用 `text-field` 条件表达式区分（多边形切片空文字不渲染，label 点显示国家名——MapLibre 对 MVT 属性 filter 匹配不稳定，改用表达式方案）；`text-allow-overlap:true + text-ignore-placement:true`——国家名永远可见、位置固定在质心、不参与城市标签碰撞（不被移动/隐藏）；**瓦片 URL 加版本参数**（`?v=`，数据重建后浏览器缓存自动失效）。点击国家名仍可查国家。
- **2026-08-18（v2.5.5）**：**MAP LABEL ENGINE：标签避让而非隐藏**——核心规则 **Entity Never Hide, Label May Move**（实体永不因标签碰撞而隐藏；标签自动重新定位）。`MapLibreMap` 名称层改用 `text-variable-anchor`（上/下/左/右/四角 8 锚点）+ `text-radial-offset`：MapLibre 在**屏幕空间 bounding box 软碰撞**下自动为每个标签选择无冲突锚点——同坐标多名字（Jerusalem/Jebus/Aelia Capitolina/Holy City 等不同时代同一地点）**扇形展开全部显示**、文字绝不重叠；**符号层允许重叠**（`text-allow-overlap:true`——点可以重叠，同坐标多实体符号全部显示不丢失，数量由密度档位控制）；`symbol-sort-key` 按 importance 保证重要地点优先占锚点（实测：符号 236 全显示、同视野名字 27 vs 固定锚点 17、z10 视野 164 个名字）。
- **2026-08-18（v2.5.4）**：**地图信息密度系统（Map Data Engine）**——① **密度分级表**：`MapLibreMap` 新增 `DENSITY_ZOOM` 三档分级（简洁/标准/详细），每档为 13 类地点指定 zoom 起点（0-4 大区域国家 → 4-6 国家/首都/重要城市 → 6-8 行政区/城市 → 8-10 城市/村镇 → 10-12 圣经地点 → 12+ 遗址/山/河），城市按 major（重要城市）分级更早出现；② **信息密度控制器**（地图右上角，缩放控件下方，两处地图共用）：简洁（只国家/首都/重要城市）/ 标准 / 详细 三档，选择持久化（localStorage）；③ **Label Collision**：城市符号层启用碰撞剔除（`allow-overlap:false`）+ `symbol-sort-key` 按 importance 排序——重叠时耶路撒冷优先保留、村庄自动隐藏（实测 z6 视野 678 符号 → 12）；④ **Pleiades 补充点密度控制**：简洁不显示、标准 z11.5+、详细 z9+（消除蚂蚁堆）；⑤ **国家区域标签层** `territory-label`（疆域质心大写区域标签，与城市点标签视觉分离，点击可查国家）；⑥ **图例默认收起**：MapPage/MapPanel 地点分类图例改为词条式（默认收起，显示 N/13 计数）。图例图标样式保持不变。
- **2026-08-18（v2.5.3）**：**地图点击拾取升级（读经页地图抽屉 + map 子页面共用）**——① 读经页地图功能**默认关闭所有分类图例**（`MapPanel` visibleCats 默认空：只显示本章地点金色高亮层，不干扰读经定位；图例中可手动打开）；② 点击地图**重叠的图例全部列出**——不再只显示第一个命中：`MapLibreMap` 点击拾取把名称层（cities-label/pleiades-label）纳入（点击图例符号**或名字**均可触发），命中多个地点时 popup 列出全部（分类符号 + 中文名（英文名）+ 时代名 + 存在窗口 + 政治归属），疆域重叠列表保持原有色块列出；鼠标悬停 cursor 同步覆盖名称层。
- **2026-08-18（v2.5.2）**：**NIV 译本接入 + 默认译本切换**——`import-niv.mjs` 导入素材库 aruljohn/Bible-niv（66 卷 / 1189 章 / 31,103 节，卷名归一化：数字前缀→罗马数字、Revelation→Revelation of John、Song Of Solomon 规范化），与 bibledatabase 统一格式合并；`build-data.mjs` 注册 NIV 元数据（en/protestant）并列入显式顺序表（en 组首位）；**默认译本改为 NIV**（`PREFERRED_TRANS = ['niv', 'chiun', 'chisb']`，URL 无 trans 时优先 NIV）；译本展开菜单按语言排序确认（新教：和合本→NIV→KJV→ASV→Martin 1744，天主教：思高本→DRC）。⚠️ NIV 为 Zondervan 版权文本（非公版），公开部署前请评估版权风险。同日：**取消经文词条着色高亮**——VerseItem `.note-hl` 分类背景色停用（阅读零干扰），词条点击跳转解经面板保留，hover 轻提示可点击。
- **2026-08-18（v2.5.1）**：**地图子页面抽屉优化**——旅程/路线功能暂时关闭（`MapPage` 新增 `JOURNEYS_ENABLED` 开关：隐藏旅程计数/搜索框/列表与移动端旅程 tab，数据与地图路线图层照常加载，置回 true 即恢复）；信息栏收起交互升级（读经页头部信息栏同款）：桌面侧栏右上角 `«` 收起 → 隐藏成地图左上角浮动小按钮「☰ 地图信息」，移动端底部抽屉完全收起（不再露出标签栏）→ 地图底部居中浮动按钮，点击均恢复展开（保留拖拽宽度/高度记忆）。**路由滚动复位**：`router.afterEach` 将应用滚动容器 `.app-main` 归零——从首页底部跳转 `/sources` 等长页面时从顶部开始显示。**导航栏新增「数据来源」项**（→ `/sources`）。
- **2026-08-17（v2.5）**：**首页按 HOMEPAGE_DESIGN.md 规范重构**——8 区块（Hero 品牌页 + 数据统计带 / 理念关系图 / 研究生态 4 卡 / 真实 MapLibre 圣经地图预览 + 7 时期时间轴滑块 / 64px 全局搜索 / 数据与来源 / 结尾号召 / 页脚），区块级 IntersectionObserver 渐入（respect reduced-motion），统计从 manifest/注释清单/护教动态数据驱动，不蒜子访问量轮询；新增 `/sources` 数据来源与许可页（7 个来源 + 许可，首页 DataSection 与页脚入口）；`index.html` 补充 SEO meta。**滚动修复**：全局 window 滚动锁定（`html,body overflow:hidden` + `.app-main overscroll-behavior:contain`）——修复首页滚到底后继续下滑（body 级二次滚动/滚动链接传播）的双滚动问题。
- **2026-08-17（v2.4.1）**：**疆域时期审计修正**——核查 10 时期全部疆域实体，确认并修复三处 Cliopatria 源窗口错误（Thracian Kingdom 止于 46 年 / Trưng sisters 止于 43 年 / Greek City-States 止于前 146 年，经 `curated/polity-eras.json` clamp 修正）；罗马时期「国内属国」（Nabataea/Osroene/Pontus 等）经核为真实历史——半独立属国，Cliopatria 将其从帝国多边形挖出，属数据事实非 bug。
- **2026-08-17（v2.4）**：**Pleiades 真实年代接入**——`fetch-pleiades.mjs` 下载官方 dumps + GIS 包（2026-08-17 版，旧版归档 legacy-2021/）；existence 窗口来源链 = curated > **Pleiades 数值年（minDate/maxDate）** > DARE 自带年份 > 类型启发式（实体新增 `existence_src` 字段）；城市 93% 获得真实年代（11,028/11,859），时期不在窗口内即隐藏；纯启发式窗口的城市/国家（1,093 个）由校验器输出 WARNING 补录清单。详见 [HISTORICAL-GIS.md §3.4](HISTORICAL-GIS.md)。
- **2026-08-17（v2.3）**：新增**地区数据库** `regions.json`——960 个 region/nation 地点时空库（出现/灭亡时间 + 英文名 + 中文名槽位 + 时期映射"时期在区间内才显示"），`build-regions.mjs` 入 data:build，`regions_test.js` 入 data:validate-map，弹窗支持「中文名（英文名）」；中文名经 `curated/region-names.json` 人工录入（暂空）。详见 [HISTORICAL-GIS.md §12](HISTORICAL-GIS.md)。
- **2026-08-17（v2.2）**：新增 [HISTORICAL-GIS.md](HISTORICAL-GIS.md) 架构规范（时间语义层/数据源层级/Attestation/校验器规范/P0-P4 路线图）；P0 落地——source 头升级 provenance（url/version/license）、`map_tests/historical_validator.js` 跨文件冲突检测器（ERROR/WARNING 分级）、`npm run data:validate-map` 串联全部地图校验；校验器报告 curated 待复核清单（10 处窗口未生效 + Carthage/Persepolis/Ugarit 无对应实体）。
- **2026-08-17**：数据库重设计 v2（Temporal Historical Map）——places.json 实体化：`valid_time` → `existence` + `names`（时代名）+ `importance[]`（1-5 星历史，curated 20 城曲线 + 分类基线）+ `state[]`（ACTIVE/EMERGING/DECLINING/ABANDONED 推导）+ `political_affiliations[]`（点包含自动计算政权归属，仅 Cliopatria 国家疆域）；polities.json 分组为实体 + `states[]`（14,061 时间状态）；urban.json ARK 时期映射修复（PeriodO 实测：roman -30~300 / classical -550~-330）；DARE 反置窗口修复（14,289 条）；periods.json + era 时代元数据；新增 `src/lib/temporal.js`（Temporal Engine：existsAt/nameAt/importanceAt/affiliationAt/stateAt）；瓦片 LOD 改为 importance 驱动（图例 zoom 表编码 ★5→z0-3 … ★1→z11+）；弹窗显示「隶属政权」；时间轴 era 副标题；新增 `map_tests/temporal_consistency.js`。同日（v2.1）：**行政区划删除**——DARE 行省 + NE admin-1 全部移除（构建端 admins 层、前端行省图层、places 中 province 归属清零），正式版只保留国家疆域（Cliopatria），疆域与全部 10 个时期瓦片由 Cliopatria 源重新生成。详见 [TEMPORAL-MAP-DB.md §0](TEMPORAL-MAP-DB.md)。
- **2026-08-16**：地图页清除道路数据——删除 `tiles/roads/` 瓦片集与 `normalized/roads.json`，构建管线（build-brp-historical / build-tiles）不再生成道路，前端移除 roads 图层与图例引用；`HISTORICAL-MAP.md` 等文档中「古代道路」相关内容按规划稿保留，仅作设计参考，不代表当前数据面。地点分类图例由纯色圆点改为几何形状符号（13 类各一符号，颜色仍与地图标记一致）。
