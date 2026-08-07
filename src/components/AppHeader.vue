<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">
      <span class="brand-mark">FISH</span>
      <span class="brand-sub">读经研究平台</span>
    </RouterLink>
    <nav class="nav">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/brp">读经研究 (brp)</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1.4rem;
  background: #fff;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  text-decoration: none;
}
.brand-mark {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--accent);
}
.brand-sub {
  font-size: 0.85rem;
  color: var(--muted);
}
.nav {
  display: flex;
  gap: 1.2rem;
  font-size: 0.95rem;
}
.nav a {
  color: var(--text);
  padding: 0.25rem 0.4rem;
}
.nav a.router-link-active {
  color: var(--accent);
  font-weight: 600;
  border-bottom: 2px solid var(--accent);
}

/* 窄屏适配：紧凑头部 */
@media (max-width: 600px) {
  .app-header {
    padding: 0.5rem 0.8rem;
  }
  .brand-sub {
    display: none;
  }
  .nav {
    gap: 0.8rem;
    font-size: 0.85rem;
  }
}
</style>
