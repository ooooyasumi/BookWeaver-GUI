import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 对话框
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // 工作区
  openWorkspace: (folderPath: string) => ipcRenderer.invoke('workspace:open', folderPath),
  getWorkspaceStatus: () => ipcRenderer.invoke('workspace:getStatus'),
  saveWorkspace: (data: unknown) => ipcRenderer.invoke('workspace:save', data),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),

  // AI 上下文
  getAIContext: () => ipcRenderer.invoke('ai:getContext'),
  saveAIContext: (context: unknown) => ipcRenderer.invoke('ai:saveContext', context),

  // Shell
  openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
})