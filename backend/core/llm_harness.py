"""
LLM Harness - 大模型调用封装，用于获取书籍元数据
"""

import json
import httpx
from typing import Optional

# 分类映射：数字 -> 分类名称
CATEGORY_MAP = {
    "1": "Arts",
    "2": "Astronomy",
    "3": "Biography & Autobiography",
    "4": "Biology and other natural sciences",
    "5": "Business & Economics",
    "6": "Chemistry",
    "7": "Comics & Graphic Novels",
    "8": "Computers",
    "9": "Children's Books",
    "10": "Crime, Thrillers & Mystery",
    "11": "Cookbooks, Food & Wine",
    "12": "Earth Sciences",
    "13": "Engineering",
    "14": "Erotica",
    "15": "Education Studies & Teaching",
    "16": "Fiction",
    "17": "Fantasy",
    "18": "History",
    "19": "Housekeeping & Leisure",
    "20": "Jurisprudence & Law",
    "21": "Languages",
    "22": "Linguistics",
    "23": "Mathematics",
    "24": "Medicine",
    "25": "Nature, Animals & Pets",
    "26": "Others",
    "27": "Physics",
    "28": "Poetry",
    "29": "Psychology",
    "30": "Reference",
    "31": "Religion & Spirituality",
    "32": "Romance",
    "33": "Science Fiction",
    "34": "Science (General)",
    "35": "Sports, Hobbies & Games",
    "36": "Society, Politics & Philosophy",
    "37": "Self-Help, Relationships & Lifestyle",
    "38": "Travel",
    "39": "Technique"
}

# 有效的分类数字列表
VALID_CATEGORY_IDS = list(CATEGORY_MAP.keys())

# 分类列表文本（用于 prompt）
CATEGORY_LIST_TEXT = "\n".join([f"    {k}: \"{v}\"" for k, v in CATEGORY_MAP.items()])

PROMPT_TEMPLATE = """You are a book metadata expert. Given the book title and author, provide structured metadata.

IMPORTANT: You must respond in valid JSON format only. No other text before or after the JSON.

Book Title: {title}
Author: {author}

Respond with this exact JSON structure:
{{
  "success": true or false,
  "error": null or "reason if failed to find the book",
  "metadata": {{
    "description": "A 150-300 word English description of the book",
    "categories": [1, 2],
    "publishYear": 1813
  }}
}}

Rules:
1. description MUST be 150-300 words in English
2. categories MUST be 1-3 NUMBERS from this list (return the NUMBER, not the text):
{categories}
3. publishYear MUST be the ORIGINAL/FIRST publication year (4-digit integer), not reprint dates
4. If you cannot find reliable information about this book, set success to false and provide an error reason
5. Do not make up information - only provide what you can verify"""

BATCH_PROMPT_TEMPLATE = """You are a book metadata expert. Given multiple book titles and authors, provide structured metadata for each.

IMPORTANT: You must respond in valid JSON array format only. No other text before or after the JSON.

Books to process:
{books}

Respond with a JSON array where each item has:
{{
  "index": the book index (0-based),
  "success": true or false,
  "error": null or "reason if failed",
  "metadata": {{
    "description": "150-300 word English description",
    "categories": [1, 2],
    "publishYear": 1813
  }}
}}

Rules:
1. description MUST be 150-300 words in English
2. categories MUST be 1-3 NUMBERS from this list (return the NUMBER, not the text):
{categories}
3. publishYear MUST be the ORIGINAL/FIRST publication year (4-digit integer), not reprint dates
4. If you cannot find reliable information, set success to false
5. Return results in the same order as input"""


def convert_category_ids_to_names(category_ids: list) -> list[str]:
    """将分类数字转换为分类名称"""
    result = []
    for id in category_ids:
        # 处理字符串或数字类型的 id
        id_str = str(id)
        if id_str in CATEGORY_MAP:
            result.append(CATEGORY_MAP[id_str])
        else:
            # 如果不在映射中，使用 "Others"
            result.append("Others")
    return result


def build_single_prompt(title: str, author: str) -> str:
    """构建单本书的 prompt"""
    return PROMPT_TEMPLATE.format(
        title=title,
        author=author,
        categories=CATEGORY_LIST_TEXT
    )


def build_batch_prompt(books: list[dict]) -> str:
    """构建批量处理的 prompt"""
    books_text = ""
    for i, book in enumerate(books):
        books_text += f'{i}. Title: "{book["title"]}", Author: "{book["author"]}"\n'

    return BATCH_PROMPT_TEMPLATE.format(
        books=books_text,
        categories=CATEGORY_LIST_TEXT
    )


