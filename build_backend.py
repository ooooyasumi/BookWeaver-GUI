#!/usr/bin/env python3
"""
后端打包脚本 - 使用 PyInstaller 将 FastAPI 后端打包为单一可执行文件。

用法:
  python build_backend.py          # 打包当前平台
  python build_backend.py --clean  # 清理后重新打包
"""

import os
import sys
import shutil
import subprocess
import argparse

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
DIST_DIR = os.path.join(ROOT, "dist-backend")


def clean():
    """清理打包产物。"""
    paths = [
        os.path.join(BACKEND_DIR, "build"),
        os.path.join(BACKEND_DIR, "dist"),
        os.path.join(BACKEND_DIR, "*.spec"),
        DIST_DIR,
    ]
    for p in paths:
        if "*" in p:
            import glob
            for f in glob.glob(p):
                shutil.rmtree(f, ignore_errors=True)
        elif os.path.exists(p):
            shutil.rmtree(p, ignore_errors=True)
    print("已清理打包产物")


def build():
    """执行 PyInstaller 打包。"""
    os.chdir(BACKEND_DIR)

    # PyInstaller 参数
    # --onefile: 单一可执行文件
    # --name: 输出文件名
    # --hidden-import: 隐式导入的模块
    # --add-data: 添加数据文件（如果需要）
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "bookweaver-backend",
        # 隐式导入（PyInstaller 无法自动检测的模块）
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        # 入口文件
        "main.py",
    ]

    print(f"执行: {' '.join(cmd)}")
    subprocess.check_call(cmd)

    # 移动输出到项目根目录的 dist-backend
    os.chdir(ROOT)
    os.makedirs(DIST_DIR, exist_ok=True)

    src = os.path.join(BACKEND_DIR, "dist", "bookweaver-backend")
    if sys.platform == "win32":
        src += ".exe"
        dst = os.path.join(DIST_DIR, "bookweaver-backend.exe")
    else:
        dst = os.path.join(DIST_DIR, "bookweaver-backend")

    if os.path.exists(src):
        shutil.copy2(src, dst)
        os.chmod(dst, 0o755)
        print(f"打包完成: {dst}")
    else:
        print(f"错误: 找不到打包产物 {src}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="打包 BookWeaver 后端")
    parser.add_argument("--clean", action="store_true", help="清理后重新打包")
    args = parser.parse_args()

    if args.clean:
        clean()

    build()
