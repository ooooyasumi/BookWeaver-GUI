"""FastAPI 后端入口."""

import sys
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import books, download, chat, config, workspace

app = FastAPI(
    title="BookWeaver API",
    description="Project Gutenberg 书籍下载工具后端 API",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(workspace.router, prefix="/api/workspace", tags=["工作区"])
app.include_router(books.router, prefix="/api/books", tags=["书籍"])
app.include_router(download.router, prefix="/api/download", tags=["下载"])
app.include_router(chat.router, prefix="/api/chat", tags=["对话"])
app.include_router(config.router, prefix="/api/config", tags=["配置"])


@app.get("/api/health")
async def health_check():
    """健康检查."""
    return {"status": "ok"}