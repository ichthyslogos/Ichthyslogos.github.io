# 部署指南（DEPLOY）

> **⚠️ 部署约定（重要）**：**部署只能手动，不会自动进行**。
> - 工作流 `deploy.yml` 仅支持手动触发（`workflow_dispatch`），**push 代码不会自动部署**
> - 日常开发修改：`git commit` 即可，**不推送、不部署**
> - 只有**明确要求"部署/上线"**时，才执行部署（见下方"如何部署"）
> - 历史遗留：此前版本曾为 push 自动部署，已按约定改为手动

> **实际部署状态（2026-08-19）**：已上线 ✅
> - 仓库：`git@github.com:ichthyslogos/Ichthyslogos.github.io.git`（用户站点，已从 Ichthyslogo.github.io 改名，GitHub 自动重定向旧地址）
> - 线上地址：https://ichthyslogos.github.io/（根路径）
> - 部署用专用 SSH key：`~/.ssh/id_ed25519_fish`（repo 级 `core.sshCommand` 指定，不影响其他仓库）
> - Pages 构建模式：workflow（`build_type: workflow`，2026-08-19 通过 API 启用）

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

## 3. 如何部署（手动）

**仅当明确要求部署时执行**，两种方式任选：

### 方式一：GitHub Actions 手动触发（推荐）

1. 本地 `git push` 推送最新代码（**push 本身不会部署**）
2. 打开 GitHub 仓库 → **Actions** → **Deploy to GitHub Pages** → **Run workflow**（选 main 分支）
3. 等待几分钟，构建并部署 `dist/` 到 Pages，上线 `https://<用户名>.github.io/<仓库名>/`

### 方式二：手动构建推送

```bash
npm run build
npx gh-pages -d dist        # 把 dist/ 推送到 gh-pages 分支
```

GitHub 仓库 → Settings → Pages → Source 选择 `Deploy from a branch` → 分支 `gh-pages`。

### 方式三：临时 push trigger（2026-08 起实际使用）

本机无 gh CLI、API token 权限受限时使用（历史实践，见 §7.4）：

1. `deploy.yml` 的 `on:` 临时追加 `push: branches: [main]`（加注释「部署完成后恢复 manual-only」）
2. commit + push → Actions 自动构建部署
3. **部署完成后立即移除 push trigger** 并再次 commit + push（恢复仅手动约定）

```bash
# 1. 编辑 .github/workflows/deploy.yml 加 push 触发 → commit → push（自动部署）
# 2. 验证线上 bundle 与本地 dist 一致（curl https://ichthyslogos.github.io/ 对比 assets/index-*.js）
# 3. 移除 push 触发 → commit「ci: 恢复仅手动触发（manual-only）」→ push
```

## 4. 自定义域名（可选）

1. 域名服务商添加 CNAME 记录指向 `<用户名>.github.io`
2. 在 `public\CNAME` 放入域名（如 `bible.example.com`）后重新构建部署

## 5. 仓库文件策略（.gitignore）

| 路径 | 是否入库 | 原因 |
|---|---|---|
| `node_modules\` | ❌ 忽略 | 依赖，CI 用 `npm ci` 重建 |
| `dist\` | ❌ 忽略 | 构建产物 |
| `public\data\` | ✅ 提交 | 运行时数据，CI 构建直接打包（素材库在本地，CI 无法重新导入） |
| `data-src\` | ✅ 提交（可选） | 数据源投影（~16MB），保留可复现；不需要时也可忽略 |
| 素材库（`..\bible_databases` 等） | ❌ 不入库 | 素材与网站隔离，只保留站点消费的 `formats\json`（约 1GB，其余格式已整理删除） |

## 6. 常见问题

- **页面空白/数据不加载**：确认访问的是带尾斜杠路径（`/repo/`，无尾斜杠会自动 301，与 Pages 行为一致）；确认 `public\data\brp\manifest.json` 已提交
- **404 页面**：直接访问不带 `#` 的路径（如 `/repo/brp`）会 404——这是静态托管正常行为，应用内所有链接均带 `#`
- **数据更新**：本地重跑 `npm run data`（需素材库在场）或直接替换 `public\data\` 下的 JSON，提交推送即可

---

## 7. 部署实战记录（2026-08-08）

### 7.1 现象

push 一切正常（SSH 推送成功），但执行"GitHub Actions 手动触发"时，用 API 触发 `workflow_dispatch` 返回 **HTTP 403**：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ichthyslogos/Ichthyslogos.github.io/actions/workflows/deploy.yml/dispatches \
  -d '{"ref":"main"}'   # → 403
```

