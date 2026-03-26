"""Gutenberg 目录处理."""

import csv
import os
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests

# Gutenberg 目录 URL
GUTENBERG_CATALOG_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv"

# 缓存目录
CACHE_DIR = Path.home() / ".cache" / "bookweaver"
CACHE_FILE = CACHE_DIR / "pg_catalog.csv"
CACHE_MAX_AGE = 24 * 60 * 60  # 24 小时

# 内存缓存
_catalog_cache: Optional[list] = None


def fetch_catalog(use_cache: bool = True) -> str:
    """
    下载 Gutenberg 目录 CSV.

    Args:
        use_cache: 是否使用缓存

    Returns:
        CSV 文本内容
    """
    # 检查缓存
    if use_cache and CACHE_FILE.exists():
        cache_age = time.time() - CACHE_FILE.stat().st_mtime
        if cache_age < CACHE_MAX_AGE:
            return CACHE_FILE.read_text(encoding="utf-8")

    # 下载目录
    response = requests.get(GUTENBERG_CATALOG_URL, timeout=60)
    response.raise_for_status()

    content = response.text

    # 保存缓存
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(content, encoding="utf-8")

    return content


def parse_catalog(csv_text: str) -> list[dict]:
    """
    解析 CSV 目录.

    Gutenberg CSV 格式:
    - Text#: 书籍 ID
    - Title: 书名
    - Authors: 作者
    - Language: 语言代码

    Args:
        csv_text: CSV 文本

    Returns:
        书籍列表
    """
    books = []
    reader = csv.DictReader(csv_text.splitlines())

    for row in reader:
        # Gutenberg 使用 Text# 作为 ID 字段
        book_id = row.get("Text#") or ""
        book_id = book_id.strip() if book_id else ""
        if not book_id:
            continue

        try:
            book_id_int = int(book_id)
        except ValueError:
            continue

        # 获取作者 - Gutenberg 使用 Authors 字段
        author = row.get("Authors") or ""
        author = author.strip() if author else ""
        if not author:
            continue

        # 获取书名
        title = row.get("Title") or ""
        title = title.strip() if title else ""
        if not title:
            continue

        # 获取语言
        language = row.get("Language") or "en"
        language = language.strip().lower() if language else "en"

        # 构建 EPUB URL (Gutenberg 的 EPUB URL 格式固定)
        epub_url_images = f"https://www.gutenberg.org/ebooks/{book_id_int}.epub.images"
        epub_url_noimages = f"https://www.gutenberg.org/ebooks/{book_id_int}.epub.noimages"

        formats = {
            "application/epub+zip (images)": epub_url_images,
            "application/epub+zip (noimages)": epub_url_noimages,
        }

        books.append({
            "id": book_id_int,
            "title": title,
            "author": author,
            "language": language,
            "formats": formats
        })

    return books


def get_catalog(cache_only: bool = False) -> list[dict]:
    """
    获取目录（带缓存）.

    Args:
        cache_only: 是否只使用缓存

    Returns:
        书籍列表
    """
    global _catalog_cache

    if _catalog_cache is not None:
        return _catalog_cache

    try:
        # 如果只使用缓存，直接读取缓存文件
        if cache_only:
            if CACHE_FILE.exists():
                csv_text = CACHE_FILE.read_text(encoding="utf-8")
                _catalog_cache = parse_catalog(csv_text)
                return _catalog_cache
            else:
                return []

        csv_text = fetch_catalog(use_cache=True)
        _catalog_cache = parse_catalog(csv_text)
        return _catalog_cache
    except Exception as e:
        print(f"获取目录失败: {e}")
        return []


