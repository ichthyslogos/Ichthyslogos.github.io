<script setup>
/**
 * SearchBar — 护教搜索框（关键词/问题/分类搜索）
 * 受控组件：父级持有 query，本组件只负责输入与清空。
 */
defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="search-bar">
    <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
    <input
      class="search-input"
      type="text"
      :value="modelValue"
      placeholder="搜索问题、主题或关键词，如「为什么有苦难」"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button v-if="modelValue" class="search-clear" aria-label="清空搜索" @click="emit('update:modelValue', '')">✕</button>
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
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-pill);
}
.search-clear:hover {
  color: var(--text);
  background: var(--line-soft);
}
</style>
