# 部署指南（DEPLOY）

FISH 是纯前端静态站（无后端），**可直接部署到 GitHub Pages**。已实测验证（模拟 `user.github.io/repo/` 子路径场景：资源、数据、路由全部正常）。

## 1. 部署前提（已验证的有利条件）

| 条件 | 现状 | 说明 |
|---|---|---|
| 无后端依赖 | ✅ 纯静态 | 数据以静态 JSON 提供，无需服务器 |
| 路由 | ✅ hash 模式（`#/brp/...`） | 任意路径都能加载 index.html，无需 SPA 重写规则 |
| 资源路径 | ✅ `base: './'` 相对路径 | 支持部署在子路径（`user.github.io/repo/`） |
| 数据加载 | ✅ 相对路径 fetch | 子路径下自动解析到正确位置 |
| 数据体积 | ✅ ~8.6MB | 远低于 GitHub 仓库限额 |

## 2. 本地验证（部署前）

```bash
npm run data    # 数据流水线（素材投影 → 切片，可选，public/data 已在仓库时跳过）
npm run build   # 生产构建 → dist/
npm run preview # 根路径验证 http://localhost:4173
```

模拟子路径（GitHub Pages 同款行为，含无尾斜杠 301）：

```bash
MSYS_NO_PATHCONV=1 FISH_BASE=/repo node scripts/serve-dist.mjs 8088
# 浏览器打开 http://localhost:8088/repo/#/brp/01/1
```

## 3. 方式一：GitHub Actions 自动部署（推荐）

仓库已提供 `.github/workflows/deploy.yml`：push 到 `main` 分支即自动构建并部署 `dist/` 到 Pages。

操作步骤：
1. 把 `site\` 内容推送为一个 GitHub 仓库（可在 `site\` 内 `git init`）
2. 确认 `public\data\` 已提交（构建数据，仓库内约 8.6MB；**不要忽略它**，CI 无法访问本地素材库）
3. GitHub 仓库 → **Settings → Pages → Source 选择 `GitHub Actions`**
4. 推送 `main` 分支，Actions 自动运行，几分钟后网站上线：`https://<用户名>.github.io/<仓库名>/`

## 4. 方式二：手动部署

```bash
npm run build
npx gh-pages -d dist        # 把 dist/ 推送到 gh-pages 分支
```

GitHub 仓库 → Settings → Pages → Source 选择 `Deploy from a branch` → 分支 `gh-pages`。

## 5. 自定义域名（可选）

1. 域名服务商添加 CNAME 记录指向 `<用户名>.github.io`
2. 在 `public\CNAME` 放入域名（如 `bible.example.com`）后重新构建部署

## 6. 仓库文件策略（.gitignore）

| 路径 | 是否入库 | 原因 |
|---|---|---|
| `node_modules\` | ❌ 忽略 | 依赖，CI 用 `npm ci` 重建 |
| `dist\` | ❌ 忽略 | 构建产物 |
| `public\data\` | ✅ 提交 | 运行时数据，CI 构建直接打包（素材库在本地，CI 无法重新导入） |
| `data-src\` | ✅ 提交（可选） | 数据源投影（~16MB），保留可复现；不需要时也可忽略 |
| 素材库（`..\bible_databases` 等） | ❌ 不入库 | 素材与网站隔离，体积 18GB+ |

## 7. 常见问题

- **页面空白/数据不加载**：确认访问的是带尾斜杠路径（`/repo/`，无尾斜杠会自动 301，与 Pages 行为一致）；确认 `public\data\brp\manifest.json` 已提交
- **404 页面**：直接访问不带 `#` 的路径（如 `/repo/brp`）会 404——这是静态托管正常行为，应用内所有链接均带 `#`
- **数据更新**：本地重跑 `npm run data`（需素材库在场）或直接替换 `public\data\` 下的 JSON，提交推送即可
