<script setup>
/**
 * ResponseCard — 回应卡片（子问题详情内）
 * 结构：中英标题 + 视角徽章 + 领域标签 + 核心思想（summary）+ 正文 + 证据面板。
 */
import EvidencePanel from './EvidencePanel.vue'

defineProps({ r: { type: Object, required: true } })
</script>

<template>
  <article class="response-card">
    <header class="r-head">
      <h4 class="r-title">{{ r.title.zh }}</h4>
      <span class="r-title-en">{{ r.title.en }}</span>
      <span v-if="r.perspective" class="r-persp">{{ r.perspective }}</span>
    </header>
    <div v-if="r.tags?.length" class="r-tags">{{ r.tags.join(' · ') }}</div>
    <p class="r-summary">{{ r.summary }}</p>
    <p class="r-text">{{ r.text }}</p>
    <EvidencePanel v-if="r.evidence" :evidence="r.evidence" />
  </article>
</template>

<style scoped>
.response-card {
  padding: 1.7rem 0;
  border-bottom: 1px solid #f0ece2;
}
.response-card:last-child {
  border-bottom: none;
}
.r-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.r-title {
  margin: 0;
  font-size: 1.16rem;
  font-weight: 700;
  color: #1f2937;
}
.r-title-en {
  font-size: 0.82rem;
  color: #a7adb6;
  letter-spacing: 0.03em;
}
.r-persp {
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: #8b7355;
  background: #f1ece2;
  border-radius: 999px;
  padding: 0.14rem 0.65rem;
}
.r-tags {
  margin-top: 0.45rem;
  font-size: 0.75rem;
  color: #a7adb6;
  letter-spacing: 0.04em;
}
.r-summary {
  margin: 0.9rem 0 0;
  font-size: 0.94rem;
  font-style: italic;
  line-height: 1.8;
  color: #6b7683;
}
.r-text {
  margin: 0.8rem 0 0;
  font-size: 0.96rem;
  line-height: 2.05;
  color: #3f4a56;
  white-space: pre-line;
}
</style>
