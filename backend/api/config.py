"""配置 API."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class LLMConfig(BaseModel):
    """LLM 配置."""
    apiKey: str = ""
    model: str = "qwen3.5-plus"
    baseUrl: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    temperature: float = 0.7
    maxTokens: int = 2000


class DownloadConfig(BaseModel):
    """下载配置."""
    concurrent: int = 3
    timeout: int = 30


class Config(BaseModel):
    """应用配置."""
    llm: LLMConfig = LLMConfig()
    download: DownloadConfig = DownloadConfig()


@router.get("")
async def get_config():
    """获取配置."""
    # TODO: 从工作区读取配置
    return Config().model_dump()


@router.put("")
async def save_config(config: Config):
    """保存配置."""
    # TODO: 保存到工作区
    return {"success": True}