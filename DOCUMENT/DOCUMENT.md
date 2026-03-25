# BookWeaver GUI 开发文档

本文档详细记录 BookWeaver GUI 项目的架构设计、模块说明、API 参考等内容。

---

## 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [目录结构](#目录结构)
4. [前端模块](#前端模块)
5. [后端模块](#后端模块)
6. [API 参考](#api-参考)
7. [数据模型](#数据模型)
8. [工作区数据](#工作区数据)
9. [开发指南](#开发指南)

---

## 项目概述

### 版本信息

- **当前版本**: v0.1.0
- **Node.js 要求**: 18+
- **Python 要求**: 3.9+
- **许可证**: MIT

### 核心功能

| 功能 | 说明 |
|------|------|
| 工作区系统 | 类似编辑器的工作区模式，数据持久化 |
| 书籍搜索 | 搜索 Gutenberg 目录（77,000+ 书籍） |
| 下载管理 | 批量下载、进度跟踪、批次管理 |
| AI 助手 | 自然语言交互（框架已完成） |
| 设置 | LLM 配置、下载配置 |

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Electron + React + TypeScript |
| UI 组件库 | Ant Design |
| 状态管理 | React Context |
| 后端框架 | FastAPI |
| 通信方式 | HTTP REST + SSE |

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 主进程                              │
│  - 工作区管理                                                     │
│  - Python 后端进程管理                                            │
│  - IPC 通信                                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      渲染进程 (React)                             │
│  ┌─────────────────────────┐    ┌───────────────────────────┐   │
│  │     Pages               │    │    Components             │   │
│  │  - SearchPage           │    │  - SearchBar              │   │
│  │  - DownloadPage         │    │  - BookTable              │   │
│  │  - LibraryPage          │    │  - AIChatPanel            │   │
│  └─────────────────────────┘    └───────────────────────────┘   │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   React Context                          │    │
│  │  - WorkspaceContext                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Python FastAPI 后端                         │
│  ┌─────────────────────────┐    ┌───────────────────────────┐   │
│  │     API 路由             │    │    核心模块               │   │
│  │  - books.py             │    │  - catalog.py             │   │
│  │  - download.py          │    │  - matcher.py             │   │
│  │  - chat.py              │    │  - downloader.py          │   │
│  │  - config.py            │    │                           │   │
│  └─────────────────────────┘    └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 通信流程

```
渲染进程                     Electron 主进程              Python 后端
    │                              │                          │
    │  IPC: openFolder             │                          │
    │─────────────────────────────▶│                          │
    │                              │                          │
    │  IPC: openWorkspace          │                          │
    │─────────────────────────────▶│                          │
    │                              │  HTTP: POST /api/workspace/open
    │                              │─────────────────────────▶│
    │                              │                          │
    │  HTTP: GET /api/books/search │                          │
    │──────────────────────────────────────────────────────▶  │
    │                              │                          │
    │  HTTP: POST /api/download/start (SSE)                   │
    │──────────────────────────────────────────────────────▶  │
    │  ◀─────── SSE: progress events ────────────────────────│
    │                              │                          │
```

---

## 目录结构

```
bookweaver-gui/
├── package.json              # 项目配置
├── tsconfig.json             # TypeScript 配置
├── vite.config.ts            # Vite 配置
├── electron-builder.yml      # 打包配置
├── CHANGELOG.md              # 版本记录
│
├── electron/                 # Electron 主进程
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本
│   └── workspace.ts         # 工作区管理
│
├── src/                      # React 前端
│   ├── main.tsx             # React 入口
│   ├── App.tsx              # 主应用组件
│   ├── contexts/            # React Context
│   │   └── WorkspaceContext.tsx
│   ├── components/          # UI 组件
│   │   ├── Layout/          # 布局组件
│   │   ├── Search/          # 搜索组件
│   │   ├── Download/        # 下载组件
│   │   ├── Library/         # 图书管理组件
│   │   └── Settings/        # 设置组件
│   ├── services/            # API 调用
│   │   └── api.ts
│   └── styles/              # 样式文件
│       └── globals.css
│
├── backend/                  # Python 后端
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置模型
│   ├── api/                 # API 路由
│   │   ├── books.py         # 书籍 API
│   │   ├── download.py      # 下载 API
│   │   ├── chat.py          # 对话 API
│   │   ├── config.py        # 配置 API
│   │   └── workspace.py     # 工作区 API
│   ├── core/                # 核心模块
│   │   ├── catalog.py       # 目录处理
│   │   ├── matcher.py       # 匹配算法
│   │   └── downloader.py    # 下载器
│   └── requirements.txt     # Python 依赖
│
├── DOCUMENT/                 # 文档目录
│   └── DOCUMENT.md          # 开发文档
│
└── resources/               # 打包资源
    └── icon.ico
```

---

## 前端模块

### WorkspaceContext

**位置**: `src/contexts/WorkspaceContext.tsx`

**职责**: 管理工作区状态和全局数据。

```typescript
interface WorkspaceContextType {
  // 状态
  isWorkspaceOpen: boolean
  workspacePath: string | null
  workspaceData: WorkspaceData | null
  currentPage: PageType

  // 方法
  openWorkspace: (path: string) => Promise<void>
  closeWorkspace: () => void
  saveWorkspaceData: () => Promise<void>
  setCurrentPage: (page: PageType) => void

  // 数据操作
  addToPending: (books: PendingBook[]) => void
  removeFromPending: (ids: number[]) => void
  selectAllPending: (selected: boolean) => void
}
```

### 页面组件

| 组件 | 文件 | 说明 |
|------|------|------|
| WelcomePage | `components/Layout/WelcomePage.tsx` | 欢迎页，打开工作区 |
| AppLayout | `components/Layout/AppLayout.tsx` | 主布局 |
| Sidebar | `components/Layout/Sidebar.tsx` | 侧边导航栏 |
| SearchPage | `components/Search/SearchPage.tsx` | 搜索书籍页面 |
| DownloadPage | `components/Download/DownloadPage.tsx` | 下载管理页面 |
| LibraryPage | `components/Library/LibraryPage.tsx` | 图书管理页面（占位） |
| SettingsModal | `components/Settings/SettingsModal.tsx` | 设置弹窗 |

### Electron API

通过 `preload.ts` 暴露给渲染进程：

```typescript
window.electronAPI = {
  // 对话框
  openFolder: () => Promise<string | null>

  // 工作区
  openWorkspace: (folderPath: string) => Promise<WorkspaceData>
  getWorkspaceStatus: () => Promise<WorkspaceData | null>
  saveWorkspace: (data: WorkspaceData) => Promise<boolean>

  // 配置
  getConfig: () => Promise<Config>
  saveConfig: (config: Config) => Promise<boolean>

  // AI 上下文
  getAIContext: () => Promise<AIContext>
  saveAIContext: (context: AIContext) => Promise<boolean>
}
```

---

## 后端模块

### catalog.py - 目录处理

**位置**: `backend/core/catalog.py`

**职责**: 下载和解析 Gutenberg 目录 CSV。

```python
# 主要函数
def fetch_catalog(use_cache: bool = True) -> str
def parse_catalog(csv_text: str) -> list[dict]
def get_catalog(cache_only: bool = False) -> list[dict]
def search_books(catalog, title, author, language, limit) -> list[dict]
def get_cache_status() -> dict
```

**Gutenberg CSV 字段**:
- `Text#`: 书籍 ID
- `Title`: 书名
- `Authors`: 作者
- `Language`: 语言代码

### matcher.py - 匹配算法

**位置**: `backend/core/matcher.py`

**职责**: 书名/作者模糊匹配。

```python
def normalize_author(author: str) -> str      # 标准化作者名
def normalize_title(title: str) -> str        # 标准化书名
def match_author(input_author, catalog_author, threshold) -> Tuple[bool, float]
def match_title(input_title, catalog_title, threshold) -> Tuple[bool, float]
def validate_books(queries, catalog) -> dict
```

**匹配规则**:
- 作者匹配阈值: 80%
- 书名匹配阈值: 70%
- 综合评分: `title_score * 0.4 + author_score * 0.6`

### downloader.py - 下载器

**位置**: `backend/core/downloader.py`

**职责**: EPUB 文件下载。

```python
def sanitize_filename(filename: str) -> str
def get_epub_url(book_id: int, formats: dict) -> Optional[str]
def download_epub(book_id, title, output_dir, dry_run) -> dict
def batch_download(books, output_dir, dry_run, progress_callback) -> dict
```

**配置**:
- `DOWNLOAD_TIMEOUT = 30`
- `MAX_RETRIES = 3`
- `RATE_LIMIT_DELAY = 1`

---

## API 参考

### 书籍 API

```
GET  /api/books/search
```

参数:
- `title`: 书名 (可选)
- `author`: 作者 (可选)
- `language`: 语言代码，默认 "en"
- `limit`: 返回数量，默认 10

响应:
```json
{
  "results": [
    {
      "id": 1342,
      "title": "Pride and Prejudice",
      "author": "Austen, Jane",
      "language": "en",
      "matchScore": 100.0
    }
  ]
}
```

```
GET  /api/books/catalog/status
POST /api/books/catalog/refresh
```

### 下载 API

```
POST /api/download/start
```

请求:
```json
{
  "books": [
    { "id": 1342, "title": "Pride and Prejudice", "author": "Austen, Jane" }
  ],
  "outputDir": "/path/to/output"
}
```

响应: SSE 流

事件类型:
- `progress`: 下载进度
- `complete`: 下载完成

```
GET  /api/download/status
```

### 对话 API

```
POST /api/chat
```

请求:
```json
{
  "message": "推荐一些经典小说"
}
```

响应: SSE 流

### 配置 API

```
GET  /api/config
PUT  /api/config
```

---

## 数据模型

### WorkspaceData

```typescript
interface WorkspaceData {
  version: string
  createdAt: string
  updatedAt: string
  pendingDownloads: PendingBook[]
  currentBatch: number | null
  batches: Batch[]
}
```

### PendingBook

```typescript
interface PendingBook {
  id: number
  title: string
  author: string
  language: string
  selected: boolean
}
```

### Batch

```typescript
interface Batch {
  id: number
  name: string
  createdAt: string
  status: 'downloading' | 'completed' | 'failed'
  total: number
  success: number
  failed: number
  results: DownloadResult[]
}
```

### Config

```typescript
interface Config {
  llm: {
    apiKey: string
    model: string
    baseUrl: string
    temperature: number
    maxTokens: number
  }
  download: {
    concurrent: number
    timeout: number
  }
}
```

---

## 工作区数据

### 目录结构

打开工作区后，在根目录创建 `.bookweaver/` 目录：

```
工作区目录/
├── .bookweaver/
│   ├── config.json           # 用户配置
│   ├── workspace.json        # 工作区状态
│   ├── ai_context.json       # AI 对话上下文
│   └── downloads/            # 下载记录
│       ├── batch_1.json
│       └── batch_2.json
├── 下载1/                    # 批次1下载文件
└── 下载2/                    # 批次2下载文件
```

### workspace.json

```json
{
  "version": "1.0",
  "createdAt": "2026-03-26T10:00:00Z",
  "updatedAt": "2026-03-26T12:00:00Z",
  "pendingDownloads": [...],
  "currentBatch": null,
  "batches": [...]
}
```

### ai_context.json

```json
{
  "history": [
    { "role": "user", "content": "推荐一些经典小说" },
    { "role": "assistant", "content": "我推荐以下书籍..." }
  ],
  "bookList": [...]
}
```

---

## 开发指南

### 环境配置

```bash
# 克隆仓库
cd bookweaver-gui

# 安装前端依赖
npm install

# 安装后端依赖
cd backend
pip install -r requirements.txt
```

### 启动开发服务器

```bash
# 终端 1: 启动后端
cd backend
python -m uvicorn main:app --reload --port 8765

# 终端 2: 启动前端
npm run dev
```

### 打包

```bash
# macOS
npm run package:mac

# Windows
npm run package:win
```

### 代码规范

```bash
# 格式化 Python 代码
black backend/

# 检查 Python 代码
ruff check backend/

# 类型检查
mypy backend/
```

---

*最后更新：2026-03-26*