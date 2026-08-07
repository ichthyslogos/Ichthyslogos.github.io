<script setup>
/**
 * BookSidebar — 书卷选择栏（brp 子组件）
 * 书卷列表完全由 manifest 数据驱动：随当前译本变化（如思高本含 7 卷次经）
 * 移动端为抽屉形态，头部提供关闭按钮（仅 ≤900px 显示）
 */
import { computed, watch, nextTick, ref } from 'vue'
import { GROUPS } from '../../lib/data.js'

const props = defineProps({
  translation: { type: Object, required: true },
  activeBookId: { type: String, default: '' },
})
const emit = defineEmits(['select-book', 'close'])

const sidebarEl = ref(null)

/** 按分组组织书卷，保持 manifest 中的顺序 */
const groups = computed(() => {
  const g = []
  for (const key of ['ot', 'nt', 'ext']) {
    const books = props.translation.books.filter((b) => b.group === key)
    if (books.length) g.push({ key, zh: GROUPS[key], books })
  }
  return g
})

/** 把高亮书卷滚入可视区（66 卷列表较长，当前卷可能在视口外） */
function scrollActiveIntoView() {
  nextTick(() => {
    const sc = sidebarEl.value
    const el = sc?.querySelector('.book-item.active')
    if (!sc || !el) return
    const rel = el.offsetTop - sc.offsetTop // 相对滚动容器顶部的偏移（两元素 offsetParent 相同，差值可靠）
    if (rel < sc.scrollTop) sc.scrollTop = rel - 8
    else if (rel + el.offsetHeight > sc.scrollTop + sc.clientHeight) {
      sc.scrollTop = rel + el.offsetHeight - sc.clientHeight + 8
    }
  })
}

// 当前书卷变化（选择书卷/串珠跳转）时滚动到高亮项
watch(() => props.activeBookId, scrollActiveIntoView)

</script>

<template>
  <aside ref="sidebarEl" class="book-sidebar" @transitionend="scrollActiveIntoView">
    <div class="sidebar-head">
      <span class="sidebar-head-title">书卷目录</span>
      <button class="sidebar-close" @click="emit('close')" aria-label="关闭书卷目录">✕</button>
    </div>
    <div v-for="g in groups" :key="g.key" class="book-group">
      <div class="group-title">{{ g.zh }}</div>
      <button
        v-for="b in g.books"
        :key="b.id"
        class="book-item"
        :class="{ active: b.id === activeBookId }"
        @click="emit('select-book', b.id)"
      >
        <span class="book-id">{{ b.id }}</span>
        {{ b.zh }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.book-sidebar {
  width: 15rem;
  flex-shrink: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #fbfcfd;
  border-right: 1px solid var(--line);
  padding: 0.8rem 0;
}
/* 抽屉头部：仅移动端（≤900px）显示关闭按钮 */
.sidebar-head {
  display: none;
}
.book-group + .book-group {
  border-top: 1px solid var(--line);
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}
.group-title {
  padding: 0.25rem 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.08em;
}
.book-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  padding: 0.32rem 1rem;
  border: none;
  background: transparent;
  text-align: left;
  color: var(--text);
  font-size: 0.92rem;
}
.book-item:hover {
  background: var(--accent-soft);
}
.book-item.active {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.book-id {
  font-size: 0.7rem;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}

/* 移动端抽屉形态：显示头部与关闭按钮（头部随列表滚动，不悬浮遮挡文本） */
@media (max-width: 900px) {
  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--line);
    background: #fbfcfd;
  }
  .sidebar-head-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
  }
  .sidebar-close {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 0.95rem;
    padding: 0.1rem 0.45rem;
  }
  .sidebar-close:hover {
    color: var(--text);
  }
}
</style>
