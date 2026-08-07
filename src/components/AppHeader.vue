<script setup>
/**
 * AppHeader — 全局导航栏
 * 风格：60px 白底极简导航——左品牌（logo 图标 + 名称）、中菜单（大间距）。
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
        <img :src="logoUrl" class="brand-logo" alt="FISH 鱼与饼 · 基督教研究平台" />
        <span class="brand-name">FISH 鱼与饼</span>
      </RouterLink>

      <nav class="nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/brp">读经研究</RouterLink>
        <RouterLink to="/apologetics">护教</RouterLink>
      </nav>
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
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  position: relative;
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
  /* 菜单水平居中 */
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
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
    font-size: 0.88rem;
  }
}
</style>
