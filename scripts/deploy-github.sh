#!/usr/bin/env bash
# deploy-github.sh — 推送到 GitHub 并给出 Pages 配置指引（需先手动创建空仓库）
# 用法：
#   ./scripts/deploy-github.sh <仓库URL> [分支]
# 例：
#   ./scripts/deploy-github.sh git@github.com:Eyphka23/fish.git
set -e

REMOTE="${1:?用法: ./scripts/deploy-github.sh <仓库URL>}"
BRANCH="${2:-main}"
cd "$(dirname "$0")/.."

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
git push -u origin "$BRANCH"

echo ""
echo "✅ 已推送到 $REMOTE"
echo ""
echo "下一步（一次网页操作）："
echo "  1. 打开 https://github.com/ 仓库页 → Settings → Pages"
echo "  2. Source 选择 \"GitHub Actions\"（仓库已含 .github/workflows/deploy.yml，push 后自动构建部署）"
echo "  3. 或选择 \"Deploy from a branch\" → 分支 gh-pages（需先: git push origin main:gh-pages 或用 npx gh-pages -d dist）"
echo "  4. 上线地址: https://<用户名>.github.io/<仓库名>/"
