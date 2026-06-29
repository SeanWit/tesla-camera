#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PNPM="/Users/sean/Library/pnpm/pnpm"

echo "=== 清理前端缓存 ==="
rm -rf node_modules/.cache .rsbuild dist

echo "=== 清理 Tauri 增量编译缓存（保留依赖缓存） ==="
cargo clean --manifest-path src-tauri/Cargo.toml -p app 2>/dev/null || true

echo "=== 安装依赖 ==="
"$PNPM" install

echo "=== 启动 Tauri 开发模式 ==="
exec "$PNPM" app:dev
