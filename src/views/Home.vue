<script setup>
/**
 * Home — 网站首页（FISH · 基督教研究平台品牌页）
 * 风格：现代出版风（浅色）——暖白底、衬线大字、金棕眉题、胶囊按钮、
 *       油画横幅 + 渐变过渡、平台数据统计带、功能亮点三卡、滚动渐入动效。
 * 数据统计从 manifest / 注释清单 / 护教 / 图书馆索引动态读取（各自失败不影响整页）。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchManifest, fetchCommentaryManifest, fetchApologetics, fetchLibraryIndex } from '../lib/data.js'
import bannerUrl from '../assets/hero-banner.jpg'

const manifest = ref(null)
const commentary = ref(null)
const apologetics = ref(null)
const library = ref(null)
/** 累计访问（不蒜子 busuanzi；null = 未获取到 → 统计带不显示该项） */
const bszPv = ref(null)

/** 平台数据统计（数据驱动：译本/卷数/注释源/护教主题/研究问题/累计访问） */
const stats = computed(() => {
  const ts = manifest.value?.translations || []
  const books = ts.reduce((s, t) => s + (t.books?.length || 0), 0)
  const sources = commentary.value?.sources?.length || 0
  const topics = apologetics.value?.topics?.length || 0
  const questions = apologetics.value?.topics?.reduce((s, t) => s + (t.sqCount || 0), 0) || 0
  return {
    versions: ts.length,
    books,
    sources,
    topics,
    questions,
    visits: bszPv.value,
  }
})

/** 统计项定义（en 眉题 + zh 标签；访问量低调展示于页脚，不进统计带） */
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

/** 数字滚动显示值（进入视口后从 0 数到目标，easeOutCubic） */
const statNums = ref({})
let statAnimated = false
const statsRoot = ref(null)
let statsIo = null

