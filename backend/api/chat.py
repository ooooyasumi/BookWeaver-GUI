"""AI 对话 API - 支持 Function Calling."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import httpx

from openai import OpenAI

router = APIRouter()


class Message(BaseModel):
    """消息."""
    role: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class LLMConfig(BaseModel):
    """LLM 配置."""
    apiKey: str
    model: str = "qwen3.5-plus"
    baseUrl: str = "https://coding.dashscope.aliyuncs.com/v1"
    temperature: float = 0.7
    maxTokens: int = 2000


class ChatRequest(BaseModel):
    """对话请求."""
    message: str
    history: Optional[List[Message]] = None
    config: Optional[LLMConfig] = None
    workspacePath: Optional[str] = None


class TestConfig(BaseModel):
    """测试配置请求."""
    apiKey: str
    baseUrl: str
    model: str


# 工具定义
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_books",
            "description": "在 Project Gutenberg 目录中搜索书籍。当用户需要找书、获取书单、推荐书籍时使用",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "书名或关键词，可以是部分书名。如果用户只是想要一些书而不指定具体书名，可以传入'popular'、'classic'、'fiction'等通用关键词"
                    },
                    "author": {
                        "type": "string",
                        "description": "作者名字，可选"
                    },
                    "language": {
                        "type": "string",
                        "description": "语言代码，如 en（英语）、zh（中文）",
                        "enum": ["en", "zh", "fr", "de", "es", "it"]
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回结果数量，默认 10，最大 100",
                        "default": 10,
                        "maximum": 100
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_to_search_results",
            "description": "将搜索到的书籍添加到前端的搜索结果列表中。在 search_books 之后调用",
            "parameters": {
                "type": "object",
                "properties": {
                    "books": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "integer", "description": "书籍 ID"},
                                "title": {"type": "string", "description": "书名"},
                                "author": {"type": "string", "description": "作者"},
                                "language": {"type": "string", "description": "语言"}
                            },
                            "required": ["id", "title", "author", "language"]
                        },
                        "description": "要添加的书籍列表"
                    }
                },
                "required": ["books"]
            }
        }
    }
]

SYSTEM_PROMPT = """你是 BookWeaver 的图书推荐助手。你的任务是帮助用户找到他们可能喜欢的书籍。

你可以：
1. 根据用户的阅读喜好推荐书籍
2. 根据主题、风格、作者等条件推荐书籍
3. 回答关于文学作品的问题
4. 当用户没有指定具体书名时，推荐经典文学作品或热门书籍

可用的工具：
- search_books: 搜索书籍。当用户需要找书、获取书单时使用
  - title 参数是可选的，可以传入：
    - 具体书名（如"Pride and Prejudice"）
    - 类型关键词（如"classic"、"fiction"、"adventure"、"science"）
    - 通用词（如"popular"、"best"、"recommended"）来获取热门推荐
- add_to_search_results: 将搜索结果添加到前端列表，让用户可以直接选择下载

工作流程：
1. 当用户请求推荐书籍或搜索时，调用 search_books 搜索
   - 如果用户说"找 100 本书"或类似模糊请求，使用 title="classic" 或 title="popular"，limit=100
   - 如果用户有具体偏好，使用相应的关键词
2. 搜索完成后，调用 add_to_search_results 将结果添加到前端
3. 最后回复用户，告知已添加的书籍数量和类型

请用中文回复用户。"""


async def call_search_api(title: str = "", author: Optional[str] = None, language: str = "en", limit: int = 10) -> List[dict]:
    """调用搜索 API."""
    try:
        url = "http://127.0.0.1:8765/api/books/search"
        params = {"title": title, "author": author or "", "language": language, "limit": limit}
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                return data.get("results", [])
    except Exception as e:
        print(f"搜索失败：{e}")
    return []


@router.post("")
async def chat(request: ChatRequest):
    """
    AI 对话 (SSE) - 支持 Function Calling.
    """
    # 检查配置
    if not request.config or not request.config.apiKey:
        async def error_response():
            error_msg = "请先在设置中配置 LLM API Key"
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"
        return StreamingResponse(error_response(), media_type="text/event-stream")

    client = OpenAI(
        api_key=request.config.apiKey,
        base_url=request.config.baseUrl
    )

    # 构建消息历史
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if request.history:
        for msg in request.history:
            msg_dict = {"role": msg.role, "content": msg.content}
            if msg.tool_calls:
                msg_dict["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                msg_dict["tool_call_id"] = msg.tool_call_id
            messages.append(msg_dict)

    messages.append({"role": "user", "content": request.message})

    async def generate():
        try:
            # 第一次调用：获取回复（可能包含工具调用）
            response = client.chat.completions.create(
                model=request.config.model,
                messages=messages,
                temperature=request.config.temperature,
                max_completion_tokens=request.config.maxTokens,
                tools=TOOLS,
                tool_choice="auto",
                stream=False  # 先不使用流式，等待工具调用结果
            )

            assistant_message = response.choices[0].message

            # 检查是否有工具调用
            if assistant_message.tool_calls:
                # 流式输出：告知用户正在搜索
                searching_event = {
                    "type": "tool_status",
                    "content": "正在为您搜索书籍..."
                }
                yield f"data: {json.dumps(searching_event)}\n\n"

                added_books = []
                for tool_call in assistant_message.tool_calls:
                    func_name = tool_call.function.name
                    func_args = json.loads(tool_call.function.arguments)

                    if func_name == "search_books":
                        # 执行搜索
                        search_results = await call_search_api(
                            title=func_args.get("title", ""),
                            author=func_args.get("author"),
                            language=func_args.get("language", "en"),
                            limit=func_args.get("limit", 10)
                        )

                        # 将搜索结果添加到前端
                        if search_results:
                            yield f"data: {json.dumps({'type': 'add_books', 'books': search_results})}\n\n"
                            added_books = search_results

                # 执行完工具后，用简化版消息历史再次调用获取回复
                # DashScope Coding API 不支持 tool 角色，使用 system 消息告知工具执行结果
                tool_messages = messages.copy()
                tool_messages.append({
                    "role": "assistant",
                    "content": f"已为您搜索到 {len(added_books)} 本书籍。"
                })
                tool_messages.append({
                    "role": "system",
                    "content": f"工具执行结果：search_books 返回 {len(added_books)} 条结果，已通过 add_to_search_results 添加到前端。"
                })

                # 第二次调用：生成最终回复（不使用 tools 参数，避免再次触发工具调用）
                final_response = client.chat.completions.create(
                    model=request.config.model,
                    messages=tool_messages,
                    temperature=request.config.temperature,
                    max_completion_tokens=request.config.maxTokens,
                    stream=True
                )

                # 流式输出最终回复
                for chunk in final_response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            else:
                # 没有工具调用，直接流式输出
                stream_response = client.chat.completions.create(
                    model=request.config.model,
                    messages=messages,
                    temperature=request.config.temperature,
                    max_completion_tokens=request.config.maxTokens,
                    stream=True
                )
                for chunk in stream_response:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            error_event = {
                "type": "error",
                "content": f"AI 对话失败：{str(e)}"
            }
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


@router.post("/test")
async def test_api(config: TestConfig):
    """测试 API 连接."""
    try:
        client = OpenAI(
            api_key=config.apiKey,
            base_url=config.baseUrl
        )
        response = client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": "你好"}],
            max_completion_tokens=10
        )
        return {"success": True, "message": "连接成功"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/context")
async def get_context():
    """获取 AI 对话上下文."""
    return {"history": [], "bookList": []}


@router.delete("/context")
async def clear_context():
    """清空 AI 对话上下文."""
    return {"success": True}
