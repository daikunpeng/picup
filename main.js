const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
// const Store = require('electron-store').default; // This might be needed for newer versions

const store = new Store();

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

// 辅助函数：从一个文件夹读取所有图片路径
function readImagesFromDirectory(dir) {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }
    const files = fs.readdirSync(dir);
    return files
      .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => path.join(dir, file));
  } catch (err) {
    console.error("Error reading directory:", err);
    return [];
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// -- 新的核心 IPC 处理器 --

// 获取初始数据 (工程路径和其中的图片)
ipcMain.handle('get-initial-data', () => {
  const projectPath = store.get('projectPath');
  if (projectPath && fs.existsSync(projectPath)) {
    const imagePaths = readImagesFromDirectory(projectPath);
    return { projectPath, imagePaths };
  }
  return { projectPath: null, imagePaths: [] };
});

// 选择并设置工程文件夹
ipcMain.handle('select-project-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const projectPath = filePaths[0];
  store.set('projectPath', projectPath);
  
  const imagePaths = readImagesFromDirectory(projectPath);
  return { projectPath, imagePaths };
});

// 导入并复制一个文件夹中的所有图片
ipcMain.handle('import-folder', async () => {
  const projectPath = store.get('projectPath');
  if (!projectPath) return [];

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return [];
  }

  const sourceFolder = filePaths[0];
  const sourceImages = readImagesFromDirectory(sourceFolder);
  const copiedImagePaths = [];

  for (const sourcePath of sourceImages) {
    const fileName = path.basename(sourcePath);
    const destinationPath = path.join(projectPath, fileName);
    try {
      // 避免复制到自身
      if (path.dirname(sourcePath) !== projectPath) {
        fs.copyFileSync(sourcePath, destinationPath);
      }
      copiedImagePaths.push(destinationPath);
    } catch (err) {
      console.error(`Error copying ${fileName}:`, err);
    }
  }
  return copiedImagePaths;
});

// 导入并复制单张图片
ipcMain.handle('import-single-file', async () => {
  const projectPath = store.get('projectPath');
  if (!projectPath) return null;

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: imageExtensions.map(e => e.substring(1)) }]
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const sourcePath = filePaths[0];
  const fileName = path.basename(sourcePath);
  const destinationPath = path.join(projectPath, fileName);

  try {
    fs.copyFileSync(sourcePath, destinationPath);
    return destinationPath;
  } catch (err) {
    console.error(`Error copying ${fileName}:`, err);
    return null;
  }
}); 