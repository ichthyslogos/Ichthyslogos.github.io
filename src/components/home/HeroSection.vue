<script setup>
/**
 * HeroSection — 首页 Hero（HOMEPAGE_DESIGN.md §11-21）
 * 古典油画横幅（渐隐过渡）+ FISH 衬线大字 + 经文副题（品牌蓝）+ 功能关键词（text+separator）
 * + 右侧简介 + 双 CTA（墨黑胶囊 / 描边胶囊）+ 数据统计带（数据驱动，数字滚动动画）
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import bannerUrl from '../../assets/hero-banner.jpg'

const props = defineProps({
  stats: { type: Object, default: () => ({}) }, // { versions, books, sources, topics, questions }
})

/** 统计项定义（en 眉题 + zh 标签） */
const STAT_ITEMS = [
  { key: 'versions', en: 'VERSIONS', zh: '个译本' },
  { key: 'books', en: 'VOLUMES', zh: '卷经文' },
  { key: 'sources', en: 'COMMENTARIES', zh: '注释源' },
  { key: 'topics', en: 'TOPICS', zh: '护教主题' },
  { key: 'questions', en: 'QUESTIONS', zh: '研究问题' },
]

/** 数字显示格式化：≥1万 用「万」单位，其余千分位 */
function fmtNum(n) {
  if (n == null) return ''
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return n.toLocaleString('zh-Hans')
}

/* —— 数字滚动动画（进入视口触发；respect reduced-motion；卸载取消 rAF） —— */
const statNums = ref({})
let statAnimated = false
const statsRoot = ref(null)
let statsIo = null
const rafIds = new Set()
function raf(cb) {
  const id = requestAnimationFrame((t) => {
    rafIds.delete(id)
    cb(t)
  })
  rafIds.add(id)
  return id
}
const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
function animateOne(key, target) {
  const t = target || 0
  if (prefersReducedMotion()) {
    statNums.value[key] = t
    return
  }
  statNums.value[key] = 0
  const start = performance.now()
  const dur = 1000
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1)
    statNums.value[key] = Math.round(t * (1 - Math.pow(1 - p, 3)))
    if (p < 1) raf(tick)
  }
  raf(tick)
}
function animateCounts() {
  if (statAnimated) return
  statAnimated = true
  for (const item of STAT_ITEMS) {
    const v = props.stats[item.key]
    if (v != null) animateOne(item.key, v)
  }
}
// 统计区在 v-if="stats.versions" 内，而 stats 由父页异步拉取——onMounted 时必然
// 尚未渲染，IO 挂不上。改为数据到达后再建观察器
watch(
  () => props.stats.versions,
  async () => {
    if (!props.stats.versions || statsIo || statAnimated) return
    await nextTick()
    if (!statsRoot.value) return
    statsIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          animateCounts()
          statsIo?.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    statsIo.observe(statsRoot.value)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  statsIo?.disconnect()
  rafIds.forEach((id) => cancelAnimationFrame(id))
  rafIds.clear()
})
</script>

