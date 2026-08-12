<script setup>
/**
 * ChurchHistoryPage — 教会史（《历史的轨迹——二千年教会史》在线阅读器）
 * 路由：/history（默认第壹部导论）与 /history/:part/:chapter（chapter: intro | 章号）
 * 数据：content.json（索引）→ partN.json 按需加载；插图位于 data/church-history/images/
 * 结构：50 章按 5 部组织，每部有部导论（intro）；章内容为块序列：
 *   h 小节标题 / p 正文段落（首行缩进）/ img 插图（附【图注】）
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchChurchHistory, fetchChurchHistoryPart, churchHistoryImg } from '../../lib/data.js'

const route = useRoute()
const router = useRouter()

const index = ref(null)
const part = ref(null) // 当前部完整数据（intro + chapters）
const loading = ref(false)
const error = ref('')

/** 当前部序号（1-5，默认 1） */
const partNo = computed(() => {
  const n = Number(route.params.part)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1
})

/** 当前章节选择：'intro'（部导论）或章号数字（默认部导论） */
const chapterKey = computed(() => {
  const c = route.params.chapter
  if (!c) return 'intro'
  const n = Number(c)
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 'intro'
})

onMounted(async () => {
  try {
    index.value = await fetchChurchHistory()
  } catch (e) {
    error.value = e.message
  }
})

/** 按需加载当前部数据（含切换守卫：快速切换部时丢弃过期响应） */
let partSeq = 0
watch(
  partNo,
  async (n) => {
    const seq = ++partSeq
    loading.value = true
    try {
      const p = await fetchChurchHistoryPart(n)
      if (seq !== partSeq) return
      part.value = p
    } catch (e) {
      if (seq !== partSeq) return
      error.value = e.message
    } finally {
      if (seq === partSeq) loading.value = false
    }
  },
  { immediate: true },
)

/** 阅读器滚动回顶（.ch-main 是阅读区滚动容器） */
function scrollTop() {
  chMain.value?.scrollTo(0, 0)
}

/** 切换章节（章号或 'intro'）；URL 即状态 */
function go(partIdx, key) {
  const c = key === 'intro' ? 'intro' : String(key)
  if (partIdx === partNo.value && c === String(chapterKey.value)) return
  router.push(`/history/${partIdx}/${c}`)
  scrollTop()
}

/* ---------- 阅读内容组装 ---------- */

/** 当前展示内容：部导论或章（找不到则回退导论） */
const currentDoc = computed(() => {
  if (!part.value) return null
  if (chapterKey.value === 'intro') return { kind: 'intro', ...part.value.intro }
  const ch = part.value.chapters.find((c) => c.no === chapterKey.value)
  return ch || { kind: 'intro', ...part.value.intro }
})

/** 当前章标题（去掉 blocks 中与标题重复的首个 h 块） */
const docTitle = computed(() => {
  const d = currentDoc.value
  if (!d) return ''
  if (d.kind === 'intro') return d.title
  return `第${cnNum(d.no)}章 ${d.title}`
})

/** 中文数字 */
function cnNum(n) {
  const map = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return map[n]
  if (n < 20) return '十' + (n > 10 ? map[n % 10] : '')
  if (n < 100) return map[Math.floor(n / 10)] + '十' + (n % 10 ? map[n % 10] : '')
  return String(n)
}

/** 章标题（阿拉伯数字版，用于副题展示） */
const docTitleNum = computed(() => {
  const d = currentDoc.value
  if (!d || d.kind === 'intro') return ''
  return `第${d.no}章`
})

/** 渲染块：跳过与标题重复的 h（如「第一章 新约教会的诞生」） */
const docBlocks = computed(() => {
  const d = currentDoc.value
  if (!d) return []
  const skip = d.kind === 'intro' ? '导 论' : `第${cnNum(d.no)}章 ${d.title}`
  return d.blocks.filter((b, i) => !(i === 0 && b.t === 'h' && b.text === skip))
})

/* ---------- 全书线性导航（上一章 / 下一章） ---------- */

/** 全书线性章节表：每部 intro + 各章 */
const linear = computed(() => {
  if (!index.value) return []
  const list = []
  index.value.parts.forEach((p, i) => {
    list.push({ part: i + 1, key: 'intro', label: `第${p.no}部导论`, short: '部导论' })
    for (let c = p.firstChapter; c <= p.lastChapter; c++) {
      list.push({ part: i + 1, key: c, label: `第${c}章`, short: `第${c}章` })
    }
  })
  return list
})

