const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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
  
  // 设置数据库编码为 UTF-8
  db.pragma('encoding = "UTF-8"');
  
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

  // 创建FTS5全文搜索表
  const createFTSTableSQL = `
    CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
      photoId UNINDEXED,
      descriptionAI,
      tokenize='unicode61 remove_diacritics 0'
    );
  `;
  db.exec(createFTSTableSQL);

  // 简单的数据库迁移: 检查并为旧版数据库添加新列
  const columns = db.pragma('table_info(photos)');
  const hasTakenAt = columns.some(col => col.name === 'takenAt');
  const hasLocation = columns.some(col => col.name === 'location');
  const hasDescriptionAI = columns.some(col => col.name === 'descriptionAI');
  const hasStatus = columns.some(col => col.name === 'status');
  const hasIsEdited = columns.some(col => col.name === 'isEdited');
  const hasDescriptionOriginal = columns.some(col => col.name === 'descriptionOriginal');

  if (!hasTakenAt) db.exec("ALTER TABLE photos ADD COLUMN takenAt TEXT;");
  if (!hasLocation) db.exec("ALTER TABLE photos ADD COLUMN location TEXT;");
  if (!hasDescriptionAI) db.exec("ALTER TABLE photos ADD COLUMN descriptionAI TEXT;");
  if (!hasStatus) db.exec("ALTER TABLE photos ADD COLUMN status TEXT DEFAULT 'pending';");
  if (!hasIsEdited) db.exec("ALTER TABLE photos ADD COLUMN isEdited BOOLEAN DEFAULT FALSE;");
  if (!hasDescriptionOriginal) db.exec("ALTER TABLE photos ADD COLUMN descriptionOriginal TEXT;");

  // 填充FTS5表（针对已有的AI描述）
  try {
    const existingDescriptions = db.prepare("SELECT photoId, descriptionAI FROM photos WHERE descriptionAI IS NOT NULL AND descriptionAI != ''").all();
    if (existingDescriptions.length > 0) {
      const insertFTS = db.prepare("INSERT OR REPLACE INTO photos_fts(photoId, descriptionAI) VALUES (?, ?)");
      const transaction = db.transaction(() => {
        existingDescriptions.forEach(({ photoId, descriptionAI }) => {
          insertFTS.run(photoId, descriptionAI);
        });
      });
      transaction();
      console.log(`[DEBUG] 已将 ${existingDescriptions.length} 条现有描述同步到FTS5表`);
    }
  } catch (error) {
    console.error('[DEBUG] 填充FTS5表时出错:', error);
  }
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
    } else {
      // 如果没有拍摄时间，使用当前系统时间
      takenAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
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
    // 很多文件可能没有EXIF或数据已损坏，使用当前系统时间作为默认值
    const currentTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return { takenAt: currentTime, location: null };
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
    let endpointUrl = store.get('endpointUrl');
    if (!apiKey) {
      throw new Error('API Key not configured.');
    }
    if (!endpointUrl || !endpointUrl.trim()) {
      endpointUrl = 'https://api.moonshot.cn/v1/chat/completions';
    }
    const imageBuffer = fs.readFileSync(filePath);
    const imageBase64 = imageBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.bmp') mimeType = 'image/bmp';
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    const payload = {
      model: 'moonshot-v1-32k-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请用简体中文描述这张图片的主要内容，50字以内。' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    console.log('[DEBUG] Moonshot API request:', { endpointUrl, payload });
    const response = await axios.post(endpointUrl, payload, { headers });
    console.log('[DEBUG] Moonshot API response:', response.data);
    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0 &&
      response.data.choices[0].message &&
      response.data.choices[0].message.content
    ) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Moonshot API 返回内容为空或格式异常');
    }
  } catch (error) {
    console.error('[DEBUG] Error generating description:', error.response ? error.response.data : error.message);
    return null;
  }
}

async function processQueue() {
  console.log('[DEBUG] processQueue called. Queue length:', processingQueue.length, 'isProcessing:', isProcessing);
  if (processingQueue.length === 0 || isProcessing) {
    return;
  }
  isProcessing = true;
  const { photoId, filePath } = processingQueue.shift();
  console.log(`[DEBUG] Start processing photoId=${photoId}, filePath=${filePath}`);

  try {
    db.prepare("UPDATE photos SET status = 'processing' WHERE photoId = ?").run(photoId);
    console.log(`[DEBUG] Set status=processing for photoId=${photoId}`);
    await new Promise(r => setTimeout(r, 1200));
    const description = await generateDescription(filePath);
    console.log(`[DEBUG] AI description result for photoId=${photoId}:`, description);
    if (description) {
      // 使用事务确保数据一致性
      const updateTransaction = db.transaction(() => {
        db.prepare("UPDATE photos SET descriptionAI = ?, status = 'completed' WHERE photoId = ?").run(description, photoId);
        // 更新FTS5索引
        db.prepare("INSERT OR REPLACE INTO photos_fts(photoId, descriptionAI) VALUES (?, ?)").run(photoId, description);
      });
      updateTransaction();
      console.log(`[DEBUG] Set status=completed, descriptionAI and FTS index updated for photoId=${photoId}`);
    } else {
      db.prepare("UPDATE photos SET status = 'failed' WHERE photoId = ?").run(photoId);
      console.log(`[DEBUG] Set status=failed for photoId=${photoId}`);
    }
  } catch (error) {
    console.error(`[DEBUG] Failed to process photoId ${photoId}:`, error);
    db.prepare("UPDATE photos SET status = 'failed' WHERE photoId = ?").run(photoId);
  } finally {
    isProcessing = false;
    processQueue();
  }
}

