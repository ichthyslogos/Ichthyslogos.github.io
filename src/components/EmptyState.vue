<script setup>
/** EmptyState — 共享空状态组件（components/ 根目录，供各子页面复用） */
defineProps({
  title: { type: String, default: '暂无内容' },
  message: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">⛵</div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="message" class="empty-message">{{ message }}</div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--muted);
}
.empty-icon {
  font-size: 2.2rem;
  opacity: 0.55;
}
.empty-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
}
.empty-message {
  max-width: 30rem;
  font-size: 0.9rem;
}
</style>
