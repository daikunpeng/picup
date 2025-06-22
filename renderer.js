// UI 元素
const selectProjectBtn = document.getElementById('select-project-btn');
const importFolderBtn = document.getElementById('import-btn');
const importSingleBtn = document.getElementById('import-single-btn');
const imageContainer = document.getElementById('image-container');
const projectPathSpan = document.getElementById('project-path');

// 使用 Set 存储当前显示的图片路径，自动处理重复项
let displayedImagePaths = new Set();

// ---- 核心函数 ----

// 根据当前图片路径集，重新渲染图片网格
function renderImages() {
  imageContainer.innerHTML = ''; // 清空现有内容
  
  displayedImagePaths.forEach(filePath => {
    const imgElement = document.createElement('img');
    const fileSrc = `file://${filePath.replace(/\\/g, '/')}`;
    imgElement.src = fileSrc;
    imgElement.title = filePath;
    imageContainer.appendChild(imgElement);
  });
}

// 更新界面状态（按钮是否可用，工程路径显示）
function updateUIForProject(projectPath) {
  if (projectPath) {
    projectPathSpan.textContent = projectPath;
    importFolderBtn.disabled = false;
    importSingleBtn.disabled = false;
  } else {
    projectPathSpan.textContent = '未选择';
    importFolderBtn.disabled = true;
    importSingleBtn.disabled = true;
  }
}

// ---- 事件监听与初始化 ----

// “选择/创建工程”按钮
selectProjectBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.selectProjectFolder();
  if (result) {
    updateUIForProject(result.projectPath);
    displayedImagePaths = new Set(result.imagePaths);
    renderImages();
  }
});

// “导入文件夹”按钮
importFolderBtn.addEventListener('click', async () => {
  const newImagePaths = await window.electronAPI.importFolder();
  if (newImagePaths && newImagePaths.length > 0) {
    newImagePaths.forEach(path => displayedImagePaths.add(path));
    renderImages();
  }
});

// “导入单张照片”按钮
importSingleBtn.addEventListener('click', async () => {
  const newImagePath = await window.electronAPI.importSingleFile();
  if (newImagePath) {
    displayedImagePaths.add(newImagePath);
    renderImages();
  }
});

// 应用启动时的初始化函数
async function initialize() {
  const initialData = await window.electronAPI.getInitialData();
  updateUIForProject(initialData.projectPath);
  if (initialData.projectPath) {
    displayedImagePaths = new Set(initialData.imagePaths);
    renderImages();
  }
}

// 启动！
initialize(); 