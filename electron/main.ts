import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import { WorkspaceManager } from './workspace'

let mainWindow: BrowserWindow | null = null
let pythonProcess: ChildProcess | null = null
let workspaceManager: WorkspaceManager | null = null

const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function startPythonBackend() {
  const port = 8765

  if (isDev) {
    // 开发模式：假设用户手动启动后端
    console.log('开发模式：请手动启动后端 (npm run dev:backend)')
    return
  }

  // 生产模式：启动嵌入的 Python 后端
  const resourcesPath = process.resourcesPath
  const pythonPath = process.platform === 'win32'
    ? path.join(resourcesPath, 'python', 'python.exe')
    : path.join(resourcesPath, 'python', 'bin', 'python3')

  const backendPath = path.join(resourcesPath, 'backend')

  pythonProcess = spawn(pythonPath, [
    '-m', 'uvicorn', 'main:app',
    '--host', '127.0.0.1',
    '--port', String(port)
  ], {
    cwd: backendPath,
    stdio: 'inherit'
  })

  pythonProcess.on('error', (err) => {
    console.error('Python 后端启动失败:', err)
  })
}

function stopPythonBackend() {
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
}

// IPC 处理器

// 打开文件夹选择对话框
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// 打开工作区
ipcMain.handle('workspace:open', async (_event, folderPath: string) => {
  workspaceManager = new WorkspaceManager(folderPath)
  await workspaceManager.initialize()
  return workspaceManager.getData()
})

// 获取工作区状态
ipcMain.handle('workspace:getStatus', async () => {
  if (!workspaceManager) {
    return null
  }
  return workspaceManager.getData()
})

// 保存工作区数据
ipcMain.handle('workspace:save', async (_event, data: unknown) => {
  if (!workspaceManager) {
    throw new Error('没有打开的工作区')
  }
  workspaceManager.save(data)
  return true
})

// 获取配置
ipcMain.handle('config:get', async () => {
  if (!workspaceManager) {
    return null
  }
  return workspaceManager.getConfig()
})

// 保存配置
ipcMain.handle('config:save', async (_event, config: unknown) => {
  if (!workspaceManager) {
    throw new Error('没有打开的工作区')
  }
  workspaceManager.saveConfig(config)
  return true
})

// 获取 AI 上下文
ipcMain.handle('ai:getContext', async () => {
  if (!workspaceManager) {
    return null
  }
  return workspaceManager.getAIContext()
})

// 保存 AI 上下文
ipcMain.handle('ai:saveContext', async (_event, context: unknown) => {
  if (!workspaceManager) {
    throw new Error('没有打开的工作区')
  }
  workspaceManager.saveAIContext(context)
  return true
})

// 在文件管理器中打开
ipcMain.handle('shell:openPath', async (_event, path: string) => {
  shell.openPath(path)
})

// 应用生命周期
app.whenReady().then(() => {
  startPythonBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopPythonBackend()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopPythonBackend()
})