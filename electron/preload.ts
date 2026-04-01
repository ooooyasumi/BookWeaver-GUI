import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 对话框
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // 工作区
  openWorkspace: (folderPath: string) => ipcRenderer.invoke('workspace:open', folderPath),
  getWorkspaceStatus: () => ipcRenderer.invoke('workspace:getStatus'),
  saveWorkspace: (data: unknown) => ipcRenderer.invoke('workspace:save', data),

  // 批次 meta
  getBatchMeta: (batchId: number) => ipcRenderer.invoke('workspace:getBatchMeta', batchId),
  saveBatchMeta: (meta: unknown) => ipcRenderer.invoke('workspace:saveBatchMeta', meta),
  nextBatchId: () => ipcRenderer.invoke('workspace:nextBatchId'),

  // 配置
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config: unknown) => ipcRenderer.invoke('config:save', config),

  // Shell
  openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
})
