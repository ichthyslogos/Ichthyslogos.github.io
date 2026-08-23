<script setup>
/**
 * SourcesPage — 数据来源与许可（HOMEPAGE_DESIGN.md §43 / 页脚入口）
 * 按类别列出平台全部数据源、用途与许可证；许可信息来自素材库记录（只读素材的 LICENSE 文件核对）。
 * 持续维护：新增数据源时在此登记。
 */
const categories = [
  {
    title: '圣经经文与译本',
    en: 'Scripture & Translations',
    sources: [
      {
        name: '和合本（繁體字）',
        use: '中文圣经和合本（1919），读经主译本',
        license: '公有领域',
        via: 'biblesuper "All Bibles - JSON"（bible_databases）',
        url: null,
      },
      {
        name: '和合本（简体）',
        use: '和合本简体，支持逐字原文 Strong 码',
        license: '公有领域 / 非商用可共享',
        via: 'biblesuper chinese_union_simp_s.json（MySword）',
        url: null,
      },
      {
        name: '思高本',
        use: '天主教中文圣经译本',
        license: '版权归思高圣经学会（研究引用）',
        via: 'bible_databases（ChiSB）',
        url: null,
      },
      {
        name: '新国际版（NIV）',
        use: '英文现代译本',
        license: '版权归 Biblica（研究引用）',
        via: 'GitHub aruljohn/Bible-niv',
        url: 'https://github.com/aruljohn/Bible-niv',
      },
      {
        name: '英王钦定本（KJV）',
        use: '英文经典译本（1769 版，含 Strong 码与词形）',
        license: '公有领域',
        via: 'bible_databases（KJV with Strongs）',
        url: null,
      },
    ],
  },
  {
    title: '原文与词典',
    en: 'Original Language & Dictionaries',
    sources: [
      {
        name: 'Open Scriptures Strong\'s',
        use: 'Strong 原文词典基础层（全量希腊/希伯来词条）',
        license: 'CC0',
        via: 'openscriptures/strongs',
        url: 'https://github.com/openscriptures/strongs',
      },
      {
        name: 'STEPBible TBESG / TBESH',
        use: 'Strong 简明词典核心层（lemma/音译/词性/gloss）',
        license: 'CC BY 4.0',
        via: 'STEPBible.org / Tyndale House Cambridge',
        url: 'https://www.stepbible.org',
      },
      {
        name: 'TFLSJ（Full LSJ）',
        use: '高级希腊词典（LSJ 全本，详情页懒加载）',
        license: 'CC BY',
        via: 'STEPBible.org（Full LSJ Bible lexicon）',
        url: 'https://www.stepbible.org',
      },
      {
        name: 'BDB（Brown-Driver-Briggs）',
        use: '希伯来语词典（扩展词条）',
        license: '公有领域',
        via: 'strongs-extra/BDB.xml',
        url: null,
      },
      {
        name: 'Easton\'s Bible Dictionary',
        use: '人物词典摘录（生卒年/亲属/简介）',
        license: '公有领域',
        via: 'Theographic Bible Metadata 附带',
        url: null,
      },
    ],
  },
  {
    title: '注释与参考',
    en: 'Commentaries & References',
    sources: [
      {
        name: '加尔文注释合集',
        use: 'Calvin\'s Collected Commentaries（47 卷）',
        license: '公有领域',
        via: 'CCEL 文本 · CrossWire SWORD 模块（CalvinCommentaries v1.1）',
        url: 'https://www.crosswire.org',
      },
      {
        name: 'Robertson\'s Word Pictures（RWP）',
        use: '新约逐节注释（A.T. Robertson）',
        license: '公有领域（版权已到期）',
        via: 'CrossWire SWORD 模块（RWP）',
        url: 'https://www.crosswire.org',
      },
      {
        name: 'Catena Aurea（金链）',
        use: '四福音教父注解汇编（托马斯·阿奎那编）',
        license: '公有领域',
        via: 'CrossWire SWORD 模块（Catena）',
        url: 'https://www.crosswire.org',
      },
      {
        name: 'Abbott Illustrated New Testament',
        use: '新约逐节注释（1878）',
        license: '公有领域',
        via: 'CrossWire SWORD 模块（Abbott）',
        url: 'https://www.crosswire.org',
      },
      {
        name: 'Matthew Henry 简明注释（MHCC）',
        use: '逐卷经文解释与一句话总结',
        license: '公有领域',
        via: 'MHCC 文本整理',
        url: null,
      },
      {
        name: 'STEP Bible TIPNR',
        use: '圣经专有名词（人名/地名）与本地坐标',
        license: 'CC BY 4.0',
        via: 'STEPBible.org / Tyndale House Cambridge',
        url: 'https://www.stepbible.org',
      },
      {
        name: 'TSK 串珠',
        use: '交叉引用（Treasury of Scripture Knowledge 系）',
        license: 'CC BY 4.0',
        via: 'bible-cross-references/kjv/crossreferences_kjv.tsv',
        url: null,
      },
    ],
  },
  {
    title: '地理与历史地图',
    en: 'Geography & Historical Maps',
    sources: [
      {
        name: 'STEP Bible (TIPNR)',
        use: '圣经专有名词（人名/地名）与本地坐标',
        license: 'CC BY 4.0',
        via: 'STEPBible.org / Tyndale House Cambridge',
        url: 'https://www.stepbible.org',
      },
      {
        name: 'Pleiades',
        use: '古代地点身份、坐标、时代名与存在年代（minDate/maxDate）',
        license: 'CC BY 4.0',
        via: 'pleiades.stoa.org · atlantides.org 官方导出（2026-08-17）',
        url: 'https://pleiades.stoa.org',
      },
      {
        name: 'DARE',
        use: '罗马帝国地点（城市名/坐标）',
        license: 'CC BY 4.0',
        via: 'klokantech/roman-empire · Johan Åhlfeldt',
        url: 'https://imperium.ahlfeldt.se',
      },
      {
        name: 'Cliopatria (Seshat)',
        use: '历史政权疆域（国家边界，3400 BCE–2024 CE）',
        license: 'CC BY 4.0',
        via: 'Seshat Global History Databank',
        url: 'https://github.com/Seshat-Global-History-Databank/cliopatria',
      },
      {
        name: 'AWMC',
        use: '古代城市建成区（urban areas）',
        license: 'CC BY-NC 4.0（待核实后回填）',
        via: 'Ancient World Mapping Center, UNC',
        url: 'https://awmc.unc.edu',
      },
      {
        name: 'Natural Earth',
        use: '自然地理底图（海洋/河流/湖泊）',
        license: 'Public Domain',
        via: 'naturalearthdata.com',
        url: 'https://www.naturalearthdata.com',
      },
      {
        name: 'UBS MARBLE',
        use: '圣经旅程路线（179 条）',
        license: 'UBS 开放许可',
        via: '素材库 ubs-open-license 记录',
        url: null,
      },
    ],
  },
  {
    title: '护教与神学',
    en: 'Apologetics & Theology',
    sources: [
      {
        name: '《游子吟》',
        use: '护教论证图谱（10 主题 · 51 子问题，含命题/质疑/回应/证据逻辑链）',
        license: '版权归作者里程所有（全文归档，详情面板仅展示摘要）',
        via: '里程（Li Cheng）著',
        url: null,
      },
    ],
  },
  {
    title: '教会历史',
    en: 'Church History',
    sources: [
      {
        name: '《历史的轨迹——二千年教会史》',
        use: '教会史五部（初期/中世纪/改教/近代/现代）',
        license: '版权归作者与译者（研究引用）',
        via: '祁伯尔 B. K. Kuiper 著 · 赵中辉译',
        url: null,
      },
    ],
  },
  {
    title: '预言与编年',
    en: 'Prophecy & Chronology',
    sources: [
      {
        name: 'scripture-journey / Payne 弥赛亚预言',
        use: '弥赛亚预言数据集（200 条）',
        license: 'MIT（数据集）',
        via: 'systemslibrarian/scripture-journey · J. Barton Payne《圣经预言百科全书》（弥赛亚子集）',
        url: 'https://github.com/systemslibrarian/scripture-journey',
      },
    ],
  },
  {
    title: '人物与事件',
    en: 'Persons & Events',
    sources: [
      {
        name: 'Theographic Bible Metadata',
        use: '人物生卒年/亲属关系/编年事件（450 条时间线）',
        license: 'CC BY-SA 4.0',
        via: 'robertrouse/theographic-bible-metadata（生卒年采用 Ussher 传统编年，非考古学定年）',
        url: 'https://github.com/robertrouse/theographic-bible-metadata',
      },
    ],
  },
  {
    title: '图书馆',
    en: 'Library',
    sources: [
      {
        name: '经典文献资料库',
        use: '注释书/教父著作/改革宗经典/神学/灵修/教会史/圣经工具/圣乐/图册（多格式）',
        license: '各书版权归原作者（研究引用）',
        via: '书籍文件按类别存放于独立 GitHub 仓库（library-books-*，每仓开 Pages）',
        url: null,
      },
    ],
  },
]

