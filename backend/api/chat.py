"""AI 对话 API."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()


class Message(BaseModel):
    """消息."""
    role: str
    content: str


class ChatRequest(BaseModel):
    """对话请求."""
    message: str
    history: Optional[List[Message]] = None


@router.post("")
async def chat(request: ChatRequest):
    """
    AI 对话 (SSE).

    与 AI 进行自然语言交互，返回流式响应。
    """
    async def generate():
        # TODO: 实现实际的 LLM 调用
        # 这里先返回模拟响应

        response_text = f"收到您的消息: {request.message}\n\n我正在开发中，暂时无法提供实际的 AI 对话功能。请稍后再试。"

        # 模拟流式输出
        for char in response_text:
            event = {
                "type": "token",
                "content": char
            }
            yield f"data: {json.dumps(event)}\n\n"

        # 发送完成事件
        complete_event = {
            "type": "complete"
        }
        yield f"data: {json.dumps(complete_event)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


@router.get("/context")
async def get_context():
    """获取 AI 对话上下文."""
    # TODO: 从工作区数据读取
    return {
        "history": [],
        "bookList": []
    }


@router.delete("/context")
async def clear_context():
    """清空 AI 对话上下文."""
    # TODO: 清空工作区数据
    return {"success": True}