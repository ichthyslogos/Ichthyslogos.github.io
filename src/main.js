import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './lib/scrollbars.js' // 全局滚动条显隐驱动（副作用模块）
import './style.css'

createApp(App).use(router).mount('#app')
