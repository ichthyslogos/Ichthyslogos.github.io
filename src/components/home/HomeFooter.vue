<script setup>
/**
 * HomeFooter — 首页页脚（HOMEPAGE_DESIGN.md §45）
 * 简洁三列（研究/资源/关于）+ Scripture · Language · History + © 2026 FISH
 */
import { RouterLink } from 'vue-router'

defineProps({
  visits: { type: Number, default: null }, // 累计访问（busuanzi；null 不显示）
})

/** 数字显示格式化：≥1万 用「万」单位，其余千分位 */
function fmtNum(n) {
  if (n == null) return ''
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-Hans')
}

const cols = [
  {
    title: '研究',
    links: [
      { label: '读经研究', to: '/brp' },
      { label: '圣经地图', to: '/map' },
      { label: '护教', to: '/apologetics' },
      { label: '教会史', to: '/history' },
    ],
  },
  {
    title: '资源',
    links: [
      { label: '书籍', to: '/library' },
      { label: '数据来源与许可', to: '/sources' },
    ],
  },
  {
    title: '关于',
    links: [{ label: 'GitHub', to: 'https://github.com/ichthyslogos/Ichthyslogos.github.io', external: true }],
  },
]
</script>

<template>
  <footer class="home-footer" aria-label="页脚">
    <div class="foot-inner">
      <div class="foot-brand">
        <p class="foot-name">FISH</p>
        <p class="foot-tag">Christian Study Platform</p>
      </div>
      <nav v-for="col in cols" :key="col.title" class="foot-col" :aria-label="col.title">
        <p class="foot-col-title">{{ col.title }}</p>
        <a
          v-for="l in col.links"
          :key="l.label"
          :href="l.external ? l.to : undefined"
          :to="l.external ? undefined : l.to"
          :target="l.external ? '_blank' : undefined"
          :rel="l.external ? 'noopener' : undefined"
          class="foot-link"
        >
          {{ l.label }}
        </a>
      </nav>
    </div>
    <div class="foot-base">
      <p class="foot-motto">Scripture · Language · History</p>
      <p class="foot-copy">© 2026 FISH</p>
      <p v-if="visits != null" class="foot-visits">本站累计访问 {{ fmtNum(visits) }} 次</p>
    </div>
  </footer>
</template>

<style scoped>
.home-footer {
  background: #f8f7f3;
  border-top: 1px solid #e4e1da;
}
.foot-inner {
  display: flex;
  justify-content: space-between;
  gap: 3rem;
  flex-wrap: wrap;
  max-width: 1200px;
  margin: 0 auto;
  padding: 3.4rem 2rem 2.6rem;
}
.foot-brand {
  flex-shrink: 0;
}
.foot-name {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.5rem;
  letter-spacing: 0.3em;
  color: #171717;
}
.foot-tag {
  margin: 0.3rem 0 0;
  font-size: 0.72rem;
  color: #a8a49b;
  letter-spacing: 0.12em;
}
.foot-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 8rem;
}
.foot-col-title {
  margin: 0 0 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #405d82;
  letter-spacing: 0.2em;
}
.foot-link {
  font-size: 0.84rem;
  color: #6b6b68;
  text-decoration: none;
  transition: color var(--dur) var(--ease);
}
.foot-link:hover {
  color: #171717;
  text-decoration: none;
}
.foot-base {
  border-top: 1px solid #e4e1da;
  padding: 1.2rem 2rem 1.6rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 1200px;
  margin: 0 auto;
}
.foot-motto {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  color: #b5b1a8;
}
.foot-copy {
  margin: 0;
  font-size: 0.7rem;
  color: #b5b1a8;
}
.foot-visits {
  margin: 0;
  font-size: 0.68rem;
  color: #c2beb5;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 700px) {
  .foot-inner {
    gap: 2rem;
    padding: 2.4rem 1.4rem 2rem;
  }
}
</style>
