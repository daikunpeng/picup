const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const Database = require('better-sqlite3');
const exifParser = require('exif-parser');
const axios = require('axios');

const store = new Store();
let db; // 全局数据库连接, 在 setupDatabase 中进行管理
let processingQueue = [];
let isProcessing = false;

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * 设置或连接到指定工程路径的数据库.
 * 如果数据库或表不存在, 会自动创建.
 * 同时包含简单的 schema 升级逻辑.
 * @param {string} projectPath 工程文件夹的绝对路径
 */
function setupDatabase(projectPath) {
  if (db) {
    db.close();
  }
  const dbPath = path.join(projectPath, 'database.db');
  db = new Database(dbPath);
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS photos (
      photoId INTEGER PRIMARY KEY AUTOINCREMENT,
      filePath TEXT NOT NULL UNIQUE,
      takenAt TEXT,
      location TEXT,
      descriptionAI TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now','localtime'))
    );
  `;
  db.exec(createTableSQL);

  // 简单的数据库迁移: 检查并为旧版数据库添加新列
  const columns = db.pragma('table_info(photos)');
  const hasTakenAt = columns.some(col => col.name === 'takenAt');
  const hasLocation = columns.some(col => col.name === 'location');
  const hasDescriptionAI = columns.some(col => col.name === 'descriptionAI');
  const hasStatus = columns.some(col => col.name === 'status');

  if (!hasTakenAt) db.exec("ALTER TABLE photos ADD COLUMN takenAt TEXT;");
  if (!hasLocation) db.exec("ALTER TABLE photos ADD COLUMN location TEXT;");
  if (!hasDescriptionAI) db.exec("ALTER TABLE photos ADD COLUMN descriptionAI TEXT;");
  if (!hasStatus) db.exec("ALTER TABLE photos ADD COLUMN status TEXT DEFAULT 'pending';");
}

/**
 * 从图片文件路径解析出EXIF元数据.
 * @param {string} filePath 图片文件的绝对路径
 * @returns {{takenAt: string|null, location: string|null}}
 */
function parseExif(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = exifParser.create(buffer);
    const result = parser.parse();

    let takenAt = null;
    if (result.tags && result.tags.DateTimeOriginal) {
      const timestamp = result.tags.DateTimeOriginal * 1000;
      // 格式化为 'YYYY-MM-DD HH:MM:SS'
      takenAt = new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19);
    }

    let location = null;
    if (result.tags && result.tags.GPSLatitude && result.tags.GPSLongitude) {
      location = JSON.stringify({
        lat: result.tags.GPSLatitude,
        lon: result.tags.GPSLongitude,
      });
    }

    return { takenAt, location };
  } catch (err) {
    // 很多文件可能没有EXIF或数据已损坏, 静默处理并返回null是安全的.
    return { takenAt: null, location: null };
  }
}

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

// 创建设置窗口的函数
function createSettingsWindow() {
  const settingsWin = new BrowserWindow({
    width: 500,
    height: 350,
    title: '设置',
    parent: BrowserWindow.getAllWindows()[0], // 设置父窗口
    modal: true, // 模态窗口
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  settingsWin.loadFile('settings.html');
  settingsWin.setMenuBarVisibility(false); // 隐藏菜单栏
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

// -- IPC Handlers --

// 监听打开设置窗口的请求
ipcMain.handle('open-settings-window', () => {
  createSettingsWindow();
});

// 获取API配置
ipcMain.handle('get-api-config', () => {
  return {
    apiKey: store.get('apiKey'),
    endpointUrl: store.get('endpointUrl')
  };
});

// 保存API配置
ipcMain.handle('set-api-config', (event, config) => {
  store.set('apiKey', config.apiKey);
  store.set('endpointUrl', config.endpointUrl);
});

async function generateDescription(filePath) {
  try {
    const apiKey = store.get('apiKey');
    if (!apiKey) {
      throw new Error('API Key not configured.');
    }

    const imageBuffer = fs.readFileSync(filePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = `image/${path.extname(filePath).substring(1)}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: "为这张图片生成一个简洁、客观的描述。" },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }]
    };

    const response = await axios.post(url, payload);
    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Error generating description:', error.response ? error.response.data : error.message);
    return null;
  }
}

