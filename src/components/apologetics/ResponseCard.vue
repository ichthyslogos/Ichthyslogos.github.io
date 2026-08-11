<script setup>
/**
 * ResponseCard — 内容卡（子命题详情内）
 * 结构：中英标题 + 视角徽章 + 领域标签 + 导语（summary）+ 正文（段落化，中文阅读排版）+ 证据面板。
 * 阅读排版：正文衬线字体、首行缩进两字符、段间距、限宽列——长文章读起来自然。
 * 版权合规：copyrighted 子命题（如《游子吟》全文归档）不渲染正文全文，
 *   改以摘要 + 版权提示呈现，引导读者购买正版。
 */
import { computed } from 'vue'
import EvidencePanel from './EvidencePanel.vue'

const props = defineProps({
  r: { type: Object, required: true },
  copyrighted: { type: Boolean, default: false },
})

/** 正文按换行拆段（去空行），每段一个 <p> 便于首行缩进与段间距 */
const paragraphs = computed(() =>
  (props.r.text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean),
)
</script>

<template>
  <article class="response-card">
    <header class="r-head">
      <h4 class="r-title">{{ r.title.zh }}</h4>
      <span class="r-title-en">{{ r.title.en }}</span>
      <span v-if="r.perspective" class="r-persp">{{ r.perspective }}</span>
    </header>
    <div v-if="r.tags?.length" class="r-tags">{{ r.tags.join(' · ') }}</div>
    <p v-if="r.summary" class="r-summary">{{ r.summary }}</p>

    <!-- 版权保护全文：不展示正文，显示摘要 + 版权提示 -->
    <div v-if="copyrighted" class="r-copyright">
      <span class="rc-badge">版权提示</span>
      <p class="rc-text">
        本内容基于里程《游子吟》整理，为受版权保护作品，全文暂不公开展示。
        摘要如上，完整论述请参阅正版书籍。
      </p>
    </div>

    <div v-else class="r-body">
      <p v-for="(para, i) in paragraphs" :key="i" class="r-para">{{ para }}</p>
    </div>
    <EvidencePanel v-if="r.evidence" :evidence="r.evidence" />
  </article>
</template>

<style scoped>
.response-card {
  padding: 1.7rem 0;
  border-bottom: 1px solid var(--line-soft);
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
  color: var(--text);
}
.r-title-en {
  font-size: 0.82rem;
  color: #a7adb6;
  letter-spacing: 0.03em;
}
.r-persp {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--gold);
  background: var(--gold-soft);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.65rem;
}
.r-tags {
  margin-top: 0.45rem;
  font-size: var(--fs-xs);
  color: #a7adb6;
  letter-spacing: 0.04em;
}

/* 导语：金棕竖线 + 稍大斜体，作为长文的引入 */
.r-summary {
  margin: 1rem 0 0;
  padding: 0.15rem 0 0.15rem 0.9rem;
  border-left: 3px solid var(--gold);
  font-size: 1rem;
  font-style: italic;
  line-height: 1.95;
  color: #5c6676;
}

/* 正文：书籍式阅读排版——衬线字体、两字符首行缩进、段间距、限宽列 */
.r-body {
  max-width: 46rem; /* 中文阅读舒适行宽 */
  margin-top: 1.1rem;
}
.r-para {
  margin: 0 0 0.85em;
  font-family: var(--serif);
  font-size: 1.03rem;
  line-height: 2.15;
  letter-spacing: 0.02em;
  text-indent: 2em; /* 中文段落首行缩进两字符 */
  color: #37404b;
  white-space: pre-wrap;
}
.r-para:last-child {
  margin-bottom: 0;
}

/* 版权提示块（受版权保护全文不展示） */
.r-copyright {
  margin-top: 1.1rem;
  max-width: 46rem;
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  background: var(--gold-soft);
  border: 1px dashed rgba(139, 115, 85, 0.5);
  border-radius: var(--radius-sm);
  padding: 0.9rem 1.1rem;
}
.rc-badge {
  flex-shrink: 0;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: #fff;
  background: var(--gold);
  border-radius: var(--radius-pill);
  padding: 0.14rem 0.6rem;
  margin-top: 0.15rem;
}
.rc-text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.85;
  color: #6b7683;
}
</style>