const currentIdx = computed(() =>
  linear.value.findIndex((x) => x.part === partNo.value && String(x.key) === String(chapterKey.value)),
)

const prevDoc = computed(() => (currentIdx.value > 0 ? linear.value[currentIdx.value - 1] : null))
const nextDoc = computed(() =>
  currentIdx.value >= 0 && currentIdx.value < linear.value.length - 1
    ? linear.value[currentIdx.value + 1]
    : null,
)

/** 当前部信息（来自索引，含章节数/时期） */
const partMeta = computed(() => index.value?.parts[partNo.value - 1] || null)

/* ---------- 阅读进度（书眉条金线） ---------- */
const chMain = ref(null) // 阅读区滚动容器
const progress = ref(0)
function onScroll() {
  const el = chMain.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? Math.min(1, el.scrollTop / max) : 0
}
onMounted(() => {
  chMain.value?.addEventListener('scroll', onScroll)
  onScroll()
})
onBeforeUnmount(() => {
  chMain.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="ch-page">
    <template v-if="index">
      <!-- 页头：单行窄书眉条（大标题不再常驻，滚动时显示当前位置 + 阅读进度） -->
      <header class="ch-hero">
        <div class="ch-hero-inner">
          <span class="ch-hero-title">历史的轨迹——二千年教会史</span>
          <span class="ch-hero-meta">
            <template v-if="partMeta">第{{ partMeta.no }}部 · {{ partMeta.title }}</template>
            <template v-if="docTitleNum"><span class="ch-hero-sep">/</span>{{ docTitleNum }}</template>
          </span>
        </div>
        <div class="ch-progress" aria-hidden="true">
          <i :style="{ width: (progress * 100).toFixed(1) + '%' }"></i>
        </div>
      </header>

      <div class="ch-body">
        <!-- 目录栏 -->
        <aside class="ch-side">
          <div
            v-for="(p, i) in index.parts"
            :key="p.no"
            class="ch-part"
            :class="{ active: partNo === i + 1 }"
          >
            <button
              class="ch-part-btn"
              @click="go(i + 1, 'intro')"
            >
              <span class="ch-part-no">第{{ p.no }}部</span>
              <span class="ch-part-name">{{ p.title }}</span>
            </button>
            <div v-if="partNo === i + 1" class="ch-chapters">
              <button
                class="ch-ch-btn"
                :class="{ active: chapterKey === 'intro' }"
                @click="go(i + 1, 'intro')"
              >
                <span class="ch-ch-dot">导</span>
                <span class="ch-ch-label">部导论</span>
              </button>
              <button
                v-for="c in p.lastChapter - p.firstChapter + 1"
                :key="c"
                class="ch-ch-btn"
                :class="{ active: chapterKey === p.firstChapter + c - 1 }"
                @click="go(i + 1, p.firstChapter + c - 1)"
              >
                <span class="ch-ch-dot">{{ p.firstChapter + c - 1 }}</span>
                <span class="ch-ch-label">
                  {{ part?.chapters[c - 1]?.title || `第${p.firstChapter + c - 1}章` }}
                </span>
              </button>
            </div>
          </div>
        </aside>

        <!-- 阅读区 -->
        <main ref="chMain" class="ch-main">
          <div v-if="error" class="ch-error">{{ error }}</div>
          <div v-else-if="loading" class="ch-state">加载中…</div>
          <template v-else-if="currentDoc">
            <article class="ch-doc">
              <!-- 移动端章选择（桌面隐藏） -->
              <nav v-if="part" class="ch-mobile-nav" aria-label="章节">
                <button
                  class="ch-mobile-chip"
                  :class="{ active: chapterKey === 'intro' }"
                  @click="go(partNo, 'intro')"
                >
                  导论
                </button>
                <button
                  v-for="c in part.chapters"
                  :key="c.no"
                  class="ch-mobile-chip"
                  :class="{ active: chapterKey === c.no }"
                  @click="go(partNo, c.no)"
                >
                  {{ c.no }}
                </button>
              </nav>

              <header class="ch-doc-head">
                <p class="ch-doc-kicker">
                  <template v-if="partMeta">
                    第{{ partMeta.no }}部 · {{ partMeta.title }}<span class="ch-doc-kicker-sep">/</span>{{ docTitleNum }}<span class="ch-doc-kicker-sep">·</span>{{ partMeta.period }}
                  </template>
                  <template v-else>{{ docTitleNum }}</template>
                </p>
                <h2 class="ch-doc-title">{{ docTitle }}</h2>
              </header>

              <div class="ch-blocks">
                <template v-for="(b, bi) in docBlocks" :key="bi">
                  <h3 v-if="b.t === 'h'" class="ch-block-h">{{ b.text }}</h3>
                  <p v-else-if="b.t === 'p'" class="ch-block-p">{{ b.text }}</p>
                  <figure v-else-if="b.t === 'img'" class="ch-block-img">
                    <img
                      :src="churchHistoryImg(b.src)"
                      :alt="b.caption || '插图'"
                      loading="lazy"
                    />
                    <figcaption v-if="b.caption">{{ b.caption }}</figcaption>
                  </figure>
                </template>
              </div>

              <footer class="ch-doc-nav">
                <button
                  class="ch-nav-btn"
                  :disabled="!prevDoc"
                  @click="prevDoc && go(prevDoc.part, prevDoc.key)"
                >
                  <span class="ch-nav-arrow">←</span>
                  <span class="ch-nav-text">
                    <small>上一篇</small>
                    {{ prevDoc ? prevDoc.label : '已是第一篇' }}
                  </span>
                </button>
                <button
                  class="ch-nav-btn next"
                  :disabled="!nextDoc"
                  @click="nextDoc && go(nextDoc.part, nextDoc.key)"
                >
                  <span class="ch-nav-text">
                    <small>下一篇</small>
                    {{ nextDoc ? nextDoc.label : '已是最后一篇' }}
                  </span>
                  <span class="ch-nav-arrow">→</span>
                </button>
              </footer>
            </article>
          </template>
          <div v-else class="ch-state">内容加载中…</div>
        </main>
      </div>
    </template>
    <div v-else-if="error" class="ch-state">{{ error }}</div>
    <div v-else class="ch-state">数据加载中…</div>
  </div>
</template>

<style scoped>
.ch-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg);
}
.ch-state,
.ch-error {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}
.ch-error {
  color: #b3413b;
}

