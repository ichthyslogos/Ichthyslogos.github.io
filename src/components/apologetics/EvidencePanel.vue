<script setup>
/**
 * EvidencePanel — 证据面板（回应详情内）
 * 按类别展示回应关联的证据：圣经 / 哲学 / 历史 / 科学 / 神学 / 伦理 / 文献。
 * 圣经类条目使用 ScriptureReference（可跳转读经研究）。
 */
import { computed } from 'vue'
import ScriptureReference from './ScriptureReference.vue'

const props = defineProps({ evidence: { type: Object, default: null } })

const CATS = [
  { key: 'bible', label: '圣经', icon: '📖' },
  { key: 'philosophy', label: '哲学', icon: '📚' },
  { key: 'history', label: '历史', icon: '🏛️' },
  { key: 'science', label: '科学', icon: '🔬' },
  { key: 'theology', label: '神学', icon: '✝️' },
  { key: 'ethics', label: '伦理', icon: '⚖️' },
  { key: 'literature', label: '文献', icon: '📜' },
]

/** 仅渲染有证据的类别（避免 v-if 与 v-for 同元素：v-if 优先级更高会先于 v-for 求值） */
const visibleCats = computed(() => CATS.filter((c) => props.evidence?.[c.key]?.length))
</script>

<template>
  <aside v-if="evidence" class="evidence-panel">
    <div class="ep-title">证据支持</div>
    <section v-for="cat in visibleCats" :key="cat.key" class="ep-cat">
      <div class="ep-cat-label">{{ cat.icon }} {{ cat.label }}</div>
      <div v-for="(item, i) in evidence[cat.key]" :key="i" class="ep-item">
        <ScriptureReference v-if="cat.key === 'bible'" :ref-text="item.ref" :note="item.note" />
        <div v-else class="ep-ref-item">
          <span class="ep-ref">{{ item.ref }}</span>
          <span class="ep-note">{{ item.note }}</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.evidence-panel {
  margin-top: 1.1rem;
  background: #f8f5ef;
  border: 1px solid #efe9dd;
  border-radius: 8px;
  padding: 0.9rem 1.1rem 1rem;
}
.ep-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #8b7355;
  letter-spacing: 0.14em;
  margin-bottom: 0.55rem;
}
.ep-cat {
  display: flex;
  gap: 1.2rem;
  padding: 0.35rem 0;
  border-top: 1px solid #efe9dd;
  align-items: flex-start;
}
.ep-cat:first-of-type {
  border-top: none;
}
.ep-cat-label {
  flex-shrink: 0;
  width: 3.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #1f2937;
  padding-top: 0.12rem;
}
.ep-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.ep-ref-item {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}
.ep-ref {
  flex-shrink: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #1f2937;
}
.ep-note {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  color: #8a93a0;
  line-height: 1.6;
}
</style>
