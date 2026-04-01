#!/usr/bin/env python3
"""
开发服务器管理脚本

用法:
  python dev.py      # 启动前后端，Ctrl+C 退出并同时关闭
"""

import os
import sys
import signal
import subprocess
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")

processes = []


def shutdown(signum=None, frame=None):
    print("\n正在关闭开发服务器...")
    for p in processes:
        try:
            if sys.platform == "win32":
                p.terminate()
            else:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
    sys.exit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("启动后端 (FastAPI :8765) ...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8765"],
        cwd=BACKEND_DIR,
        start_new_session=True,
    )
    processes.append(backend)

    time.sleep(1)

    print("启动前端 (Vite + Electron) ...")
    frontend = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=ROOT,
        start_new_session=True,
    )
    processes.append(frontend)

    print(f"已启动 — 后端 PID={backend.pid}, 前端 PID={frontend.pid}")
    print("按 Ctrl+C 退出并关闭所有服务")

    # 等待任一子进程退出，随即关闭全部
    while True:
        for p in processes:
            if p.poll() is not None:
                print(f"进程 {p.pid} 已意外退出，关闭所有服务...")
                shutdown()
        time.sleep(1)