/** 单项目标值动画（key → target） */
function animateOne(key, target) {
  const t = target || 0
  statNums.value[key] = 0 // 先落零再递增，避免首帧闪烁
  const start = performance.now()
  const dur = 1000
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    statNums.value[key] = Math.round(t * eased)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function animateCounts() {
  if (statAnimated) return
  statAnimated = true
  for (const item of STAT_ITEMS) {
    const v = stats.value[item.key]
    if (v == null) continue // visits 未就绪：等 busuanzi 值到达后单独补动画
    animateOne(item.key, v)
  }
}

/**
 * 不蒜子计数读取：busuanzi 脚本暴露全局 bszCaller.fetch（JSONP），
 * 本页主动拉取 site_pv——不依赖脚本加载时自动填充 span 的时序
 * （Vue 渲染 span 前脚本可能已执行完，自动填充会落空）。
 * 数值展示在页脚小字（不起眼位置）；本地 localhost 为 busuanzi 共享计数池
 * （非本站真实数据），生产域名按域名独立计数。
 */
let bszTimer = null
let bszDone = false
const BSZ_URL = 'https://busuanzi.ibruce.info/busuanzi?jsonpCallback=BusuanziCallback'

function fetchBusuanzi() {
  if (bszDone) return
  const caller = window.bszCaller
  if (!caller?.fetch) return // 脚本尚未加载完，等待下一轮重试
  caller.fetch(BSZ_URL, (data) => {
    if (data?.site_pv == null) return
    bszDone = true
    bszPv.value = Number(data.site_pv)
  })
}

/** 轮询：等 bszCaller 就绪后拉取一次；成功或 30s 超时即停 */
function pollBusuanzi() {
  if (bszTimer) return
  let tries = 0
  bszTimer = setInterval(() => {
    tries++
    fetchBusuanzi()
    if (bszDone || tries > 20) {
      clearInterval(bszTimer)
      bszTimer = null
    }
  }, 1500)
}

onMounted(async () => {
  // 统计区进入视口 → 触发数字动画（数据未就绪时先记录，数据到达后补触发）
  let statsSeen = false
  if (statsRoot.value) {
    statsIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          statsSeen = true
          if (stats.value.versions) animateCounts()
          statsIo?.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    statsIo.observe(statsRoot.value)
  }

  // 四份数据并行拉取，各自容错；busuanzi 计数由 index.html 注入脚本填充隐藏 span，此处轮询读取
  const jobs = [
    fetchManifest().then((d) => (manifest.value = d)).catch(() => {}),
    fetchCommentaryManifest().then((d) => (commentary.value = d)).catch(() => {}),
    fetchApologetics().then((d) => (apologetics.value = d)).catch(() => {}),
    fetchLibraryIndex().then((d) => (library.value = d)).catch(() => {}),
  ]
  pollBusuanzi()
  await Promise.all(jobs)

  // 数据到达后：统计区已可见（首屏）→ 补触发动画
  if (stats.value.versions && statsRoot.value) {
    const rect = statsRoot.value.getBoundingClientRect()
    if (rect.top < window.innerHeight || statsSeen) animateCounts()
  }
})

/** 功能亮点（静态内容，链接到对应页面） */
const features = [
  {
    icon: 'books',
    title: '多译本对照',
    en: 'Parallel Readings',
    desc: '和合本简繁、思高本、KJV、法文译本并行对照，章节目录随译本联动。',
    to: '/brp',
    cta: '进入读经研究',
  },
  {
    icon: 'scroll',
    title: '解经译注',
    en: 'Commentaries',
    desc: '马太亨利圣经注释中英双语，历代注释家逐卷逐节讲解。',
    to: '/brp',
    cta: '查阅译注',
  },
  {
    icon: 'link',
    title: '串珠与原文',
    en: 'Cross-References',
    desc: '串珠交叉引用、KJV 原文对照与 Strong 原文词典，深入经文脉络。',
    to: '/brp',
    cta: '原文研究',
  },
]

/** 滚动渐入：进入视口时加 .in 类（轻量 IntersectionObserver，组件卸载时清理） */
const revealRoot = ref(null)
let io = null
onMounted(() => {
  const els = revealRoot.value?.querySelectorAll?.('.reveal')
  if (!els?.length) return
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }
    },
    { threshold: 0.15 },
  )
  els.forEach((el) => io.observe(el))
})
onBeforeUnmount(() => {
  io?.disconnect()
  statsIo?.disconnect()
  if (bszTimer) {
    clearInterval(bszTimer)
    bszTimer = null
  }
})
</script>

