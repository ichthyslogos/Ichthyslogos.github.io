<script setup>
import AppHeader from './components/AppHeader.vue'
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* 滚动条槽位稳定：滚动条出现/消失时内容宽度不变 */
  scrollbar-gutter: stable;
}
</style>
