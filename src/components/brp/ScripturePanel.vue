<script setup>
/**
 * ScripturePanel — 经文正文面板（brp 子组件）
 * 包含：书名/章节标题、译本切换（展开式下拉）、经文列表、"解经"按钮（切换右侧解经面板）
 * 译本选择器由 manifest 数据驱动：新增译本 → 自动出现在下拉中（原文/译本分组展示）
 */
import TranslationMenu from './TranslationMenu.vue'
import VerseItem from './VerseItem.vue'

defineProps({
  book: { type: Object, required: true },
  chapter: { type: Number, required: true },
  verses: { type: Array, default: () => [] },
  translations: { type: Array, required: true },
  activeKey: { type: String, required: true },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['change-translation', 'toggle-commentary'])
</script>

<template>
  <div class="scripture-panel">
    <header class="panel-head">
      <h1 class="panel-title">
        {{ book.zh }} <span class="chapter-label">第 {{ chapter }} 章</span>
      </h1>
      <div class="panel-actions">
        <TranslationMenu
          :translations="translations"
          :active-key="activeKey"
          @select="emit('change-translation', $event)"
        />
        <button class="btn-commentary" @click="emit('toggle-commentary')">解经</button>
      </div>
    </header>

    <div class="scripture-scroll">
      <div class="scripture-body">
        <div v-if="loading" class="scripture-loading">经文加载中…</div>
        <template v-else>
          <p v-if="!verses.length" class="scripture-empty">本章无经文数据</p>
          <VerseItem v-for="v in verses" :key="v.verse" :verse="v.verse" :text="v.text" :lang="activeKey" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scripture-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.9rem 1.4rem;
  border-bottom: 1px solid var(--line);
}
.panel-title {
  margin: 0;
  font-size: 1.35rem;
}
.chapter-label {
  font-size: 1rem;
  color: var(--muted);
  font-weight: 500;
}
.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.btn-commentary {
  padding: 0.3rem 1rem;
  border: none;
  border-radius: 6px;
  background: #1f6f4a;
  color: #fff;
  font-size: 0.9rem;
  white-space: nowrap;
}
.btn-commentary:hover {
  background: #185a3d;
}
/* 滚动容器贴面板右缘（紧邻解经面板），滚动条显示在容器边缘 */
.scripture-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* 正文内容在滚动容器内居中，不参与滚动定位 */
.scripture-body {
  max-width: 46rem;
  margin: 0 auto;
  padding: 1rem 1.6rem 3rem;
}
.scripture-loading,
.scripture-empty {
  color: var(--muted);
  text-align: center;
  padding: 2rem 0;
}
</style>