def validate_metadata(metadata: dict) -> tuple[bool, Optional[str]]:
    """验证元数据字段"""
    # 验证简介
    description = metadata.get("description", "")
    if not isinstance(description, str):
        return False, "description must be a string"

    word_count = len(description.split())
    if word_count < 150 or word_count > 300:
        return False, f"description word count must be 150-300, got {word_count}"

    # 验证分类（现在是数字，限制 1-3 个）
    categories = metadata.get("categories", [])
    if not isinstance(categories, list):
        return False, "categories must be a list"

    if len(categories) == 0:
        return False, "categories cannot be empty"

    if len(categories) > 3:
        return False, f"categories must have 1-3 items, got {len(categories)}"

    for cat in categories:
        # 转换为字符串进行检查
        cat_str = str(cat)
        if cat_str not in VALID_CATEGORY_IDS:
            return False, f"invalid category id: {cat}"

    # 验证年份
    year = metadata.get("publishYear")
    if not isinstance(year, int):
        return False, "publishYear must be an integer"

    if year < 1000 or year > 9999:
        return False, f"publishYear must be 4-digit, got {year}"

    return True, None


def parse_single_response(response_text: str) -> dict:
    """解析单本书的 LLM 响应"""
    try:
        # 尝试提取 JSON
        text = response_text.strip()

        # 移除可能的 markdown 代码块标记
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        data = json.loads(text)
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Failed to parse JSON: {str(e)}"
        }

    # 检查 success 字段
    if "success" not in data:
        return {
            "success": False,
            "error": "Missing 'success' field in response"
        }

    # 如果失败，返回错误
    if not data["success"]:
        return {
            "success": False,
            "error": data.get("error", "Unknown error from LLM")
        }

    # 验证元数据
    metadata = data.get("metadata", {})
    is_valid, error_msg = validate_metadata(metadata)

    if not is_valid:
        return {
            "success": False,
            "error": error_msg
        }

    # 将分类数字转换为分类名称
    category_names = convert_category_ids_to_names(metadata["categories"])

    return {
        "success": True,
        "metadata": {
            "description": metadata["description"],
            "categories": category_names,
            "publishYear": metadata["publishYear"]
        }
    }


def parse_batch_response(response_text: str, expected_count: int) -> list[dict]:
    """解析批量处理的 LLM 响应"""
    try:
        text = response_text.strip()

        # 移除可能的 markdown 代码块标记
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        data = json.loads(text)
    except json.JSONDecodeError as e:
        # 返回所有失败
        return [{
            "success": False,
            "error": f"Failed to parse JSON: {str(e)}"
        } for _ in range(expected_count)]

    if not isinstance(data, list):
        return [{
            "success": False,
            "error": "Response is not a JSON array"
        } for _ in range(expected_count)]

    results = []
    for i in range(expected_count):
        # 查找对应索引的结果
        item = None
        for d in data:
            if d.get("index") == i:
                item = d
                break

        if item is None:
            results.append({
                "success": False,
                "error": f"No result for index {i}"
            })
            continue

        if not item.get("success", False):
            results.append({
                "success": False,
                "error": item.get("error", "Unknown error")
            })
            continue

        metadata = item.get("metadata", {})
        is_valid, error_msg = validate_metadata(metadata)

        if not is_valid:
            results.append({
                "success": False,
                "error": error_msg
            })
        else:
            # 将分类数字转换为分类名称
            category_names = convert_category_ids_to_names(metadata["categories"])

            results.append({
                "success": True,
                "metadata": {
                    "description": metadata["description"],
                    "categories": category_names,
                    "publishYear": metadata["publishYear"]
                }
            })

    return results


async def call_llm_single(
    title: str,
    author: str,
    api_key: str,
    base_url: str,
    model: str,
    timeout: float = 60.0
) -> dict:
    """调用 LLM 获取单本书的元数据"""
    prompt = build_single_prompt(title, author)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000
                }
            )

            if response.status_code != 200:
                return {
                    "success": False,
                    "error": f"LLM API error: {response.status_code}"
                }

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            return parse_single_response(content)

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "LLM request timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"LLM request failed: {str(e)}"
            }


async def call_llm_batch(
    books: list[dict],
    api_key: str,
    base_url: str,
    model: str,
    timeout: float = 120.0
) -> list[dict]:
    """调用 LLM 批量获取多本书的元数据"""
    if not books:
        return []

    prompt = build_batch_prompt(books)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000
                }
            )

            if response.status_code != 200:
                return [{
                    "success": False,
                    "error": f"LLM API error: {response.status_code}"
                } for _ in books]

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            return parse_batch_response(content, len(books))

        except httpx.TimeoutException:
            return [{
                "success": False,
                "error": "LLM request timeout"
            } for _ in books]
        except Exception as e:
            return [{
                "success": False,
                "error": f"LLM request failed: {str(e)}"
            } for _ in books]