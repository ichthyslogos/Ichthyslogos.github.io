<script setup>
/**
 * FinalCTA — 结尾号召（HOMEPAGE_DESIGN.md §44）
 * 非常安静的设计：#EFEDE7 背景，BEGIN YOUR STUDY / 开始探索
 */
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="final-cta" aria-label="开始探索">
    <p class="cta-kicker">BEGIN YOUR STUDY</p>
    <h2 class="cta-title">开始探索</h2>
    <p class="cta-desc">
      从一节经文开始，<br />
      进入整个圣经世界。
    </p>
    <RouterLink to="/brp" class="cta-btn">开始研究 <span class="arrow">→</span></RouterLink>
  </section>
</template>

<style scoped>
.final-cta {
  background: #efede7;
  text-align: center;
  padding: 120px 2rem 130px;
}
.cta-kicker {
  margin: 0 0 1rem;
  font-size: 12px;
  font-weight: 700;
  color: #405d82;
  letter-spacing: 0.32em;
}
.cta-title {
  margin: 0 0 1.1rem;
  font-family: var(--serif);
  font-size: 2.4rem;
  font-weight: 500;
  color: #171717;
}
.cta-desc {
  margin: 0 0 2.4rem;
  font-size: 0.95rem;
  line-height: 2;
  color: #6b6b68;
}
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 46px;
  padding: 0 1.8rem;
  border-radius: 999px;
  background: #171717;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  transition: background var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.cta-btn:hover {
  text-decoration: none;
  background: #000;
  transform: translateY(-1px);
}
.arrow {
  font-size: 1rem;
}

@media (max-width: 600px) {
  .final-cta {
    padding: 80px 1.4rem 90px;
  }
}
</style>
