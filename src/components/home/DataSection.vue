<script setup>
/**
 * DataSection — 数据与来源（HOMEPAGE_DESIGN.md §40-43）
 * 数据理念（开放/可追溯/模块化/持续更新）+ 数据源名录（名称展示，遵守许可；仅列已确认来源）
 */
import { RouterLink } from 'vue-router'

const philosophy = [
  { en: 'Open Data', zh: '开放数据', desc: '数据来自开放许可的历史与地理项目。' },
  { en: 'Traceable', zh: '可追溯', desc: '每条记录可溯源到原始来源与许可。' },
  { en: 'Modular', zh: '模块化', desc: '经文、地点、疆域、注释分层独立构建。' },
  { en: 'Continuously Updated', zh: '持续更新', desc: '随上游数据版本定期刷新。' },
]

const sources = ['STEP Bible', 'Pleiades', 'DARE', 'AWMC', 'Cliopatria', 'Natural Earth', 'UBS MARBLE']
</script>

<template>
  <section class="data-sec" aria-label="数据与来源">
    <header class="sec-head">
      <p class="sec-kicker">DATA &amp; SOURCES</p>
      <h2 class="sec-title">数据与来源</h2>
      <p class="sec-sub">让研究建立在可追溯的数据之上。</p>
    </header>

    <div class="philosophy">
      <div v-for="p in philosophy" :key="p.en" class="philo-item">
        <p class="philo-en">{{ p.en }}</p>
        <p class="philo-zh">{{ p.zh }}</p>
        <p class="philo-desc">{{ p.desc }}</p>
      </div>
    </div>

    <ul class="source-list" aria-label="数据来源">
      <li v-for="s in sources" :key="s">{{ s }}</li>
    </ul>

    <p class="data-cta">
      <RouterLink to="/sources">查看数据来源与许可 →</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.data-sec {
  background: #f8f7f3;
  padding: 20px 2rem 140px;
}
.sec-head {
  max-width: 1200px;
  margin: 0 auto 3rem;
  text-align: center;
}
.sec-kicker {
  margin: 0 0 0.8rem;
  font-size: 12px;
  font-weight: 700;
  color: #405d82;
  letter-spacing: 0.3em;
}
.sec-title {
  margin: 0 0 0.8rem;
  font-family: var(--serif);
  font-size: 2.2rem;
  font-weight: 500;
  color: #171717;
}
.sec-sub {
  margin: 0;
  font-size: 0.92rem;
  color: #6b6b68;
}

/* 数据理念：四列纯排版 */
.philosophy {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2.4rem;
  max-width: 1080px;
  margin: 0 auto 3.4rem;
}
.philo-item {
  text-align: center;
}
.philo-en {
  margin: 0 0 0.3rem;
  font-family: var(--serif);
  font-size: 1.15rem;
  font-weight: 600;
  color: #171717;
}
.philo-zh {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #405d82;
  letter-spacing: 0.15em;
}
.philo-desc {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.8;
  color: #9a9790;
}

/* 来源名录：文字标签（不展示 Logo，遵守许可要求） */
.source-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  max-width: 1080px;
  margin: 0 auto 2.6rem;
  padding: 0;
}
.source-list li {
  font-size: 0.8rem;
  color: #6b6b68;
  border: 1px solid #e4e1da;
  border-radius: 999px;
  background: #fff;
  padding: 0.3rem 0.95rem;
}

.data-cta {
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 600;
}
.data-cta a {
  color: #171717;
  text-decoration: none;
  border-bottom: 1px solid #405d82;
  padding-bottom: 2px;
  transition: color var(--dur) var(--ease);
}
.data-cta a:hover {
  color: #405d82;
}

@media (max-width: 800px) {
  .data-sec {
    padding: 20px 1.2rem 90px;
  }
  .philosophy {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.8rem;
  }
}
@media (max-width: 480px) {
  .philosophy {
    grid-template-columns: 1fr;
  }
}
</style>
