<script setup>
/**
 * Home — 首页（Google 搜索引擎风）
 * 居中品牌字 + 大搜索框：回车/「FISH 搜索」跳转独立搜索结果页（/search?q=）；
 * 「手气不错」随机打开一章经文；底部为站点快捷入口链接。
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchManifest } from '../lib/data.js'

const router = useRouter()
const query = ref('')

const suggestions = [
  { label: '亚伯拉罕', q: '亚伯拉罕' },
  { label: '大卫', q: '大卫' },
  { label: '恩典', q: '恩典' },
  { label: '耶路撒冷', q: '耶路撒冷' },
  { label: '约翰福音 3:16', q: '约翰福音 3:16' },
]

let manifestPromise = null
/** 手气不错：随机打开一本书的一章。读到缓存清单失败则退回读经首页。 */
async function lucky() {
  try {
    manifestPromise ??= fetchManifest()
    const d = await manifestPromise
    const books = d?.translations?.[0]?.books
    if (!books?.length) return router.push('/brp')
    const b = books[Math.floor(Math.random() * books.length)]
    const ch = Math.floor(Math.random() * (b.chapterCount || 1)) + 1
    router.push(`/brp/${b.id}/${ch}`)
  } catch {
    router.push('/brp')
  }
}

/** 执行搜索：跳转独立的搜索结果页（完整页面，非浮层） */
function doSearch(q) {
  const kw = String(q ?? query.value).trim()
  router.push({ path: '/search', query: kw ? { q: kw } : undefined })
}
</script>

<template>
  <div class="home">
    <div class="home-main">
      <router-link to="/brp" class="brand" aria-label="FISH 去读经研究">
        <span class="brand-fish" aria-hidden="true">FISH</span>
        <span class="brand-sub">圣经研究与知识搜索</span>
      </router-link>

      <form class="search-form" @submit.prevent="doSearch()">
        <label class="visually-hidden" for="home-search">搜索圣经人物、经文、地点、原文或主题</label>
        <div class="search-box">
          <svg class="search-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" fill="currentColor" />
          </svg>
          <input
            id="home-search"
            v-model="query"
            type="search"
            placeholder="搜索人物、经文、地点、原文或主题……"
            aria-label="搜索人物、经文、地点、原文或主题"
            @keydown.enter.prevent="doSearch()"
          />
        </div>
        <div class="search-actions">
          <button type="submit" class="gbtn">FISH 搜索</button>
          <button type="button" class="gbtn" @click="lucky">手气不错</button>
        </div>
      </form>

      <div class="suggest" aria-label="热门搜索">
        <span class="suggest-label">热门搜索：</span>
        <button v-for="s in suggestions" :key="s.label" type="button" class="suggest-chip" @click="doSearch(s.q)">
          {{ s.label }}
        </button>
      </div>
    </div>

    <footer class="home-footer">
      <div class="footer-row">
        <div class="footer-links">
          <router-link to="/brp">读经</router-link>
          <router-link to="/map">地图</router-link>
          <router-link to="/persons">人物</router-link>
          <router-link to="/events">事件</router-link>
        </div>
        <div class="footer-links">
          <router-link to="/apologetics">护教</router-link>
          <router-link to="/library">文库</router-link>
          <router-link to="/history">教会史</router-link>
          <router-link to="/sources">数据与来源</router-link>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
/* 居中主体：占满视口，撑开时不把页脚拉到中间 */
.home-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 56px;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  margin-bottom: 36px;
}
.brand-fish {
  font-family: Georgia, "Times New Roman", var(--serif);
  font-size: 66px;
  font-weight: 600;
  letter-spacing: 4px;
  color: var(--gold, #a9834b);
  line-height: 1;
}
.brand-sub {
  margin-top: 10px;
  font-size: 12px;
  letter-spacing: 0.34em;
  color: #6b6b68;
}

/* 大搜索框：Google 式圆角白底浮框 */
.search-form {
  width: 100%;
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 26px;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 52px;
  padding: 0 0 0 1.2rem;
  border: 1px solid #dadce0;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(32, 33, 36, 0.16);
  transition: box-shadow var(--dur, 0.2s) var(--ease, ease), border-color 0.2s;
}
.search-box:focus-within {
  box-shadow: 0 2px 12px rgba(32, 33, 36, 0.28);
}
.search-ico {
  width: 20px;
  height: 20px;
  color: #9aa0a6;
  flex: none;
}
.search-box input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: #202124;
  font-family: inherit;
}

/* 按钮行：Google 风格的浅灰按钮 */
.search-actions {
  display: flex;
  justify-content: center;
  gap: 0.9rem;
}
.gbtn {
  font-family: inherit;
  font-size: 0.86rem;
  color: #3c4043;
  background: #f8f9fa;
  border: 1px solid #f8f9fa;
  border-radius: 4px;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.gbtn:hover {
  border-color: #dadce0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 热门搜索 */
.suggest {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 6px;
  max-width: 620px;
}
.suggest-label {
  font-size: 0.78rem;
  color: #9aa0a6;
}
.suggest-chip {
  font-family: inherit;
  font-size: 0.78rem;
  border: none;
  background: none;
  color: #1a73e8;
  cursor: pointer;
  padding: 2px 2px;
}
.suggest-chip + .suggest-chip::before {
  content: "·";
  margin: 0 0.45rem;
  color: #dadce0;
}
.suggest-chip:hover {
  text-decoration: underline;
}

/* 页脚：顶部细线 + 快捷链接双栏（Google 风格） */
.home-footer {
  border-top: 1px solid #dadce0;
  background: #f2f2f2;
  color: #70757a;
  font-size: 0.78rem;
}
.footer-row {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 26px 16px;
}
.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.4rem;
}
.footer-links a {
  color: #70757a;
  text-decoration: none;
}
.footer-links a:hover {
  text-decoration: underline;
}

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

@media (max-width: 560px) {
  .brand-fish {
    font-size: 52px;
  }
  .home-main {
    padding-top: 12px;
  }
  .footer-row {
    flex-direction: column;
    gap: 8px;
  }
}
</style>