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
import { fetchCrossrefs, findCrossrefChapter, fetchNotes, findNotesChapter, fetchZhNames, fetchNameVariants } from '../../lib/data.js'

const props = defineProps({
  book: { type: Object, required: true },
  chapter: { type: Number, required: true },
  verses: { type: Array, default: () => [] },
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
  /** 对照译本（按选择顺序的主译本的对照；空数组=仅单译本阅读） */
  compareKeys: { type: Array, default: () => [] },
  /** 对照译本取数结果：{key, name, verses:{节:文本}} */
  compareTrans: { type: Array, default: () => [] },
  /** 逐字原文（和合本简体 Strong）：是否可用 / 是否已开启 / 每节 words（{节:[{t,s}]}） */
  strongReady: { type: Boolean, default: false },
  strongOn: { type: Boolean, default: false },
  strongOf: { type: Object, default: null },
  menuOpen: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  /** 移动端沉浸阅读：隐藏头部（标题/按钮）扩大阅读区；退出靠 BrpPage 悬浮按钮 */
  immersive: { type: Boolean, default: false },
})
const emit = defineEmits(['set-primary', 'toggle-compare', 'toggle-strong', 'toggle-sidebar', 'toggle-menu', 'goto-verse', 'toggle-immersive', 'open-tool', 'open-note'])

/** 功能词条菜单（解经/地图）本地展开状态：瞬时浮层，选择后即关 */
const toolMenuOpen = ref(false)
function pickTool(tool) {
  toolMenuOpen.value = false
  emit('open-tool', tool)
}
/** 逐字原文开关：切换后保持菜单展开，便于看到 ✓ 状态并随时关闭 */
function pickStrong() {
  emit('toggle-strong')
}

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
    } catch (e) {
      if (seq !== crossrefSeq) return
      // 仅 404（该卷确无串珠）记入黑名单；瞬时网络错误保留重试机会
      if (e?.status === 404) failedCrossrefs.add(id)
      crossrefBook.value = null
    }
  },
  { immediate: true },
)

/** 当前章 verse → refs 映射 */
const refsByVerse = computed(() =>
  findCrossrefChapter(crossrefBook.value, props.chapter),
)

// 背景注释（notes 栏目）：按卷加载（data.js 缓存，与解经抽屉共用同一份数据），
// 用于给有注释的经节加背景高亮提示（带序号守卫：快速切卷丢弃过期响应；
// 失败卷记入集合，避免每次切回都重复 404 请求）
const notesBook = ref(null)
const failedNotes = new Set()
let notesSeq = 0
watch(
  () => props.book?.id,
  async (id) => {
    if (!id) return
    const seq = ++notesSeq
    if (failedNotes.has(id)) {
      notesBook.value = null
      return
    }
    try {
      const data = await fetchNotes(id)
      if (seq !== notesSeq) return
      notesBook.value = data
    } catch (e) {
      if (seq !== notesSeq) return
      // 仅 404（该卷确无注释）记入黑名单；瞬时网络错误保留重试机会
      if (e?.status === 404) failedNotes.add(id)
      notesBook.value = null
    }
  },
  { immediate: true },
)

/** 当前章词条按节索引（refs → 节号）：节 → [{ type, name, nameZh, variants }]
 *  供 VerseItem 文本级高亮（经文含中文名/变体即高亮，节级锚定防多划） */
const noteNamesByVerse = computed(() => {
  const ch = findNotesChapter(notesBook.value, props.chapter)
  if (!ch?.entries) return null
  const map = new Map()
  for (const e of ch.entries) {
    if (!e.strong) continue
    const norm = normCode(e.strong)
    const item = {
      type: e.type || 'Other',
      name: e.name,
      nameZh: noteZhNames.value?.[norm] || '',
      variants: noteVariants.value?.[e.name] || [],
    }
    if (!item.nameZh && !item.variants.length) continue
    for (const ref of e.refs || []) {
      const vs = Number(ref)
      if (!map.has(vs)) map.set(vs, [])
      const arr = map.get(vs)
      if (!arr.some((x) => x.name === item.name)) arr.push(item)
    }
  }
  return map.size ? map : null
})

/** 某节词条（文本级高亮用） */
const noteNamesOf = (verse) => noteNamesByVerse.value?.get(verse) || null

/** 归一化 Strong 码：H0085 → H85；H6160G → H6160；G2424 → G2424（保留 H/G 区分新旧约，与 zh-names 表一致） */
const normCode = (code) => {
  const m = String(code).match(/^([HG])0*(\d+)/)
  return m ? m[1] + m[2] : ''
}

