<script setup>
/** DictView — 词典正文：默认折叠展示前 PREVIEW 字，可展开全文；
 *  展开后底部始终有可见的「收起」栏（滚动阅读时无需回到顶部即可关闭）。 */
import { ref, computed } from 'vue'

const PREVIEW = 400

const props = defineProps({
  text: { type: String, default: '' },
})

const expanded = ref(false)
/** 短词条无需折叠 */
const isLong = computed(() => props.text.length > PREVIEW)
const preview = computed(() => props.text.slice(0, PREVIEW))
</script>

<template>
  <div v-if="isLong" class="dict" :class="{ open: expanded }">
    <p class="dict-text">{{ expanded ? text : preview }}</p>
    <div v-if="expanded" class="dict-bbar">
      <button type="button" class="dict-btn" @click="expanded = false">收起全文</button>
    </div>
    <div v-else class="dict-bbar">
      <button type="button" class="dict-btn" @click="expanded = true">展开全文（共 {{ text.length }} 字）</button>
    </div>
  </div>
  <p v-else class="dict-text">{{ text }}</p>
</template>

<style scoped>
.dict {
  position: relative;
  max-width: 46rem;
}
/* 展开态：限高滚动，让底部收起栏随阅读保持可见 */
.dict.open {
  max-height: 62vh;
  overflow-y: auto;
}
.dict-text {
  margin: 0;
  font-family: var(--serif);
  font-size: 0.95rem;
  line-height: 1.95;
  color: #4a5560;
  background: var(--panel);
  border: 1px solid var(--line);
  border-left: 3px solid var(--gold);
  border-radius: var(--radius-sm);
  padding: 1.3rem 1.6rem;
}
.dict.open .dict-text {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  border-bottom: 1px solid var(--line);
}
.dict-bbar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  backdrop-filter: blur(4px);
  border-top: 1px solid var(--line);
}
/* 折叠态：按钮放在预览文本下方居中，非吸底 */
.dict:not(.open) .dict-bbar {
  position: static;
  justify-content: center;
  border-top: none;
  padding: 10px 0 0;
  background: transparent;
  backdrop-filter: none;
}
.dict-btn {
  font: inherit;
  font-size: 0.8rem;
  color: var(--gold);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.dict-btn:hover {
  border-color: var(--gold);
  background: color-mix(in srgb, var(--gold) 8%, transparent);
}
</style>