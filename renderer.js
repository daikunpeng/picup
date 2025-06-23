// This script is loaded in the HTML file and has access to the DOM

window.addEventListener('DOMContentLoaded', () => {
    const imageGrid = document.getElementById('image-grid');
    const welcomeScreen = document.getElementById('welcome-screen');
    const selectProjectBtn = document.getElementById('select-project-btn');
    const importFolderBtn = document.getElementById('import-folder-btn');
    const importSingleBtn = document.getElementById('import-single-file-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const currentProjectSpan = document.getElementById('current-project-path');

    // 使用 Set 存储当前显示的图片路径，自动处理重复项
    let displayedImagePaths = new Set();

    // ---- 核心函数 ----

    function getStatusText(status) {
        switch (status) {
            case 'pending': return '等待中...';
            case 'processing': return 'AI处理中...';
            case 'failed': return '处理失败';
            case 'completed': return null;
            default: return '未知状态';
        }
    }

    function displayImages(photos) {
        // Clear existing images before displaying new ones, only if it's a full refresh
        // For appends, we should handle it differently. Let's stick to full refresh for now.
        imageGrid.innerHTML = ''; 

        if (!photos || photos.length === 0) {
            // Handle empty state if needed, maybe show a message inside the grid
            return;
        }

        photos.forEach(photo => {
            const container = document.createElement('div');
            container.className = 'image-container';
            container.dataset.photoId = photo.photoId;

            const img = document.createElement('img');
            img.src = photo.filePath; // Electron allows direct local file paths

            const statusText = getStatusText(photo.status);
            if (statusText) {
                const overlay = document.createElement('div');
                overlay.className = 'status-overlay';
                overlay.textContent = statusText;
                container.appendChild(overlay);
            }

            if (photo.status === 'completed' && photo.descriptionAI) {
                const tooltip = document.createElement('span');
                tooltip.className = 'tooltip';
                tooltip.textContent = photo.descriptionAI;
                container.appendChild(tooltip);
            }

            container.appendChild(img);
            imageGrid.appendChild(container);
        });
    }

    function updateUI(projectPath, photos = []) {
        if (projectPath) {
            currentProjectSpan.textContent = projectPath;
            welcomeScreen.classList.add('hidden');
            imageGrid.classList.remove('hidden');
            importFolderBtn.disabled = false;
            importSingleBtn.disabled = false;
            displayImages(photos);
        } else {
            currentProjectSpan.textContent = '未选择';
            welcomeScreen.classList.remove('hidden');
            imageGrid.classList.add('hidden');
            importFolderBtn.disabled = true;
            importSingleBtn.disabled = true;
        }
    }

    // ---- 事件监听与初始化 ----

    // "选择/创建工程"按钮
    selectProjectBtn.addEventListener('click', async () => {
        const data = await window.electronAPI.selectProjectFolder();
        if (data) {
            updateUI(data.projectPath, data.photos);
        }
    });

    // 新增: "设置" 按钮
    settingsBtn.addEventListener('click', () => {
        window.electronAPI.openSettingsWindow();
    });

    // "导入文件夹"按钮
    importFolderBtn.addEventListener('click', async () => {
        const newPhotos = await window.electronAPI.importFolder();
        if (newPhotos && newPhotos.length > 0) {
            // For simplicity, re-fetch all data to ensure UI is in sync.
            // A more optimized approach would be to just append the new photos.
            const data = await window.electronAPI.getInitialData();
            updateUI(data.projectPath, data.photos);
        }
    });

    // "导入单张照片"按钮
    importSingleBtn.addEventListener('click', async () => {
        const newPhoto = await window.electronAPI.importSingleFile();
        if (newPhoto) {
            // Re-fetch for simplicity
            const data = await window.electronAPI.getInitialData();
            updateUI(data.projectPath, data.photos);
        }
    });

    // 应用启动时的初始化函数
    async function initialize() {
        const data = await window.electronAPI.getInitialData();
        updateUI(data.projectPath, data.photos);
    }

    // 启动！
    initialize();
}); 