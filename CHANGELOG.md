# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-01

### Added

- **AI 助手 Plan-Execute-Verify 四阶段 Harness**
  - Phase 1 PLAN：LLM 分析用户意图，输出结构化 JSON 搜索计划（关键词列表、每次 limit、目标数量）
  - Phase 2 EXECUTE：Backend 驱动循环按计划逐关键词搜索，不依赖 LLM 决策
  - Phase 3 VERIFY：内置 30+ 兜底关键词，未达目标自动补充搜索
  - Phase 4 REPLY：任务完成后 LLM 流式输出自然语言总结
  - 支持一条消息完成"推荐 1000 本书"等大批量任务，全程无需人工干预

- **下载实时网速显示**
  - 下载中标签页实时显示当前网速（KB/s 或 MB/s）
  - 每秒聚合所有并发下载的速度后推送给前端

- **下载暂停 / 继续**
  - 暂停：向后端发送取消信号，当前正在传输的书下载完后停止，不强制中断
  - 继续：从 meta.json 读取已完成列表，只下载剩余书籍，断点续传
  - 暂停状态跨 app 重启持久化，重新打开工作区后可继续

- **下载进度条实时动画**
  - 总进度条使用 Ant Design `active` 状态，实时跳动
  - 进度基于已完成本数/总本数精确计算

### Changed

- **AI 对话 UI 优化**
  - 状态消息（搜索进度）原地更新，不再每批次追加新消息
  - 大批量任务期间对话框只显示一条"搜索中，已加入 N 本书..."动态消息
  - 任务完成后状态消息变为"共加入 N 本书到列表"结果样式

- **缓存文件结构重构**
  - 旧 `workspace.json` 拆分为：
    - `state.json`：轻量持久状态（预下载列表 + 批次摘要），每次操作立即写入
    - `downloads/batch_N/meta.json`：批次完整书单 + 下载结果，仅在下载时写入
  - 去掉 `ai_context.json`（AI 对话历史不再持久化）
  - 工作区首次打开时自动迁移旧格式数据

- **下载页面交互**
  - 点击"开始下载"：预下载列表全部转移到下载中，预下载列表清空
  - 已完成批次展开时懒加载 meta.json 详情，避免大文件影响启动速度
  - 已完成列表按批次倒序排列（最新在最上方）
  - 每批次新增"打开文件夹"按钮，直接在 Finder/Explorer 中打开

### Fixed

- **SSE 解析错误**：旧版 `JSON.parse(chunk)` 对非标准 SSE 格式不健壮，改为标准 `data: ...` 行解析
- **`downloadProgress` 频繁写磁盘**：临时下载进度从 `workspaceData` 中分离，仅保存在内存中
- **React 状态闭包问题**：使用 `useRef` 追踪消息索引，避免 `setState` 回调中读到陈旧值

## [0.1.1] - 2026-03-26

### Fixed

- **AI 对话 Function Calling**
  - 修复 DashScope Coding API 兼容性问题，移除对 `tool` 角色的依赖
  - 改用 `system` 消息传递工具执行结果
  - 修复无工具调用时的流式输出错误

- **下载进度显示**
  - 修复下载过程中进度条不可见的问题
  - 修复下载完成后"已完成"标签页不显示批次的问题
  - 优化下载中列表使用独立的书籍列表数据

- **AI 对话消息样式**
  - 优化消息气泡样式，更像手机聊天软件
  - 工具状态消息显示为浅蓝色带加载图标
  - 工具结果消息显示为浅绿色边框
  - 简化输出内容，去除冗余信息

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