# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-26

### Added

- **工作区系统**
  - 类似编辑器的工作区模式，需要打开文件夹才能工作
  - 支持拖拽文件夹打开工作区
  - 工作区数据持久化在 `.bookweaver/` 目录

- **书籍搜索**
  - 按书名/作者搜索 Gutenberg 目录（77,000+ 书籍）
  - 支持模糊匹配，显示匹配度评分
  - 搜索结果支持复选框选择和全选
  - 一键添加到预下载列表

- **下载管理**
  - 三个标签页：预下载 / 下载中 / 已完成
  - 批量下载支持 SSE 实时进度
  - 下载批次记录管理

- **AI 助手**
  - 悬浮按钮打开对话抽屉
  - SSE 流式输出（基础框架）

- **设置功能**
  - LLM API 配置（API Key、模型、Base URL）
  - 下载配置（并发数、超时时间）

- **图书管理**
  - 页面占位，待开发元数据编辑器

### Technical

- **前端**: Electron + React + TypeScript + Ant Design
- **后端**: Python FastAPI
- **通信**: HTTP REST + SSE

### Project Structure

```
bookweaver-gui/
├── electron/          # Electron 主进程
├── src/               # React 前端
├── backend/           # FastAPI 后端
└── resources/         # 打包资源
```