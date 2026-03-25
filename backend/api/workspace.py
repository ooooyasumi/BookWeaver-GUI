"""工作区 API."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()


class PendingBook(BaseModel):
    """待下载书籍."""
    id: int
    title: str
    author: str
    language: str = "en"
    selected: bool = True


class DownloadResult(BaseModel):
    """下载结果."""
    bookId: int
    title: str
    success: bool
    filePath: Optional[str] = None
    error: Optional[str] = None


class Batch(BaseModel):
    """下载批次."""
    id: int
    name: str
    createdAt: str
    status: str
    total: int
    success: int
    failed: int
    results: List[DownloadResult] = []


class WorkspaceData(BaseModel):
    """工作区数据."""
    version: str = "1.0"
    createdAt: str
    updatedAt: str
    pendingDownloads: List[PendingBook] = []
    currentBatch: Optional[int] = None
    batches: List[Batch] = []


class WorkspaceStatus(BaseModel):
    """工作区状态."""
    isOpen: bool
    path: Optional[str] = None
    data: Optional[WorkspaceData] = None


# 临时存储 (实际应该存储在文件系统)
_current_workspace: dict = {}


@router.post("/open")
async def open_workspace(path: str):
    """
    打开工作区.

    初始化或加载工作区数据。
    """
    global _current_workspace

    # TODO: 实际从文件系统读取
    now = datetime.now().isoformat()

    _current_workspace = {
        "path": path,
        "data": WorkspaceData(
            createdAt=now,
            updatedAt=now
        ).model_dump()
    }

    return _current_workspace["data"]


@router.get("/status", response_model=WorkspaceStatus)
async def get_status():
    """获取工作区状态."""
    if not _current_workspace:
        return WorkspaceStatus(isOpen=False)

    return WorkspaceStatus(
        isOpen=True,
        path=_current_workspace.get("path"),
        data=WorkspaceData(**_current_workspace.get("data", {}))
    )


@router.post("/save")
async def save_workspace(data: WorkspaceData):
    """保存工作区数据."""
    global _current_workspace

    if not _current_workspace:
        return {"success": False, "error": "没有打开的工作区"}

    data.updatedAt = datetime.now().isoformat()
    _current_workspace["data"] = data.model_dump()

    # TODO: 实际保存到文件系统

    return {"success": True}