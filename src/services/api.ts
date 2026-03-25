// API 调用封装

const API_BASE = '/api'

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