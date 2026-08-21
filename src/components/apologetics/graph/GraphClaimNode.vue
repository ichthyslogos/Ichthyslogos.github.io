<script setup>
/* GraphClaimNode — 命题节点（子命题的主张） */
defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })
</script>

<template>
  <div class="gn gn-claim" :class="{ sel: selected }">
    <div class="gn-head">
      <span class="gn-kind k-claim">命题</span>
      <span v-if="data.perspective" class="gn-persp">{{ data.perspective }}</span>
    </div>
    <div class="gn-title gn-claim-q">{{ data.question }}</div>
    <div v-if="data.tags?.length" class="gn-tags">{{ data.tags.join(' · ') }}</div>
    <p v-if="data.summary" class="gn-summary">{{ data.summary }}</p>
  </div>
</template>

<style scoped>
.gn {
  width: 280px;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  background: var(--panel);
  border: 1.5px solid #c9d6ea;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(47, 93, 158, 0.15), var(--shadow-md); }
.gn-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.45rem; }
.gn-kind { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; color: #fff; background: var(--accent); border-radius: 999px; padding: 0.1rem 0.55rem; }
.gn-persp { font-size: 0.72rem; font-weight: 600; background: #f0f1f4; color: #5c6676; border-radius: 999px; padding: 0.06rem 0.5rem; }
.gn-title { font-size: 0.98rem; font-weight: 700; line-height: 1.5; color: var(--text); }
.gn-tags { margin-top: 0.4rem; font-size: 0.72rem; color: #a7adb6; }
.gn-summary { margin: 0.5rem 0 0; font-size: 0.8rem; line-height: 1.7; color: #6b7683; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>