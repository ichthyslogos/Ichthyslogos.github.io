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
  width: 200px;
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  background: #fdfaf3;
  border: 1.5px solid #e2cfae;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { border-color: #9a6b2f; box-shadow: 0 0 0 3px rgba(154, 107, 47, 0.16), var(--shadow-md); }
.gn-head { display: flex; align-items: center; margin-bottom: 0.3rem; }
.gn-kind { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; color: #fff; background: #9a6b2f; border-radius: 999px; padding: 0.08rem 0.5rem; }
.gn-scr-ref { color: #7a5319; }
.gn-ev-ref { font-size: 0.82rem; font-weight: 700; line-height: 1.45; }
.gn-ev-note { margin: 0.25rem 0 0; font-size: 0.7rem; line-height: 1.5; color: #6b7683; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
</style>