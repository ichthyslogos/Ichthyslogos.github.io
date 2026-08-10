<script setup>
/**
 * CommentarySourceMenu — 注释源选择器（brp 子组件，受控组件）
 * 解经面板按「传统 → 作者（源）」两级选择：下拉按 tradition 分组，
 * 组标题为传统中文名，组内列出该传统的注释源，当前源高亮。
 * - 可用性过滤：传 bookId 时仅显示覆盖该书卷的源（manifest.sources[].books）
 * - 语言版本：同书多语言（如马太亨利中/英）在组内各列一项，带语言徽章（zh/en），
 *   另配语言标签按钮（面板顶部）快速切换
 * 展开状态由父组件控制；面板 fixed 定位并钳制在视口内（参照 TranslationMenu）。
 */
import { ref, computed, watch, nextTick } from 'vue'
import { groupOfSource } from '../../lib/data.js'

/** 传统 key → 中文名（9 个固定传统，与 docs/COMMENTARY-ROADMAP.md 一致） */
const TRADITION_NAMES = {
  'church-fathers': '教父著作',
  catholic: '天主教传统',
  lutheran: '路德宗',
  reformed: '改革宗',
  baptist: '浸信会',
  methodist: '卫理公会',
  anglican: '圣公会',
  pentecostal: '五旬节派',
  evangelical: '福音派',
}

const props = defineProps({
  sources: { type: Array, default: () => [] }, // 全量源（含同书各语言版本）
  activeKey: { type: String, default: '' },
  open: { type: Boolean, default: false },
  bookId: { type: String, default: '' }, // 仅显示覆盖此卷的源；空 = 全部
})
const emit = defineEmits(['toggle', 'select'])

const triggerEl = ref(null)
const popEl = ref(null)

/** 当前激活项；语言组成员用组名 + 语言徽章显示（避免英文长名撑爆按钮） */
const active = computed(() => {
  const s = props.sources.find((x) => x.key === props.activeKey)
  if (!s) return null
  const g = groupOfSource(s.key)
  return g ? { ...s, name: `${g.label} · ${g.langs.find((l) => l.key === s.key)?.label || s.lang}` } : s
})

/** 按传统分组（保持 manifest 顺序，过滤当前卷不可用的源）：[{ tradition, name, sources[] }] */
const groups = computed(() => {
  const map = new Map()
  for (const s of props.sources) {
    if (props.bookId && Array.isArray(s.books) && !s.books.includes(props.bookId)) continue
    if (!map.has(s.tradition)) map.set(s.tradition, { tradition: s.tradition, sources: [] })
    map.get(s.tradition).sources.push(s)
  }
  return [...map.values()]
})

/** 展开时把面板定位到视口内（水平/垂直钳制，移动端覆盖层内同样适用） */
watch(
  () => props.open,
  async (v) => {
    if (!v || !triggerEl.value || !popEl.value) return
    await nextTick()
    const tr = triggerEl.value.getBoundingClientRect()
    const pw = popEl.value.offsetWidth
    const ph = popEl.value.offsetHeight
    let left = Math.min(tr.left, innerWidth - pw - 8)
    left = Math.max(8, left)
    let top = tr.bottom + 6
    if (top + ph > innerHeight) top = Math.max(8, innerHeight - ph - 8)
    popEl.value.style.left = `${left}px`
    popEl.value.style.top = `${top}px`
  },
)
</script>

<template>
  <div class="source-menu">
    <button
      ref="triggerEl"
      class="source-trigger"
      :class="{ open }"
      :title="active ? active.name : '选择注释源'"
      @click="emit('toggle')"
      aria-haspopup="listbox"
    >
      <span class="source-trigger-name">{{ active ? active.name : '注释源' }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    <Transition name="menu">
      <div v-if="open" ref="popEl" class="source-pop" role="listbox">
        <template v-if="groups.length">
          <div v-for="g in groups" :key="g.tradition" class="source-group">
            <div class="source-group-title">{{ TRADITION_NAMES[g.tradition] || g.tradition }}</div>
            <button
              v-for="s in g.sources"
              :key="s.key"
              class="source-item"
              :class="{ active: s.key === activeKey }"
              role="option"
              :aria-selected="s.key === activeKey"
              @click="emit('select', s.key)"
            >
              {{ s.name }}
              <span v-if="s.lang" class="source-lang">{{ s.lang }}</span>
            </button>
          </div>
        </template>
        <div v-else class="source-empty">本卷暂无可用注释源</div>
      </div>
    </Transition>

    <div v-if="open" class="source-backdrop" @click="emit('toggle')"></div>
  </div>
</template>

<style scoped>
.source-menu {
  position: relative;
}
.source-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.12rem 0.55rem;
  white-space: nowrap;
  max-width: 11rem;
  cursor: pointer;
}
.source-trigger:hover,
.source-trigger.open {
  border-color: var(--accent);
}
.source-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.caret {
  font-size: 0.7rem;
  transition: transform 0.15s ease;
}
.source-trigger.open .caret {
  transform: rotate(180deg);
}
/* 固定定位 + JS 动态设置 left/top，保证面板始终在视口内 */
.source-pop {
  position: fixed;
  min-width: 14rem;
  max-height: min(22rem, 60vh);
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(20, 28, 38, 0.14);
  padding: 0.35rem;
  z-index: 61;
}
.source-group + .source-group {
  border-top: 1px solid var(--line);
  margin-top: 0.3rem;
  padding-top: 0.3rem;
}
.source-group-title {
  padding: 0.2rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.06em;
}
.source-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding: 0.32rem 0.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 0.88rem;
  cursor: pointer;
  /* 长名称（如英中双语名）最多两行，移动端不截断 */
  line-height: 1.45;
}
.source-item:hover {
  background: var(--accent-soft);
}
.source-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.source-lang {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.68rem;
  color: var(--muted);
  border: 1px solid currentColor;
  border-radius: 3px;
  padding: 0 0.25rem;
  opacity: 0.8;
}
.source-item.active .source-lang {
  color: #fff;
}
.source-empty {
  padding: 0.8rem 0.6rem;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
}
.source-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
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
/* 窄屏：trigger 限宽，面板贴近视口、列表项加高便于点按 */
@media (max-width: 900px) {
  .source-trigger {
    max-width: 8.5rem;
    font-size: 0.72rem;
  }
  .source-pop {
    min-width: calc(100vw - 1.5rem);
    max-width: calc(100vw - 1.5rem);
    max-height: min(20rem, 55vh);
  }
  .source-item {
    padding: 0.55rem 0.6rem;
    font-size: 0.92rem;
  }
  .source-group-title {
    padding-top: 0.35rem;
    padding-bottom: 0.35rem;
    font-size: 0.74rem;
  }
}
</style>
