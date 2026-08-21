<script setup>
/**
 * SearchInput — 通用搜索输入框（放大镜图标 + 输入 + 清除按钮）
 * v-model 双向绑定；placeholder 可配置。人物/事件/预言等词条页共用。
 */
defineProps({
  placeholder: { type: String, default: '搜索…' },
})
const model = defineModel({ type: String, default: '' })
</script>

<template>
  <div class="search-bar">
    <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
    <input v-model="model" class="search-input" type="text" :placeholder="placeholder" />
    <button v-if="model" class="search-clear" aria-label="清空搜索" @click="model = ''">✕</button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  max-width: 34rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--panel);
  padding: 0.5rem 1rem;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.search-bar:focus-within {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.12);
}
.search-icon {
  flex-shrink: 0;
  color: var(--muted);
}
.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.92rem;
  color: var(--text);
}
.search-input::placeholder {
  color: #a7adb6;
}
.search-clear {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #a7adb6;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 2px 4px;
}
.search-clear:hover {
  color: var(--text);
}
</style>
