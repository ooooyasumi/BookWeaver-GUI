"""书籍匹配算法."""

import re
from typing import Tuple

from rapidfuzz import fuzz


def normalize_author(author: str) -> str:
    """
    标准化作者名字格式.

    Args:
        author: 作者名

    Returns:
        标准化后的作者名

    Examples:
        "Austen, Jane" → "austen jane"
        "Shelley, Mary W." → "shelley mary w"
        "Austen, Jane, 1775-1817" → "austen jane"
    """
    if not author:
        return ""

    # 转小写
    author = author.lower()

    # 移除日期 (如 "1775-1817")
    author = re.sub(r'\d{4}-?\d*', '', author)

    # 移除多余标点
    author = re.sub(r'[,\.\-]+', ' ', author)

    # 移除多余空格
    author = ' '.join(author.split())

    return author.strip()


def normalize_title(title: str) -> str:
    """
    标准化书名字符串.

    移除副标题和冠词。

    Args:
        title: 书名

    Returns:
        标准化后的书名
    """
    if not title:
        return ""

    # 转小写
    title = title.lower()

    # 移除副标题 (如 ": A Novel", "; Or, The...")":.*$", "", title)
    title = re.sub(r";.*$", "", title)

    # 移除方括号内容
    title = re.sub(r'\[.*?\]', '', title)

    # 移除多余标点
    title = re.sub(r'[,\.\-:;]+', ' ', title)

    # 移除多余空格
    title = ' '.join(title.split())

    return title.strip()


def match_author(
    input_author: str,
    catalog_author: str,
    threshold: float = 80.0
) -> Tuple[bool, float]:
    """
    模糊匹配作者.

    Args:
        input_author: 输入的作者名
        catalog_author: 目录中的作者名
        threshold: 匹配阈值

    Returns:
        (是否匹配, 置信度)
    """
    if not input_author or not catalog_author:
        return False, 0

    input_norm = normalize_author(input_author)
    catalog_norm = normalize_author(catalog_author)

    # 计算相似度
    score = fuzz.token_sort_ratio(input_norm, catalog_norm)

    return score >= threshold, score


def match_title(
    input_title: str,
    catalog_title: str,
    threshold: float = 70.0
) -> Tuple[bool, float]:
    """
    模糊匹配书名.

    Args:
        input_title: 输入的书名
        catalog_title: 目录中的书名
        threshold: 匹配阈值

    Returns:
        (是否匹配, 置信度)
    """
    if not input_title or not catalog_title:
        return False, 0

    input_norm = normalize_title(input_title)
    catalog_norm = normalize_title(catalog_title)

    # 处理通用关键词：classic, popular, best, fiction 等
    # 这些词应该匹配所有书籍，返回高置信度
    generic_keywords = ["classic", "popular", "best", "fiction", "novel", "adventure", "science", "history"]
    if input_norm in generic_keywords:
        # 对于通用关键词，返回一个基础评分，让所有书籍都能匹配
        return True, 50.0

    # 计算相似度
    score = fuzz.token_sort_ratio(input_norm, catalog_norm)

    # 也尝试子串匹配
    if input_norm in catalog_norm or catalog_norm in input_norm:
        score = max(score, 85.0)

    return score >= threshold, score


def validate_books(queries: list[dict], catalog: list[dict]) -> dict:
    """
    验证书籍列表.

    Args:
        queries: 查询列表，每个查询包含 title, author, language
        catalog: 目录列表

    Returns:
        {
            "matched": [...],
            "unmatched": [...],
            "total": 10,
            "match_rate": 0.8
        }
    """
    matched = []
    unmatched = []

    for query in queries:
        title = query.get("title", "")
        author = query.get("author", "")
        language = query.get("language", "en")

        best_match = None
        best_score = 0

        for book in catalog:
            # 语言匹配
            if language and book.get("language") != language:
                continue

            # 计算匹配度
            title_matched, title_score = match_title(title, book.get("title", "")) if title else (True, 100)
            author_matched, author_score = match_author(author, book.get("author", "")) if author else (True, 100)

            if title_matched and author_matched:
                # 计算综合评分
                if title and author:
                    score = title_score * 0.4 + author_score * 0.6
                elif title:
                    score = title_score
                else:
                    score = author_score

                if score > best_score:
                    best_score = score
                    best_match = book

        if best_match:
            matched.append({
                "entry": best_match,
                "confidence": best_score
            })
        else:
            unmatched.append({
                "query": query
            })

    total = len(queries)
    match_rate = len(matched) / total if total > 0 else 0

    return {
        "matched": matched,
        "unmatched": unmatched,
        "total": total,
        "match_rate": match_rate
    }


def match_subject(
    input_subject: str,
    catalog_subjects: str,
    threshold: float = 60.0
) -> Tuple[bool, float]:
    """
    模糊匹配分类/主题.

    Args:
        input_subject: 输入的分类/主题
        catalog_subjects: 目录中的分类字符串（可能有多个，用分号分隔）
        threshold: 匹配阈值

    Returns:
        (是否匹配, 置信度)
    """
    if not input_subject or not catalog_subjects:
        return False, 0

    # 标准化输入
    input_norm = input_subject.lower().strip()

    # 目录中的分类可能是分号分隔的，处理一下
    subjects = [s.strip().lower() for s in catalog_subjects.split(";")]

    best_score = 0

    for subj in subjects:
        if not subj:
            continue

        # 精确匹配
        if input_norm in subj or subj in input_norm:
            best_score = max(best_score, 90.0)
        else:
            # 模糊匹配
            score = fuzz.token_sort_ratio(input_norm, subj)
            best_score = max(best_score, score)

    return best_score >= threshold, best_score