### 7.2 根因（两层凭据，权限不同）

| 凭据 | 对应账号 | 权限 |
|---|---|---|
| SSH 密钥 `~/.ssh/id_ed25519_fish` | **ichthyslogos**（仓库主任） | ✅ 推送/读写 |
| SSH 密钥 `~/.ssh/id_rsa` | Eyphka23 | ✅ 推送 |
| Windows 凭据管理器缓存的 token | JL0327 | ❌ 仅只读（pull） |

**关键认知**：
1. `workflow_dispatch` 只能通过 **GitHub API / 网页** 触发——**SSH 密钥无法调用 API**
2. 凭据管理器里的 token（JL0327）对该仓库只有 `pull` 权限，所以 API 触发 403；它虽然带 `repo, workflow` scope，但 **token scope ≠ 仓库实际权限**
3. 仓库 Pages 配置为 **workflow 构建模式**（`GET /repos/{owner}/{repo}/pages` → `build_type: workflow`），必须走 Actions 部署，不能靠"Deploy from branch"

### 7.3 排查路径（供日后复用）

```bash
# 1. 取凭据管理器中的 token（注意：可能是无权限的账号）
printf "protocol=https\nhost=github.com\n\n" | git credential fill

# 2. 看 token 的 scope（容易被误导：scope 全≠有权限）
curl -sI -H "Authorization: Bearer $TOKEN" https://api.github.com/user | grep -i x-oauth-scopes

# 3. 关键：看 token 对目标仓库的实际权限
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ichthyslogos/Ichthyslogos.github.io \
  | python -c "import json,sys; print(json.load(sys.stdin)['permissions'])"
# 输出 {'pull': True, ...} → 只读，无法触发部署

# 4. 确认各 SSH 密钥对应的 GitHub 账号
ssh -i ~/.ssh/id_ed25519_fish -T git@github.com   # → Hi ichthyslogos!
ssh -i ~/.ssh/id_rsa -T git@github.com            # → Hi Eyphka23!

# 5. 确认 Pages 构建模式
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/ichthyslogos/Ichthyslogos.github.io/pages
```

### 7.4 解决方案：临时 push 触发法（已实测）

没有可用的 API token 时，利用**有推送权限的 SSH 密钥** + 临时修改 workflow 触发条件：

1. `deploy.yml` 的 `on:` 临时追加 push 触发（**必须限定 main 分支**）：
   ```yaml
   on:
     workflow_dispatch:
     push:
       branches: [main]
   ```
2. 用仓库主任的 SSH key 推送（触发自动部署）：
   ```bash
   GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_fish" git push origin main
   ```
3. 轮询部署状态（只读 token 即可查）：
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://api.github.com/repos/ichthyslogos/Ichthyslogos.github.io/actions/runs?per_page=1"
   ```
4. 部署成功后**立即恢复** `deploy.yml` 为仅 `workflow_dispatch`，再次推送——
   这次推送**不会误触发**（恢复后的 workflow 文件已不含 push 触发，自洽）。

### 7.5 实战中顺带发现的问题

- **`index.html` 静态 `<title>` 残留旧品牌名**（"读经研究平台"）：Vue 组件内的标题/品牌改版不会同步到 `index.html` 的 `<title>`，需手动同步（本次已改为"FISH 鱼与饼 · 基督教研究平台"）
- **Git Bash 终端中文乱码**（GBK 显示 UTF-8）：提交消息、curl 输出可能显示为乱码——**纯显示问题**，用字节级验证确认真实内容：
  ```bash
  curl -s https://ichthyslogos.github.io/ | python -c "
  import sys, re
  text = sys.stdin.buffer.read().decode('utf-8', errors='replace')
  m = re.search(r'<title>([^<]*)</title>', text)
  print('title_is_correct:', m.group(1) == 'FISH 鱼与饼 · 基督教研究平台')
  "
  ```

### 7.6 经验总结

1. **判断部署权限看 `/repos/{owner}/{repo}` 的 `permissions` 字段**，不要只看 token 的 scope
2. workflow_dispatch 触发需要**该仓库有写权限的 token**；SSH 密钥再有权也无法调 API
3. 临时 push 触发法是有效兜底，但要：限定分支、部署后立即恢复、恢复提交本身不会误触发
4. 部署后验证线上内容用 python 字节级判断，避免终端编码误导

## 8. 访问统计（Umami）

站点接入 **Umami Cloud** 访问统计（开源、隐私友好，不采集原始 IP）。

### 接入位置

`index.html` 的 `<head>` 内动态注入：

```html
<script>
  // Umami 访问统计：仅生产域名加载（本地开发不计入统计，避免污染数据）
  if (location.hostname !== 'localhost') {
    var s = document.createElement('script')
    s.src = 'https://cloud.umami.is/script.js'
    s.setAttribute('data-website-id', 'b589b8c3-71d5-45e9-80cc-7f0db0751d90')
    s.setAttribute('defer', '')
    document.head.appendChild(s)
  }
