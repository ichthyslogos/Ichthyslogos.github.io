<script setup>
/**
 * TopicCard — 护教主题卡片（主题探索页网格）
 * 展示：中英标题、描述、子问题数、领域标签、箭头。
 */
defineProps({ topic: { type: Object, required: true } })
const emit = defineEmits(['select'])
</script>

<template>
  <article class="topic-card" tabindex="0" role="button" @click="emit('select', topic.id)" @keydown.enter="emit('select', topic.id)">
    <div class="t-card-top">
      <h3 class="t-zh">{{ topic.title.zh }}</h3>
      <span class="t-arrow" aria-hidden="true">→</span>
    </div>
    <p class="t-en">{{ topic.title.en }}</p>
    <p class="t-desc">{{ topic.description }}</p>
    <div class="t-meta">
      <span class="t-count">{{ topic.sqCount ?? topic.sub_questions?.length ?? 0 }} 个相关问题</span>
      <span class="t-tags">{{ (topic.tags || []).join(' · ') }}</span>
    </div>
  </article>
</template>

<style scoped>
.topic-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: var(--panel);
  padding: 1.4rem 1.5rem 1.3rem;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.topic-card:hover,
.topic-card:focus-visible {
  border-color: var(--gold);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  outline: none;
}
.t-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}
.t-zh {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
}
.t-arrow {
  flex-shrink: 0;
  font-size: 1.15rem;
  color: var(--muted);
  transition: color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.topic-card:hover .t-arrow {
  color: var(--gold);
  transform: translateX(3px);
}
.t-en {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: #a7adb6;
  letter-spacing: 0.04em;
}
.t-desc {
  flex: 1;
  margin: 0.8rem 0 1rem;
  font-size: 0.9rem;
  line-height: 1.75;
  color: #6b7683;
}
.t-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line-soft);
}
.t-count {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--gold);
}
.t-tags {
  font-size: 0.75rem;
  color: #a7adb6;
  white-space: nowrap;
}
</style>
