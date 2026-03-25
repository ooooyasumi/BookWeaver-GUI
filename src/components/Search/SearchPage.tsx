import React, { useState } from 'react'
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
  role: 'user' | 'assistant'
  content: string
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiInput })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          assistantContent += chunk
        }
      }

      setAiMessages(prev => [...prev, { role: 'assistant', content: assistantContent }])
    } catch (error) {
      message.error('AI 对话失败')
      console.error(error)
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
                    background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.role === 'user' ? '#fff' : '#000'
                  }}
                >
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
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAiSend}
              loading={aiLoading}
            />
          </Space.Compact>
        </div>
      </Drawer>
    </div>
  )
}