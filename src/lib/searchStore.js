/**
 * searchStore.js — 全局搜索状态（模块级单例）
 * AppHeader / 快捷入口调用 openSearch()，SearchPanel 监听 searchOpen 渲染浮层。
 */
import { ref } from 'vue'

export const searchOpen = ref(false)

export function openSearch() {
  searchOpen.value = true
}

export function closeSearch() {
  searchOpen.value = false
}
