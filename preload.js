const { contextBridge, ipcRenderer } = require('electron');

// 将一个名为 'electronAPI' 的对象暴露到全局的 window 对象上
contextBridge.exposeInMainWorld('electronAPI', {
  // 工程管理
  getInitialData: () => ipcRenderer.invoke('get-initial-data'),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  // 文件导入
  importFolder: () => ipcRenderer.invoke('import-folder'),
  importSingleFile: () => ipcRenderer.invoke('import-single-file'),

  // 设置与配置
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  setApiConfig: (config) => ipcRenderer.invoke('set-api-config', config),

  // 实时状态更新
  getPhotosStatus: () => ipcRenderer.invoke('get-photos-status'),

  // 搜索功能
  searchPhotos: (query) => ipcRenderer.invoke('search-photos', query),

  // 调试功能
  debugGetDescriptions: () => ipcRenderer.invoke('debug-get-descriptions'),
}); 