<script setup>
/**
 * ScripturePanel — 经文正文面板（brp 子组件）
 * 包含：书卷菜单按钮（移动端抽屉）、书名/章节标题、译本切换（展开式下拉）、
 *      经文列表、"解经"按钮（切换右侧解经面板）
 * 译本选择器由 manifest 数据驱动：新增译本 → 自动出现在下拉中（原文/译本分组展示）
 * 串珠：按当前书卷加载 public/data/brp/crossrefs/<bookId>.json（缓存），
 *      计算每节引用的目标显示名（中文书卷名 + 章节），随经文传给 VerseItem。
 */
import { computed, ref, watch } from 'vue'
import TranslationMenu from './TranslationMenu.vue'
import VerseItem from './VerseItem.vue'
import LexiconPopup from './LexiconPopup.vue'
import { fetchCrossrefs, findCrossrefChapter, fetchStrongLexicon } from '../../lib/data.js'

const props = defineProps({
  book: { type: Object, required: true },
  chapter: { type: Number, required: true },
  verses: { type: Array, default: () => [] },
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
  menuOpen: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  /** Strong 逐词标注（和合本简体 chiuns；其他译本为 null → 纯文本） */
  strong: { type: Object, default: null },
})
const emit = defineEmits(['change-translation', 'toggle-commentary', 'toggle-sidebar', 'toggle-menu', 'goto-verse'])

// 串珠数据：按卷加载 + 缓存（data.js 内部缓存）；加载失败的卷记入集合，避免反复请求
const crossrefBook = ref(null)
const failedCrossrefs = new Set()
/** 序号守卫：快速切卷时丢弃过期串珠响应 */
let crossrefSeq = 0
watch(
  () => props.book?.id,
  async (id) => {
    if (!id) return
    const seq = ++crossrefSeq
    if (failedCrossrefs.has(id)) {
      crossrefBook.value = null
      return
    }
    try {
      const data = await fetchCrossrefs(id)
      if (seq !== crossrefSeq) return
      crossrefBook.value = data
    } catch {
      if (seq !== crossrefSeq) return
      failedCrossrefs.add(id)
      crossrefBook.value = null // 该卷无串珠
    }
  },
  { immediate: true },
)

/** 当前章 verse → refs 映射 */
const refsByVerse = computed(() =>
  findCrossrefChapter(crossrefBook.value, props.chapter),
)

/** 当前译本的书卷中文名表（用于串珠目标显示） */
const zhNames = computed(() => {
  const t = props.translations.find((x) => x.key === props.activeKey)
  const map = {}
  for (const b of t?.books || []) map[b.id] = b.zh
  return map
})

/** 当前章 verse → Strong 逐词映射（无标注的译本或开关关闭时返回 null） */
const wordsByVerse = (verse) => {
  if (!strongOn.value) return null
  const ch = props.strong?.book?.chapters?.find((c) => c.chapter === props.chapter)
  return ch?.verses?.find((v) => v.verse === verse)?.words || null
}

/** Strong 标注开关（仅和合本简体有数据时显示）；偏好持久化 localStorage */
const strongOn = ref(localStorage.getItem('brp-strong') !== 'off')

function toggleStrong() {
  strongOn.value = !strongOn.value
  localStorage.setItem('brp-strong', strongOn.value ? 'on' : 'off')
}

/* ============ Strong 词义弹层（点击 Strong 码 → 词典词条） ============ */
const lexCode = ref('')
const lexEntry = ref(null)
const lexLoading = ref(false)
const lexPos = ref(null) // { left, top }：点击词中心 x 与底部 y

async function loadLexicon(code) {
  lexCode.value = code
  lexLoading.value = true
  lexEntry.value = null
  try {
    const entry = await fetchStrongLexicon(code)
    if (lexCode.value !== code) return // 期间已关闭/切换
    lexEntry.value = entry
  } catch {
    if (lexCode.value === code) lexEntry.value = null // 词条加载失败：保持弹层显示"未找到"
  } finally {
    if (lexCode.value === code) lexLoading.value = false
  }
}

/** 点击经文中 Strong 码：记录点击位置并加载词条 */
function showLexicon(code, el) {
  const rect = el.getBoundingClientRect()
  lexPos.value = { left: rect.left + rect.width / 2, top: rect.bottom }
  loadLexicon(code)
}

function closeLexicon() {
  lexCode.value = ''
  lexEntry.value = null
  lexLoading.value = false
  lexPos.value = null
}

// 正文滚动或书卷/章节/译本变化时关闭弹层（位置坐标已失效；跨卷但章号相同时也必须关闭）
watch(() => [props.book?.id, props.chapter, props.activeKey], closeLexicon)

/** 每节引用：目标补上显示名（"箴言 8:22-24"） */
function verseRefs(verse) {
  const refs = refsByVerse.value[verse]
  if (!refs || !refs.length) return null
  return refs.map((r) => ({
    anchor: r.anchor,
    targets: r.targets.map((t) => ({
      ...t,
      label: `${zhNames.value[t.id] || t.id} ${t.ch}:${t.vs}`,
    })),
  }))
}
</script>

