"""
元数据管理 API
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import asyncio
import json
import sys
import os

# 添加 core 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.metadata_updater import (
    get_metadata_status,
    update_metadata_for_files,
    set_cancel_flag,
    reset_cancel_flag
)

router = APIRouter()


class FileInfo(BaseModel):
    filePath: str
    title: Optional[str] = None
    author: Optional[str] = None


class UpdateRequest(BaseModel):
    workspacePath: str
    files: list[FileInfo]
    config: dict


@router.get("/status")
async def get_status(workspacePath: str):
    """获取元数据管理状态"""
    try:
        status = get_metadata_status(workspacePath)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update")
async def update_metadata(request: UpdateRequest):
    """
    更新元数据 (SSE 流)

    使用 asyncio.Queue 实现真正的流式推送，
    progress_callback 产生的事件立即通过 SSE 发送给前端。
    """
    queue: asyncio.Queue = asyncio.Queue()

    async def event_generator():
        # 准备文件列表
        files = []
        for f in request.files:
            files.append({
                "filePath": f.filePath,
                "title": f.title,
                "author": f.author
            })

        # 进度回调：直接把事件放入队列
        async def progress_callback(info):
            await queue.put(info)

        # 在后台任务中运行更新
        async def run_update():
            try:
                result = await update_metadata_for_files(
                    workspace_path=request.workspacePath,
                    files=files,
                    config=request.config,
                    progress_callback=progress_callback
                )
                # 将最终结果放入队列
                await queue.put({
                    'type': 'done',
                    'success': result['success'],
                    'failed': result['failed'],
                    'results': result['results']
                })
            except Exception as e:
                await queue.put({'type': 'error', 'message': str(e)})
            finally:
                # 放入哨兵值表示结束
                await queue.put(None)

        # 启动后台任务
        task = asyncio.create_task(run_update())

        try:
            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'total': len(files)})}\n\n"

            # 从队列中持续读取事件并推送
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            # 客户端断开连接时取消后台任务
            set_cancel_flag(True)
            task.cancel()
            raise

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/cancel")
async def cancel_update():
    """取消当前更新任务"""
    set_cancel_flag(True)
    return {"success": True, "message": "Cancel signal sent"}


@router.post("/reset-status")
async def reset_metadata_status(workspacePath: str, filePath: Optional[str] = None):
    """
    重置元数据状态

    Args:
        workspacePath: 工作区路径
        filePath: 可选，指定文件路径。如果不提供，重置所有文件
    """
    try:
        from core.metadata_updater import load_index, save_index

        index_data = load_index(workspacePath)

        for file_info in index_data.get("files", []):
            if filePath is None or file_info.get("filePath") == filePath:
                file_info["metadataUpdated"] = False
                file_info["metadataUpdatedAt"] = None
                file_info["metadataError"] = None

        save_index(workspacePath, index_data)

        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))