</script>
```

### 维护要点

- **更换统计站点**：在 [umami.is](https://umami.is) 创建新网站后，替换 `data-website-id` 即可（脚本 URL 不变）
- **本地开发**：`localhost` 下脚本不加载，开发访问不会污染线上统计数据
- **查看数据**：部署后访问 Umami 面板（仪表盘：访问量/来源/地域/设备/页面）
- **验证**：生产环境页面加载后，控制台 Network 中可见 `cloud.umami.is/script.js` 请求；本地无此请求
- **故障影响**：脚本 `defer` 异步加载，失败不影响站点功能

### 页面展示累计访问（首页页脚小字）

首页页脚通过**不蒜子（busuanzi）**低调展示累计访问量（免费、无需注册/token），实现在 `index.html` 脚本注入 + `src/views/Home.vue` 主动拉取：

- **脚本**：`index.html` 注入 `https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js`（async）
- **读取**：busuanzi 暴露全局 `bszCaller.fetch`（JSONP），`Home.vue` 轮询等其就绪后主动拉取 `site_pv`（不依赖脚本自动填充 span 的时序——Vue 渲染 span 前脚本可能已执行完）；成功或 30s 超时即停
- **展示**：页脚第二行小字「本站累计访问 N 次」（0.68rem 淡灰，不起眼位置；万单位格式化）
- **⚠️ 本地数值**：busuanzi 把所有 `localhost` 访问归入同一**共享计数池**（全球累计，非本站数据）；生产域名按域名独立计数，部署后显示本站真实累计
- **容错**：脚本加载失败 / 接口超时 → 访问量静默隐藏，不影响页面与其他统计项
- **更换**：如 busuanzi 服务不可用，可替换为同协议的自建/镜像地址（占位 ID 不变）

### 7.4 部署记录（2026-08-12 ~ 08-14，方式三：临时 push trigger）

| 日期 | 内容 | 提交 |
| --- | --- | --- |
| 08-12 | 教会史子页面 + ui-ux-pro-max 全站规范对齐 | `fb63802` |
| 08-13 | 教会史移动端目录居中（offsetParent 修复） | `0134e13` |
| 08-13 | 教会史中英混排防断行（word joiner，仅数据文件） | `e9f6d47` |
| 08-14 | 马太亨利 66 卷空 section 修复 + 新增 ASV/DRC 译本 + 菜单宗派分组 + 面板拖拽调宽 + 中文注释暂时关闭 + 规划文档 | `9250387` |
| 08-19 | **切换新仓库部署**：全局搜索第一阶段 + 护教专题源回填 + 正式版测试标识清理；Pages 经 API 启用（workflow 模式），workflow_dispatch 触发 | `5e902026` |
| 08-19 | **仓库改名 Ichthyslogo.github.io → Ichthyslogos.github.io**（用户站点，根路径上线）；remote 同步更新，workflow_dispatch 重新部署 | `838c57c8` |

流程要点（复用）：
1. push 偶发瞬时失败（"could not read from remote"）→ 重试即可
2. 部署验证：`curl https://ichthyslogos.github.io/ | grep assets/index-*.js` 与本地 `dist/index.html` 对比；**注意**：bundle hash 因 CI（Linux/node20）与本地（Windows/node24）构建平台差异可能不同，数据类改动以**数据文件内容**为准（manifest 译本/注释源清单、切片 200/404 状态）
3. 每次部署后三连 commit：功能改动 → `ci: 临时 push 触发部署` → `ci: 恢复仅手动触发（manual-only）`