function enqueuePhotos(photoIds) {
  console.log('[DEBUG] enqueuePhotos called with photoIds:', photoIds);
  const stmt = db.prepare("SELECT photoId, filePath FROM photos WHERE photoId = ? AND (status = 'pending' OR status = 'failed')");
  for (const photoId of photoIds) {
    const photo = stmt.get(photoId);
    if (photo && !processingQueue.some(p => p.photoId === photo.photoId)) {
      processingQueue.push(photo);
      console.log(`[DEBUG] Photo enqueued: photoId=${photo.photoId}, filePath=${photo.filePath}`);
    }
  }
  console.log('[DEBUG] Current processingQueue:', processingQueue.map(p => p.photoId));
  processQueue();
}

ipcMain.handle('get-initial-data', () => {
  const projectPath = store.get('projectPath');
  if (projectPath && fs.existsSync(projectPath)) {
    setupDatabase(projectPath);
    const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal FROM photos ORDER BY createdAt DESC').all();
    // 只获取需要处理的图片ID
    const pendingPhotoIds = db.prepare("SELECT photoId FROM photos WHERE status = 'pending' OR status = 'failed'").all().map(r => r.photoId);
    if (pendingPhotoIds.length > 0) {
      enqueuePhotos(pendingPhotoIds);
    }
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
  const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal FROM photos ORDER BY createdAt DESC').all();
  // 只获取需要处理的图片ID
  const pendingPhotoIds = db.prepare("SELECT photoId FROM photos WHERE status = 'pending' OR status = 'failed'").all().map(r => r.photoId);
  if (pendingPhotoIds.length > 0) {
    enqueuePhotos(pendingPhotoIds);
  }
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

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[DEBUG] Error opening external URL:', error);
    return { success: false, error: error.message };
  }
}); 

// 获取照片更新状态
ipcMain.handle('get-photos-status', () => {
  if (!db) return [];
  try {
    const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal FROM photos ORDER BY createdAt DESC').all();
    return rows;
  } catch (error) {
    console.error('[DEBUG] Error getting photos status:', error);
    return [];
  }
});

// 调试：获取数据库中的描述数据
ipcMain.handle('debug-get-descriptions', () => {
  if (!db) return [];
  try {
    const descriptions = db.prepare('SELECT photoId, descriptionAI FROM photos WHERE descriptionAI IS NOT NULL AND descriptionAI != ""').all();
    console.log('[DEBUG] Database descriptions:');
    descriptions.forEach((desc, index) => {
      console.log(`[DEBUG] ${index + 1}. PhotoID ${desc.photoId}: "${desc.descriptionAI}"`);
      // 检查每个字符的编码
      const chars = Array.from(desc.descriptionAI);
      console.log(`[DEBUG]   Length: ${chars.length}, First 5 chars: ${chars.slice(0, 5).map(c => `${c}(${c.charCodeAt(0)})`).join(', ')}`);
    });
    return descriptions;
  } catch (error) {
    console.error('[DEBUG] Error getting descriptions:', error);
    return [];
  }
});

// 更新照片描述（用户编辑）
ipcMain.handle('update-photo-description', async (event, photoId, newDescription) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  
  try {
    const updateTransaction = db.transaction(() => {
      // 检查是否首次编辑，如果是则保存原始AI描述
      const photo = db.prepare('SELECT descriptionAI, isEdited FROM photos WHERE photoId = ?').get(photoId);
      
      if (photo && !photo.isEdited && photo.descriptionAI) {
        // 首次编辑，保存原始描述
        db.prepare('UPDATE photos SET descriptionOriginal = ? WHERE photoId = ?').run(photo.descriptionAI, photoId);
        console.log(`[DEBUG] Saved original description for photoId=${photoId}`);
      }
      
      // 更新描述和编辑状态
      db.prepare('UPDATE photos SET descriptionAI = ?, isEdited = TRUE WHERE photoId = ?').run(newDescription, photoId);
      
      // 更新FTS5索引
      db.prepare('INSERT OR REPLACE INTO photos_fts(photoId, descriptionAI) VALUES (?, ?)').run(photoId, newDescription);
      
      console.log(`[DEBUG] Updated description for photoId=${photoId}, isEdited=true`);
    });
    
    updateTransaction();
    return { success: true };
  } catch (error) {
    console.error('[DEBUG] Error updating photo description:', error);
    return { success: false, error: error.message };
  }
});

