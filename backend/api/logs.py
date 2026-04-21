"""
AI 数据日志导出 API.
"""

import csv
import io
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.ai_logger import (
    get_log_info,
    get_chat_logs_dir,
    get_metadata_logs_dir,
)


router = APIRouter()


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """解析日期字符串，格式 YYYY-MM-DD."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None


def _date_range_files(logs_dir: Path, date_from: Optional[datetime], date_to: Optional[datetime]) -> List[Path]:
    """获取指定日期范围内的 CSV 文件列表."""
    if not logs_dir.exists():
        return []

    all_files = sorted(logs_dir.glob("*.csv"))
    result = []

    for f in all_files:
        date_part = f.stem.split("_")[0]
        try:
            file_date = datetime.strptime(date_part, "%Y-%m-%d")
        except ValueError:
            continue

        if date_from and file_date < date_from:
            continue
        if date_to and file_date > date_to:
            continue

        result.append(f)

    return result


def _build_csv_stream(files: List[Path]) -> io.StringIO:
    """将多个 CSV 文件合并为一个内存中的 CSV."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")

    first_file = True
    for file_path in files:
        with open(file_path, encoding="utf-8") as f:
            reader = csv.reader(f)
            rows = list(reader)

        if first_file:
            # 第一个文件：写入表头 + 全部数据行
            for row in rows:
                writer.writerow(row)
            first_file = False
        else:
            # 后续文件：跳过表头，只写数据行
            for row in rows[1:]:
                writer.writerow(row)

    output.seek(0)
    return output


@router.get("/info")
async def get_logs_info(
    workspacePath: str = Query(..., description="工作区路径"),
):
    """获取日志统计信息."""
    info = get_log_info(workspace_path=workspacePath)
    return info


@router.get("/export/chat")
async def export_chat_logs(
    workspacePath: str = Query(..., description="工作区路径"),
    date_from: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """
    导出 AI 对话日志为合并后的单个 CSV 文件。
    """
    logs_dir = get_chat_logs_dir(workspacePath)

    if not logs_dir.exists():
        raise HTTPException(status_code=404, detail="暂无对话日志")

    df = _parse_date(date_from)
    dt = _parse_date(date_to)

    files = _date_range_files(logs_dir, df, dt)
    if not files:
        raise HTTPException(status_code=404, detail="指定日期范围内无日志")

    csv_stream = _build_csv_stream(files)

    date_range = ""
    if df and dt:
        date_range = f"_from_{df.strftime('%Y-%m-%d')}_to_{dt.strftime('%Y-%m-%d')}"
    elif df:
        date_range = f"_from_{df.strftime('%Y-%m-%d')}"
    elif dt:
        date_range = f"_to_{dt.strftime('%Y-%m-%d')}"

    filename = f"bookweaver_chat_logs{date_range}.csv"

    return StreamingResponse(
        iter([csv_stream.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        }
    )


@router.get("/export/metadata")
async def export_metadata_logs(
    workspacePath: str = Query(..., description="工作区路径"),
    date_from: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """
    导出 AI 元数据更新日志为合并后的单个 CSV 文件。
    """
    logs_dir = get_metadata_logs_dir(workspacePath)

    if not logs_dir.exists():
        raise HTTPException(status_code=404, detail="暂无元数据日志")

    df = _parse_date(date_from)
    dt = _parse_date(date_to)

    files = _date_range_files(logs_dir, df, dt)
    if not files:
        raise HTTPException(status_code=404, detail="指定日期范围内无日志")

    csv_stream = _build_csv_stream(files)

    date_range = ""
    if df and dt:
        date_range = f"_from_{df.strftime('%Y-%m-%d')}_to_{dt.strftime('%Y-%m-%d')}"
    elif df:
        date_range = f"_from_{df.strftime('%Y-%m-%d')}"
    elif dt:
        date_range = f"_to_{dt.strftime('%Y-%m-%d')}"

    filename = f"bookweaver_metadata_logs{date_range}.csv"

    return StreamingResponse(
        iter([csv_stream.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename}"
        }
    )
