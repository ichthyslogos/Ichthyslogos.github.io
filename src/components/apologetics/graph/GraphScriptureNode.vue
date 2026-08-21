<script setup>
/* GraphScriptureNode — 经文节点（可深链读经页） */
defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })
</script>

<template>
  <div class="gn gn-scripture" :class="{ sel: selected }">
    <div class="gn-head"><span class="gn-kind k-scripture">经文</span></div>
    <div class="gn-ev-ref gn-scr-ref">📖 {{ data.ref }}</div>
    <p v-if="data.note" class="gn-ev-note">{{ data.note }}</p>
  </div>
</template>

<style scoped>
.gn {
  width: 260px;
  border-radius: 12px;
  padding: 0.8rem 0.95rem;
  background: #fdfaf3;
  border: 1.5px solid #e2cfae;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { border-color: #9a6b2f; box-shadow: 0 0 0 3px rgba(154, 107, 47, 0.16), var(--shadow-md); }
.gn-head { display: flex; align-items: center; margin-bottom: 0.4rem; }
.gn-kind { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; color: #fff; background: #9a6b2f; border-radius: 999px; padding: 0.1rem 0.55rem; }
.gn-scr-ref { color: #7a5319; }
.gn-ev-ref { font-size: 0.9rem; font-weight: 700; line-height: 1.5; }
.gn-ev-note { margin: 0.35rem 0 0; font-size: 0.76rem; line-height: 1.6; color: #6b7683; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>