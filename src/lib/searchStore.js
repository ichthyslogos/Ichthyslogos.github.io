/**
 * searchStore.js — 全局搜索状态（模块级单例）
 * AppHeader / 快捷入口调用 openSearch()，SearchPanel 监听 searchOpen 渲染浮层。
 * openSearch(initialQuery) 可附带初始关键词（如首页大搜索框回车），搜索面板打开时预填。
 */
import { ref } from 'vue'

export const searchOpen = ref(false)

/** 打开面板时预填的关键词（一次性：SearchPanel 读取后清空） */
export const searchInitialQuery = ref('')

export function openSearch(initialQuery = '') {
  if (initialQuery) searchInitialQuery.value = initialQuery
  searchOpen.value = true
}

export function closeSearch() {
  searchOpen.value = false
}
