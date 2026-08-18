import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './lib/scrollbars.js' // 全局滚动条显隐驱动（副作用模块）
import './style.css'

// 全局错误捕获（协议 §13 调试日志：渲染异常必须可见，不静默失败）
window.addEventListener('error', (e) => {
  document.documentElement.setAttribute('data-app-error', String(e.message || e.error?.message || '').slice(0, 200))
})
window.addEventListener('unhandledrejection', (e) => {
  document.documentElement.setAttribute('data-app-reject', String(e.reason?.message || e.reason || '').slice(0, 200))
})

createApp(App).use(router).mount('#app')
