<script setup>
/**
 * VerseItem — 单节经文（brp 子组件）
 * 预留 Future Strong 插槽：原文 Strong 编号高亮、词义注解将通过具名插槽
 * `annotations` 注入本组件的 slot（当前版本不渲染任何内容）。
 */
defineProps({
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  lang: { type: String, default: '' },
})
</script>

<template>
  <p class="verse-item">
    <span class="verse-num">{{ verse }}</span>
    <span class="verse-text">{{ text }}</span>
    <!-- Future Strong：<slot name="annotations" :verse="verse" /> -->
  </p>
</template>

<style scoped>
.verse-item {
  margin: 0;
  padding: 0.28rem 0;
  line-height: 2;
}
.verse-item:hover {
  background: #fafafb;
}
.verse-num {
  display: inline-block;
  min-width: 1.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent);
  text-align: right;
  margin-right: 0.6rem;
  user-select: none;
}
.verse-text {
  font-family: var(--serif);
  font-size: 1.08rem;
  letter-spacing: 0.02em;
}
</style>
