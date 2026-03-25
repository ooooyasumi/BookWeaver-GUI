# BookWeaver GUI

Project Gutenberg 书籍下载工具 - GUI 版本

## 功能特性

- 📁 **工作区模式**: 类似编辑器的工作区管理，数据持久化
- 🔍 **书籍搜索**: 按书名/作者搜索 Gutenberg 目录（77,000+ 书籍）
- 🤖 **AI 助手**: 自然语言交互，智能推荐书籍（待完善）
- ⬇️ **批量下载**: 支持批量下载和进度跟踪
- 📊 **下载管理**: 预下载、下载中、已完成三态管理
- ⚙️ **设置**: LLM API 配置、下载设置

## 技术栈

- **前端**: Electron + React + TypeScript + Ant Design
- **后端**: Python FastAPI
- **通信**: HTTP REST + SSE

## 项目结构

```
bookweaver-gui/
├── electron/          # Electron 主进程
│   ├── main.ts       # 主进程入口
│   ├── preload.ts    # 预加载脚本
│   └── workspace.ts  # 工作区管理
├── src/              # React 前端
│   ├── components/   # UI 组件
│   ├── contexts/     # React Context
│   └── services/     # API 调用
├── backend/          # Python FastAPI 后端
│   ├── api/          # API 路由
│   └── core/         # 核心功能
└── resources/        # 打包资源
```

## 开发

### 环境要求

- Node.js 18+
- Python 3.9+

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd backend
pip install -r requirements.txt
```

### 启动开发服务器

```bash
# 启动后端 (终端 1)
cd backend
python -m uvicorn main:app --reload --port 8765

# 启动前端 (终端 2)
npm run dev
```

## API 端点

### 书籍搜索
- `GET /api/books/search` - 搜索书籍
- `GET /api/books/catalog/status` - 目录缓存状态
- `POST /api/books/catalog/refresh` - 刷新目录

### 下载管理
- `POST /api/download/start` - 开始下载 (SSE)
- `GET /api/download/status` - 下载状态

### 对话
- `POST /api/chat` - AI 对话 (SSE)

### 配置
- `GET /api/config` - 获取配置
- `PUT /api/config` - 保存配置

## 打包

```bash
# macOS
npm run package:mac

# Windows
npm run package:win
```

## 工作区数据

打开工作区后，会在根目录创建 `.bookweaver/` 目录：

```
.bookweaver/
├── config.json        # 用户配置
├── workspace.json     # 工作区状态
├── ai_context.json    # AI 对话上下文
└── downloads/         # 下载记录
```

## 许可证

MIT