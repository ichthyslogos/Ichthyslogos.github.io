<script setup>
/**
 * BookSidebar — 书卷选择栏（brp 子组件）
 * 书卷列表完全由 manifest 数据驱动：随当前译本变化（如思高本含 7 卷次经）
 * 移动端为抽屉形态，头部提供关闭按钮（仅 ≤900px 显示）
 */
import { computed } from 'vue'
import { GROUPS } from '../../lib/data.js'

const props = defineProps({
  translation: { type: Object, required: true },
  activeBookId: { type: String, default: '' },
})
const emit = defineEmits(['select-book', 'close'])

/** 按分组组织书卷，保持 manifest 中的顺序 */
const groups = computed(() => {
  const g = []
  for (const key of ['ot', 'nt', 'ext']) {
    const books = props.translation.books.filter((b) => b.group === key)
    if (books.length) g.push({ key, zh: GROUPS[key].zh, books })
  }
  return g
})
</script>

<template>
  <aside class="book-sidebar">
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

/* 移动端抽屉形态：显示头部与关闭按钮 */
@media (max-width: 900px) {
  .sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    background: #fbfcfd;
    z-index: 1;
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