<template>
  <div class="scripture-panel">
    <header class="panel-head">
      <div class="head-left">
        <button class="menu-btn" @click="emit('toggle-sidebar')" aria-label="书卷列表">☰</button>
        <h1 class="panel-title">
          {{ book.zh }} <span class="chapter-label">第 {{ chapter }} 章</span>
        </h1>
      </div>
      <div class="panel-actions">
        <button
          v-if="strong"
          class="strong-toggle"
          :class="{ on: strongOn }"
          :aria-pressed="strongOn"
          :title="strongOn ? '关闭原文 Strong 标注' : '显示原文 Strong 标注'"
          @click="toggleStrong"
        >
          <span class="st-label">原文标注</span>
          <span class="st-switch"><span class="st-knob"></span></span>
        </button>
        <TranslationMenu
          :translations="translations"
          :active-key="activeKey"
          :open="menuOpen"
          @toggle="emit('toggle-menu')"
          @select="emit('change-translation', $event)"
        />
        <button class="btn-commentary" @click="emit('toggle-commentary')">解经</button>
      </div>
    </header>

    <div class="scripture-scroll" @scroll="closeLexicon">
      <div class="scripture-body">
        <div v-if="loading" class="scripture-loading">经文加载中…</div>
        <template v-else>
          <p v-if="!verses.length" class="scripture-empty">本章无经文数据</p>
          <VerseItem
            v-for="v in verses"
            :key="v.verse"
            :verse="v.verse"
            :text="v.text"
            :lang="activeKey"
            :refs="verseRefs(v.verse)"
            :words="wordsByVerse(v.verse)"
            @goto="emit('goto-verse', $event)"
            @lexicon="showLexicon($event.code, $event.el)"
          />
        </template>
      </div>
    </div>
    <LexiconPopup
      :code="lexCode"
      :entry="lexEntry"
      :loading="lexLoading"
      :pos="lexPos"
      @close="closeLexicon"
      @goto="loadLexicon"
    />
  </div>
</template>

<style scoped>
.scripture-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.9rem 1.4rem;
  border-bottom: 1px solid var(--line);
}
.head-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
/* 汉堡按钮：仅窄屏显示（移动端书卷抽屉开关） */
.menu-btn {
  display: none;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  font-size: 1.05rem;
  line-height: 1;
  padding: 0.32rem 0.55rem;
}
.menu-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.panel-title {
  margin: 0;
  font-size: 1.35rem;
}
.chapter-label {
  font-size: 1rem;
  color: var(--muted);
  font-weight: 500;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
/* Strong 原文标注开关（胶囊开关） */
.strong-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  padding: 0.24rem 0.55rem 0.24rem 0.7rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.strong-toggle:hover {
  border-color: var(--accent);
}
.st-label {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}
.strong-toggle.on .st-label {
  color: var(--text);
  font-weight: 600;
}
.st-switch {
  position: relative;
  width: 1.7rem;
  height: 0.95rem;
  border-radius: 999px;
  background: #cfd5dc;
  transition: background 0.18s ease;
}
.strong-toggle.on .st-switch {
  background: var(--accent);
}
.st-knob {
  position: absolute;
  top: 0.12rem;
  left: 0.14rem;
  width: 0.71rem;
  height: 0.71rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s ease;
}
.strong-toggle.on .st-knob {
  transform: translateX(0.72rem);
}
.btn-commentary {
  padding: 0.3rem 1rem;
  border: none;
  border-radius: 6px;
  background: #1f6f4a;
  color: #fff;
  font-size: 0.9rem;
  white-space: nowrap;
}
.btn-commentary:hover {
  background: #185a3d;
}
/* 滚动容器贴面板右缘（紧邻解经面板），滚动条显示在容器边缘 */
.scripture-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
/* 正文内容在滚动容器内居中，不参与滚动定位 */
.scripture-body {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1rem 1.6rem 3rem;
}
.scripture-loading,
.scripture-empty {
  color: var(--muted);
  text-align: center;
  padding: 2rem 0;
}

/* 窄屏适配：显示汉堡按钮、头部与正文紧凑化 */
@media (max-width: 900px) {
  .menu-btn {
    display: inline-flex;
  }
  .panel-head {
    padding: 0.5rem 0.8rem;
    gap: 0.35rem;
  }
  .panel-title {
    font-size: 1.08rem;
  }
  .panel-actions {
    gap: 0.4rem;
  }
  /* 头部按钮紧凑化：原文标注开关缩小、解经按钮收窄 */
  .strong-toggle {
    padding: 0.18rem 0.4rem 0.18rem 0.5rem;
    gap: 0.32rem;
  }
  .st-label {
    font-size: 0.72rem;
  }
  .st-switch {
    width: 1.5rem;
    height: 0.85rem;
  }
  .st-knob {
    top: 0.11rem;
    left: 0.12rem;
    width: 0.63rem;
    height: 0.63rem;
  }
  .strong-toggle.on .st-knob {
    transform: translateX(0.63rem);
  }
  .btn-commentary {
    padding: 0.25rem 0.7rem;
    font-size: 0.85rem;
  }
  .scripture-body {
    padding: 0.75rem 0.9rem 2.5rem;
  }
}
</style>
