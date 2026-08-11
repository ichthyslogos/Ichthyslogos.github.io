import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import BrpPage from '../views/brp/BrpPage.vue'
import ApologeticsPage from '../views/apologetics/ApologeticsPage.vue'
import LibraryPage from '../views/library/LibraryPage.vue'

/**
 * 路由约定：新增子页面在 views/[子页面名]/ 下建页面，并在本文件注册
 * 路由地址统一用 kebab-case（如 /brp），与 views/components/data 目录同名
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/brp', name: 'brp', component: BrpPage },
    { path: '/brp/:bookId/:chapter(\\d+)', name: 'brp-chapter', component: BrpPage },
    { path: '/apologetics', name: 'apologetics', component: ApologeticsPage },
    { path: '/library', name: 'library', component: LibraryPage },
    { path: '/library/:bookId', name: 'library-book', component: LibraryPage },
  ],
})

export default router
