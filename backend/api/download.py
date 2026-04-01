"""下载相关 API - 支持暂停、继续、网速上报."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from core.downloader import download_epub

router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=10)

# 全局取消标志表：download_id -> threading.Event
# Event 被 set 表示"请停止"
_cancel_events: dict[str, threading.Event] = {}


class BookItem(BaseModel):
    id: int
    title: str
    author: str
    language: str = "en"


class DownloadRequest(BaseModel):
    books: List[BookItem]
    outputDir: str
    concurrent: int = 3
    downloadId: str          # 唯一标识本次下载任务，用于暂停/继续


@router.post("/start")
async def start_download(request: DownloadRequest):
    """
    开始（或继续）下载书籍 (SSE).

    SSE 事件类型：
      book_start    {"type": "book_start", "bookId": int}
      book_complete {"type": "book_complete", "bookId": int, "result": {...}}
      progress      {"type": "progress", "completed": int, "total": int, "percent": int}
      speed         {"type": "speed", "bytesPerSec": float}
      paused        {"type": "paused"}
      complete      {"type": "complete", "success": int, "failed": int, "results": [...]}
    """
    concurrent = max(1, min(request.concurrent, 10))
    total = len(request.books)
    download_id = request.downloadId

    # 创建/重置取消标志
    cancel_event = threading.Event()
    _cancel_events[download_id] = cancel_event

    async def generate():
        loop = asyncio.get_event_loop()
        semaphore = asyncio.Semaphore(concurrent)
        queue: asyncio.Queue = asyncio.Queue()

        # 网速聚合：多本书并发，把各自的速度加总，定时推给前端
        speed_lock = threading.Lock()
        accumulated_speed: list[float] = [0.0]  # 用列表方便闭包修改

        def add_speed(s: float):
            with speed_lock:
                accumulated_speed[0] += s

        async def speed_reporter():
            """每秒推一次聚合网速."""
            while True:
                await asyncio.sleep(1.0)
                with speed_lock:
                    spd = accumulated_speed[0]
                    accumulated_speed[0] = 0.0
                await queue.put({"type": "speed", "bytesPerSec": spd})

        speed_task = asyncio.create_task(speed_reporter())

        async def download_one(book: BookItem):
            async with semaphore:
                await queue.put({"type": "book_start", "bookId": book.id})

                def run():
                    return download_epub(
                        book_id=book.id,
                        title=book.title,
                        output_dir=request.outputDir,
                        speed_callback=add_speed,
                        cancel_check=lambda: cancel_event.is_set(),
                    )

                result = await loop.run_in_executor(_executor, run)

                book_result = {
                    "bookId": book.id,
                    "title": book.title,
                    "success": result["success"],
                    "filePath": result.get("file_path", ""),
                    "error": result.get("error", ""),
                    "cancelled": result.get("error") == "cancelled",
                }
                await queue.put({"type": "book_complete", "bookId": book.id, "result": book_result})

        tasks = [asyncio.create_task(download_one(book)) for book in request.books]

        success_count = 0
        failed_count = 0
        all_results = []
        completed = 0

        while completed < total:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=120.0)
            except asyncio.TimeoutError:
                break

            if event["type"] == "book_start":
                yield f"data: {json.dumps(event)}\n\n"

            elif event["type"] == "book_complete":
                result = event["result"]
                all_results.append(result)
                if result["success"]:
                    success_count += 1
                else:
                    failed_count += 1
                completed += 1

                yield f"data: {json.dumps({'type': 'book_complete', 'bookId': event['bookId'], 'result': result})}\n\n"
                yield f"data: {json.dumps({'type': 'progress', 'completed': completed, 'total': total, 'percent': int(completed / total * 100)})}\n\n"

            elif event["type"] == "speed":
                yield f"data: {json.dumps(event)}\n\n"

        speed_task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

        # 检查是否是因为暂停而结束
        if cancel_event.is_set():
            yield f"data: {json.dumps({'type': 'paused', 'completed': completed, 'total': total, 'results': all_results})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'complete', 'success': success_count, 'failed': failed_count, 'results': all_results})}\n\n"

        # 清理
        _cancel_events.pop(download_id, None)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/pause/{download_id}")
async def pause_download(download_id: str):
    """设置取消标志，正在传输的书下载完后停止新书。"""
    event = _cancel_events.get(download_id)
    if event:
        event.set()
        return {"success": True}
    return {"success": False, "error": "找不到该下载任务"}


@router.get("/status")
async def download_status():
    return {"activeDownloads": list(_cancel_events.keys())}
