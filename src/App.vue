<script setup>
// App 根组件：应用外壳（AppHeader + main 路由出口）。全局滚动收敛在 .app-main（见下方样式注释）。
// 首页（Google 式）隐藏顶部导航栏，其余页面保留。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import SearchPanel from './components/search/SearchPanel.vue'

const route = useRoute()
const showHeader = computed(() => route.name !== 'home')
</script>

<template>
  <div class="app-shell">
    <AppHeader v-if="showHeader" />
    <main class="app-main">
      <router-view />
    </main>
    <SearchPanel />
  </div>
</template>

<style scoped>
.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  /* 滚动到底/顶时不向 window 传播滚动（配合 html,body overflow:hidden，
     杜绝首页「划到底还能继续滑」的二次滚动） */
  overscroll-behavior: contain;
  /* 滚动条槽位稳定：滚动条出现/消失时内容宽度不变 */
  scrollbar-gutter: stable;
}
</style>
