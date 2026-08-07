<script setup>
/**
 * ChapterTabs — 章节导航（brp 子组件）
 * 章节数来自 manifest（数据驱动）；当前章自动滚动到可视区
 */
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  chapterCount: { type: Number, required: true },
  current: { type: Number, required: true },
})
const emit = defineEmits(['select-chapter'])

const scroller = ref(null)

watch(
  () => props.current,
  async (cur) => {
    await nextTick()
    const el = scroller.value?.querySelector(`[data-ch="${cur}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
  { immediate: true },
)
</script>

<template>
  <div ref="scroller" class="chapter-tabs">
    <button
      v-for="n in chapterCount"
      :key="n"
      :data-ch="n"
      class="chapter-tab"
      :class="{ active: n === current }"
      @click="emit('select-chapter', n)"
    >
      {{ n }}
    </button>
  </div>
</template>

<style scoped>
.chapter-tabs {
  display: flex;
  gap: 2px;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--line);
  background: #fff;
  overflow-x: auto;
  flex-shrink: 0;
}
.chapter-tab {
  min-width: 2.1rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #fff;
  color: var(--muted);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}
.chapter-tab:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.chapter-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
</style>
