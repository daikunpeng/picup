const { contextBridge, ipcRenderer } = require('electron');

// 将一个名为 'electronAPI' 的对象暴露到全局的 window 对象上
contextBridge.exposeInMainWorld('electronAPI', {
  // 工程管理
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  // 文件导入
  importFolder: () => ipcRenderer.invoke('import-folder'),
  importSingleFile: () => ipcRenderer.invoke('import-single-file'),
}); 