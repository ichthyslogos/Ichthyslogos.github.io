<script setup>
/**
 * IntroSection — 首页理念区（HOMEPAGE_DESIGN.md §22-24）
 * 核心信息："圣经不是孤立的文本" + 简约关系网络（经文 → 原文/地理/历史 → 注释）
 */
</script>

<template>
  <section class="intro" aria-label="平台理念">
    <div class="intro-inner">
      <p class="intro-kicker">FISH</p>
      <h2 class="intro-title">圣经不是孤立的文本。</h2>
      <p class="intro-desc">
        一节经文背后，<br />
        可能有一种语言、一座城市、一条道路、一个民族、一个时代，<br />
        以及数百年来的解释。<br /><br />
        FISH 将这些信息重新连接起来。
      </p>

      <!-- 简约关系网络：黑色文字 / 细灰色连接线 / 蓝色小节点（§24，不做动态图） -->
      <div class="relation" role="img" aria-label="经文连接原文、地理、历史，汇聚为注释">
        <div class="rel-col">
          <div class="rel-node rel-root">经文</div>
          <div class="rel-vline" aria-hidden="true"></div>
          <div class="rel-branches" aria-hidden="true">
            <span class="rel-hline"></span>
            <span class="rel-hline"></span>
            <span class="rel-hline"></span>
          </div>
        </div>
        <div class="rel-mid">
          <div class="rel-item"><i class="rel-dot" aria-hidden="true"></i>原文<span class="rel-sub">Strong 词典 · 词形</span></div>
          <div class="rel-item"><i class="rel-dot" aria-hidden="true"></i>地理<span class="rel-sub">城市 · 道路 · 地点</span></div>
          <div class="rel-item"><i class="rel-dot" aria-hidden="true"></i>历史<span class="rel-sub">国家 · 王朝 · 事件</span></div>
        </div>
        <div class="rel-col rel-bottom">
          <div class="rel-vline" aria-hidden="true"></div>
          <div class="rel-node rel-leaf">注释</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro {
  background: #f8f7f3;
  padding: 120px 2rem 140px;
}
.intro-inner {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}
.intro-kicker {
  margin: 0 0 1.2rem;
  font-family: var(--serif);
  font-size: 1.6rem;
  letter-spacing: 0.4em;
  color: #405d82;
}
.intro-title {
  margin: 0 0 1.4rem;
  font-family: var(--serif);
  font-size: 2.6rem;
  font-weight: 500;
  color: #171717;
}
.intro-desc {
  margin: 0 auto;
  max-width: 620px;
  font-size: 0.95rem;
  line-height: 2;
  color: #6b6b68;
}

/* 关系网络（§24）：三列——经文 → 原文/地理/历史 → 注释 */
.relation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  margin: 4rem auto 0;
  max-width: 760px;
}
.rel-col {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rel-vline {
  width: 1px;
  height: 34px;
  background: #d8d5ce;
}
.rel-branches {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 8rem;
  margin-bottom: -12px;
}
.rel-hline {
  flex: 1;
  height: 1px;
  background: #d8d5ce;
  max-width: 90px;
}
.rel-node {
  font-size: 1.05rem;
  font-weight: 600;
  color: #171717;
  padding: 0.35rem 1.1rem;
  border: 1px solid #e4e1da;
  border-radius: 999px;
  background: #fff;
}
.rel-leaf {
  color: #405d82;
  border-color: #405d82;
  background: #f8f7f3;
}
.rel-mid {
  display: flex;
  gap: 4.5rem;
  padding: 1.6rem 0 0.4rem;
}
.rel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #171717;
}
.rel-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #405d82;
}
.rel-sub {
  font-size: 0.7rem;
  font-weight: 400;
  color: #9a9790;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.rel-bottom {
  margin-top: -6px;
}

/* 响应式 */
@media (max-width: 700px) {
  .intro {
    padding: 80px 1.4rem 100px;
  }
  .intro-title {
    font-size: 1.9rem;
  }
  .relation {
    margin-top: 2.6rem;
  }
  .rel-branches {
    padding: 0 2rem;
  }
  .rel-mid {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
