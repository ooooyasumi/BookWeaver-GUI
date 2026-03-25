import React, { useState } from 'react'
import { Layout, Typography, Button, Space } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
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
          style={{
            background: '#fff',
            padding: '0 24px',
            height: 48,
            lineHeight: '48px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text strong style={{ fontSize: 14 }}>
            {workspacePath}
          </Text>
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