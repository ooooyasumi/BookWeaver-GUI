"""
元数据更新器 - 使用 LLM 更新书籍元数据
"""

import os
import json
import asyncio
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime

from ebooklib import epub

from .llm_harness import call_llm_batch, validate_metadata, VALID_CATEGORY_IDS
from .epub_meta import INDEX_FILE, load_index, save_index
from .ai_logger import MetadataLogger

# 批量处理的最大书籍数量（可运行时调整）
BATCH_SIZE = 5
# 并发控制（可运行时调整）
MAX_CONCURRENT_BATCHES = 2

# 取消标志
_cancel_flag = False


def set_batch_size(size: int):
    """设置每批处理的书籍数量 (5-15)"""
    global BATCH_SIZE
    BATCH_SIZE = max(5, min(15, size))


def set_max_concurrent_batches(size: int):
    """设置最大并发批次数 (1-5)"""
    global MAX_CONCURRENT_BATCHES
    MAX_CONCURRENT_BATCHES = max(1, min(5, size))


def set_cancel_flag(value: bool = True):
    """设置取消标志"""
    global _cancel_flag
    _cancel_flag = value


def is_cancelled() -> bool:
    """检查是否被取消"""
    return _cancel_flag


def reset_cancel_flag():
    """重置取消标志"""
    global _cancel_flag
    _cancel_flag = False


def update_epub_metadata(file_path: str, metadata: dict) -> tuple:
    """
    更新 EPUB 文件的元数据

    Args:
        file_path: EPUB 文件路径
        metadata: 元数据字典，包含 description, categories, publishYear

    Returns:
        (success, error_message)
    """
    try:
        # 读取 EPUB
        book = epub.read_epub(file_path, {'ignore_ncx': True})

        # 清除已有的元数据（防止累加）
        # ebooklib 的 DC 命名空间 key 是完整的 URI
        dc_ns = 'http://purl.org/dc/elements/1.1/'
        if dc_ns in book.metadata:
            for field in ('description', 'subject', 'date', 'creator'):
                if field in book.metadata[dc_ns]:
                    book.metadata[dc_ns][field] = []

        # 添加新的元数据
        # 更新简介 (DC:description)
        book.add_metadata('DC', 'description', metadata['description'])

        # 更新分类 (DC:subject) - 去重并限制最多3个
        unique_categories = list(dict.fromkeys(metadata['categories']))[:3]
        for category in unique_categories:
            book.add_metadata('DC', 'subject', category)

        # 更新出版年份 (DC:date) - 只写年份
        book.add_metadata('DC', 'date', str(metadata['publishYear']))

        # 更新作者 (DC:creator)
        if metadata.get('author'):
            book.add_metadata('DC', 'creator', metadata['author'])

        # 保存 EPUB（使用 UTF-8 编码支持多语言字符）
        epub.write_epub(file_path, book, {"encoding": "utf-8"})

        return True, None

    except Exception as e:
        return False, str(e)


def update_file_metadata_status(
    workspace_path: str,
    file_path: str,
    updated: bool,
    error: Optional[str] = None,
    new_metadata: Optional[dict] = None
):
    """更新文件的元数据状态

    Args:
        new_metadata: 更新成功后要写入索引的元数据（author/description/subjects/publishYear）
    """
    index_data = load_index(workspace_path)
    if not index_data:
        index_data = {"files": {}, "version": "1.0"}

    if file_path in index_data.get("files", {}):
        index_data["files"][file_path]["metadataUpdated"] = updated
        index_data["files"][file_path]["metadataUpdatedAt"] = datetime.now().isoformat() if updated else None
        index_data["files"][file_path]["metadataError"] = error
        # 更新实际元数据到索引
        if updated and new_metadata:
            if "author" in new_metadata:
                index_data["files"][file_path]["author"] = new_metadata["author"]
            if "description" in new_metadata:
                index_data["files"][file_path]["description"] = new_metadata["description"]
            if "subjects" in new_metadata:
                index_data["files"][file_path]["subjects"] = new_metadata["subjects"]
            if "publishYear" in new_metadata:
                index_data["files"][file_path]["publishYear"] = new_metadata["publishYear"]

    save_index(workspace_path, index_data)


