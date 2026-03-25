import fs from 'fs'
import path from 'path'

const WORKSPACE_DIR = '.bookweaver'
const CONFIG_FILE = 'config.json'
const WORKSPACE_FILE = 'workspace.json'
const AI_CONTEXT_FILE = 'ai_context.json'
const DOWNLOADS_DIR = 'downloads'

interface WorkspaceData {
  version: string
  createdAt: string
  updatedAt: string
  pendingDownloads: PendingBook[]
  currentBatch: number | null
  batches: Batch[]
}

interface PendingBook {
  id: number
  title: string
  author: string
  language: string
  selected: boolean
}

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

interface DownloadResult {
  bookId: number
  title: string
  success: boolean
  filePath?: string
  error?: string
}

interface AIContext {
  history: Array<{ role: string; content: string }>
  bookList: PendingBook[]
}

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

const DEFAULT_CONFIG: Config = {
  llm: {
    apiKey: '',
    model: 'qwen3.5-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    temperature: 0.7,
    maxTokens: 2000
  },
  download: {
    concurrent: 3,
    timeout: 30
  }
}

const DEFAULT_WORKSPACE: WorkspaceData = {
  version: '1.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pendingDownloads: [],
  currentBatch: null,
  batches: []
}

const DEFAULT_AI_CONTEXT: AIContext = {
  history: [],
  bookList: []
}

export class WorkspaceManager {
  private basePath: string
  private workspacePath: string

  constructor(folderPath: string) {
    this.basePath = folderPath
    this.workspacePath = path.join(folderPath, WORKSPACE_DIR)
  }

  async initialize(): Promise<void> {
    // 创建 .bookweaver 目录
    if (!fs.existsSync(this.workspacePath)) {
      fs.mkdirSync(this.workspacePath, { recursive: true })
    }

    // 创建 downloads 子目录
    const downloadsPath = path.join(this.workspacePath, DOWNLOADS_DIR)
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true })
    }

    // 初始化默认文件
    const configPath = path.join(this.workspacePath, CONFIG_FILE)
    if (!fs.existsSync(configPath)) {
      this.saveConfig(DEFAULT_CONFIG)
    }

    const workspaceFilePath = path.join(this.workspacePath, WORKSPACE_FILE)
    if (!fs.existsSync(workspaceFilePath)) {
      this.save(DEFAULT_WORKSPACE)
    }

    const aiContextPath = path.join(this.workspacePath, AI_CONTEXT_FILE)
    if (!fs.existsSync(aiContextPath)) {
      this.saveAIContext(DEFAULT_AI_CONTEXT)
    }
  }

  getData(): WorkspaceData {
    const filePath = path.join(this.workspacePath, WORKSPACE_FILE)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return DEFAULT_WORKSPACE
    }
  }

  save(data: unknown): void {
    const filePath = path.join(this.workspacePath, WORKSPACE_FILE)
    const workspaceData = {
      ...(data as WorkspaceData),
      updatedAt: new Date().toISOString()
    }
    fs.writeFileSync(filePath, JSON.stringify(workspaceData, null, 2))
  }

  getConfig(): Config {
    const filePath = path.join(this.workspacePath, CONFIG_FILE)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
    } catch {
      return DEFAULT_CONFIG
    }
  }

  saveConfig(config: unknown): void {
    const filePath = path.join(this.workspacePath, CONFIG_FILE)
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2))
  }

  getAIContext(): AIContext {
    const filePath = path.join(this.workspacePath, AI_CONTEXT_FILE)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return DEFAULT_AI_CONTEXT
    }
  }

  saveAIContext(context: unknown): void {
    const filePath = path.join(this.workspacePath, AI_CONTEXT_FILE)
    fs.writeFileSync(filePath, JSON.stringify(context, null, 2))
  }

  saveBatch(id: number, data: Batch): void {
    const downloadsPath = path.join(this.workspacePath, DOWNLOADS_DIR)
    const filePath = path.join(downloadsPath, `batch_${id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  getBatch(id: number): Batch | null {
    const downloadsPath = path.join(this.workspacePath, DOWNLOADS_DIR)
    const filePath = path.join(downloadsPath, `batch_${id}.json`)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  getBasePath(): string {
    return this.basePath
  }

  getWorkspacePath(): string {
    return this.workspacePath
  }
}