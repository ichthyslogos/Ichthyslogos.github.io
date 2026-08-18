<script setup>
/**
 * UniversalSearch — 全局搜索入口（HOMEPAGE_DESIGN.md §36-39）
 * 大搜索框（64px/760px）+ 快捷搜索词（点击跳转读经研究；全局搜索为未来能力）
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const query = ref('')

const suggestions = [
  { label: '耶路撒冷', q: '耶路撒冷' },
  { label: '亚伯拉罕', q: '亚伯拉罕' },
  { label: '恩典', q: '恩典' },
  { label: 'πίστις', q: 'πίστις' },
  { label: '约翰福音 3:16', q: '约翰福音 3:16' },
  { label: '大卫', q: '大卫' },
]

/** 执行搜索：当前跳转读经研究（全局知识搜索为后续路线图能力） */
function doSearch(q) {
  const kw = (q ?? query.value).trim()
  router.push({ path: '/brp', query: kw ? { q: kw } : undefined })
}
</script>

<template>
  <section class="search-sec" aria-label="搜索圣经">
    <header class="sec-head">
      <p class="sec-kicker">SEARCH THE BIBLE</p>
      <h2 class="sec-title">探索整个圣经世界</h2>
      <p class="sec-sub">从一个关键词开始。</p>
    </header>

    <form class="search-form" @submit.prevent="doSearch()">
      <label class="visually-hidden" for="home-search">搜索人物、地点、经文、原文或主题</label>
      <div class="search-box">
        <span class="search-ico" aria-hidden="true">🔍</span>
        <input
          id="home-search"
          v-model="query"
          type="search"
          placeholder="搜索人物、地点、经文、原文或主题……"
          aria-label="搜索人物、地点、经文、原文或主题"
        />
        <button type="submit" class="search-btn">搜索</button>
      </div>
    </form>

    <div class="search-suggest" aria-label="试试">
      <span class="suggest-label">试试：</span>
      <button v-for="s in suggestions" :key="s.label" class="suggest-chip" @click="doSearch(s.q)">
        {{ s.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.search-sec {
  background: #f8f7f3;
  padding: 20px 2rem 140px;
}
.sec-head {
  max-width: 1200px;
  margin: 0 auto 2.8rem;
  text-align: center;
}
.sec-kicker {
  margin: 0 0 0.8rem;
  font-size: 12px;
  font-weight: 700;
  color: #405d82;
  letter-spacing: 0.3em;
}
.sec-title {
  margin: 0 0 0.8rem;
  font-family: var(--serif);
  font-size: 2.2rem;
  font-weight: 500;
  color: #171717;
}
.sec-sub {
  margin: 0;
  font-size: 0.92rem;
  color: #6b6b68;
}

/* 大搜索框：64px 高 / 760px 宽（§37） */
.search-form {
  max-width: 760px;
  margin: 0 auto;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: 64px;
  padding: 0 0.5rem 0 1.2rem;
  border: 1px solid #e4e1da;
  border-radius: 999px;
  background: #fff;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}
.search-box:focus-within {
  border-color: #405d82;
  box-shadow: 0 0 0 3px rgba(64, 93, 130, 0.12);
}
.search-ico {
  font-size: 1.05rem;
}
.search-box input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.95rem;
  color: #171717;
  font-family: inherit;
}
.search-btn {
  height: 44px;
  padding: 0 1.5rem;
  border: none;
  border-radius: 999px;
  background: #171717;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}
.search-btn:hover {
  background: #000;
}

/* 快捷搜索词（§38） */
.search-suggest {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  max-width: 760px;
  margin: 1.2rem auto 0;
}
.suggest-label {
  font-size: 0.8rem;
  color: #a8a49b;
}
.suggest-chip {
  border: 1px solid #e4e1da;
  border-radius: 999px;
  background: #fff;
  color: #6b6b68;
  font-size: 0.8rem;
  padding: 0.3rem 0.9rem;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), color var(--dur) var(--ease);
}
.suggest-chip:hover {
  border-color: #405d82;
  color: #405d82;
}

/* 无障碍：仅视觉隐藏 label */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 700px) {
  .search-sec {
    padding: 20px 1.2rem 90px;
  }
  .search-box {
    height: 54px;
  }
  .search-btn {
    height: 40px;
    padding: 0 1.1rem;
  }
}
</style>