def get_metadata_status(
    workspace_path: str,
    offset: int = 0,
    limit: int = 0,
    filter_updated: Optional[bool] = None,
) -> dict:
    """获取元数据管理状态，支持分页和筛选.

    Args:
        workspace_path: 工作区路径
        offset: 跳过前 N 条
        limit: 最多返回 N 条，0=不限制
        filter_updated: True=只返回已更新，False=只返回未更新，None=全部
    """
    index_data = load_index(workspace_path)
    if not index_data:
        index_data = {"files": {}, "version": "1.0"}

    files = index_data.get("files", {})

    # 加载上传状态
    try:
        from .book_uploader import load_upload_progress
        upload_progress = load_upload_progress(workspace_path)
        uploaded_map = upload_progress.get("uploaded", {})
    except Exception:
        uploaded_map = {}

    total = len(files)
    not_updated_files = []
    updated_files = []

    for file_path, file_info in files.items():
        # 返回完整的文件信息
        file_data = {
            "filePath": file_path,
            "title": file_info.get("title"),
            "author": file_info.get("author"),
            "language": file_info.get("language"),
            "publishYear": file_info.get("publishYear"),
            "subjects": file_info.get("subjects", []),
            "fileSize": file_info.get("fileSize"),
            "metadataUpdated": file_info.get("metadataUpdated", False),
            "metadataError": file_info.get("metadataError"),
            "coverUpdated": file_info.get("coverUpdated", False),
            "coverError": file_info.get("coverError"),
            "uploaded": file_info.get("uploaded", file_path in uploaded_map),
            "uploadError": file_info.get("uploadError"),
            "uploadedAt": file_info.get("uploadedAt"),
        }

        if file_info.get("metadataUpdated", False):
            updated_files.append(file_data)
        else:
            not_updated_files.append(file_data)

    # 根据 filter_updated 筛选
    if filter_updated is True:
        filtered = updated_files
    elif filter_updated is False:
        filtered = not_updated_files
    else:
        filtered = updated_files + not_updated_files

    # 应用分页
    paginated = filtered[offset:offset + limit] if limit > 0 else filtered

    return {
        "total": total,
        "notUpdated": len(not_updated_files),
        "updated": len(updated_files),
        "notUpdatedFiles": not_updated_files,
        "updatedFiles": updated_files,
        # 分页信息
        "offset": offset,
        "limit": limit,
        "filteredTotal": len(filtered),
        "books": paginated,
    }


