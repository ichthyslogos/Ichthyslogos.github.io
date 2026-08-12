# 教会史子页面（Church History）

## 页面

- 路由：`/history`（默认第壹部导论）、`/history/:part/:chapter`（part=1-5，chapter=`intro` 或章号）
- 组件：`src/views/church-history/ChurchHistoryPage.vue`（目录栏 + 阅读器双栏；移动端目录转横向 chips + 章选择 chips）
- 导航：`src/components/AppHeader.vue` 菜单「教会史」

## 数据管线

《历史的轨迹——二千年教会史》The Church in History（祁伯尔 B. K. Kuiper 著 / 赵中辉 译，50 章按 5 部组织）

```
素材/library/采纳/历史的轨迹——二千年教会史 插图版v2.CHM   ← 源（只读）
  ↓ hh.exe -decompile 解包（工作区/library/chm-extract/html/）
  ↓ iconv gb18030 → utf8（工作区/library/chm-extract/utf8/）
  ↓ 工作区/library/chm-extract/convert-chm.mjs
site/data-src/church-history/
  ├── content.json   书目索引（书名/作者/译者 + 5 部元数据）
  ├── part1..part5.json  按部切片：{ no, title, period, intro, chapters[] }
  └── （插图 160 张 → site/public/data/church-history/images/）
  ↓ scripts/build-data.mjs（buildChurchHistory 段）
site/public/data/church-history/   ← 运行时（按部按需加载）
```

- 块模型：`{ t: 'h'|'p'|'img', text?, src?, caption? }`（h=小节标题，p=段落，img=插图+【图注】）
- 前端取数：`src/lib/data.js` 的 `fetchChurchHistory()` / `fetchChurchHistoryPart(n)` / `churchHistoryImg(src)`
- 内容忠实原文：保留原书错字（如「马太幅音」）、全角标点；段落首行缩进由 CSS 处理
- 转换注意：gb18030 转码会产生 PUA 杂符（U+E5E5 缩进等），脚本已统一清理；跨行【图注】已合并回图片 caption

## 版权提示（重要）

本书为中文译著，译者/出版方版权可能仍在保护期内（原著作者 1961 年去世）。当前按用户要求
实现并保留在**本地**；**尚未部署**。公开上线前请评估版权风险（同《游子吟》全文仍在 data-src
的问题一并处理）。素材源文件为 TRC 下载的 CHM（见 工作区/library/TRC下载站扫描报告.md）。
