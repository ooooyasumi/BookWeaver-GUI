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
        className="title-bar-drag"
        style={{
          height: 52,
          flex: '0 0 52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: 80,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>📖</span>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
            BookWeaver
          </span>
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 12px 0' }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            border: 'none',
            background: 'transparent',
          }}
        />
      </div>
      <div
        style={{
          padding: '12px 16px',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.5px'
        }}
      >
        v0.1.1
      </div>
    </div>
  )
}
