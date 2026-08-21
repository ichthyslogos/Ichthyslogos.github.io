<script setup>
/* GraphObjectionNode — 质疑节点（反方论证） */
defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })
</script>

<template>
  <div class="gn gn-objection" :class="{ sel: selected }">
    <div class="gn-head"><span class="gn-kind k-objection">质疑</span></div>
    <div class="gn-body">{{ data.text }}</div>
  </div>
</template>

<style scoped>
.gn {
  width: 280px;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  background: #fdf7f5;
  border: 1.5px solid #e4bdb3;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.gn:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.gn.sel { border-color: #b3452e; box-shadow: 0 0 0 3px rgba(179, 69, 46, 0.16), var(--shadow-md); }
.gn-head { display: flex; align-items: center; margin-bottom: 0.45rem; }
.gn-kind { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; color: #fff; background: #b3452e; border-radius: 999px; padding: 0.1rem 0.55rem; }
.gn-body { font-size: 0.84rem; line-height: 1.7; color: #7a4a3c; font-style: italic; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
</style>