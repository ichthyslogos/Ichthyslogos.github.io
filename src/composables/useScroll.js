/**
 * useScroll.js — 页面滚动工具（探索 ↔ 详情视图切换时复位滚动）
 * 全站统一滚动容器为 .app-main；列表区锚点统一为 #list。
 * 各页面共用，避免重复实现。
 */

/** 滚动主内容区到顶部（详情/列表视图切换用） */
export function scrollMainTop() {
  document.querySelector('.app-main')?.scrollTo(0, 0)
}

/** 平滑滚动到列表区（不用 #锚点跳转：与 hash 路由冲突） */
export function scrollToList() {
  document.getElementById('list')?.scrollIntoView({ behavior: 'smooth' })
}
