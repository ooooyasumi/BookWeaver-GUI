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
import socket

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")

processes = []


def is_port_in_use(port: int) -> bool:
    """检查端口是否被占用"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def kill_port_process(port: int):
    """杀掉占用指定端口的进程"""
    try:
        # macOS/Linux: 使用 lsof 找到占用端口的进程
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True,
            text=True
        )
        if result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            for pid in pids:
                try:
                    pid_int = int(pid)
                    print(f"正在杀掉占用端口 {port} 的进程 (PID={pid_int})...")
                    os.kill(pid_int, signal.SIGTERM)
                    time.sleep(0.5)
                except (ValueError, ProcessLookupError, PermissionError):
                    pass
    except Exception as e:
        print(f"尝试清理端口时出错: {e}")


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

    PORT = 8765

    # 检查端口是否被占用，若被占用则自动清理
    if is_port_in_use(PORT):
        print(f"端口 {PORT} 已被占用，正在清理...")
        kill_port_process(PORT)
        time.sleep(1)

    print(f"启动后端 (FastAPI :{PORT}) ...")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", str(PORT)],
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
