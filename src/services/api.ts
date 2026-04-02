// API 调用封装
// 开发模式：/api（由 Vite dev server proxy 转发到 8765）
// 打包后：file:// 协议，必须用绝对地址直连后端
const API_BASE = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8765/api'
  : '/api'

// 书籍搜索
export async function searchBooks(params: {
  title?: string
  author?: string
  language?: string
  limit?: number
}): Promise<{
  results: Array<{
    id: number
    title: string
    author: string
    language: string
    matchScore: number
  }>
}> {
  const query = new URLSearchParams()
  if (params.title) query.append('title', params.title)
  if (params.author) query.append('author', params.author)
  if (params.language) query.append('language', params.language)
  if (params.limit) query.append('limit', String(params.limit))

  const response = await fetch(`${API_BASE}/books/search?${query}`)
  if (!response.ok) throw new Error('搜索失败')
  return response.json()
}

// 目录状态
export async function getCatalogStatus(): Promise<{
  cached: boolean
  lastUpdate: string | null
  totalBooks: number
}> {
  const response = await fetch(`${API_BASE}/books/catalog/status`)
  if (!response.ok) throw new Error('获取目录状态失败')
  return response.json()
}

// 刷新目录
export async function refreshCatalog(): Promise<void> {
  const response = await fetch(`${API_BASE}/books/catalog/refresh`, { method: 'POST' })
  if (!response.ok) throw new Error('刷新目录失败')
}

// 开始下载 (SSE)
export async function startDownload(
  books: Array<{ id: number; title: string; author: string; language: string }>,
  outputDir: string,
  onProgress: (bookId: number, progress: number) => void,
  onComplete: (result: { success: number; failed: number; results: Array<{
    bookId: number
    title: string
    success: boolean
    filePath?: string
    error?: string
  }> }) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/download/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ books, outputDir })
  })

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'progress') {
            onProgress(data.bookId, data.progress)
          } else if (data.type === 'complete') {
            onComplete(data)
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

// AI 对话 (SSE)
export async function* chatStream(
  message: string,
  onToken: (token: string) => void
): AsyncGenerator<string> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'token') {
            onToken(data.content)
            fullContent += data.content
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  yield fullContent
}

// 获取配置
export async function getConfig(): Promise<{
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
}> {
  const response = await fetch(`${API_BASE}/config`)
  if (!response.ok) throw new Error('获取配置失败')
  return response.json()
}

// 保存配置
export async function saveConfig(config: unknown): Promise<void> {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  if (!response.ok) throw new Error('保存配置失败')
}

// ─── Library API ─────────────────────────────────────────────────────────────

export interface EpubMetadata {
  filePath: string
  fileName: string
  fileSize: number
  title: string | null
  author: string | null
  language: string | null
  subjects: string[]
  publishYear: number | null
  error: string | null
  relativePath?: string
}

export interface EpubDetail {
  filePath: string
  description: string | null
  coverBase64: string | null
  coverMediaType: string | null
  publisher: string | null
  rights: string | null
  identifier: string | null
  error: string | null
}

export interface LibraryFilesResponse {
  files: EpubMetadata[]
  tree: Record<string, unknown>
  total: number
}

export interface CategoryGroup {
  name: string
  count: number
  books: EpubMetadata[]
}

// 获取工作区目录下的所有 EPUB 文件（使用索引）
export async function getLibraryFiles(workspacePath: string): Promise<LibraryFilesResponse> {
  const query = new URLSearchParams({ workspacePath })
  const response = await fetch(`${API_BASE}/library/files?${query}`)
  if (!response.ok) throw new Error('获取图书列表失败')
  return response.json()
}

// 按分类筛选书籍
export async function getLibraryBySubject(workspacePath: string): Promise<{
  categories: CategoryGroup[]
  total: number
}> {
  const query = new URLSearchParams({ workspacePath })
  const response = await fetch(`${API_BASE}/library/filter/subject?${query}`)
  if (!response.ok) throw new Error('获取分类失败')
  return response.json()
}

// 按出版年份筛选书籍
export async function getLibraryByYear(workspacePath: string): Promise<{
  categories: CategoryGroup[]
  total: number
}> {
  const query = new URLSearchParams({ workspacePath })
  const response = await fetch(`${API_BASE}/library/filter/year?${query}`)
  if (!response.ok) throw new Error('获取年份分类失败')
  return response.json()
}

// 获取单个书籍详情（封面 + 简介，动态读取）
export async function getBookDetail(filePath: string): Promise<EpubDetail> {
  const query = new URLSearchParams({ filePath })
  const response = await fetch(`${API_BASE}/library/detail?${query}`)
  if (!response.ok) throw new Error('获取书籍详情失败')
  return response.json()
}

// 强制重建索引
export async function reindexLibrary(workspacePath: string): Promise<{
  success: boolean
  total: number
  error?: string
}> {
  const query = new URLSearchParams({ workspacePath })
  const response = await fetch(`${API_BASE}/library/reindex?${query}`, { method: 'POST' })
  if (!response.ok) throw new Error('重建索引失败')
  return response.json()
}