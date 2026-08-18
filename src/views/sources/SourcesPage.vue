<script setup>
/**
 * SourcesPage — 数据来源与许可（HOMEPAGE_DESIGN.md §43 / 页脚入口）
 * 列出平台各数据源、用途与许可证；许可信息来自素材库记录（只读素材的 LICENSE 文件核对）。
 * 持续维护：新增数据源时在此登记。
 */
const sources = [
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

    <div class="sources-list">
      <article v-for="s in sources" :key="s.name" class="source-row">
        <div class="src-main">
          <h2 class="src-name">{{ s.name }}</h2>
          <p class="src-use">{{ s.use }}</p>
        </div>
        <div class="src-meta">
          <span class="src-license">{{ s.license }}</span>
          <p class="src-via">{{ s.via }}</p>
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener" class="src-url">{{ s.url.replace('https://', '') }} ↗</a>
        </div>
      </article>
    </div>

    <p class="sources-note">
      素材库（只读）保留各来源的许可证记录与下载记录；构建管线（data-src → public）按来源优先级
      逐层处理，详见项目文档 HISTORICAL-GIS.md §2/§5。
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
.sources-list {
  max-width: 860px;
  margin: 0 auto;
  border-top: 1px solid var(--line);
}
.source-row {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem 0.2rem;
  border-bottom: 1px solid var(--line-soft);
}
.src-main {
  min-width: 0;
}
.src-name {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
}
.src-use {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.7;
}
.src-meta {
  flex-shrink: 0;
  max-width: 15rem;
  text-align: right;
}
.src-license {
  display: inline-block;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--gold);
  border: 1px solid var(--gold-soft);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.12rem 0.6rem;
}
.src-via {
  margin: 0.45rem 0 0;
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.6;
}
.src-url {
  display: inline-block;
  margin-top: 0.4rem;
  font-size: 0.74rem;
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
    gap: 0.8rem;
  }
  .src-meta {
    max-width: none;
    text-align: left;
  }
}
</style>
