<script setup>
/* MetaThesisNode — 总图谱核心结论节点（基督教信仰的客观性） */
defineProps({ data: { type: Object, default: {} }, selected: { type: Boolean, default: false } })
</script>

<template>
  <div class="mt-thesis" :class="{ sel: selected }">
    <div class="mt-label">核心结论</div>
    <div class="mt-title">{{ data.titleZh }}</div>
    <div class="mt-en">{{ data.titleEn }}</div>
    <p class="mt-claim">{{ data.claim }}</p>
  </div>
</template>

<style scoped>
.mt-thesis {
  width: 340px;
  border-radius: 16px;
  padding: 1.1rem 1.2rem;
  background: linear-gradient(135deg, #f2e6cf, #fdf7ea);
  border: 2px solid #c9a86a;
  box-shadow: 0 6px 22px rgba(139, 115, 85, 0.16), var(--shadow-sm);
  cursor: pointer;
  transition: box-shadow var(--dur) var(--ease), transform var(--dur) var(--ease);
  text-align: center;
}
.mt-thesis:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
.mt-thesis.sel { box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.22), var(--shadow-md); }
.mt-label {
  display: inline-block;
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.16em;
  color: #fff; background: var(--gold); border-radius: 999px;
  padding: 0.16rem 0.9rem; margin-bottom: 0.7rem;
}
.mt-title {
  font-family: var(--serif); font-weight: 700; font-size: 1.5rem;
  color: #3c3124; line-height: 1.4; letter-spacing: 0.02em;
}
.mt-en { font-size: 0.8rem; color: #9a856a; letter-spacing: 0.05em; margin-top: 0.3rem; }
.mt-claim { margin: 0.85rem 0 0; padding-top: 0.85rem; border-top: 1px dashed #dcc9a5; font-size: 0.82rem; line-height: 1.9; color: #6f5f49; text-align: left; }
</style>