// 词条简体中文名表/变体表：全站共享静态数据（data.js 自动缓存），组件内只加载一次，
// 不随书卷切换重复请求（此前 watch book?.id 每换卷重取）
const noteZhNames = ref(null)
const noteVariants = ref(null)
;(async () => {
  try {
    noteZhNames.value = await fetchZhNames()
  } catch {
    noteZhNames.value = null
  }
  try {
    noteVariants.value = await fetchNameVariants()
  } catch {
    noteVariants.value = null
  }
})()

/** 当前译本的书卷中文名表（用于串珠目标显示） */
const zhNames = computed(() => {
  const t = props.translations.find((x) => x.key === props.activeKey)
  const map = {}
  for (const b of t?.books || []) map[b.id] = b.zh
  return map
})

/** 当前章每节引用（目标补显示名 "箴言 8:22-24"）：整章一次计算，模板按节直取，
 *  避免渲染时逐节重复 map 出新数组 */
const refsByVerseLabeled = computed(() => {
  const byVerse = refsByVerse.value
  const out = {}
  for (const [verse, refs] of Object.entries(byVerse)) {
    if (!refs?.length) continue
    out[verse] = refs.map((r) => ({
      anchor: r.anchor,
      targets: r.targets.map((t) => ({
        ...t,
        label: `${zhNames.value[t.id] || t.id} ${t.ch}:${t.vs}`,
      })),
    }))
  }
  return out
})

/** 每节引用（含显示名），无则 null */
function verseRefs(verse) {
  return refsByVerseLabeled.value[verse] || null
}

/* ---- 对照译本渲染：某主译本节 → 各对照译本的 {key,name,text}（只保留有文本的）---- */
function compareOf(verse) {
  const out = []
  for (const c of props.compareTrans) {
    const text = c.verses[verse]
    if (text) out.push({ key: c.key, name: c.name, text })
  }
  return out
}
</script>

