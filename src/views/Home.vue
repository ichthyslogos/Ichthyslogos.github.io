<script setup>
/**
 * Home — 网站首页（FISH 品牌 + 功能卡片）
 * 数据统计从 manifest 动态读取：新增译本后自动更新
 */
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchManifest } from '../lib/data.js'
import logoUrl from '../assets/logo.png'

const manifest = ref(null)

onMounted(async () => {
  try {
    manifest.value = await fetchManifest()
  } catch {
    manifest.value = null
  }
})

const stats = computed(() => {
  if (!manifest.value) return null
  const ts = manifest.value.translations
  return {
    versions: ts.length,
    books: ts.reduce((s, t) => s + t.books.length, 0),
    originals: ts.filter((t) => t.original).length,
  }
})

const features = [
  {
    title: '读经研究平台 (brp)',
    desc: '在线阅读圣经：书卷/章节导航、多译本一键切换（数据驱动，放入即显示）。',
    status: '已上线',
    statusClass: 'on',
    to: '/brp',
  },
  {
    title: '马太亨利译注',
    desc: '解经面板已接入马太亨利圣经注释：按书卷+章节对齐显示概要与小节注释，持续收录扩充中（当前已开放旧约前 10 卷）。',
    status: '已上线',
    statusClass: 'on',
    to: '/brp',
  },
  {
    title: 'Strong 原文研究',
    desc: '规划中：原文（希伯来文/希腊文）与译本数据流隔离，按 Strong 编号挂接词义注解。',
    status: '规划中',
    statusClass: 'soon',
    to: null,
  },
]
</script>

<template>
  <div class="home">
    <section class="hero">
      <img :src="logoUrl" class="hero-logo" alt="FISH 读经研究平台" />
      <h1 class="hero-title">FISH</h1>
      <p class="hero-sub">Bible Research Platform · 读经研究平台</p>
      <p class="hero-desc">
        面向中文读经者的轻量研究工具。素材与框架严格隔离，数据流水线驱动：新译本放入数据库即可自动上架。
      </p>
      <div v-if="stats" class="hero-stats">
        <span>{{ stats.versions }} 个译本</span>
        <span>{{ stats.books }} 卷经文</span>
        <span v-if="stats.originals">{{ stats.originals }} 类原文</span>
      </div>
      <RouterLink to="/brp" class="hero-cta">进入读经研究 →</RouterLink>
    </section>

    <section class="features">
      <div v-for="f in features" :key="f.title" class="feature-card">
        <div class="feature-head">
          <h2>{{ f.title }}</h2>
          <span class="feature-status" :class="f.statusClass">{{ f.status }}</span>
        </div>
        <p>{{ f.desc }}</p>
        <RouterLink v-if="f.to" :to="f.to" class="feature-link">打开 →</RouterLink>
      </div>
    </section>

    <footer class="home-footer">
      <p>
        数据源：bible_databases（scrollmapper，140 种译本 JSON 统一格式）· 素材存放于
        <code>D:\Eyphka\fish\</code>，与网站 <code>site\</code> 隔离。
        详细架构见 <code>docs\</code>。
      </p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  max-width: 60rem;
  width: 100%;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}
.hero {
  text-align: center;
  padding: 2.5rem 1rem 2rem;
}
.hero-logo {
  height: 4.6rem;
  width: auto;
  margin-bottom: 0.8rem;
}
.hero-title {
  margin: 0;
  font-size: 3.4rem;
  letter-spacing: 0.12em;
  color: var(--accent);
  font-weight: 800;
}
.hero-sub {
  margin: 0.4rem 0 1rem;
  color: var(--muted);
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}
.hero-desc {
  max-width: 34rem;
  margin: 0 auto 1.2rem;
  color: var(--text);
}
.hero-stats {
  display: flex;
  justify-content: center;
  gap: 1.4rem;
  font-size: 0.9rem;
  color: var(--accent);
  font-weight: 600;
}
.hero-cta {
  display: inline-block;
  margin-top: 1.6rem;
  padding: 0.55rem 1.8rem;
  background: var(--accent);
  color: #fff;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
}
.hero-cta:hover {
  background: #24497e;
  text-decoration: none;
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}
.feature-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}
.feature-card h2 {
  margin: 0;
  font-size: 1.08rem;
}
.feature-card p {
  margin: 0;
  font-size: 0.92rem;
  color: var(--muted);
  flex: 1;
}
.feature-status {
  font-size: 0.75rem;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}
.feature-status.on {
  background: #e3f2e8;
  color: #1f6f4a;
}
.feature-status.soon {
  background: #f4ecd9;
  color: #8a6d1a;
}
.feature-link {
  font-size: 0.9rem;
  font-weight: 600;
}
.home-footer {
  margin-top: 3rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--muted);
}
.home-footer code {
  background: #eef1f4;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
}
</style>