async function processQueue() {
  if (processingQueue.length === 0 || isProcessing) {
    return;
  }
  isProcessing = true;
  const { photoId, filePath } = processingQueue.shift();

  try {
    db.prepare("UPDATE photos SET status = 'processing' WHERE photoId = ?").run(photoId);
    
    const description = await generateDescription(filePath);
    
    if (description) {
      db.prepare("UPDATE photos SET descriptionAI = ?, status = 'completed' WHERE photoId = ?").run(description, photoId);
    } else {
      db.prepare("UPDATE photos SET status = 'failed' WHERE photoId = ?").run(photoId);
    }
  } catch (error) {
    console.error(`Failed to process photoId ${photoId}:`, error);
    db.prepare("UPDATE photos SET status = 'failed' WHERE photoId = ?").run(photoId);
  } finally {
    isProcessing = false;
    processQueue();
  }
}

function enqueuePhotos(photoIds) {
  const stmt = db.prepare("SELECT photoId, filePath FROM photos WHERE photoId = ? AND (status = 'pending' OR status = 'failed')");
  for (const photoId of photoIds) {
    const photo = stmt.get(photoId);
    if (photo && !processingQueue.some(p => p.photoId === photo.photoId)) {
      processingQueue.push(photo);
    }
  }
  processQueue();
}

ipcMain.handle('get-initial-data', () => {
  const projectPath = store.get('projectPath');
  if (projectPath && fs.existsSync(projectPath)) {
    setupDatabase(projectPath);
    const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status FROM photos ORDER BY createdAt DESC').all();
    enqueuePhotos(rows.map(r => r.photoId));
    return { projectPath, photos: rows };
  }
  return { projectPath: null, photos: [] };
});

ipcMain.handle('select-project-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const projectPath = filePaths[0];
  store.set('projectPath', projectPath);
  
  setupDatabase(projectPath);
  const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status FROM photos ORDER BY createdAt DESC').all();
  enqueuePhotos(rows.map(r => r.photoId));
  return { projectPath, photos: rows };
});

ipcMain.handle('import-folder', async () => {
  const projectPath = store.get('projectPath');
  if (!projectPath || !db) return [];

  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (canceled || filePaths.length === 0) {
    return [];
  }

  const sourceFolder = filePaths[0];
  const sourceImages = readImagesFromDirectory(sourceFolder);
  const newPhotos = [];
  
  // 使用事务可以极大地提高批量插入的性能
  const insertStmt = db.prepare('INSERT OR IGNORE INTO photos (filePath, takenAt, location) VALUES (?, ?, ?)');
  const transaction = db.transaction((photos) => {
    for (const photo of photos) {
      const info = insertStmt.run(photo.filePath, photo.takenAt, photo.location);
      if (info.changes > 0) {
        newPhotos.push({ photoId: info.lastInsertRowid, filePath: photo.filePath });
      }
    }
  });

  const photosToInsert = [];

  for (const sourcePath of sourceImages) {
    const fileName = path.basename(sourcePath);
    const destinationPath = path.join(projectPath, fileName);
    try {
      // 关键检查: 防止将工程目录重复导入到自身
      if (path.dirname(sourcePath).toLowerCase() !== projectPath.toLowerCase()) {
        fs.copyFileSync(sourcePath, destinationPath);
        const { takenAt, location } = parseExif(destinationPath);
        photosToInsert.push({ filePath: destinationPath, takenAt, location });
      }
    } catch (err) {
      console.error(`Error copying ${fileName}:`, err);
    }
  }

  if (photosToInsert.length > 0) {
    transaction(photosToInsert);
    enqueuePhotos(newPhotos.map(p => p.photoId));
  }
  
  // 返回所有新加入处理队列的照片的完整信息
  return newPhotos.map(p => ({...p, status: 'pending', descriptionAI: null}));
});

ipcMain.handle('import-single-file', async () => {
  const projectPath = store.get('projectPath');
  if (!projectPath || !db) return null;

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
    const { takenAt, location } = parseExif(destinationPath);
    const stmt = db.prepare('INSERT OR IGNORE INTO photos (filePath, takenAt, location) VALUES (?, ?, ?)');
    const info = stmt.run(destinationPath, takenAt, location);

    if (info.changes > 0) {
      enqueuePhotos([info.lastInsertRowid]);
      return { photoId: info.lastInsertRowid, filePath: destinationPath, status: 'pending', descriptionAI: null };
    }
    return null;
  } catch (err) {
    console.error(`Error copying ${fileName}:`, err);
    return null;
  }
});

ipcMain.handle('get-settings', () => {
  return {
    apiKey: store.get('apiKey'),
    endpointUrl: store.get('endpointUrl'),
    projectPath: store.get('projectPath')
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('apiKey', settings.apiKey);
  store.set('endpointUrl', settings.endpointUrl);
}); 