<script setup>
/**
 * ResearchSection — 研究生态入口（HOMEPAGE_DESIGN.md §25-30）
 * 4 个核心入口卡：左上编号 + 标题 + 简介 + 标签 + 底部箭头；细边框、无阴影、大面积留白
 */
import { RouterLink } from 'vue-router'

const cards = [
  {
    no: '01',
    title: '读经研究',
    en: 'Scripture',
    desc: '从经文本身开始。',
    tags: ['多译本', '原文', "Strong's", '串珠', '注释'],
    to: '/brp',
    cta: '进入研究',
  },
  {
    no: '02',
    title: '圣经地图',
    en: 'Bible Map',
    desc: '把经文重新放回真实的地理空间。',
    tags: ['城市', '道路', '疆域', '旅行路线'],
    to: '/map',
    cta: '探索地图',
  },
  {
    no: '03',
    title: '历史时间轴',
    en: 'Timeline',
    desc: '理解圣经发生的时代。',
    tags: ['国家', '王朝', '人物', '事件', '城市'],
    to: '/map',
    cta: '探索时间轴',
  },
  {
    no: '04',
    title: '原文研究',
    en: 'Original Languages',
    desc: '深入一个词，而不仅仅是一节经文。',
    tags: ['Hebrew', 'Aramaic', 'Greek'],
    to: '/brp',
    cta: '开始研究',
  },
]
</script>

<template>
  <section class="research" aria-label="探索圣经研究">
    <header class="sec-head">
      <p class="sec-kicker">EXPLORE</p>
      <h2 class="sec-title">探索圣经研究</h2>
      <p class="sec-sub">从经文出发，连接语言、历史与地理。</p>
    </header>

    <div class="card-grid">
      <RouterLink v-for="c in cards" :key="c.no" :to="c.to" class="research-card">
        <span class="card-no" aria-hidden="true">{{ c.no }}</span>
        <h3 class="card-title">{{ c.title }}</h3>
        <p class="card-en">{{ c.en }}</p>
        <p class="card-desc">{{ c.desc }}</p>
        <ul class="card-tags" aria-label="功能标签">
          <li v-for="t in c.tags" :key="t">{{ t }}</li>
        </ul>
        <span class="card-cta">{{ c.cta }} <span class="arrow">→</span></span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.research {
  background: #f8f7f3;
  padding: 40px 2rem 140px;
}
.sec-head {
  max-width: 1200px;
  margin: 0 auto 3.2rem;
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

/* 2×2 卡片网格（§30）：细边框、无阴影、大面积留白 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.4rem;
  max-width: 1200px;
  margin: 0 auto;
}
.research-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 2.2rem 2rem 1.8rem;
  border: 1px solid #e4e1da;
  border-radius: 12px;
  background: #fff;
  text-decoration: none;
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.research-card:hover {
  text-decoration: none;
  border-color: #405d82;
  transform: translateY(-2px);
}
.card-no {
  position: absolute;
  top: 1.2rem;
  right: 1.4rem;
  font-family: var(--serif);
  font-size: 1.05rem;
  color: #c9c5bc;
  letter-spacing: 0.1em;
}
.card-title {
  margin: 0.4rem 0 0;
  font-family: var(--serif);
  font-size: 1.5rem;
  font-weight: 600;
  color: #171717;
}
.card-en {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: #405d82;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.card-desc {
  margin: 0.2rem 0 0.8rem;
  font-size: 0.88rem;
  color: #6b6b68;
  line-height: 1.8;
}
.card-tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0 0 1.4rem;
  padding: 0;
}
.card-tags li {
  font-size: 0.72rem;
  color: #6b6b68;
  border: 1px solid #e4e1da;
  border-radius: 999px;
  padding: 0.12rem 0.6rem;
}
.card-cta {
  margin-top: auto;
  font-size: 0.88rem;
  font-weight: 600;
  color: #171717;
  transition: color var(--dur) var(--ease);
}
.research-card:hover .card-cta {
  color: #405d82;
}
.card-cta .arrow {
  display: inline-block;
  transition: transform var(--dur) var(--ease);
}
.research-card:hover .card-cta .arrow {
  transform: translateX(3px);
}

/* 响应式（§56）：移动端单列 */
@media (max-width: 700px) {
  .research {
    padding: 20px 1.2rem 90px;
  }
  .card-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .research-card {
    padding: 1.7rem 1.4rem 1.4rem;
  }
}
</style>
