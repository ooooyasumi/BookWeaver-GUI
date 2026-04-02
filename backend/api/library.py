"""图书管理 API."""

from fastapi import APIRouter, Query
import os
import sys

# 添加 core 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.epub_meta import (
    get_indexed_files,
    build_file_tree,
    categorize_by_subject,
    categorize_by_year,
    extract_epub_detail,
    build_index,
)

router = APIRouter()


@router.get("/files")
async def get_library_files(
    workspacePath: str = Query(..., description="工作区目录路径")
):
    """获取工作区目录下的所有 EPUB 文件（使用索引）."""
    try:
        epub_files = get_indexed_files(workspacePath)
        file_tree = build_file_tree(epub_files)

        return {
            "files": epub_files,
            "tree": file_tree,
            "total": len(epub_files),
        }
    except Exception as e:
        return {"error": str(e), "files": [], "tree": {}, "total": 0}


@router.get("/filter/subject")
async def filter_by_subject(
    workspacePath: str = Query(..., description="工作区目录路径")
):
    """按分类筛选书籍."""
    try:
        epub_files = get_indexed_files(workspacePath)
        categories = categorize_by_subject(epub_files)

        return {
            "categories": [
                {"name": name, "count": len(books), "books": books}
                for name, books in categories.items()
            ],
            "total": len(epub_files),
        }
    except Exception as e:
        return {"error": str(e), "categories": [], "total": 0}


@router.get("/filter/year")
async def filter_by_year(
    workspacePath: str = Query(..., description="工作区目录路径")
):
    """按出版年份筛选书籍（50年分段）."""
    try:
        epub_files = get_indexed_files(workspacePath)
        categories = categorize_by_year(epub_files)

        return {
            "categories": [
                {"name": name, "count": len(books), "books": books}
                for name, books in categories.items()
            ],
            "total": len(epub_files),
        }
    except Exception as e:
        return {"error": str(e), "categories": [], "total": 0}


@router.get("/detail")
async def get_book_detail(
    filePath: str = Query(..., description="EPUB 文件路径")
):
    """获取单个书籍的详细元数据（含封面 base64 和简介）."""
    try:
        detail = extract_epub_detail(filePath)
        return detail
    except Exception as e:
        return {"error": str(e)}


@router.post("/reindex")
async def reindex_library(
    workspacePath: str = Query(..., description="工作区目录路径")
):
    """强制重建索引."""
    try:
        index = build_index(workspacePath)
        total = len(index.get("files", {}))
        return {"success": True, "total": total}
    except Exception as e:
        return {"success": False, "error": str(e)}
