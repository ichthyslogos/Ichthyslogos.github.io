<script setup>
/**
 * QuestionCard — 子问题列表项（主题详情左栏）
 * 展示：序号、问题、回应数；激活态灰黑底白字。
 */
defineProps({
  q: { type: Object, required: true },
  active: { type: Boolean, default: false },
  index: { type: Number, default: 0 },
})
const emit = defineEmits(['select'])
</script>

<template>
  <button class="question-item" :class="{ active }" @click="emit('select', q.id)">
    <span class="q-num">{{ String(index + 1).padStart(2, '0') }}</span>
    <span class="q-text">{{ q.question }}</span>
  </button>
</template>

<style scoped>
.question-item {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.75rem 0.8rem;
  border-radius: var(--radius-sm);
  font-size: 0.93rem;
  color: #4a5662;
  cursor: pointer;
  line-height: 1.55;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}
.question-item:hover {
  background: var(--gold-soft);
}
.question-item.active {
  background: var(--ink);
  color: #fff;
  font-weight: 600;
}
.q-num {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--gold);
  margin-top: 0.22rem;
  font-variant-numeric: tabular-nums;
}
.question-item.active .q-num {
  color: #c9b693;
}
.q-text {
  flex: 1;
  min-width: 0;
}
</style>