<template>
  <div class="home">
    <!-- 古典油画横幅：圣保拉在奥斯蒂亚登船（克劳德·洛兰, 1640，公有领域） -->
    <div class="banner" role="img" aria-label="古典油画：圣保拉在奥斯蒂亚港登船">
      <img :src="bannerUrl" alt="克劳德·洛兰《圣保拉在奥斯蒂亚登船》1640" />
      <div class="banner-veil" aria-hidden="true"></div>
    </div>

    <!-- Hero：眉题 + FISH 大字 + 经文副题 / 右侧描述 + 双 CTA + 统计 -->
    <section class="hero">
      <div class="hero-copy">
        <p class="hero-eyebrow">FISH · CHRISTIAN STUDY PLATFORM</p>
        <h1 class="hero-title">FISH</h1>
        <p class="hero-sub">五饼二鱼，众人吃饱（约翰福音 6:1-14）</p>
        <p class="hero-tags">多译本对照 · 解经译注 · 串珠引用 · 原文研究</p>
      </div>
      <div class="hero-side">
        <p class="hero-desc">
          面向中文读者的基督教研究与学习平台：多译本对照阅读、历代解经译注、串珠交叉引用与原文研究，
          助你深入研读圣经。平台内容持续整理更新，不断充实。
        </p>
        <div class="hero-actions">
          <RouterLink to="/brp" class="btn btn-primary">进入读经研究 <span class="arrow">→</span></RouterLink>
          <RouterLink to="/library" class="btn btn-outline">探索图书馆</RouterLink>
        </div>
      </div>
    </section>

    <!-- 平台数据统计（数字滚动动画，数据驱动；访问量在页脚低调展示） -->
    <section v-if="stats.versions" ref="statsRoot" class="stats-band" aria-label="平台数据">
      <span id="busuanzi_value_site_pv" class="bsz-hidden" aria-hidden="true"></span>
      <div v-for="item in STAT_ITEMS" :key="item.key" class="stat-item">
        <span class="stat-en">{{ item.en }}</span>
        <span class="stat-num">{{ fmtNum(statNums[item.key] ?? stats[item.key]) }}</span>
        <span class="stat-line" aria-hidden="true"></span>
        <span class="stat-zh">{{ item.zh }}</span>
      </div>
    </section>

    <!-- 功能亮点三卡 -->
    <section ref="revealRoot" class="features" aria-label="平台功能">
      <div v-for="f in features" :key="f.icon" class="feature-card reveal">
        <div class="feature-icon" aria-hidden="true">
          <svg v-if="f.icon === 'books'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <svg v-else-if="f.icon === 'scroll'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8" />
            <path d="M4 7h4M4 11h4M4 15h4M4 19h4" />
            <path d="M4 3h4v18H4z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div class="feature-body">
          <h3 class="feature-title">{{ f.title }}</h3>
          <p class="feature-en">{{ f.en }}</p>
          <p class="feature-desc">{{ f.desc }}</p>
          <RouterLink :to="f.to" class="feature-link">{{ f.cta }} <span class="arrow">→</span></RouterLink>
        </div>
      </div>
    </section>

    <footer class="home-footer">
      <p>FISH · 基督教研究平台</p>
      <!-- 访问量：页脚小字，不起眼位置（本地为 busuanzi 共享池值，生产为本站真实累计） -->
      <p v-if="stats.visits != null" class="footer-visits">本站累计访问 {{ fmtNum(stats.visits) }} 次</p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  background: var(--bg);
}

/* 古典油画横幅：全宽约 320px，cover 裁切 + 底部渐变过渡到页面底色 */
.banner {
  position: relative;
  width: 100%;
  height: 320px;
  overflow: hidden;
  background: #d9d3c8; /* 油画底色，加载时占位 */
}
.banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
.banner-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(250, 249, 247, 0) 55%, rgba(250, 249, 247, 0.72) 88%, var(--bg) 100%);
  pointer-events: none;
}

/* Hero：非对称两列（左 FISH 大字 / 右侧描述 + 按钮），内容限宽居中 */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 5rem;
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 3.4rem 2rem 3rem;
}
.hero-title {
  margin: 0;
  font-family: var(--serif);
  font-size: var(--fs-hero);
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--ink);
}
/* 品牌眉题：英文小字 + 宽字距 */
.hero-eyebrow {
  margin: 0 0 1.2rem;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--gold);
  letter-spacing: 0.26em;
}
/* 经文副题 */
.hero-sub {
  margin: 1.1rem 0 0;
  font-size: var(--fs-md);
  color: var(--muted);
  letter-spacing: 0.05em;
}
/* 标题下方功能关键词：小字横排 */
.hero-tags {
  margin: 1.3rem 0 0;
  font-size: var(--fs-sm);
  color: var(--muted);
  letter-spacing: 0.06em;
}
.hero-side {
  width: 310px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.6rem;
  padding-top: 0.6rem;
}
.hero-desc {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.95;
  color: #565e68;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

/* 平台数据统计：纯排版（无边框无卡片）——英文眉题 + 衬线大字 + 渐变细线 + 中文标签 */
.stats-band {
  display: flex;
  justify-content: center;
  gap: 3.5rem;
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 2.8rem 2rem 3rem;
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
/* 数字下方渐变细线（金 → 透明） */
.stat-line {
  width: 1.7rem;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--gold) 0%, rgba(139, 115, 85, 0.12) 100%);
}
.stat-zh {
  font-size: var(--fs-xs);
  color: var(--muted);
  letter-spacing: 0.2em;
}
/* busuanzi 计数占位 span：隐藏（脚本填充后本页轮询读取） */
.bsz-hidden {
  display: none;
}

