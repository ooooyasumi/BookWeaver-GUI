"""
AI 数据埋点与日志模块
负责 AI 对话找书和 AI 修改元数据两项功能的埋点 CSV 写入。
"""

import csv
import json
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any
from threading import Lock
import shutil


# ─────────────────────────────────────────────────────────────────────────────
# 目录与文件路径
# ─────────────────────────────────────────────────────────────────────────────

def get_logs_base_dir(workspace_path: str) -> Path:
    """获取工作区下的 logs/ai 目录路径."""
    return Path(workspace_path) / ".bookweaver" / "logs" / "ai"


def get_chat_logs_dir(workspace_path: str) -> Path:
    return get_logs_base_dir(workspace_path) / "chat"


def get_metadata_logs_dir(workspace_path: str) -> Path:
    return get_logs_base_dir(workspace_path) / "metadata"


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# ChatLogger — AI 对话找书埋点
# ─────────────────────────────────────────────────────────────────────────────

class ChatLogger:
    """
    负责 AI 对话找书的埋点写入。
    输出两个 CSV：
      - chat_sessions.csv  ：对话会话级别
      - chat_books.csv     ：书籍结果级别
    """

    SESSION_HEADERS = [
        "log_id", "session_id", "timestamp", "user_query", "query_language",
        "is_search_task", "plan_generated", "plan_keywords", "plan_target_count",
        "fallback_triggered", "fallback_count", "total_search_calls",
        "books_returned", "books_added", "llm_model",
        "plan_latency_ms", "reply_latency_ms", "total_duration_ms", "error"
    ]

    BOOK_HEADERS = [
        "log_id", "book_id", "rank", "title", "author", "language",
        "relevance_score", "source_keyword", "added_to_list", "match_score"
    ]

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.chat_dir = get_chat_logs_dir(workspace_path)
        self._ensure_dirs()
        self._session_lock = Lock()
        self._book_lock = Lock()

    def _ensure_dirs(self) -> None:
        _ensure_dir(self.chat_dir)

    def _session_path(self) -> Path:
        return self.chat_dir / f"{_today()}_chat_sessions.csv"

    def _books_path(self) -> Path:
        return self.chat_dir / f"{_today()}_chat_books.csv"

    def _write_session_header(self, f) -> None:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(self.SESSION_HEADERS)

    def _write_book_header(self, f) -> None:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(self.BOOK_HEADERS)

    def write_session(self, session: Dict[str, Any]) -> None:
        """写入一条会话记录."""
        path = self._session_path()
        is_new = not path.exists()

        with self._session_lock:
            with open(path, "a", newline="", encoding="utf-8") as f:
                if is_new:
                    self._write_session_header(f)
                writer = csv.writer(f, lineterminator="\n")
                row = []
                for h in self.SESSION_HEADERS:
                    v = session.get(h, "")
                    if isinstance(v, (list, dict)):
                        v = json.dumps(v, ensure_ascii=False)
                    row.append(v)
                writer.writerow(row)

    def write_books(self, books: List[Dict[str, Any]]) -> None:
        """批量写入书籍记录."""
        if not books:
            return

        path = self._books_path()
        is_new = not path.exists()

        with self._book_lock:
            with open(path, "a", newline="", encoding="utf-8") as f:
                if is_new:
                    self._write_book_header(f)
                writer = csv.writer(f, lineterminator="\n")
                for b in books:
                    row = []
                    for h in self.BOOK_HEADERS:
                        v = b.get(h, "")
                        if isinstance(v, (list, dict)):
                            v = json.dumps(v, ensure_ascii=False)
                        row.append(v)
                    writer.writerow(row)


# ─────────────────────────────────────────────────────────────────────────────
# MetadataLogger — AI 修改元数据埋点
# ─────────────────────────────────────────────────────────────────────────────

