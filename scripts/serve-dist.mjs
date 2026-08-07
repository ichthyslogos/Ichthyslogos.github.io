// scripts/serve-dist.mjs — 本地模拟静态托管（含子路径场景），验证构建产物可部署
// 用法：FISH_BASE=/repo node scripts/serve-dist.mjs [端口]
// 例：FISH_BASE=/repo node scripts/serve-dist.mjs 8088  → 模拟 https://user.github.io/repo/
// 注：用环境变量传子路径，避免 Git Bash 对 /xxx 参数的 MSYS 路径转换
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist')
// 用法：MSYS_NO_PATHCONV=1 FISH_BASE=/repo node scripts/serve-dist.mjs [端口]（Git Bash 需禁路径转换）
const basePath = ('/' + (process.env.FISH_BASE || 'repo').replace(/^.*\//, '').replace(/^\/|\/$/g, ''))
const port = Number(process.argv[2] || 8088)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
}

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  // 无尾斜杠 → 301（GitHub Pages 同款行为）
  if (urlPath === basePath) {
    res.writeHead(301, { Location: basePath + '/' })
    res.end()
    return
  }
  // 去掉子路径前缀后映射到 dist/（rel 为无前导斜杠的相对路径，兼容 win32 join）
  const rel = (urlPath.startsWith(basePath) ? urlPath.slice(basePath.length) : urlPath).replace(/^[/\\]+/, '')
  let fp = join(DIST, rel)
  if (!existsSync(fp)) { res.writeHead(404).end('404'); return }
  if (statSync(fp).isDirectory()) fp = join(fp, 'index.html')
  res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' })
  res.end(readFileSync(fp))
}).listen(port, () => {
  console.log(`[serve-dist] 模拟静态托管: http://localhost:${port}${basePath}/`)
})
