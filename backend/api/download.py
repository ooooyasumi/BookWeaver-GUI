"""下载相关 API."""

import sys
from pathlib import Path

# 添加当前目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio

from core.downloader import download_epub

router = APIRouter()


class BookItem(BaseModel):
    """书籍项."""
    id: int
    title: str
    author: str
    language: str = "en"


class DownloadRequest(BaseModel):
    """下载请求."""
    books: List[BookItem]
    outputDir: str


@router.post("/start")
async def start_download(request: DownloadRequest):
    """
    开始下载书籍 (SSE).

    返回 Server-Sent Events 流，包含下载进度和结果。
    """
    async def generate():
        results = []
        success_count = 0
        failed_count = 0

        for i, book in enumerate(request.books):
            # 发送进度事件
            progress_event = {
                "type": "progress",
                "bookId": book.id,
                "progress": int((i / len(request.books)) * 100)
            }
            yield f"data: {json.dumps(progress_event)}\n\n"

            try:
                # 执行下载
                result = download_epub(
                    book_id=book.id,
                    title=book.title,
                    output_dir=request.outputDir
                )

                if result["success"]:
                    success_count += 1
                    results.append({
                        "bookId": book.id,
                        "title": book.title,
                        "success": True,
                        "filePath": result["file_path"]
                    })
                else:
                    failed_count += 1
                    results.append({
                        "bookId": book.id,
                        "title": book.title,
                        "success": False,
                        "error": result.get("error", "下载失败")
                    })

            except Exception as e:
                failed_count += 1
                results.append({
                    "bookId": book.id,
                    "title": book.title,
                    "success": False,
                    "error": str(e)
                })

            # 模拟下载延迟
            await asyncio.sleep(0.5)

            # 发送完成进度
            complete_event = {
                "type": "progress",
                "bookId": book.id,
                "progress": int(((i + 1) / len(request.books)) * 100)
            }
            yield f"data: {json.dumps(complete_event)}\n\n"

        # 发送完成事件
        complete_event = {
            "type": "complete",
            "success": success_count,
            "failed": failed_count,
            "results": results
        }
        yield f"data: {json.dumps(complete_event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


@router.get("/status")
async def download_status():
    """获取当前下载状态."""
    # TODO: 实现下载状态跟踪
    return {
        "isDownloading": False,
        "currentBatch": None,
        "progress": 0
    }


@router.get("/batches")
async def list_batches():
    """获取已完成批次列表."""
    # TODO: 从工作区数据读取
    return {"batches": []}


@router.get("/batch/{batch_id}")
async def get_batch(batch_id: int):
    """获取批次详情."""
    # TODO: 从工作区数据读取
    return {"batch": None}