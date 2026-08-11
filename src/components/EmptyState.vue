<script setup>
/** EmptyState — 共享空状态组件（components/ 根目录，供各子页面复用） */
defineProps({
  title: { type: String, default: '暂无内容' },
  message: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon" aria-hidden="true">⛵</div>
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
  width: 3.4rem;
  height: 3.4rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--gold-soft);
  font-size: 1.5rem;
  margin-bottom: 0.3rem;
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
