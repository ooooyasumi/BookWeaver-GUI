import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import { WelcomePage } from './components/Layout/WelcomePage'
import { AppLayout } from './components/Layout/AppLayout'

function AppContent() {
  const { isWorkspaceOpen } = useWorkspace()

  if (!isWorkspaceOpen) {
    return <WelcomePage />
  }

  return <AppLayout />
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <WorkspaceProvider>
        <AppContent />
      </WorkspaceProvider>
    </ConfigProvider>
  )
}

export default App