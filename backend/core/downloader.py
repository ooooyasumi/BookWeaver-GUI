"""EPUB 下载器."""

import os
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests


# 下载配置
DOWNLOAD_TIMEOUT = 30
MAX_RETRIES = 3
RATE_LIMIT_DELAY = 1


def sanitize_filename(filename: str) -> str:
    """
    清理文件名中的非法字符.

    Args:
        filename: 原始文件名

    Returns:
        清理后的文件名
    """
    # 移除非法字符
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    # 替换空格为下划线
    filename = filename.replace(' ', '_')
    # 限制长度
    if len(filename) > 100:
        filename = filename[:100]
    return filename


def get_epub_url(book_id: int, formats: dict[str, str]) -> Optional[str]:
    """
    获取 EPUB 下载 URL.

    优先选择带图片的版本。

    Args:
        book_id: 书籍 ID
        formats: 格式字典

    Returns:
        EPUB URL 或 None
    """
    # 优先选择带图片的版本
    for mime in ["application/epub+zip (images)", "application/epub+zip (noimages)", "application/epub+zip"]:
        if mime in formats:
            return formats[mime]

    # 如果没有在格式中找到，使用默认 URL
    return f"https://www.gutenberg.org/ebooks/{book_id}.epub.noimages"


def download_epub(
    book_id: int,
    title: str,
    output_dir: str,
    dry_run: bool = False
) -> dict:
    """
    下载单本 EPUB.

    Args:
        book_id: 书籍 ID
        title: 书名
        output_dir: 输出目录
        dry_run: 是否仅预览

    Returns:
        {
            "success": bool,
            "file_path": str,
            "error": str
        }
    """
    # 创建输出目录
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 生成文件名
    safe_title = sanitize_filename(title)
    filename = f"pg{book_id}_{safe_title}.epub"
    file_path = output_path / filename

    # 如果文件已存在，跳过
    if file_path.exists():
        return {
            "success": True,
            "file_path": str(file_path),
            "skipped": True
        }

    if dry_run:
        return {
            "success": True,
            "file_path": str(file_path),
            "dry_run": True
        }

    # 获取下载 URL
    epub_url = f"https://www.gutenberg.org/ebooks/{book_id}.epub.noimages"

    # 下载
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(
                epub_url,
                timeout=DOWNLOAD_TIMEOUT,
                stream=True
            )
            response.raise_for_status()

            # 写入文件
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            # 限速
            time.sleep(RATE_LIMIT_DELAY)

            return {
                "success": True,
                "file_path": str(file_path)
            }

        except requests.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            return {
                "success": False,
                "error": str(e)
            }

    return {
        "success": False,
        "error": "下载失败"
    }


def batch_download(
    books: list[dict],
    output_dir: str,
    dry_run: bool = False,
    progress_callback=None
) -> dict:
    """
    批量下载书籍.

    Args:
        books: 书籍列表
        output_dir: 输出目录
        dry_run: 是否仅预览
        progress_callback: 进度回调函数 (current, total, result)

    Returns:
        {
            "total": int,
            "successful": int,
            "failed": int,
            "skipped": int,
            "results": list
        }
    """
    results = []
    successful = 0
    failed = 0
    skipped = 0

    for i, book in enumerate(books):
        book_id = book.get("id")
        title = book.get("title", "")

        result = download_epub(
            book_id=book_id,
            title=title,
            output_dir=output_dir,
            dry_run=dry_run
        )

        result["book_id"] = book_id
        result["title"] = title
        results.append(result)

        if result.get("success"):
            if result.get("skipped"):
                skipped += 1
            else:
                successful += 1
        else:
            failed += 1

        if progress_callback:
            progress_callback(i + 1, len(books), result)

    return {
        "total": len(books),
        "successful": successful,
        "failed": failed,
        "skipped": skipped,
        "results": results,
        "output_dir": output_dir
    }