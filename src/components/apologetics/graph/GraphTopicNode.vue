<script setup>
/* GraphTopicNode — 核心命题节点（主题根节点） */
defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })
</script>

<template>
  <div class="gn gn-topic" :class="{ sel: selected }">
    <div class="gn-kind">核心命题</div>
    <div class="gn-topic-title">{{ data.titleZh }}</div>
    <div class="gn-topic-en">{{ data.titleEn }}</div>
    <p class="gn-topic-desc">{{ data.description }}</p>
  </div>
</template>

<style scoped>
.gn {
  width: 300px;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  background: var(--panel);
  border: 1.5px solid var(--line);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.18), var(--shadow-md); }

.gn-topic { background: linear-gradient(135deg, #f6efe3, #fdf9f2); border-color: #d9c5a4; }
.gn-kind {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
  background: var(--gold);
  border-radius: 999px;
  padding: 0.1rem 0.55rem;
  margin-bottom: 0.45rem;
}
.gn-topic-title { font-family: var(--serif); font-weight: 700; font-size: 1.12rem; color: var(--text); line-height: 1.45; }
.gn-topic-en { font-size: 0.78rem; color: #9a856a; letter-spacing: 0.04em; margin-top: 0.2rem; }
.gn-topic-desc { margin: 0.55rem 0 0; font-size: 0.78rem; line-height: 1.7; color: #6f5f49; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
</style>