import React, { useState, useEffect, useRef } from 'react'
import { Input, Button, Table, Space, message, Checkbox, FloatButton, Modal, Drawer, Spin, Tag } from 'antd'
import { SearchOutlined, RobotOutlined, SendOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useWorkspace, PendingBook } from '../../contexts/WorkspaceContext'

interface BookResult {
  id: number
  title: string
  author: string
  language: string
  matchScore: number
}

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
  const { addToPending } = useWorkspace()
  const [searchTitle, setSearchTitle] = useState('')
  const [searchAuthor, setSearchAuthor] = useState('')
  const [searchResults, setSearchResults] = useState<BookResult[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [loading, setLoading] = useState(false)

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
        `/api/books/search?title=${encodeURIComponent(searchTitle)}&author=${encodeURIComponent(searchAuthor)}&limit=20`
      )
      const data = await response.json()
      setSearchResults(data.results || [])
      setSelectedRowKeys([])
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
        selected: true
      }))

    addToPending(selectedBooks)
    message.success(`已添加 ${selectedBooks.length} 本书籍到预下载列表`)
    setSelectedRowKeys([])
  }

  // AI 对话
  const handleAiSend = async () => {
    if (!aiInput.trim()) return

    const userMessage: Message = { role: 'user', content: aiInput }
    setAiMessages(prev => [...prev, userMessage])
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
      let hasContent = false

      // 先添加一条空的助手消息
      setAiMessages(prev => [...prev, { role: 'assistant', content: '', type: 'normal' }])

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // 解析 SSE 事件
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留未完成的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))

                if (event.type === 'token') {
                  hasContent = true
                  assistantContent += event.content
                  // 实时更新最后一条消息
                  setAiMessages(prev => {
                    const newMessages = [...prev]
                    const lastIdx = newMessages.length - 1
                    newMessages[lastIdx] = { role: 'assistant', content: assistantContent, type: 'normal' }
                    return newMessages
                  })
                } else if (event.type === 'tool_status') {
                  // 工具状态消息 - 显示为加载提示
                  setAiMessages(prev => [...prev, { role: 'assistant', content: '正在搜索...', type: 'tool_status' }])
                } else if (event.type === 'add_books') {
                  // 添加书籍到搜索结果
                  const books = event.books || []
                  if (books.length > 0) {
                    setSearchResults(books)
                    setSelectedRowKeys([])
                    // 添加工具执行结果消息
                    setAiMessages(prev => [...prev, { role: 'assistant', content: `已找到 ${books.length} 本书，请在列表中查看`, type: 'tool_result' }])
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
      }

      // 如果没有收到任何内容，更新最后一条消息
      if (!hasContent && assistantContent === '') {
        setAiMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = { role: 'assistant', content: '未收到回复，请检查 API Key 是否正确', type: 'normal' }
          return newMessages
        })
      }
    } catch (error) {
      message.error('AI 对话失败')
      console.error(error)
      setAiMessages(prev => [...prev, { role: 'assistant', content: '对话失败，请检查网络连接和配置' }])
    } finally {
      setAiLoading(false)
    }
  }

  // 表格列定义
  const columns: ColumnsType<BookResult> = [
    {
      title: '书名',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 200,
      ellipsis: true
    },
    {
      title: '语言',
      dataIndex: 'language',
      key: 'language',
      width: 80
    },
    {
      title: '匹配度',
      dataIndex: 'matchScore',
      key: 'matchScore',
      width: 100,
      render: (score: number) => (
        <Tag color={score >= 80 ? 'green' : score >= 60 ? 'orange' : 'default'}>
          {score}%
        </Tag>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    }
  }

  return (
    <div className="page-card">
      {/* 搜索栏 */}
      <div className="search-bar">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="书名"
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: '40%' }}
          />
          <Input
            placeholder="作者"
            value={searchAuthor}
            onChange={e => setSearchAuthor(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: '40%' }}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
          >
            搜索
          </Button>
        </Space.Compact>
      </div>

      {/* 操作栏 */}
      {searchResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Checkbox
              checked={selectedRowKeys.length === searchResults.length && searchResults.length > 0}
              indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < searchResults.length}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedRowKeys(searchResults.map(b => b.id))
                } else {
                  setSelectedRowKeys([])
                }
              }}
            >
              全选
            </Checkbox>
            <span>已选 {selectedRowKeys.length} 本</span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddToPending}
              disabled={selectedRowKeys.length === 0}
            >
              预下载
            </Button>
          </Space>
        </div>
      )}

      {/* 搜索结果表格 */}
      <Table
        className="book-table"
        columns={columns}
        dataSource={searchResults}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条`
        }}
        locale={{ emptyText: '输入书名或作者进行搜索' }}
      />

      {/* AI 悬浮按钮 */}
      <FloatButton
        icon={<RobotOutlined />}
        type="primary"
        onClick={() => setAiDrawerOpen(true)}
        tooltip="AI 助手"
      />

      {/* AI 对话抽屉 */}
      <Drawer
        title="AI 助手"
        placement="right"
        width={400}
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 消息列表 */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 12,
                  textAlign: msg.role === 'user' ? 'right' : 'left'
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: msg.type === 'tool_status' ? '#e6f7ff' : msg.type === 'tool_result' ? '#f6ffed' : msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    maxWidth: '80%',
                    wordBreak: 'break-word',
                    border: msg.type === 'tool_status' ? '1px dashed #1890ff' : msg.type === 'tool_result' ? '1px solid #b7eb8f' : 'none'
                  }}
                >
                  {msg.type === 'tool_status' && <Spin size="small" style={{ marginRight: 8 }} />}
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ textAlign: 'center' }}>
                <Spin size="small" />
              </div>
            )}
          </div>

          {/* 输入框 */}
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入消息..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onPressEnter={handleAiSend}
              disabled={aiLoading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAiSend}
              loading={aiLoading}
              disabled={!aiInput.trim()}
            />
          </Space.Compact>
        </div>
      </Drawer>
    </div>
  )
}
