import React from 'react'
import { Menu } from 'antd'
import { SearchOutlined, DownloadOutlined, BookOutlined } from '@ant-design/icons'
import { useWorkspace, PageType } from '../../contexts/WorkspaceContext'

const menuItems = [
  {
    key: 'search',
    icon: <SearchOutlined />,
    label: '搜索书籍'
  },
  {
    key: 'download',
    icon: <DownloadOutlined />,
    label: '下载管理'
  },
  {
    key: 'library',
    icon: <BookOutlined />,
    label: '图书管理'
  }
]

export function Sidebar() {
  const { currentPage, setCurrentPage } = useWorkspace()

  const handleMenuClick = ({ key }: { key: string }) => {
    setCurrentPage(key as PageType)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        className="drag-region"
        style={{
          height: 48,
          flex: '0 0 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 70 }}>
          BookWeaver
        </span>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[currentPage]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ flex: 1, border: 'none' }}
      />
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 12
        }}
      >
        v1.0.0
      </div>
    </div>
  )
}