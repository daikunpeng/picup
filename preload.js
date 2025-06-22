const { contextBridge, ipcRenderer } = require('electron');

// 将一个名为 'electronAPI' 的对象暴露到全局的 window 对象上
contextBridge.exposeInMainWorld('electronAPI', {
  // 暴露一个名为 openFolderDialog 的函数
  // 当在渲染进程中调用 window.electronAPI.openFolderDialog() 时，
  // 它实际上会安全地触发主进程中名为 'open-folder-dialog' 的事件
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
}); 