/* ---------- 页头：单行窄书眉条（与全局导航同白，无装饰） ---------- */
.ch-hero {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  border-bottom: 1px solid var(--line-soft);
}
.ch-hero-inner {
  height: 46px;
  max-width: 96rem;
  margin: 0 auto;
  padding: 0 1.3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.ch-hero-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-hero-meta {
  font-size: var(--fs-xs);
  color: var(--muted);
  white-space: nowrap;
}
.ch-hero-sep {
  margin: 0 0.5em;
  color: var(--line);
}
/* 阅读进度细线（书眉条底部） */
.ch-progress {
  height: 2px;
  background: var(--line-soft);
}
.ch-progress i {
  display: block;
  height: 100%;
  background: var(--gold);
  border-radius: 2px;
  transition: width 0.12s linear;
}

/* ---------- 双栏布局 ---------- */
.ch-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
/* 目录栏：与全站一致的白底极简 */
.ch-side {
  width: 18.5rem;
  flex-shrink: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  border-right: 1px solid var(--line-soft);
  background: #fff;
  padding: 0.9rem 0.7rem 2rem;
}
.ch-part + .ch-part {
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--line-soft);
}
.ch-part-btn {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.ch-part-btn:hover {
  background: var(--accent-soft);
}
.ch-part.active .ch-part-btn {
  background: var(--accent-soft);
}
.ch-part-no {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
}
.ch-part-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}
.ch-chapters {
  margin: 0.25rem 0 0.2rem;
}
.ch-ch-btn {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  width: 100%;
  padding: 0.3rem 0.75rem;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.45;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.ch-ch-btn:hover {
  background: var(--accent-soft);
  color: var(--text);
}
.ch-ch-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.ch-ch-dot {
  flex-shrink: 0;
  margin-top: 0.1rem;
  min-width: 1.1rem;
  font-size: var(--fs-xs);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
}
.ch-ch-btn.active .ch-ch-dot {
  color: var(--accent);
  font-weight: 600;
}
.ch-ch-label {
  /* 章标题完整显示：允许折行（两行内），不再省略号截断 */
  overflow: visible;
  white-space: normal;
  word-break: break-word;
}

/* ---------- 阅读区 ---------- */
.ch-main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  display: flex;
  justify-content: center;
}
.ch-doc {
  width: 100%;
  max-width: 46rem;
  padding: 1.5rem 2rem 3rem;
}
/* 章首标题区：灰 kicker + 衬线标题 + 浅灰细线 */
.ch-doc-head {
  position: relative;
  padding: 0.5rem 0 1rem;
  margin-bottom: 1.5rem;
}
.ch-doc-head::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--line-soft);
}
.ch-doc-kicker {
  margin: 0 0 0.5rem;
  font-size: var(--fs-xs);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ch-doc-kicker-sep {
  margin: 0 0.5em;
  color: var(--line);
}
.ch-doc-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.3rem;
  color: var(--ink);
  letter-spacing: 0.02em;
  line-height: 1.6;
}

