<script setup>
/**
 * TranslationMenu — 展开式译本选择器（brp 子组件，受控组件）
 * 展开状态由父组件（BrpPage）控制：移动端与侧栏抽屉、解经面板互斥（每次只开一个）。
 * 面板采用动态定位：展开时测量 trigger 与面板尺寸，将面板钳制在视口内
 * （避免窄屏下 panel-head 换行导致 trigger 靠左时面板向左溢出屏幕）。
 */
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle', 'select'])

const triggerEl = ref(null)
const popEl = ref(null)

const versions = computed(() => props.translations.filter((t) => !t.original))
const originals = computed(() => props.translations.filter((t) => t.original))
const active = computed(() => props.translations.find((t) => t.key === props.activeKey))

/** 语言显示顺序：中文（简→繁）→ 英文 → 其他按代码字母序；同语言保持 manifest 顺序（stable sort） */
const LANG_ORDER = { 'zh-Hans': 0, 'zh-Hant': 1, en: 2 }
function langRank(lang) {
  return lang in LANG_ORDER ? LANG_ORDER[lang] : 3
}
function sortByLang(list) {
  return [...list].sort((a, b) => langRank(a.lang) - langRank(b.lang))
}

/** 宗派分组（新教 / 天主教 / 其他未登记），组内按语言排列 */
const traditionGroups = computed(() => {
  const groups = [
    { key: 'protestant', title: '新教译本', list: [] },
    { key: 'catholic', title: '天主教译本', list: [] },
    { key: 'other', title: '其他译本', list: [] },
  ]
  for (const t of versions.value) {
    const g = groups.find((x) => x.key === (t.tradition || 'other'))
    g.list.push(t)
  }
  for (const g of groups) g.list = sortByLang(g.list)
  return groups.filter((g) => g.list.length)
})

function pick(key) {
  emit('select', key)
}

/** 展开时把面板定位到视口内：水平不超出左右缘，垂直不超出下缘。
 * flush: 'post'——等待 pop 挂载后再测量定位（pre-flush 时 popEl 尚为 null，定位会跳过）。 */
watch(
  () => props.open,
  async (v) => {
    if (!v) return
    await nextTick()
    if (!triggerEl.value || !popEl.value) return
    const tr = triggerEl.value.getBoundingClientRect()
    const pw = popEl.value.offsetWidth
    const ph = popEl.value.offsetHeight
    const gap = 6
    let left = Math.min(tr.left, innerWidth - pw - 8)
    left = Math.max(8, left)
    let top = tr.bottom + gap
    if (top + ph > innerHeight) top = Math.max(8, innerHeight - ph - 8)
    popEl.value.style.left = `${left}px`
    popEl.value.style.top = `${top}px`
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="trans-menu">
    <button
      ref="triggerEl"
      class="trans-trigger"
      :class="{ open }"
      @click="emit('toggle')"
      aria-haspopup="listbox"
    >
      <span class="trans-trigger-name">{{ active ? active.name : '译本' }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="menu">
      <div v-if="open" ref="popEl" class="menu-pop" role="listbox">
        <div v-for="g in traditionGroups" :key="g.key" class="menu-group">
          <div class="menu-group-title">{{ g.title }}</div>
          <button
            v-for="t in g.list"
            :key="t.key"
            class="menu-item"
            :class="{ active: t.key === activeKey }"
            role="option"
            :aria-selected="t.key === activeKey"
            @click="pick(t.key)"
          >
            {{ t.name }}
          </button>
        </div>
        <div v-if="originals.length" class="menu-group">
          <div class="menu-group-title">原文</div>
          <button
            v-for="t in originals"
            :key="t.key"
            class="menu-item"
            :class="{ active: t.key === activeKey }"
            role="option"
            :aria-selected="t.key === activeKey"
            @click="pick(t.key)"
          >
            {{ t.name }}
          </button>
        </div>
      </div>
    </Transition>

    <div v-if="open" class="menu-backdrop" @click="emit('toggle')"></div>
  </div>
</template>

<style scoped>
.trans-menu {
  position: relative;
}
.trans-trigger {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  font-size: 0.9rem;
  white-space: nowrap;
  max-width: 14rem;
}
.trans-trigger:hover,
.trans-trigger.open {
  border-color: var(--accent);
  color: var(--accent);
}
.trans-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.caret {
  font-size: 0.75rem;
  transition: transform 0.15s ease;
}
.trans-trigger.open .caret {
  transform: rotate(180deg);
}
/* 固定定位 + JS 动态设置 left/top，保证面板始终在视口内 */
.menu-pop {
  position: fixed;
  min-width: 15rem;
  max-height: min(24rem, 60vh);
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(20, 28, 38, 0.14);
  padding: 0.35rem;
  z-index: 51;
}
.menu-group + .menu-group {
  border-top: 1px solid var(--line);
  margin-top: 0.3rem;
  padding-top: 0.3rem;
}
.menu-group-title {
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.32rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu-item:hover {
  background: var(--accent-soft);
}
.menu-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.menu-backdrop {
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
/* 窄屏适配：触发按钮紧凑化，避免头部换行过宽 */
@media (max-width: 900px) {
  .trans-trigger {
    min-height: 2.75rem;
    padding: 0.25rem 0.6rem;
    gap: 0.3rem;
    font-size: 0.85rem;
    max-width: 9.5rem;
  }
  .menu-pop {
    min-width: 13rem;
    max-width: calc(100vw - 1.5rem);
  }
}
</style>
