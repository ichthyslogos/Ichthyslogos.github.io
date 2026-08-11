<script setup>
/**
 * ApologeticsClosed — 护教页面占位页（合规关闭显示，2026-08）
 *
 * 背景：护教模块部分内容（《游子吟》全文归档）存在未解决的版权风险，
 * 依法律合规审查（knowledge/china/）决定"技术层面关闭入口，非删除"。
 *
 * 恢复方式：router/index.js 中 /apologetics 路由改回 ApologeticsPage 即可。
 * 原页面组件与数据均原样保留，未做任何删除。
 */
import EmptyState from '../../components/EmptyState.vue'
</script>

<template>
  <div class="closed-page">
    <EmptyState title="护教问答" message="该栏目暂未开放，敬请期待。" />
  </div>
</template>

<style scoped>
.closed-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
</style>
