const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const Database = require('better-sqlite3');
const exifParser = require('exif-parser');

const store = new Store();
let db; // 全局数据库连接, 在 setupDatabase 中进行管理

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
      createdAt TEXT DEFAULT (datetime('now','localtime'))
    );
  `;
  db.exec(createTableSQL);

  // 简单的数据库迁移: 检查并为旧版数据库添加新列
  const columns = db.pragma('table_info(photos)');
  const hasTakenAt = columns.some(col => col.name === 'takenAt');
  const hasLocation = columns.some(col => col.name === 'location');

  if (!hasTakenAt) db.exec("ALTER TABLE photos ADD COLUMN takenAt TEXT;");
  if (!hasLocation) db.exec("ALTER TABLE photos ADD COLUMN location TEXT;");
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

ipcMain.handle('get-initial-data', () => {
  const projectPath = store.get('projectPath');
  if (projectPath && fs.existsSync(projectPath)) {
    setupDatabase(projectPath);
    const rows = db.prepare('SELECT filePath FROM photos ORDER BY createdAt DESC').all();
    const imagePaths = rows.map(row => row.filePath);
    return { projectPath, imagePaths };
  }
  return { projectPath: null, imagePaths: [] };
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
  // 即使是新工程, 也从数据库读取以保持逻辑一致
  const rows = db.prepare('SELECT filePath FROM photos ORDER BY createdAt DESC').all();
  const imagePaths = rows.map(row => row.filePath);
  return { projectPath, imagePaths };
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
  const copiedImagePaths = [];
  
  // 使用事务可以极大地提高批量插入的性能
  const insertStmt = db.prepare('INSERT OR IGNORE INTO photos (filePath, takenAt, location) VALUES (?, ?, ?)');
  const insertMany = db.transaction((photos) => {
    for (const photo of photos) {
      insertStmt.run(photo.filePath, photo.takenAt, photo.location);
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
      copiedImagePaths.push(destinationPath);
    } catch (err) {
      console.error(`Error copying ${fileName}:`, err);
    }
  }

  if (photosToInsert.length > 0) {
    insertMany(photosToInsert);
  }
  return copiedImagePaths;
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
    stmt.run(destinationPath, takenAt, location);
    return destinationPath;
  } catch (err) {
    console.error(`Error copying ${fileName}:`, err);
    return null;
  }
}); 