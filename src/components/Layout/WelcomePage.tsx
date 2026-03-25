import React, { useState, useCallback, DragEvent } from 'react'
import { Button, Typography, Space, message } from 'antd'
import { FolderOpenOutlined, FolderAddOutlined } from '@ant-design/icons'
import { useWorkspace } from '../../contexts/WorkspaceContext'

const { Title, Text } = Typography

export function WelcomePage() {
  const { openWorkspace, isLoading } = useWorkspace()
  const [isDragging, setIsDragging] = useState(false)

  const handleOpenFolder = async () => {
    try {
      const path = await window.electronAPI.openFolder()
      if (path) {
        await openWorkspace(path)
        message.success(`已打开工作区: ${path}`)
      }
    } catch (error) {
      message.error('打开工作区失败')
      console.error(error)
    }
  }

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const item = files[0]
      // 检查是否是文件夹
      if (item.path) {
        try {
          await openWorkspace(item.path)
          message.success(`已打开工作区: ${item.path}`)
        } catch (error) {
          message.error('打开工作区失败')
          console.error(error)
        }
      }
    }
  }, [openWorkspace])

  return (
    <div
      className={`drop-zone ${isDragging ? 'active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f0f2f5'
      }}
    >
      <Space direction="vertical" size="large" align="center">
        <div style={{ textAlign: 'center' }}>
          <Title level={2}>BookWeaver</Title>
          <Text type="secondary">Project Gutenberg 书籍下载工具</Text>
        </div>

        <div
          style={{
            padding: '48px 64px',
            border: '2px dashed #d9d9d9',
            borderRadius: 8,
            background: isDragging ? 'rgba(24, 144, 255, 0.05)' : '#fff',
            textAlign: 'center',
            transition: 'all 0.3s',
            borderColor: isDragging ? '#1890ff' : '#d9d9d9'
          }}
        >
          <Space direction="vertical" size="middle">
            <FolderAddOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Text>拖拽文件夹到此处，或点击下方按钮选择工作区</Text>
            <Button
              type="primary"
              size="large"
              icon={<FolderOpenOutlined />}
              onClick={handleOpenFolder}
              loading={isLoading}
            >
              打开工作区
            </Button>
          </Space>
        </div>

        <Text type="secondary" style={{ fontSize: 12 }}>
          工作区将用于存储下载的书籍和配置数据
        </Text>
      </Space>
    </div>
  )
}