def search_books(
    catalog: list[dict],
    title: Optional[str] = None,
    author: Optional[str] = None,
    language: str = "en",
    limit: int = 10
) -> list[dict]:
    """
    搜索书籍.

    Args:
        catalog: 目录列表
        title: 书名或关键词（可选，如果为空则返回热门书籍）
        author: 作者
        language: 语言代码
        limit: 返回数量限制

    Returns:
        匹配的书籍列表
    """
    from .matcher import match_title, match_author

    # 如果 title 和 author 都为空，返回热门书籍
    if not title and not author:
        return get_popular_books(catalog, limit=limit)

    # 如果是通用关键词，也返回热门书籍
    generic_keywords = ["classic", "popular", "best", "fiction", "novel", "recommended"]
    if title and title.lower() in generic_keywords:
        return get_popular_books(catalog, limit=limit)

    results = []

    for book in catalog:
        # 语言匹配
        if language and book.get("language") != language:
            continue

        # 书名匹配
        title_score = 0
        if title:
            matched, title_score = match_title(title, book.get("title", ""))
            if not matched:
                continue

        # 作者匹配
        author_score = 0
        if author:
            matched, author_score = match_author(author, book.get("author", ""))
            if not matched:
                continue

        # 计算综合评分
        if title or author:
            if title and author:
                score = title_score * 0.4 + author_score * 0.6
            elif title:
                score = title_score
            else:
                score = author_score
        else:
            score = 0

        results.append({
            "id": book["id"],
            "title": book["title"],
            "author": book["author"],
            "language": book["language"],
            "matchScore": round(score, 1),
            "formats": book.get("formats", {})
        })

    # 按匹配度排序
    results.sort(key=lambda x: x["matchScore"], reverse=True)

    return results[:limit]


def get_cache_status() -> dict:
    """获取缓存状态."""
    if CACHE_FILE.exists():
        cache_age = time.time() - CACHE_FILE.stat().st_mtime
        return {
            "cached": True,
            "lastUpdate": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(CACHE_FILE.stat().st_mtime)),
            "totalBooks": len(get_catalog(cache_only=True))
        }
    return {
        "cached": False,
        "lastUpdate": None,
        "totalBooks": 0
    }


def get_popular_books(catalog: list[dict], limit: int = 10) -> list[dict]:
    """
    获取热门/经典书籍.

    返回 Gutenberg 目录中的经典文学作品。
    这些书籍通常是公共领域中最受欢迎的作品。

    Args:
        catalog: 目录列表
        limit: 返回数量限制

    Returns:
        热门书籍列表
    """
    # 经典作者列表（公共领域中最受欢迎的作者）
    classic_authors = [
        "shakespeare", "austen", "dickens", "twain", "doyle",
        "tolstoy", "dostoevsky", "bronte", "wilde", "orwell",
        "kafka", "hugo", "verne", "wells", "stevenson"
    ]

    # 经典书名关键词
    classic_keywords = [
        "pride", "prejudice", "great", "expectations", "adventure",
        "sherlock", "holmes", "alice", "wonderland", "wizard", "oz",
        "frankenstein", "dracula", "jekyll", "hyde", "time", "machine",
        "war", "peace", "crime", "punishment", "brothers", "karamazov"
    ]

    results = []

    for book in catalog:
        score = 0
        title_lower = book.get("title", "").lower()
        author_lower = book.get("author", "").lower()

        # 检查是否是经典作者
        for author in classic_authors:
            if author in author_lower:
                score += 10
                break

        # 检查是否是经典书名
        for keyword in classic_keywords:
            if keyword in title_lower:
                score += 5
                break

        # 英语经典文学作品优先
        if book.get("language") == "en" and score > 0:
            score += 2

        if score > 0:
            results.append({
                "id": book["id"],
                "title": book["title"],
                "author": book["author"],
                "language": book["language"],
                "matchScore": score,
                "formats": book.get("formats", {})
            })

    # 按评分排序
    results.sort(key=lambda x: x["matchScore"], reverse=True)

    return results[:limit]


def refresh_catalog_cache() -> None:
    """刷新缓存."""
    global _catalog_cache
    _catalog_cache = None
    fetch_catalog(use_cache=False)