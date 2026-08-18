<script setup>
/**
 * Home — 网站首页（FISH · 基督教研究平台品牌页）
 *
 * 按 HOMEPAGE_DESIGN.md v1.0 重构：Hero（古典油画 + FISH 大字 + 数据统计带）→
 * 理念（圣经不是孤立的文本 + 关系网络）→ 研究生态（4 卡）→ 圣经世界地图预览
 * （真实 MapLibre + 时间轴）→ 全局搜索 → 数据与来源 → 结尾号召 → 页脚。
 *
 * 数据统计从 manifest / 注释清单 / 护教动态读取（各自失败不影响整页）；
 * 区块组件位于 components/home/（§61 模块化要求）。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { fetchManifest, fetchCommentaryManifest, fetchApologetics } from '../lib/data.js'
import HeroSection from '../components/home/HeroSection.vue'
import IntroSection from '../components/home/IntroSection.vue'
import ResearchSection from '../components/home/ResearchSection.vue'
import BibleMapPreview from '../components/home/BibleMapPreview.vue'
import UniversalSearch from '../components/home/UniversalSearch.vue'
import DataSection from '../components/home/DataSection.vue'
import FinalCTA from '../components/home/FinalCTA.vue'
import HomeFooter from '../components/home/HomeFooter.vue'

const manifest = ref(null)
const commentary = ref(null)
const apologetics = ref(null)
/** 累计访问（不蒜子 busuanzi；null = 未获取到 → 页脚不显示该项） */
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

/**
 * 不蒜子计数读取：busuanzi 脚本（index.html 注入）暴露全局 bszCaller.fetch（JSONP），
 * 本页主动拉取 site_pv——数值展示在页脚小字（不起眼位置）。
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

/** 滚动渐入：区块进入视口加 .in 类（一次；轻量 IntersectionObserver；respect reduced-motion） */
const revealRoot = ref(null)
let io = null
const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(async () => {
  const jobs = [
    fetchManifest().then((d) => (manifest.value = d)).catch(() => {}),
    fetchCommentaryManifest().then((d) => (commentary.value = d)).catch(() => {}),
    fetchApologetics().then((d) => (apologetics.value = d)).catch(() => {}),
  ]
  pollBusuanzi()
  await Promise.all(jobs)

  if (!prefersReducedMotion()) {
    const els = revealRoot.value?.querySelectorAll?.('.reveal')
    if (els?.length) {
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
    }
  } else {
    // 系统减弱动态：直接全部显示
    revealRoot.value?.querySelectorAll?.('.reveal').forEach((el) => el.classList.add('in'))
  }
})
onBeforeUnmount(() => {
  io?.disconnect()
  if (bszTimer) {
    clearInterval(bszTimer)
    bszTimer = null
  }
})
</script>

<template>
  <div class="home">
    <HeroSection :stats="stats" />

    <div ref="revealRoot">
      <div class="reveal">
        <IntroSection />
      </div>
      <div class="reveal">
        <ResearchSection />
      </div>
      <div class="reveal">
        <BibleMapPreview />
      </div>
      <div class="reveal">
        <UniversalSearch />
      </div>
      <div class="reveal">
        <DataSection />
      </div>
      <div class="reveal">
        <FinalCTA />
      </div>
    </div>

    <HomeFooter :visits="stats.visits" />
  </div>
</template>

<!-- 滚动渐入（§51：500ms 一次；区块级） -->
<style>
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s var(--ease), transform 0.5s var(--ease);
}
.reveal.in {
  opacity: 1;
  transform: none;
}
</style>
