"""书籍相关 API."""

from fastapi import APIRouter, Query
from typing import Optional
import sys
import os

# 添加 core 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.catalog import get_catalog, search_books

router = APIRouter()


@router.get("/search")
async def search(
    title: Optional[str] = Query(None, description="书名或关键词"),
    author: Optional[str] = Query(None, description="作者"),
    language: str = Query("en", description="语言代码"),
    limit: int = Query(10, description="返回数量限制")
):
    """
    搜索书籍.

    根据书名和作者在 Gutenberg 目录中搜索匹配的书籍。
    如果没有提供 title，返回热门/经典书籍。
    """
    try:
        # 优先使用缓存
        catalog = get_catalog(cache_only=True)
        if not catalog:
            # 缓存为空，尝试联网获取
            catalog = get_catalog(cache_only=False)

        # 如果没有 title 和 author，返回热门书籍
        if not title and not author:
            from core.catalog import get_popular_books
            results = get_popular_books(catalog, limit=limit)
        else:
            results = search_books(
                catalog=catalog,
                title=title or "",
                author=author,
                language=language,
                limit=limit
            )
        return {"results": results}
    except Exception as e:
        return {"results": [], "error": str(e)}


@router.get("/catalog/status")
async def catalog_status():
    """获取目录缓存状态."""
    from core.catalog import get_cache_status
    status = get_cache_status()
    return status


@router.post("/catalog/refresh")
async def refresh_catalog():
    """刷新目录缓存."""
    from core.catalog import refresh_catalog_cache
    refresh_catalog_cache()
    return {"success": True}