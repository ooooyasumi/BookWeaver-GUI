import React, { useState, useEffect } from 'react'
import { Tabs, Table, Button, Progress, Space, message, Card, Typography, Tag, Empty, List, Collapse } from 'antd'
import { PlayCircleOutlined, DeleteOutlined, FolderOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useWorkspace, PendingBook, Batch, DownloadResult } from '../../contexts/WorkspaceContext'

const { Text, Title } = Typography
const { Panel } = Collapse

export function DownloadPage() {
  const {
    workspaceData,
    workspacePath,
    removeFromPending,
    selectAllPending,
    updatePendingSelection,
    addBatch,
    updateBatch
  } = useWorkspace()

  const [activeTab, setActiveTab] = useState('pending')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<Record<number, number>>({})
  const [currentBatchId, setCurrentBatchId] = useState<number | null>(null)
  const [currentDownloadBooks, setCurrentDownloadBooks] = useState<PendingBook[]>([])

  const pendingBooks = workspaceData?.pendingDownloads || []
  const batches = workspaceData?.batches || []

  // 开始下载
  const handleStartDownload = async () => {
    const selectedBooks = pendingBooks.filter(b => b.selected)
    if (selectedBooks.length === 0) {
      message.warning('请先选择要下载的书籍')
      return
    }

    // 创建新批次
    const batchId = batches.length + 1
    const batchName = `下载${batchId}`
    const newBatch: Batch = {
      id: batchId,
      name: batchName,
      createdAt: new Date().toISOString(),
      status: 'downloading',
      total: selectedBooks.length,
      success: 0,
      failed: 0,
      results: []
    }

    addBatch(newBatch)
    setCurrentBatchId(batchId)
    setCurrentDownloadBooks(selectedBooks) // 保存当前下载书籍
    setDownloading(true)
    setDownloadProgress({})
    setActiveTab('downloading')

    try {
      // 调用后端下载 API（SSE）
      const response = await fetch('/api/download/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          books: selectedBooks,
          outputDir: `${workspacePath}/${batchName}`
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          try {
            const event = JSON.parse(chunk)

            if (event.type === 'progress') {
              // 更新单本书进度
              setDownloadProgress(prev => ({
                ...prev,
                [event.bookId]: event.progress
              }))
            } else if (event.type === 'complete') {
              // 下载完成，更新批次信息
              updateBatch(batchId, {
                status: 'completed',
                success: event.success,
                failed: event.failed,
                results: event.results
              })
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 从预下载列表移除已下载的书籍
      removeFromPending(selectedBooks.map(b => b.id))
      message.success('下载完成')
    } catch (error) {
      message.error('下载失败')
      console.error(error)
      updateBatch(batchId, { status: 'failed' })
    } finally {
      setDownloading(false)
      setCurrentBatchId(null)
      setCurrentDownloadBooks([])
      setDownloadProgress({})
      setActiveTab('completed')
    }
  }

  // 预下载表格列
  const pendingColumns: ColumnsType<PendingBook> = [
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
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeFromPending([record.id])}
        />
      )
    }
  ]

  // 渲染预下载标签
  const renderPendingTab = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleStartDownload}
            disabled={pendingBooks.filter(b => b.selected).length === 0}
            loading={downloading}
          >
            开始下载
          </Button>
          <Text type="secondary">
            已选 {pendingBooks.filter(b => b.selected).length} / {pendingBooks.length} 本
          </Text>
        </Space>
      </div>

      <Table
        columns={pendingColumns}
        dataSource={pendingBooks}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: pendingBooks.filter(b => b.selected).map(b => b.id),
          onChange: (keys) => {
            pendingBooks.forEach(b => {
              updatePendingSelection(b.id, keys.includes(b.id))
            })
          }
        }}
        pagination={false}
        locale={{ emptyText: <Empty description="暂无待下载书籍" /> }}
      />
    </div>
  )

  // 渲染下载中标签
  const renderDownloadingTab = () => {
    if (!downloading || currentDownloadBooks.length === 0) {
      return <Empty description="暂无下载任务" />
    }

    const currentBatch = batches.find(b => b.id === currentBatchId)
    const totalProgress = currentDownloadBooks.length > 0
      ? Object.values(downloadProgress).reduce((a, b) => a + b, 0) / currentDownloadBooks.length
      : 0

    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Text>整体进度</Text>
          <Progress percent={Math.round(totalProgress)} />
        </Card>

        <List
          dataSource={currentDownloadBooks}
          renderItem={book => (
            <List.Item>
              <List.Item.Meta
                title={book.title}
                description={book.author}
              />
              <Progress
                percent={downloadProgress[book.id] || 0}
                status={downloadProgress[book.id] === 100 ? 'success' : 'active'}
                style={{ width: 200 }}
              />
            </List.Item>
          )}
        />
      </div>
    )
  }

  // 渲染已完成标签
  const renderCompletedTab = () => {
    if (batches.length === 0) {
      return <Empty description="暂无下载记录" />
    }

    return (
      <Collapse accordion>
        {batches.map(batch => (
          <Panel
            key={batch.id}
            header={
              <Space>
                <FolderOutlined />
                <Text strong>{batch.name}</Text>
                <Text type="secondary">({batch.createdAt.split('T')[0]})</Text>
                <Tag color="green">成功 {batch.success}</Tag>
                {batch.failed > 0 && <Tag color="red">失败 {batch.failed}</Tag>}
              </Space>
            }
          >
            <List
              dataSource={batch.results}
              renderItem={(result: DownloadResult) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      result.success
                        ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                    }
                    title={result.title}
                    description={result.success ? result.filePath : result.error}
                  />
                </List.Item>
              )}
            />
          </Panel>
        ))}
      </Collapse>
    )
  }

  const tabItems = [
    {
      key: 'pending',
      label: `预下载 (${pendingBooks.length})`,
      children: renderPendingTab()
    },
    {
      key: 'downloading',
      label: '下载中',
      children: renderDownloadingTab()
    },
    {
      key: 'completed',
      label: `已完成 (${batches.length})`,
      children: renderCompletedTab()
    }
  ]

  return (
    <div className="page-card">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  )
}