"""EPUB 下载器 - 支持网速回调."""

import os
import re
import time
from pathlib import Path
from typing import Optional, Callable

import requests

DOWNLOAD_TIMEOUT = 30
MAX_RETRIES = 3
RATE_LIMIT_DELAY = 0.5


def sanitize_filename(filename: str) -> str:
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    filename = filename.replace(' ', '_')
    if len(filename) > 100:
        filename = filename[:100]
    return filename


def download_epub(
    book_id: int,
    title: str,
    output_dir: str,
    speed_callback: Optional[Callable[[float], None]] = None,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> dict:
    """
    下载单本 EPUB.

    Args:
        book_id: 书籍 ID
        title: 书名
        output_dir: 输出目录
        speed_callback: 回调函数，传入当前网速 bytes/s
        cancel_check: 回调函数，返回 True 表示应取消下载

    Returns:
        {"success": bool, "file_path": str, "error": str}
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    safe_title = sanitize_filename(title)
    filename = f"pg{book_id}_{safe_title}.epub"
    file_path = output_path / filename

    if file_path.exists():
        return {"success": True, "file_path": str(file_path), "skipped": True}

    epub_url = f"https://www.gutenberg.org/ebooks/{book_id}.epub.noimages"

    for attempt in range(MAX_RETRIES):
        try:
            if cancel_check and cancel_check():
                return {"success": False, "error": "cancelled"}

            response = requests.get(epub_url, timeout=DOWNLOAD_TIMEOUT, stream=True)
            response.raise_for_status()

            chunk_size = 8192
            bytes_downloaded = 0
            window_bytes = 0
            window_start = time.monotonic()

            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    if cancel_check and cancel_check():
                        # 取消：删除不完整文件
                        f.close()
                        if file_path.exists():
                            file_path.unlink()
                        return {"success": False, "error": "cancelled"}

                    f.write(chunk)
                    n = len(chunk)
                    bytes_downloaded += n
                    window_bytes += n

                    now = time.monotonic()
                    elapsed = now - window_start
                    if elapsed >= 0.5 and speed_callback:
                        speed = window_bytes / elapsed  # bytes/s
                        speed_callback(speed)
                        window_bytes = 0
                        window_start = now

            time.sleep(RATE_LIMIT_DELAY)
            return {"success": True, "file_path": str(file_path)}

        except requests.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
                continue
            return {"success": False, "error": str(e)}

    return {"success": False, "error": "下载失败"}
