#!/bin/bash
# 本地模拟 CI/CD 打包流程
# 确保与 GitHub Actions 完全一致

set -e  # 遇到错误立即退出

echo "========================================"
echo "本地 CI/CD 模拟打包流程"
echo "========================================"

# 检查 Python 版本
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python 版本: $PYTHON_VERSION"

# 检查 Node.js 版本
NODE_VERSION=$(node --version 2>&1)
echo "Node.js 版本: $NODE_VERSION"

echo ""
echo "=== 步骤 1: 清理旧的构建产物 ==="
rm -rf dist/ dist-electron/ dist-backend/ release/ backend/build/ backend/dist/

echo ""
echo "=== 步骤 2: 安装前端依赖 (npm ci) ==="
npm ci

echo ""
echo "=== 步骤 3: 安装后端依赖 ==="
python3 -m pip install --upgrade pip
pip install -r backend/requirements.txt

echo ""
echo "=== 步骤 4: 构建后端 (PyInstaller) ==="
npm run build:backend

echo ""
echo "=== 步骤 5: 验证后端构建 ==="
echo "--- dist-backend 目录内容 ---"
ls -la dist-backend/ || (echo "ERROR: dist-backend 目录不存在!" && exit 1)
echo "--- 后端文件信息 ---"
file dist-backend/bookweaver-backend || (echo "ERROR: 后端文件不存在!" && exit 1)
echo "--- 后端文件大小 ---"
du -h dist-backend/bookweaver-backend

echo ""
echo "=== 步骤 6: 构建前端 ==="
npm run build:frontend

echo ""
echo "=== 步骤 7: 打包 Electron 应用 ==="
npm run package:mac -- --publish never

echo ""
echo "=== 步骤 8: 验证最终打包结果 ==="
echo "--- release 目录内容 ---"
ls -la release/ || (echo "ERROR: release 目录不存在!" && exit 1)
echo "--- DMG 文件大小 ---"
du -h release/*.dmg
echo "--- App 包结构 ---"
ls -la release/mac-arm64/BookWeaver.app/Contents/ || (echo "ERROR: App 包结构无效!" && exit 1)
echo "--- 检查后端是否打包进 App ---"
ls -la release/mac-arm64/BookWeaver.app/Contents/resources/backend/ || (echo "ERROR: 后端未打包进 App!" && exit 1)
echo "--- App 中后端文件信息 ---"
file release/mac-arm64/BookWeaver.app/Contents/resources/backend/bookweaver-backend || (echo "ERROR: App 中后端文件不存在!" && exit 1)
du -h release/mac-arm64/BookWeaver.app/Contents/resources/backend/bookweaver-backend

echo ""
echo "========================================"
echo "打包完成!"
echo "========================================"
echo "DMG 文件: release/BookWeaver-0.2.1-arm64.dmg"
echo "App 文件: release/mac-arm64/BookWeaver.app"