<template>
  <div class="hero-wrap">
    <!-- 古典油画横幅：圣保拉在奥斯蒂亚登船（克劳德·洛兰, 1640，公有领域）——渐隐过渡到米白背景 -->
    <div class="banner" role="img" aria-label="古典油画：圣保拉在奥斯蒂亚港登船">
      <img :src="bannerUrl" alt="克劳德·洛兰《圣保拉在奥斯蒂亚登船》1640" loading="eager" />
      <div class="banner-veil" aria-hidden="true"></div>
    </div>

    <section class="hero" aria-label="FISH 简介">
      <div class="hero-copy">
        <p class="hero-eyebrow">FISH · CHRISTIAN STUDY PLATFORM</p>
        <h1 class="hero-title">FISH</h1>
        <p class="hero-sub">五饼二鱼，众人吃饱（约翰福音 6:1–14）</p>
        <p class="hero-tags">多译本对照 · 解经评注 · 串珠引用 · 原文研究</p>
      </div>
      <div class="hero-side">
        <p class="hero-desc">
          面向中文读者的基督教研究与学习平台：多译本对照阅读、历代解经评注、串珠交叉引用与原文研究，
          帮助你深入读懂圣经。
        </p>
        <div class="hero-actions">
          <RouterLink to="/brp" class="btn btn-primary">进入读经研究 <span class="arrow">→</span></RouterLink>
          <RouterLink to="/library" class="btn btn-outline">浏览书籍</RouterLink>
        </div>
      </div>
    </section>

    <!-- 平台数据统计（数据驱动，来自 manifest/注释清单/护教动态；数字滚动动画） -->
    <section v-if="props.stats.versions" ref="statsRoot" class="stats-band" aria-label="平台数据">
      <div v-for="item in STAT_ITEMS" :key="item.key" class="stat-item">
        <span class="stat-en">{{ item.en }}</span>
        <span class="stat-num">{{ fmtNum(statNums[item.key] ?? props.stats[item.key]) }}</span>
        <span class="stat-line" aria-hidden="true"></span>
        <span class="stat-zh">{{ item.zh }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero-wrap {
  background: var(--bg);
}

/* 古典油画横幅：全宽约 430px，cover 裁切 + 底部渐变过渡（HOMEPAGE_DESIGN §13） */
.banner {
  position: relative;
  width: 100%;
  height: 430px;
  overflow: hidden;
  background: #d9d3c8; /* 油画底色，加载时占位 */
  animation: heroFade 0.8s var(--ease) both;
}
.banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
/* 图片渐隐：55% 起淡出 → 米白背景（§13 指定梯度） */
.banner-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(248, 247, 243, 0) 45%,
    rgba(248, 247, 243, 0.45) 70%,
    #f8f7f3 100%
  );
  pointer-events: none;
}
@keyframes heroFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Hero：非对称两列（左 FISH 大字 / 右侧描述 + 按钮），内容限宽居中 */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 3.2rem 2rem 2.6rem;
  animation: heroUp 0.7s var(--ease) 0.15s both;
}
@keyframes heroUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: none; }
}
.hero-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 108px;
  line-height: 1.05;
  font-weight: 400; /* 不加粗（§16.1） */
  letter-spacing: 0.14em;
  color: var(--ink);
}
/* 品牌眉题：英文小字 + 宽字距（§16） */
.hero-eyebrow {
  margin: 0 0 1.2rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.28em;
}
/* 经文副题：品牌蓝（§17） */
.hero-sub {
  margin: 1.1rem 0 0;
  font-size: 14px;
  color: #405d82;
  letter-spacing: 0.05em;
}
/* 功能关键词：text + separator（§18，不做卡片） */
.hero-tags {
  margin: 1.3rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
  letter-spacing: 0.06em;
}
.hero-side {
  width: 360px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.6rem;
  padding-top: 0.6rem;
}
.hero-desc {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.95;
  color: #565e68;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
/* 胶囊按钮（§20）：主墨黑 #171717 / 次描边 #E4E1DA，高 44px */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  padding: 0 1.6rem;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--dur) var(--ease), background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.btn:hover {
  text-decoration: none;
  transform: translateY(-1px);
}
.btn-primary {
  background: #171717;
  color: #fff;
}
.btn-primary:hover {
  background: #000;
}
.btn-outline {
  background: transparent;
  border: 1px solid #e4e1da;
  color: #171717;
}
.btn-outline:hover {
  border-color: #405d82;
  color: #405d82;
}
.arrow {
  font-size: 1rem;
  line-height: 1;
}

/* 平台数据统计（§21）：纯排版，数字滚动动画 */
.stats-band {
  display: flex;
  justify-content: center;
  gap: 3.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.6rem 2rem 3.4rem;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 6.5rem;
}
.stat-en {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.32em;
}
.stat-num {
  font-family: var(--serif);
  font-size: 2.9rem;
  font-weight: 600;
  line-height: 1.1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.stat-line {
  width: 1.7rem;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--gold) 0%, rgba(139, 115, 85, 0.12) 100%);
}
.stat-zh {
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.2em;
}

/* 响应式（§52-55）：平板缩小 FISH 字号；移动端上下布局 */
@media (max-width: 900px) {
  .hero {
    gap: 3rem;
    padding: 3rem 2rem;
  }
  .hero-title {
    font-size: 76px;
  }
}
@media (max-width: 600px) {
  .banner {
    height: 240px;
  }
  .hero {
    flex-direction: column;
    gap: 1.8rem;
    padding: 2.4rem 1.5rem 2.5rem;
  }
  .hero-title {
    font-size: 52px;
    line-height: 1.15;
  }
  .hero-side {
    width: 100%;
    gap: 1.3rem;
  }
  .hero-actions {
    width: 100%;
  }
  .hero-actions .btn {
    flex: 1;
    padding: 0 1.2rem;
  }
  .stats-band {
    flex-wrap: wrap;
    gap: 1.6rem 0;
    padding: 2.2rem 1rem 2.4rem;
  }
  .stat-item {
    width: 50%;
    min-width: 0;
    gap: 0.4rem;
  }
  .stat-item:last-child:nth-child(odd) {
    width: 100%;
  }
  .stat-num {
    font-size: 2.2rem;
  }
}
</style>
