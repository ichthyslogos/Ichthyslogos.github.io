<script setup>
/**
 * AppHeader — 全局导航栏
 * 风格：60px 白底极简导航——左品牌（logo 图标 + 名称）、中菜单（大间距）、右浅灰胶囊 CTA。
 * 首页（现代极简风格）时隐藏底部分隔线，其余页面保留极浅分隔避免与内容粘连。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { RouterLink } from 'vue-router'
import logoUrl from '../assets/logo.png'

const route = useRoute()
const flat = computed(() => route.name === 'home')
</script>

<template>
  <header class="app-header" :class="{ flat }">
    <div class="header-inner">
      <RouterLink to="/" class="brand">
        <img :src="logoUrl" class="brand-logo" alt="FISH 读经研究平台" />
        <span class="brand-name">读经研究平台</span>
      </RouterLink>

      <nav class="nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/brp">读经研究</RouterLink>
      </nav>

      <RouterLink to="/brp" class="header-cta">开始读经</RouterLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: #fff;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
/* 首页极简风格：无底部分隔线 */
.app-header.flat {
  border-bottom: none;
}
.header-inner {
  height: 60px;
  max-width: 76rem;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
  min-width: 0;
}
.brand-logo {
  height: 1.6rem;
  width: auto;
  display: block;
}
.brand-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #101010;
  white-space: nowrap;
}
.nav {
  display: flex;
  gap: 2.2rem;
  font-size: 0.92rem;
  margin-right: auto;
  padding-left: 2rem;
}
.nav a {
  color: #4a4a4a;
  padding: 0.2rem 0.1rem;
}
.nav a:hover {
  color: #101010;
  text-decoration: none;
}
.nav a.router-link-active {
  color: #101010;
  font-weight: 600;
}
.header-cta {
  padding: 0.42rem 1.2rem;
  border-radius: 999px;
  background: #f5f5f5;
  color: #1d1d1d;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.header-cta:hover {
  background: #e9e9e9;
  text-decoration: none;
}

/* 窄屏：紧凑品牌与导航 */
@media (max-width: 600px) {
  .header-inner {
    height: 54px;
    padding: 0 1rem;
    gap: 0.8rem;
  }
  .brand-name {
    display: none;
  }
  .nav {
    gap: 1.2rem;
    padding-left: 0.5rem;
    font-size: 0.88rem;
  }
  .header-cta {
    padding: 0.38rem 0.9rem;
    font-size: 0.84rem;
  }
}
</style>