/* 胶囊按钮：主（墨黑）/ 次（描边） */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.5rem;
  border-radius: var(--radius-pill);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background var(--dur) var(--ease);
}
.btn:hover {
  text-decoration: none;
  transform: translateY(-1px);
}
.btn-primary {
  background: var(--ink);
  color: #fff;
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover {
  background: #000;
  box-shadow: var(--shadow-md);
}
.btn-outline {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text);
}
.btn-outline:hover {
  border-color: var(--gold);
  color: var(--gold);
  box-shadow: var(--shadow-sm);
}
.arrow {
  font-size: 1rem;
  line-height: 1;
}

/* 功能亮点三卡 */
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.4rem;
  max-width: var(--content-w);
  margin: 0 auto;
  padding: 1.5rem 2rem 3.5rem;
}
.feature-card {
  display: flex;
  gap: 1.1rem;
  padding: 1.6rem 1.5rem;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
}
.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--line);
}
.feature-icon {
  flex-shrink: 0;
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--gold-soft);
  color: var(--gold);
}
.feature-icon svg {
  width: 1.35rem;
  height: 1.35rem;
}
.feature-body {
  min-width: 0;
}
.feature-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.12rem;
  font-weight: 600;
  color: var(--text);
}
.feature-en {
  margin: 0.15rem 0 0.55rem;
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--gold);
}
.feature-desc {
  margin: 0 0 0.8rem;
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: var(--muted);
}
.feature-link {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--accent);
}
.feature-link:hover {
  text-decoration: none;
  color: var(--gold);
}
.feature-link .arrow {
  display: inline-block;
  transition: transform var(--dur) var(--ease);
}
.feature-link:hover .arrow {
  transform: translateX(3px);
}

/* 滚动渐入：视口内加 .in 触发淡入上移 */
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.55s var(--ease), transform 0.55s var(--ease);
}
.reveal.in {
  opacity: 1;
  transform: none;
}

.home-footer {
  padding: 2rem 2.5rem 2.8rem;
  text-align: center;
  font-size: var(--fs-xs);
  color: #9aa1ab;
  border-top: 1px solid var(--line-soft);
}
/* 访问量：更小更淡的小字，低调不抢眼 */
.footer-visits {
  margin: 0.45rem 0 0;
  font-size: 0.68rem;
  color: #b9bfc8;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

/* 响应式 */
@media (max-width: 900px) {
  .hero {
    gap: 3rem;
    padding: 3rem 2rem;
  }
  .hero-title {
    font-size: 3.6rem;
  }
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 600px) {
  .banner {
    height: 210px;
  }
  .hero {
    flex-direction: column;
    gap: 1.8rem;
    padding: 2.4rem 1.5rem 2.5rem;
  }
  .hero-title {
    font-size: 2.7rem;
    line-height: 1.15;
  }
  .hero-side {
    width: 100%;
    gap: 1.3rem;
  }
  .hero-desc {
    font-size: var(--fs-sm);
  }
  /* 主按钮通栏：移动端整行可点 */
  .hero-actions {
    width: 100%;
  }
  .hero-actions .btn {
    flex: 1;
    justify-content: center;
    padding: 0.7rem 1.2rem;
  }
  .features {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 1rem 1.2rem 2.5rem;
  }
  .feature-card {
    padding: 1.3rem 1.2rem;
  }
  /* 统计区：6 项改 2 列网格（奇数总数时末项占满） */
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
  .home-footer {
    padding: 1.5rem 1.5rem 2rem;
  }
}
</style>