const philosophy = ['开放数据', '可追溯', '模块化', '持续更新']
</script>

<template>
  <main class="sources-page">
    <header class="sources-head">
      <p class="kicker">DATA &amp; SOURCES</p>
      <h1>数据来源与许可</h1>
      <p class="sub">让研究建立在可追溯的数据之上。{{ philosophy.join(' · ') }}</p>
    </header>

    <section v-for="cat in categories" :key="cat.title" class="sources-cat">
      <h2 class="cat-title">
        <span class="cat-zh">{{ cat.title }}</span>
        <span class="cat-en">{{ cat.en }}</span>
      </h2>
      <div class="sources-list">
        <article v-for="s in cat.sources" :key="s.name" class="source-row">
          <div class="src-main">
            <h3 class="src-name">{{ s.name }}</h3>
            <p class="src-use">{{ s.use }}</p>
          </div>
          <div class="src-meta">
            <span class="src-license">{{ s.license }}</span>
            <p class="src-via">{{ s.via }}</p>
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="src-url">{{ s.url.replace('https://', '') }} ↗</a>
          </div>
        </article>
      </div>
    </section>

    <p class="sources-note">
      素材库（只读）保留各来源的许可证记录与下载记录；构建管线（data-src → public）按来源优先级
      逐层处理，详见项目文档 HISTORICAL-GIS.md §2/§5 与 docs/LIBRARY.md。
    </p>
  </main>
