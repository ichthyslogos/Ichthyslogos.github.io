<script setup>
/** SearchPage — 全页搜索结果页：读取路由 q 参数，以内联（page）模式渲染 SearchPanel，
 *  复用同一套检索逻辑（实体/经文/注释），区别于全局搜索浮层。 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SearchPanel from '../../components/search/SearchPanel.vue'

const route = useRoute()
const initialQuery = computed(() => String(route.query.q || ''))
</script>

<template>
  <SearchPanel page :initialQuery="initialQuery" />
</template>