/* 正文块 */
.ch-blocks {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ch-block-h {
  margin: 1.5rem 0 0.55rem;
  padding-left: 0.65rem;
  border-left: 2px solid var(--line);
  font-family: var(--serif);
  font-size: 1.06rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.6;
}
.ch-block-p {
  margin: 0;
  font-family: var(--serif);
  font-size: 1rem;
  line-height: 2;
  color: #2b3138;
  text-align: justify;
  text-indent: 2em;
}
.ch-block-img {
  margin: 1.5rem auto 0.7rem;
  max-width: 92%;
}
.ch-block-img img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  background: var(--panel);
}
.ch-block-img figcaption {
  margin-top: 0.55rem;
  text-align: center;
  font-size: var(--fs-sm);
  color: var(--muted);
}

/* 移动端章选择 chips（仅移动端显示） */
.ch-mobile-nav {
  display: none;
  gap: 0.45rem;
  padding-bottom: 1rem;
  margin-bottom: 1.2rem;
  border-bottom: 1px dashed var(--line-soft);
}
.ch-mobile-chip {
  flex-shrink: 0;
  min-width: 2.75rem;
  height: 2.75rem;
  padding: 0 0.8rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  font-size: var(--fs-sm);
  color: var(--muted);
  cursor: pointer;
  transition: all var(--dur) var(--ease);
}
.ch-mobile-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* 上一篇 / 下一篇 */
.ch-doc-nav {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2.6rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--line);
}
.ch-nav-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.95rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel);
  cursor: pointer;
  color: var(--text);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.ch-nav-btn:hover:not(:disabled) {
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}
.ch-nav-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.ch-nav-btn.next {
  flex-direction: row-reverse;
  text-align: right;
}
.ch-nav-arrow {
  color: var(--muted);
  font-size: 1.05rem;
}
.ch-nav-text {
  display: flex;
  flex-direction: column;
  font-size: 0.92rem;
  font-weight: 600;
}
.ch-nav-text small {
  font-size: var(--fs-xs);
  font-weight: 400;
  color: var(--muted);
}

/* ---------- 移动端 ---------- */
@media (max-width: 860px) {
  .ch-hero-inner {
    height: 42px;
    padding: 0 0.9rem;
  }
  .ch-hero-meta {
    display: none; /* 移动端书眉条只显示书名，节省空间 */
  }
  .ch-body {
    flex-direction: column;
  }
  .ch-side {
    width: 100%;
    flex-shrink: 0;
    border-right: none;
    border-bottom: 1px solid var(--line-soft);
    padding: 0.6rem 0.8rem;
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .ch-mobile-nav {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .ch-mobile-nav::-webkit-scrollbar,
  .ch-side::-webkit-scrollbar {
    display: none;
  }
  .ch-part {
    flex-shrink: 0;
    margin-top: 0 !important;
    padding-top: 0 !important;
    border-top: none !important;
  }
  .ch-part-btn {
    padding: 0.45rem 0.85rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    white-space: nowrap;
  }
  .ch-part.active .ch-part-btn {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .ch-chapters {
    display: none; /* 移动端章列表折叠在阅读器内导航 */
  }
  .ch-main {
    overflow: visible;
  }
  .ch-doc {
    padding: 1.2rem 1.1rem 3rem;
  }
  .ch-doc-title {
    font-size: 1.15rem;
  }
  .ch-block-p {
    font-size: 0.98rem;
  }
  .ch-doc-nav {
    flex-direction: column;
  }
  .ch-nav-btn.next {
    flex-direction: row;
    text-align: left;
  }
}
</style>
