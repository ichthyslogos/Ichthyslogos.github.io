import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * 地图瓦片 404 中间件（dev + preview 共用）：
 * 瓦片构建只产出非空瓦片，缺失瓦片被 SPA fallback 返回 200+HTML，
 * maplibre 会尝试把 HTML 当 PBF 解析并报错。这里对缺失的 .pbf
 * 直接返回 404——maplibre 将 404 视为空瓦片，静默跳过。
 * （生产静态托管缺失文件天然 404，无需此中间件。）
 */
const GEO_TILE_RE = /^\/data\/geography\/tiles\/.*\.pbf$/
function geoTile404() {
  const handler = (root, req, res, next) => {
    const url = decodeURIComponent((req.url || '').split('?')[0])
    if (!GEO_TILE_RE.test(url)) return next()
    // dev 服务 <root>/public，preview 服务 <root>/dist（public 已复制进 dist）
    const exists = [join(root, 'public', url), join(root, 'dist', url)].some(existsSync)
    if (exists) return next()
    res.statusCode = 404
    res.end()
  }
  return {
    name: 'geo-tile-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => handler(server.config.root, req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => handler(server.config.root, req, res, next))
    },
  }
}

export default defineConfig({
  plugins: [vue(), geoTile404()],
  base: './',
  // maplibre-gl v5：不排除 dep 优化——排除后 dev 直接以原始 UMD（9MB，无 CJS 互操作）
  // 导入 node_modules 文件，浏览器端 import default 失败、地图页空白（生产构建经
  // rollup 转换无此问题）。v5 经 vite 预构建 + 自带 worker 均正常。
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
})
