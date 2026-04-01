import { useState, useRef } from 'react'
import { Input, Button, Space, message, Checkbox, FloatButton, Drawer, Card } from 'antd'
import { SearchOutlined, MessageOutlined, SendOutlined, PlusOutlined } from '@ant-design/icons'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { BookList } from '../Common/BookList'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  type?: 'normal' | 'tool_status' | 'tool_result'
}

interface LLMConfig {
  apiKey: string
  model: string
  baseUrl: string
  temperature: number
  maxTokens: number
}

interface Config {
  llm: LLMConfig
}

export function SearchPage() {
  const {
    addToPending,
    searchResults,
    searchResultSelectedKeys,
    setSearchResults,
    appendSearchResults,
    removeFromSearchResults,
    clearSearchResults,
    toggleSearchResultSelection,
    selectAllSearchResults,
    clearSearchResultSelection
  } = useWorkspace()
  const [searchTitle, setSearchTitle] = useState('')
  const [searchAuthor, setSearchAuthor] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedRowKeys = searchResultSelectedKeys

  // AI 对话相关
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<Message[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // 搜索书籍
  const handleSearch = async () => {
    if (!searchTitle.trim() && !searchAuthor.trim()) {
      message.warning('请输入书名或作者')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/books/search?title=${encodeURIComponent(searchTitle)}&author=${encodeURIComponent(searchAuthor)}&limit=100`
      )
      const data = await response.json()
      setSearchResults(data.results || [])
      clearSearchResultSelection()
    } catch (error) {
      message.error('搜索失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 添加到预下载
  const handleAddToPending = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择书籍')
      return
    }

    const selectedBooks = searchResults
      .filter(book => selectedRowKeys.includes(book.id))
      .map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        language: book.language,
      }))

    addToPending(selectedBooks)
    message.success(`已添加 ${selectedBooks.length} 本书籍到预下载列表`)
    // 清空选择状态，但保留搜索结果列表
    clearSearchResultSelection()
  }

  // AI 对话
  const aiMessagesRef = useRef<Message[]>([])  // 与 aiMessages state 同步，用于读取当前长度

  const handleAiSend = async () => {
    if (!aiInput.trim()) return

    const userMessage: Message = { role: 'user', content: aiInput }
    setAiMessages(prev => {
      const next = [...prev, userMessage]
      aiMessagesRef.current = next
      return next
    })
    setAiInput('')
    setAiLoading(true)

    try {
      // 获取配置
      const config = await window.electronAPI.getConfig() as Config

      // 检查 API Key 是否配置
      if (!config?.llm?.apiKey) {
        message.error('请先在设置中配置 LLM API Key')
        setAiMessages(prev => [...prev, { role: 'assistant', content: '请先在设置中配置 LLM API Key' }])
        setAiLoading(false)
        return
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: aiInput,
          history: aiMessages,
          config: config.llm
        })
      })

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let totalAdded = 0

      // 用固定索引追踪两条特殊消息：状态消息 + 最终回复消息
      // 索引在首次插入时确定，后续原地更新，避免大批量时刷屏
      let statusMsgIdx = -1
      let replyMsgIdx = -1

      const insertStatusMsg = (text: string) => {
        statusMsgIdx = aiMessagesRef.current.length
        setAiMessages(prev => {
          const next = [...prev, { role: 'assistant' as const, content: text, type: 'tool_status' as const }]
          aiMessagesRef.current = next
          return next
        })
      }

      const updateStatusMsg = (text: string) => {
        setAiMessages(prev => {
          const msgs = [...prev]
          if (statusMsgIdx >= 0 && statusMsgIdx < msgs.length) {
            msgs[statusMsgIdx] = { role: 'assistant', content: text, type: 'tool_status' }
          }
          aiMessagesRef.current = msgs
          return msgs
        })
      }

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'token') {
                assistantContent += event.content
                if (replyMsgIdx === -1) {
                  // 第一个 token：新建回复消息
                  replyMsgIdx = aiMessagesRef.current.length
                  setAiMessages(prev => {
                    const next = [...prev, { role: 'assistant' as const, content: assistantContent, type: 'normal' as const }]
                    aiMessagesRef.current = next
                    return next
                  })
                } else {
                  // 后续 token：原地更新
                  setAiMessages(prev => {
                    const msgs = [...prev]
                    if (replyMsgIdx >= 0 && replyMsgIdx < msgs.length) {
                      msgs[replyMsgIdx] = { role: 'assistant', content: assistantContent, type: 'normal' }
                    }
                    aiMessagesRef.current = msgs
                    return msgs
                  })
                }

              } else if (event.type === 'tool_status') {
                const statusText = event.content || '正在处理...'
                if (statusMsgIdx === -1) {
                  insertStatusMsg(statusText)
                } else {
                  updateStatusMsg(statusText)
                }

              } else if (event.type === 'clear_results') {
                clearSearchResults()
                totalAdded = 0

              } else if (event.type === 'add_books') {
                const books = event.books || []
                if (books.length > 0) {
                  appendSearchResults(books)
                  totalAdded += books.length
                  if (statusMsgIdx !== -1) {
                    updateStatusMsg(`搜索中，已加入 ${totalAdded} 本书...`)
                  }
                }

              } else if (event.type === 'remove_books') {
                const ids = event.ids || []
                if (ids.length > 0) {
                  removeFromSearchResults(ids)
                }

              } else if (event.type === 'complete') {
                // 完成：把状态消息改为最终统计
                if (statusMsgIdx !== -1 && totalAdded > 0) {
                  setAiMessages(prev => {
                    const msgs = [...prev]
                    if (statusMsgIdx >= 0 && statusMsgIdx < msgs.length) {
                      msgs[statusMsgIdx] = {
                        role: 'assistant',
                        content: `共加入 ${totalAdded} 本书到列表`,
                        type: 'tool_result'
                      }
                    }
                    aiMessagesRef.current = msgs
                    return msgs
                  })
                }

              } else if (event.type === 'error') {
                message.error(event.content)
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      message.error('AI 对话失败')
      console.error(error)
      setAiMessages(prev => [...prev, { role: 'assistant', content: '对话失败，请检查网络连接和配置' }])
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      {/* 搜索卡片 */}
      <Card className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            placeholder="书名"
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            onPressEnter={handleSearch}
            style={{ flex: 2 }}
            size="large"
            allowClear
          />
          <Input
            placeholder="作者"
            value={searchAuthor}
            onChange={e => setSearchAuthor(e.target.value)}
            onPressEnter={handleSearch}
            style={{ flex: 1 }}
            size="large"
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            size="large"
            style={{ flexShrink: 0 }}
          >
            搜索
          </Button>
        </div>
      </Card>

      {/* 操作栏 */}
      {searchResults.length > 0 && (
        <Card className="card" style={{ marginBottom: 24 }}>
          <Space>
            <Checkbox
              checked={selectedRowKeys.length === searchResults.length && searchResults.length > 0}
              indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < searchResults.length}
              onChange={e => {
                selectAllSearchResults(e.target.checked)
              }}
            >
              全选
            </Checkbox>
            <span style={{ color: 'var(--text-secondary)' }}>
              已选 {selectedRowKeys.length} 本
            </span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddToPending}
              disabled={selectedRowKeys.length === 0}
            >
              预下载
            </Button>
            <Button
              onClick={clearSearchResultSelection}
              disabled={selectedRowKeys.length === 0}
            >
              清空
            </Button>
          </Space>
        </Card>
      )}

      {/* 搜索结果列表 */}
      <BookList
        type="search"
        data={searchResults}
        loading={loading}
        selectedRowKeys={selectedRowKeys}
        onSelectionChange={(keys) => {
          const clickedId = keys.find(k => !searchResultSelectedKeys.includes(k))
          if (clickedId) {
            toggleSearchResultSelection(clickedId)
          } else {
            const removedId = searchResultSelectedKeys.find(k => !keys.includes(k))
            if (removedId) {
              toggleSearchResultSelection(removedId)
            }
          }
        }}
      />

      {/* AI 悬浮按钮 */}
      <FloatButton
        icon={<MessageOutlined />}
        type="primary"
        onClick={() => setAiDrawerOpen(true)}
        tooltip="AI 助手"
        style={{ right: 32, bottom: 32 }}
      />

      {/* AI 对话抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageOutlined style={{ color: 'var(--accent-color)' }} />
            <span>AI 助手</span>
          </div>
        }
        placement="right"
        width={400}
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column' }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 消息列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {aiMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-tertiary)' }}>
                <MessageOutlined style={{ fontSize: 32, display: 'block', marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>向 AI 描述你想找的书籍</div>
              </div>
            )}
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 10,
                  textAlign: msg.role === 'user' ? 'right' : 'left'
                }}
              >
                <div
                  className={msg.role === 'user' ? 'ai-message-user' : msg.type === 'tool_status' ? 'ai-message-tool-status' : msg.type === 'tool_result' ? 'ai-message-tool-result' : 'ai-message-assistant'}
                  style={{
                    display: 'inline-block',
                    maxWidth: '85%',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ textAlign: 'left', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>AI 正在思考...</span>
              </div>
            )}
          </div>

          {/* 输入框 */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                placeholder="输入消息..."
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onPressEnter={handleAiSend}
                disabled={aiLoading}
                size="large"
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleAiSend}
                loading={aiLoading}
                disabled={!aiInput.trim()}
                size="large"
              />
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