class MetadataLogger:
    """
    负责 AI 修改元数据的埋点写入。
    输出一个 CSV：
      - metadata_updates.csv
    """

    HEADERS = [
        "log_id", "task_id", "timestamp", "book_file_path", "book_title",
        "book_author_original", "book_language",
        "has_original_author", "has_original_description", "has_original_subjects",
        "prompt_type", "batch_size",
        "llm_description", "llm_subjects", "llm_year", "llm_author",
        "parse_success", "parse_error",
        "validation_passed", "validation_errors",
        "subjects_in_range", "subjects_count_valid", "year_valid",
        "write_success", "write_error",
        "update_status", "llm_latency_ms", "total_latency_ms", "llm_model"
    ]

    def __init__(self, workspace_path: str):
        self.workspace_path = workspace_path
        self.logs_dir = get_metadata_logs_dir(workspace_path)
        self._ensure_dirs()
        self._lock = Lock()

    def _ensure_dirs(self) -> None:
        _ensure_dir(self.logs_dir)

    def _log_path(self) -> Path:
        return self.logs_dir / f"{_today()}_metadata_updates.csv"

    def _write_header(self, f) -> None:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(self.HEADERS)

    def write_update(self, record: Dict[str, Any]) -> None:
        """写入一条元数据更新记录."""
        path = self._log_path()
        is_new = not path.exists()

        with self._lock:
            with open(path, "a", newline="", encoding="utf-8") as f:
                if is_new:
                    self._write_header(f)
                writer = csv.writer(f, lineterminator="\n")
                row = []
                for h in self.HEADERS:
                    v = record.get(h, "")
                    if isinstance(v, (list, dict)):
                        v = json.dumps(v, ensure_ascii=False)
                    row.append(v)
                writer.writerow(row)


# ─────────────────────────────────────────────────────────────────────────────
# 日志轮转与清理
# ─────────────────────────────────────────────────────────────────────────────

def rotate_and_cleanup_logs(workspace_path: str, retain_days: int = 30) -> None:
    """
    清理指定工作区 logs/ai 目录下超过 retain_days 的日志文件。
    每天调用一次即可（可在后端启动时检查）。
    """
    base = get_logs_base_dir(workspace_path)
    if not base.exists():
        return

    cutoff = datetime.now() - timedelta(days=retain_days)
    removed = 0

    for f in base.rglob("*.csv"):
        try:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            if mtime < cutoff:
                f.unlink()
                removed += 1
        except Exception:
            pass

    return removed


# ─────────────────────────────────────────────────────────────────────────────
# 导出辅助
# ─────────────────────────────────────────────────────────────────────────────

def get_log_info(workspace_path: str) -> Dict[str, Any]:
    """获取日志统计信息."""
    base = get_logs_base_dir(workspace_path)
    if not base.exists():
        return {
            "chat": _empty_info(),
            "metadata": _empty_info()
        }

    chat_info = _scan_dir(get_chat_logs_dir(workspace_path))
    meta_info = _scan_dir(get_metadata_logs_dir(workspace_path))

    return {
        "chat": chat_info,
        "metadata": meta_info
    }


def _empty_info() -> Dict[str, Any]:
    return {
        "total_records": 0,
        "date_from": None,
        "date_to": None,
        "files_count": 0,
        "total_size_mb": 0.0
    }


def _scan_dir(dir_path: Path) -> Dict[str, Any]:
    if not dir_path.exists():
        return _empty_info()

    csv_files = sorted(dir_path.glob("*.csv"))
    if not csv_files:
        return _empty_info()

    total_size = sum(f.stat().st_size for f in csv_files)
    # 从文件名提取日期范围
    dates = []
    for f in csv_files:
        name = f.name
        # 格式: 2026-04-21_chat_sessions.csv 或 2026-04-21_metadata_updates.csv
        date_part = name.split("_")[0]
        try:
            dates.append(datetime.strptime(date_part, "%Y-%m-%d"))
        except ValueError:
            pass

    return {
        "total_records": sum(_count_csv_lines(f) for f in csv_files),
        "date_from": min(dates).strftime("%Y-%m-%d") if dates else None,
        "date_to": max(dates).strftime("%Y-%m-%d") if dates else None,
        "files_count": len(csv_files),
        "total_size_mb": round(total_size / (1024 * 1024), 2)
    }


def _count_csv_lines(path: Path) -> int:
    try:
        with open(path, encoding="utf-8") as f:
            return sum(1 for _ in csv.reader(f)) - 1  # 减掉表头
    except Exception:
        return 0


def merge_csv_files(file_paths: List[Path], output_path: Path) -> None:
    """
    将多个 CSV 文件合并为一个（保留表头，只追加数据行）。
    file_paths 中的文件必须具有相同的表头结构。
    """
    if not file_paths:
        return

    # 读取第一个文件的表头
    with open(file_paths[0], encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)

    with open(output_path, "w", newline="", encoding="utf-8") as out_f:
        writer = csv.writer(out_f, lineterminator="\n")
        writer.writerow(headers)

        for path in file_paths:
            with open(path, encoding="utf-8") as f:
                reader = csv.reader(f)
                try:
                    next(reader)  # 跳过表头
                except StopIteration:
                    continue
                for row in reader:
                    writer.writerow(row)