<template>
  <div class="scripture-panel">
    <header class="panel-head" v-show="!immersive">
      <div class="head-left">
        <button class="menu-btn" @click="emit('toggle-sidebar')" aria-label="书卷列表">☰</button>
        <h1 class="panel-title">
          {{ book.zh }} <span class="chapter-label">第 {{ chapter }} 章</span>
        </h1>
      </div>
      <div class="panel-actions">
        <button
          class="immersive-btn"
          :aria-pressed="immersive"
          :title="immersive ? '恢复头部' : '隐藏头部，扩大阅读区'"
          @click="emit('toggle-immersive')"
        >
          <span class="im-icon" aria-hidden="true">⤢</span>
          <span class="im-label">展开</span>
        </button>
        <TranslationMenu
          :translations="translations"
          :active-key="activeKey"
          :compare-keys="compareKeys"
          :open="menuOpen"
          @toggle="emit('toggle-menu')"
          @set-primary="emit('set-primary', $event)"
          @toggle-compare="emit('toggle-compare', $event)"
        />
        <!-- 功能词条：调出解经/地图抽屉 + 逐字原文开关（受控菜单，选择后由父页互斥切换面板） -->
        <div class="tool-menu">
          <button
            class="btn-commentary"
            :class="{ open: toolMenuOpen }"
            aria-haspopup="menu"
            :aria-expanded="toolMenuOpen"
            @click="toolMenuOpen = !toolMenuOpen"
          >
            <span class="tool-label">功能</span>
            <span class="tool-caret" aria-hidden="true">▾</span>
          </button>
          <Transition name="menu">
            <div v-if="toolMenuOpen" class="tool-pop" role="menu">
              <button class="tool-item" role="menuitem" @click="pickTool('commentary')">
                <span class="tool-ico" aria-hidden="true">📖</span>
                <span>解经</span>
              </button>
              <button class="tool-item" role="menuitem" @click="pickTool('map')">
                <span class="tool-ico" aria-hidden="true">🗺️</span>
                <span>地图</span>
              </button>
              <!-- 逐字原文（和合本简体 Strong）：仅主译本为和合本简体时显示 -->
              <button
                v-if="strongReady"
                class="tool-item"
                :class="{ on: strongOn }"
                role="menuitemcheckbox"
                :aria-checked="strongOn"
                title="逐字显示原文 Strong 码（和合本简体）"
                @click="pickStrong"
              >
                <span class="tool-ico" aria-hidden="true">📜</span>
                <span>原文</span>
                <span v-if="strongOn" class="tool-check" aria-hidden="true">✓</span>
              </button>
            </div>
          </Transition>
          <div v-if="toolMenuOpen" class="tool-backdrop" @click="toolMenuOpen = false"></div>
        </div>
      </div>
    </header>

    <div class="scripture-scroll">
      <div class="scripture-body">
        <div v-if="loading" class="scripture-loading">经文加载中…</div>
        <template v-else>
          <p v-if="!verses.length" class="scripture-empty">本章无经文数据</p>
          <div
            v-for="v in verses"
            :key="chapter + '-' + v.verse"
            class="vblock"
          >
            <VerseItem
              :verse="v.verse"
              :text="v.text"
              :words="strongOf ? strongOf[v.verse] : null"
              :strong="strongOn"
              :refs="verseRefs(v.verse)"
              :note-names="noteNamesOf(v.verse)"
              @goto="emit('goto-verse', $event)"
              @open-note="emit('open-note', $event)"
            />
            <!-- 对照译本：仅当选择了 2+ 译本时逐节显示，清晰区别于主译本 -->
            <div v-if="compareOf(v.verse).length" class="vcmp">
              <div
                v-for="c in compareOf(v.verse)"
                :key="c.key"
                class="vcmp-row"
              >
                <div class="vcmp-label">{{ c.name }}</div>
                <div class="vcmp-text">{{ c.text }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
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
  border-bottom: 1px solid var(--line-soft);
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
  border-radius: var(--radius-md);
  background: var(--panel);
  color: var(--text);
  font-size: 1.05rem;
  line-height: 1;
  padding: 0.32rem 0.55rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.menu-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
}
/* 标题：衬线书名 + 金棕章节小字 */
.panel-title {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--text);
}
.chapter-label {
  font-size: 1.02rem;
  color: var(--gold);
  font-weight: 500;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
/* 沉浸阅读入口（仅移动端显示）：隐藏头部标题/章节标签，扩大阅读区 */
.immersive-btn {
  display: none;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--muted);
  font-size: 0.78rem;
  padding: 0.24rem 0.6rem;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.immersive-btn:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.im-icon {
  font-size: 0.85rem;
  line-height: 1;
}
/* 解经按钮：墨黑胶囊主按钮 */
.btn-commentary {
  padding: 0.34rem 1.05rem;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.btn-commentary:hover {
  background: #000;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
/* 功能词条菜单（解经/地图/原文）：按钮 + 下拉浮层 */
.tool-menu {
  position: relative;
}
.tool-caret {
  font-size: 0.7rem;
  opacity: 0.85;
  transition: transform 0.15s ease;
}
.btn-commentary.open .tool-caret {
  transform: rotate(180deg);
}
.tool-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 8.5rem;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(20, 28, 38, 0.14);
  padding: 0.35rem;
  z-index: 51;
}
.tool-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.tool-item:hover {
  background: var(--accent-soft);
}
.tool-item.on {
  color: var(--gold);
  font-weight: 700;
}
.tool-ico {
  font-size: 0.95rem;
  line-height: 1;
}
.tool-check {
  flex-shrink: 0;
  margin-left: auto;
  color: var(--gold);
  font-weight: 700;
}
.tool-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
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
/* 对照译本（多选）：缩进 + 左侧金线，标签与译文并排，清晰区别于上方主译本 */
.vblock {
  margin-bottom: 0.15rem;
}
.vcmp {
  margin: 0.12rem 0 0.6rem 2rem;
  padding-left: 0.85rem;
  border-left: 2px solid var(--gold-soft);
}
.vcmp-row {
  margin-bottom: 0.45rem;
}
.vcmp-row:last-child {
  margin-bottom: 0;
}
.vcmp-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--gold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.1rem;
}
.vcmp-text {
  font-family: var(--serif);
  font-size: 0.92rem;
  line-height: 1.8;
  color: #5a6572;
  /* 定格：正文统一固定缩进，多译本正文左缘对齐 */
  padding-left: 1rem;
}
@media (max-width: 900px) {
  .vcmp {
    margin-left: 1.4rem;
  }
}

/* 窄屏适配：显示汉堡按钮、头部与正文紧凑化 */
@media (max-width: 900px) {
  .menu-btn {
    display: inline-flex;
  }
  /* 移动端显示沉浸阅读入口 */
  .immersive-btn {
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
  /* 头部按钮紧凑化：解经按钮收窄 */
  .btn-commentary {
    padding: 0.26rem 0.75rem;
    font-size: 0.85rem;
  }
  .panel-title {
    font-size: 1.12rem;
  }
  .chapter-label {
    font-size: 0.9rem;
  }
  .scripture-body {
    padding: 0.75rem 0.9rem 2.5rem;
  }
}
</style>
