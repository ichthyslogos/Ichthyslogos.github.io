/**
 * scrollbars.js — 全局滚动条显隐驱动（共享逻辑，main.js 引入一次）
 *
 * 滚动条样式见 style.css：默认 opacity 0 完全隐藏。
 * 本模块监听全局 scroll 事件（捕获阶段，覆盖所有内部滚动容器）：
 * 滚动发生时给 <html> 加 .sb-scrolling 类（滚动条淡入），
 * 停止滚动约 600ms 后移除（滚动条淡出）。鼠标悬停滚动区域时亦显示。
 */
const HIDE_DELAY = 600
let timer = null

function show() {
  document.documentElement.classList.add('sb-scrolling')
  clearTimeout(timer)
  timer = setTimeout(() => {
    document.documentElement.classList.remove('sb-scrolling')
  }, HIDE_DELAY)
}

document.addEventListener('scroll', show, { capture: true, passive: true })
