<script setup>
/**
 * TranslationMenu — 两列式译本选择器（brp 子组件，受控组件）
 * 左列「主译本」：单选一个；右列「对照译本」：多选多个，含「无」清空项。
 * 主译与对照互斥（同一译本不能既是主又是对照）；主译本切换由父级重新取数。
 * 展开状态由父组件控制；面板动态定位，钳制在视口内。
 * 交互事件：toggle（开/关）、set-primary（选主译本）、toggle-compare（切换对照，'__none__' 清空）。
 */
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
  open: { type: Boolean, default: false },
  /** 对照译本（已选中；主译本为 activeKey，与对照互斥） */
  compareKeys: { type: Array, default: () => [] },
})
const emit = defineEmits(['toggle', 'set-primary', 'toggle-compare'])
const NONE = '__none__'

const triggerEl = ref(null)
const popEl = ref(null)

const versions = computed(() => props.translations.filter((t) => !t.original))
const originals = computed(() => props.translations.filter((t) => t.original))
const active = computed(() => props.translations.find((t) => t.key === props.activeKey))

/** 主译列：全部白话/译本（非原文），按语言序 */
const primaryList = computed(() =>
  [...versions.value].sort((a, b) => langRank(a.lang) - langRank(b.lang)),
)
/** 对照列：白话译本 + 原文，按语言序 */
const compareList = computed(() =>
  [...versions.value, ...originals.value].sort((a, b) => langRank(a.lang) - langRank(b.lang)),
)

const isPrimary = (k) => k === props.activeKey
const isCompare = (k) => props.compareKeys.includes(k)

function langRank(lang) {
  const L = { 'zh-Hans': 0, 'zh-Hant': 1, en: 2 }
  return lang in L ? L[lang] : 3
}

/** 展开时把面板定位到视口内 */
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
      :class="{ open, hasCmp: compareKeys.length }"
      @click="emit('toggle')"
      aria-haspopup="dialog"
    >
      <span class="trans-trigger-name">{{ active ? active.name : '译本' }}</span>
      <span v-if="compareKeys.length" class="cmp-dot" aria-label="存在对照译本"></span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="menu">
      <div v-if="open" ref="popEl" class="menu-pop" role="dialog" aria-label="选择主译本与对照译本">
        <div class="menu-cols">
          <!-- 左列：主译本（单选） -->
          <div class="menu-col">
            <p class="menu-col-title">主译本</p>
            <div class="menu-col-list">
              <button
                v-for="t in primaryList"
                :key="t.key"
                class="row"
                :class="{ sel: isPrimary(t.key) }"
                role="radio"
                :aria-checked="isPrimary(t.key)"
                @click="emit('set-primary', t.key)"
              >
                <span class="mark" aria-hidden="true">{{ isPrimary(t.key) ? '●' : '' }}</span>
                <span class="name">{{ t.name }}</span>
                <span v-if="t.key === 'chisim'" class="badge-orig" title="该译本支持逐字原文 Strong 码">原文</span>
              </button>
            </div>
          </div>

          <!-- 右列：对照译本（多选 + 无） -->
          <div class="menu-col">
            <p class="menu-col-title">对照译本</p>
            <div class="menu-col-list">
              <button
                class="row"
                :class="{ sel: !compareKeys.length }"
                role="checkbox"
                :aria-checked="!compareKeys.length"
                @click="emit('toggle-compare', NONE)"
              >
                <span class="mark" aria-hidden="true">{{ !compareKeys.length ? '✓' : '' }}</span>
                <span class="name name-none">无</span>
              </button>
              <button
                v-for="t in compareList"
                :key="t.key"
                class="row"
                :class="{ sel: isCompare(t.key), disc: isPrimary(t.key) }"
                role="checkbox"
                :aria-checked="isCompare(t.key)"
                :disabled="isPrimary(t.key)"
                @click="emit('toggle-compare', t.key)"
              >
                <span class="mark" aria-hidden="true">{{ isCompare(t.key) ? '✓' : '' }}</span>
                <span class="name">{{ t.name }}</span>
                <span v-if="isPrimary(t.key)" class="hint">主译本</span>
              </button>
            </div>
          </div>
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
.trans-trigger.open,
.trans-trigger.hasCmp {
  border-color: var(--accent);
  color: var(--accent);
}
.trans-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.cmp-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.caret {
  font-size: 0.75rem;
  transition: transform 0.15s ease;
}
.trans-trigger.open .caret {
  transform: rotate(180deg);
}
/* 固定定位 + JS 动态设置 left/top */
.menu-pop {
  position: fixed;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(20, 28, 38, 0.16);
  padding: 0.5rem;
  z-index: 51;
}
.menu-cols {
  display: flex;
  gap: 0.5rem;
}
.menu-col {
  width: 14.5rem;
  min-width: 0;
}
.menu-col:first-child {
  border-right: 1px solid var(--line);
  padding-right: 0.5rem;
}
.menu-col-title {
  margin: 0 0 0.3rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.1em;
}
.menu-col-list {
  max-height: min(20rem, 52vh);
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding: 0.32rem 0.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.row:hover {
  background: var(--accent-soft);
}
.row.sel {
  background: var(--accent-soft);
}
.row:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  background: transparent;
}
.mark {
  flex-shrink: 0;
  width: 1.05rem;
  text-align: center;
  color: var(--accent);
  font-weight: 700;
}
.name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name-none {
  color: var(--muted);
}
.hint {
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--muted);
}
.badge-orig {
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  letter-spacing: 0.04em;
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
@media (max-width: 900px) {
  .trans-trigger {
    min-height: 2.75rem;
    padding: 0.25rem 0.6rem;
    gap: 0.3rem;
    font-size: 0.85rem;
    max-width: 8.5rem;
  }
  .menu-pop {
    max-width: calc(100vw - 1rem);
  }
  .menu-col {
    width: min(12.5rem, 42vw);
  }
}
</style>