async def update_metadata_for_files(
    workspace_path: str,
    files: list,
    config: dict,
    progress_callback=None
) -> dict:
    """
    更新多个文件的元数据

    Args:
        workspace_path: 工作区路径
        files: 要更新的文件列表，每个包含 filePath, title, author
        config: LLM 配置，包含 apiKey, baseUrl, model
        progress_callback: 进度回调函数

    Returns:
        {
            "success": int,
            "failed": int,
            "results": list
        }
    """
    reset_cancel_flag()

    # ── 埋点：初始化日志记录器 ─────────────────────────────────────
    task_id = uuid.uuid4().hex
    metadata_logger: Optional[MetadataLogger] = None
    try:
        metadata_logger = MetadataLogger(workspace_path)
    except Exception as e:
        print(f"[MetadataLogger] 初始化失败: {e}")

    results = []
    success_count = 0
    failed_count = 0

    # 分批处理
    batches = [files[i:i + BATCH_SIZE] for i in range(0, len(files), BATCH_SIZE)]

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

    async def process_batch(batch: list) -> list:
        async with semaphore:
            if is_cancelled():
                return [{
                    "filePath": f["filePath"],
                    "success": False,
                    "error": "Cancelled"
                } for f in batch]

            # 阶段1: 发送给大模型
            books_info = [{"title": f["title"], "author": f["author"]} for f in batch]

            if progress_callback:
                await progress_callback({
                    "type": "stage",
                    "stage": "sending",
                    "bookTitle": batch[0]["title"] if batch else None
                })

            llm_results = await call_llm_batch(
                books=books_info,
                api_key=config.get("apiKey", ""),
                base_url=config.get("baseUrl", ""),
                model=config.get("model", "gpt-4o-mini"),
                timeout=120.0
            )

            # 阶段2: 接收元数据
            if progress_callback:
                await progress_callback({
                    "type": "stage",
                    "stage": "receiving",
                    "bookTitle": batch[0]["title"] if batch else None
                })

            batch_results = []

            for i, file_info in enumerate(batch):
                book_start_time = datetime.now()
                if is_cancelled():
                    batch_results.append({
                        "filePath": file_info["filePath"],
                        "title": file_info["title"],
                        "success": False,
                        "error": "Cancelled"
                    })
                    continue

                llm_result = llm_results[i]

                if not llm_result.get("success"):
                    # LLM 返回失败
                    error_msg = llm_result.get("error", "Unknown error")
                    update_file_metadata_status(
                        workspace_path,
                        file_info["filePath"],
                        updated=False,
                        error=error_msg
                    )
                    # ── 埋点：记录 LLM 调用失败 ────────────────────────
                    total_latency_ms = int((datetime.now() - book_start_time).total_seconds() * 1000)
                    if metadata_logger:
                        try:
                            import time
                            llm_latency_ms = 0  # 无法从失败的调用中获取
                            parse_success = False
                            parse_error = error_msg
                            validation_passed = False
                            validation_errors = "[]"
                            subjects_in_range = False
                            subjects_count_valid = False
                            year_valid = False
                            write_success = False
                            write_error = ""
                            update_status = "failed_parse" if "parse" in error_msg.lower() or "json" in error_msg.lower() else "failed_llm"

                            # 尝试从 file_info 获取原始元数据
                            original_metadata = file_info.get("original_metadata", {})
                            log_record: Dict[str, Any] = {
                                "log_id": uuid.uuid4().hex,
                                "task_id": task_id,
                                "timestamp": book_start_time.isoformat(),
                                "book_file_path": os.path.basename(file_info["filePath"]),
                                "book_title": file_info.get("title", ""),
                                "book_author_original": file_info.get("author") or "",
                                "book_language": original_metadata.get("language", ""),
                                "has_original_author": bool(original_metadata.get("author")),
                                "has_original_description": bool(original_metadata.get("description")),
                                "has_original_subjects": bool(original_metadata.get("subjects")),
                                "prompt_type": "batch",
                                "batch_size": BATCH_SIZE,
                                "llm_description": "",
                                "llm_subjects": "[]",
                                "llm_year": None,
                                "llm_author": "",
                                "parse_success": parse_success,
                                "parse_error": parse_error,
                                "validation_passed": validation_passed,
                                "validation_errors": validation_errors,
                                "subjects_in_range": subjects_in_range,
                                "subjects_count_valid": subjects_count_valid,
                                "year_valid": year_valid,
                                "write_success": write_success,
                                "write_error": write_error,
                                "update_status": update_status,
                                "llm_latency_ms": llm_latency_ms,
                                "total_latency_ms": total_latency_ms,
                                "llm_model": config.get("model", "")
                            }
                            metadata_logger.write_update(log_record)
                        except Exception as log_err:
                            print(f"[MetadataLogger] 埋点写入失败: {log_err}")

                    batch_results.append({
                        "filePath": file_info["filePath"],
                        "title": file_info["title"],
                        "success": False,
                        "error": error_msg
                    })
                    continue

                # 阶段3: 写入 EPUB 文件
                if progress_callback:
                    await progress_callback({
                        "type": "stage",
                        "stage": "writing",
                        "bookTitle": file_info["title"]
                    })

                metadata = llm_result["metadata"]
                success, error = update_epub_metadata(file_info["filePath"], metadata)

                # ── 埋点：记录每本书的处理结果 ────────────────────────
                total_latency_ms = int((datetime.now() - book_start_time).total_seconds() * 1000)
                llm_latency_ms = int(metadata.get("_llm_latency_ms", 0)) if isinstance(metadata, dict) else 0
                if metadata_logger:
                    try:
                        original_metadata = file_info.get("original_metadata", {})
                        from .llm_harness import validate_metadata, VALID_CATEGORY_IDS
                        validation_passed, validation_err = validate_metadata(metadata)
                        subjects_in_range = all(str(c) in VALID_CATEGORY_IDS for c in metadata.get("categories", []))
                        subjects_count_valid = 1 <= len(metadata.get("categories", [])) <= 3
                        year_val = metadata.get("publishYear")
                        year_valid = year_val is not None and isinstance(year_val, (int, float)) and -3000 <= year_val <= datetime.now().year + 1
                        if not year_valid and year_val is not None:
                            pass  # keep validation result
                        parse_success = True
                        parse_error = ""
                        update_status = "success" if success else "failed_write"

                        log_record: Dict[str, Any] = {
                            "log_id": uuid.uuid4().hex,
                            "task_id": task_id,
                            "timestamp": book_start_time.isoformat(),
                            "book_file_path": os.path.basename(file_info["filePath"]),
                            "book_title": file_info.get("title", ""),
                            "book_author_original": file_info.get("author") or "",
                            "book_language": original_metadata.get("language", "") if isinstance(original_metadata, dict) else "",
                            "has_original_author": bool(original_metadata.get("author")) if isinstance(original_metadata, dict) else False,
                            "has_original_description": bool(original_metadata.get("description")) if isinstance(original_metadata, dict) else False,
                            "has_original_subjects": bool(original_metadata.get("subjects")) if isinstance(original_metadata, dict) else False,
                            "prompt_type": "batch",
                            "batch_size": BATCH_SIZE,
                            "llm_description": metadata.get("description", "") if isinstance(metadata, dict) else "",
                            "llm_subjects": json.dumps(metadata.get("categories", [])) if isinstance(metadata, dict) else "[]",
                            "llm_year": metadata.get("publishYear") if isinstance(metadata, dict) else None,
                            "llm_author": metadata.get("author", "") if isinstance(metadata, dict) else "",
                            "parse_success": parse_success,
                            "parse_error": parse_error,
                            "validation_passed": validation_passed,
                            "validation_errors": json.dumps([validation_err] if validation_err else []) if not validation_passed else "[]",
                            "subjects_in_range": subjects_in_range,
                            "subjects_count_valid": subjects_count_valid,
                            "year_valid": year_valid,
                            "write_success": success,
                            "write_error": error or "",
                            "update_status": update_status,
                            "llm_latency_ms": llm_latency_ms,
                            "total_latency_ms": total_latency_ms,
                            "llm_model": config.get("model", "")
                        }
                        metadata_logger.write_update(log_record)
                    except Exception as log_err:
                        print(f"[MetadataLogger] 埋点写入失败: {log_err}")

                if success:
                    # 写入成功后更新索引（包含作者等信息）
                    update_file_metadata_status(
                        workspace_path,
                        file_info["filePath"],
                        updated=True,
                        new_metadata=metadata
                    )
                    batch_results.append({
                        "filePath": file_info["filePath"],
                        "title": file_info["title"],
                        "success": True,
                        "metadata": metadata
                    })
                else:
                    update_file_metadata_status(
                        workspace_path,
                        file_info["filePath"],
                        updated=False,
                        error=error
                    )
                    batch_results.append({
                        "filePath": file_info["filePath"],
                        "title": file_info["title"],
                        "success": False,
                        "error": error
                    })

            return batch_results

    # 并发处理所有批次
    tasks = [process_batch(batch) for batch in batches]

    for i, task in enumerate(asyncio.as_completed(tasks)):
        if is_cancelled():
            break

        batch_results = await task
        results.extend(batch_results)

        # 更新统计
        for r in batch_results:
            if r["success"]:
                success_count += 1
            else:
                failed_count += 1

        # 回调进度
        if progress_callback:
            await progress_callback({
                "type": "progress",
                "processed": len(results),
                "total": len(files),
                "success": success_count,
                "failed": failed_count,
                "latestResults": batch_results
            })

    return {
        "success": success_count,
        "failed": failed_count,
        "results": results
    }