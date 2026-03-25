"""配置管理."""

from pydantic import BaseModel
from typing import Optional


class LLMConfig(BaseModel):
    """LLM 配置."""
    api_key: str = ""
    model: str = "qwen3.5-plus"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    temperature: float = 0.7
    max_tokens: int = 2000


class DownloadConfig(BaseModel):
    """下载配置."""
    concurrent: int = 3
    timeout: int = 30


class Config(BaseModel):
    """应用配置."""
    llm: LLMConfig = LLMConfig()
    download: DownloadConfig = DownloadConfig()


# 默认配置
DEFAULT_CONFIG = Config()