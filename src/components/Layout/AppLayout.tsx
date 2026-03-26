import React, { useState } from 'react'
import { Layout, Typography, Button, Space } from 'antd'
import { SettingOutlined, FolderOutlined } from '@ant-design/icons'
import { Sidebar } from './Sidebar'
import { SearchPage } from '../Search/SearchPage'
import { DownloadPage } from '../Download/DownloadPage'
import { LibraryPage } from '../Library/LibraryPage'
import { SettingsModal } from '../Settings/SettingsModal'
import { useWorkspace } from '../../contexts/WorkspaceContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

export function AppLayout() {
  const { currentPage, workspacePath } = useWorkspace()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const renderContent = () => {
    switch (currentPage) {
      case 'search':
        return <SearchPage />
      case 'download':
        return <DownloadPage />
      case 'library':
        return <LibraryPage />
      default:
        return <SearchPage />
    }
  }

  return (
    <Layout className="app-layout">
      <Sider width={200} className="sidebar">
        <Sidebar />
      </Sider>
      <Layout>
        <Header
          className="title-bar"
          style={{
            background: '#fff',
            padding: '0 16px',
            height: 48,
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* 左侧留出 macOS 红黄绿按钮的空间 */}
          <div style={{ width: 70, flexShrink: 0 }} />

          {/* 中间显示工作区路径 */}
          <Text strong style={{ fontSize: 14 }}>
            <FolderOutlined style={{ marginRight: 8 }} />
            {workspacePath ? workspacePath.split('/').pop() : 'BookWeaver'}
          </Text>

          {/* 右侧设置按钮 */}
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
          />
        </Header>
        <Content className="content">
          {renderContent()}
        </Content>
      </Layout>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Layout>
  )
}