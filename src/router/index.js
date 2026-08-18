import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'

/**
 * 路由约定：新增子页面在 views/[子页面名]/ 下建页面，并在本文件注册
 * 路由地址统一用 kebab-case（如 /brp），与 views/components/data 目录同名
 *
 * 性能：除首页外全部懒加载（按路由分包）。地图页独占 maplibre-gl 大依赖，
 * 懒加载后主包不含引擎，首屏体积显著下降。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/brp', name: 'brp', component: () => import('../views/brp/BrpPage.vue') },
    { path: '/brp/:bookId/:chapter(\\d+)', name: 'brp-chapter', component: () => import('../views/brp/BrpPage.vue') },
    { path: '/map', name: 'map', component: () => import('../views/map/MapPage.vue') },
    { path: '/apologetics', name: 'apologetics', component: () => import('../views/apologetics/ApologeticsPage.vue') },
    { path: '/library', name: 'library', component: () => import('../views/library/LibraryPage.vue') },
    { path: '/library/:bookId', name: 'library-book', component: () => import('../views/library/LibraryPage.vue') },
    { path: '/history', name: 'history', component: () => import('../views/church-history/ChurchHistoryPage.vue') },
    { path: '/history/:part(\\d+)/:chapter', name: 'history-doc', component: () => import('../views/church-history/ChurchHistoryPage.vue') },
    { path: '/sources', name: 'sources', component: () => import('../views/sources/SourcesPage.vue') },
    // 404 兜底：未知路径重定向首页（缺此路由时 router-view 渲染空白）
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/**
 * 路由切换后应用滚动容器复位到顶部：页面滚动收敛在 .app-main（overflow-y:auto，
 * window 已被锁定），vue-router 的 scrollBehavior 只管 window 滚动、对自定义
 * 滚动容器无效——否则从首页底部跳 /sources 等长页面时残留旧滚动位置，
 * 新页面从中间开始显示。
 */
router.afterEach(() => {
  document.querySelector('.app-main')?.scrollTo(0, 0)
})

export default router