</template>

<style scoped>
.sources-page {
  flex: 1;
  background: var(--bg);
  padding: 3.6rem 2rem 5rem;
}
.sources-head {
  max-width: 860px;
  margin: 0 auto 3rem;
}
.kicker {
  margin: 0 0 0.8rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.3em;
}
.sources-head h1 {
  margin: 0 0 0.9rem;
  font-family: var(--serif);
  font-size: 2.2rem;
  font-weight: 600;
  color: var(--ink);
}
.sub {
  margin: 0;
  font-size: 0.92rem;
  color: var(--muted);
}
.sources-cat {
  max-width: 860px;
  margin: 0 auto 2.6rem;
}
.cat-title {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  margin: 0 0 0.4rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--gold-soft);
}
.cat-zh {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ink);
}
.cat-en {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-transform: uppercase;
}
.sources-list {
  border-top: 1px solid var(--line);
}
.source-row {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.1rem 0.2rem;
  border-bottom: 1px solid var(--line-soft);
}
.src-main {
  min-width: 0;
}
.src-name {
  margin: 0 0 0.3rem;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text);
}
.src-use {
  margin: 0;
  font-size: 0.83rem;
  color: var(--muted);
  line-height: 1.7;
}
.src-meta {
  flex-shrink: 0;
  max-width: 16rem;
  text-align: right;
}
.src-license {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--gold);
  border: 1px solid var(--gold-soft);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.1rem 0.55rem;
}
.src-via {
  margin: 0.4rem 0 0;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.6;
}
.src-url {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  color: var(--accent);
  text-decoration: none;
}
.src-url:hover {
  text-decoration: underline;
}
.sources-note {
  max-width: 860px;
  margin: 2.4rem auto 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.9;
}
@media (max-width: 640px) {
  .source-row {
    flex-direction: column;
    gap: 0.7rem;
  }
  .src-meta {
    max-width: none;
    text-align: left;
  }
}
</style>