// 恢复AI原始描述
ipcMain.handle('restore-ai-description', async (event, photoId) => {
  if (!db) return { success: false, error: 'Database not initialized' };
  
  try {
    const photo = db.prepare('SELECT descriptionOriginal, isEdited FROM photos WHERE photoId = ?').get(photoId);
    
    if (!photo || !photo.isEdited || !photo.descriptionOriginal) {
      return { success: false, error: 'No original description to restore' };
    }
    
    const restoreTransaction = db.transaction(() => {
      // 恢复原始描述
      db.prepare('UPDATE photos SET descriptionAI = ?, isEdited = FALSE WHERE photoId = ?').run(photo.descriptionOriginal, photoId);
      
      // 更新FTS5索引
      db.prepare('INSERT OR REPLACE INTO photos_fts(photoId, descriptionAI) VALUES (?, ?)').run(photoId, photo.descriptionOriginal);
      
      console.log(`[DEBUG] Restored original description for photoId=${photoId}`);
    });
    
    restoreTransaction();
    return { success: true };
  } catch (error) {
    console.error('[DEBUG] Error restoring AI description:', error);
    return { success: false, error: error.message };
  }
});

// 搜索照片描述
ipcMain.handle('search-photos', (event, searchQuery) => {
  if (!db) return [];
  try {
    if (!searchQuery || searchQuery.trim() === '') {
      // 空搜索返回所有照片
      const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal FROM photos ORDER BY createdAt DESC').all();
      return rows;
    }

    // 调试：检查数据库中的数据
    const allDescriptions = db.prepare('SELECT photoId, descriptionAI FROM photos WHERE descriptionAI IS NOT NULL LIMIT 3').all();
    console.log('[DEBUG] Sample descriptions from DB:');
    allDescriptions.forEach(desc => {
      // 使用JSON.stringify确保正确显示Unicode字符
      console.log(`  PhotoID ${desc.photoId}: ${JSON.stringify(desc.descriptionAI)}`);
    });

    // 搜索策略：先用LIKE（更可靠），再尝试FTS5
    let rows = [];
    
    // 策略1：使用LIKE搜索（最可靠）
    const likeSearchSQL = `
      SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal, descriptionAI as highlightedDescription
      FROM photos 
      WHERE descriptionAI LIKE ? AND descriptionAI IS NOT NULL
      ORDER BY createdAt DESC
    `;
    
    const likeQuery = `%${searchQuery}%`;
    console.log(`[DEBUG] LIKE search for: ${JSON.stringify(likeQuery)}`);
    rows = db.prepare(likeSearchSQL).all(likeQuery);
    console.log(`[DEBUG] LIKE search results: ${rows.length}`);
    
    // 如果LIKE搜索没有结果，尝试FTS5
    if (rows.length === 0) {
      try {
        const ftsSearchSQL = `
          SELECT p.photoId, p.filePath, p.descriptionAI, p.status, p.isEdited, p.descriptionOriginal,
                 snippet(photos_fts, 1, '<mark>', '</mark>', '...', 32) as highlightedDescription
          FROM photos_fts 
          JOIN photos p ON photos_fts.photoId = p.photoId
          WHERE photos_fts MATCH ?
          ORDER BY rank
        `;
        
        console.log(`[DEBUG] Trying FTS5 search for: ${JSON.stringify(searchQuery)}`);
        rows = db.prepare(ftsSearchSQL).all(searchQuery);
        console.log(`[DEBUG] FTS5 search results: ${rows.length}`);
      } catch (ftsError) {
        console.log(`[DEBUG] FTS5 search failed: ${ftsError.message}`);
      }
    } else {
      // 为LIKE搜索结果添加简单的高亮
      rows = rows.map(row => ({
        ...row,
        highlightedDescription: row.descriptionAI.replace(
          new RegExp(`(${searchQuery})`, 'gi'), 
          '<mark>$1</mark>'
        )
      }));
    }
    
    if (rows.length > 0) {
      console.log('[DEBUG] First result:', JSON.stringify(rows[0]));
    }
    
    return rows;
  } catch (error) {
    console.error('[DEBUG] Error searching photos:', error);
    console.error('[DEBUG] Error details:', error.message);
    // 搜索出错时返回所有照片
    const rows = db.prepare('SELECT photoId, filePath, descriptionAI, status, isEdited, descriptionOriginal FROM photos ORDER BY createdAt DESC').all();
    return rows;
  }
});