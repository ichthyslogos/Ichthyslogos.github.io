<script setup>
/**
 * ChapterTabs — 章节导航（brp 子组件）
 * 章节数来自 manifest（数据驱动）；切换章节时选中章自动水平居中
 * （仅滚动章选择器自身，不影响侧栏/经文等其他区域）
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
    const sc = scroller.value
    const el = sc?.querySelector(`[data-ch="${cur}"]`)
    if (!sc || !el) return
    // 选中章居中：目标滚动位置 = 元素偏移 - 容器中心偏移
    const target = el.offsetLeft - sc.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2
    sc.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
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
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel);
  overflow-x: auto;
  scrollbar-gutter: stable;
  flex-shrink: 0;
}
.chapter-tab {
  min-width: 2.1rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid var(--line-soft);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.chapter-tab:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.chapter-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
/* 窄屏适配：章节条紧凑化（减少头部占用） */
@media (max-width: 900px) {
  .chapter-tabs {
    padding: 0.4rem 0.7rem;
  }
  .chapter-tab {
    min-width: 2rem;
    padding: 0.18rem 0.35rem;
    font-size: 0.78rem;
  }
}
</style>
