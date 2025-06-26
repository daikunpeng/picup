// This script is loaded in the HTML file and has access to the DOM

window.addEventListener('DOMContentLoaded', () => {
    const imageGrid = document.getElementById('image-grid');
    const welcomeScreen = document.getElementById('welcome-screen');
    const selectProjectBtn = document.getElementById('select-project-btn');
    const importFolderBtn = document.getElementById('import-folder-btn');
    const importSingleBtn = document.getElementById('import-single-file-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const currentProjectSpan = document.getElementById('current-project-path');
    
    // 搜索相关元素
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const searchResultsInfo = document.getElementById('search-results-info');

    // 当前显示的照片数据缓存
    let currentPhotos = [];
    // 实时更新定时器
    let updateTimer = null;
    // 当前搜索状态
    let isSearching = false;
    let currentSearchQuery = '';

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

    function displayImages(photos, isSearchResult = false) {
        // Clear existing images before displaying new ones
        imageGrid.innerHTML = ''; 

        if (!photos || photos.length === 0) {
            const emptyMessage = isSearchResult ? '没有找到匹配的照片' : '暂无照片，请导入照片';
            imageGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #6c757d;">${emptyMessage}</div>`;
            return;
        }

        photos.forEach(photo => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.dataset.photoId = photo.photoId;

            // 图片容器
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';

            const img = document.createElement('img');
            img.src = photo.filePath;
            img.onerror = () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NDQgMjEgMyAxNi45NzA2IDMgMTJDMyA3LjAyOTQ0IDcuMDI5NDQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQ0IDIxIDEyWiIgc3Ryb2tlPSIjNmM3NTdkIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K';
            };

            // 状态覆盖层（仅在处理中时显示）
            if (photo.status === 'processing') {
                const overlay = document.createElement('div');
                overlay.className = 'status-overlay';
                overlay.textContent = 'AI处理中...';
                imageContainer.appendChild(overlay);
            }

            imageContainer.appendChild(img);
            imageItem.appendChild(imageContainer);

            // 描述区域
            const descriptionArea = document.createElement('div');
            descriptionArea.className = 'description-area';

            if (photo.status === 'completed' && photo.descriptionAI) {
                const descriptionText = document.createElement('p');
                descriptionText.className = 'description-text';
                
                // 如果是搜索结果且有高亮文本，使用高亮版本
                if (isSearchResult && photo.highlightedDescription) {
                    descriptionText.innerHTML = photo.highlightedDescription;
                } else {
                    descriptionText.textContent = photo.descriptionAI;
                }
                
                descriptionArea.appendChild(descriptionText);
            } else {
                const statusElement = document.createElement('p');
                statusElement.className = `description-status ${photo.status}`;
                statusElement.textContent = getStatusText(photo.status) || '等待AI分析...';
                descriptionArea.appendChild(statusElement);
            }

            imageItem.appendChild(descriptionArea);
            imageGrid.appendChild(imageItem);
        });
    }

    function updateUI(projectPath, photos = []) {
        if (projectPath) {
            currentProjectSpan.textContent = projectPath;
            welcomeScreen.classList.add('hidden');
            imageGrid.classList.remove('hidden');
            searchContainer.classList.remove('hidden'); // 显示搜索框
            importFolderBtn.disabled = false;
            importSingleBtn.disabled = false;
            currentPhotos = photos; // 更新缓存
            displayImages(photos);
            updateSearchResultsInfo(photos.length, false);
            startRealTimeUpdate(); // 启动实时更新
        } else {
            currentProjectSpan.textContent = '未选择';
            welcomeScreen.classList.remove('hidden');
            imageGrid.classList.add('hidden');
            searchContainer.classList.add('hidden'); // 隐藏搜索框
            importFolderBtn.disabled = true;
            importSingleBtn.disabled = true;
            currentPhotos = []; // 清空缓存
            stopRealTimeUpdate(); // 停止实时更新
        }
    }

    // 执行搜索
    async function performSearch(query) {
        try {
            const searchResults = await window.electronAPI.searchPhotos(query);
            currentSearchQuery = query;
            isSearching = query.trim() !== '';
            
            displayImages(searchResults, isSearching);
            updateSearchResultsInfo(searchResults.length, isSearching, query);
            
            console.log(`[UI] 搜索完成: "${query}", 结果数量: ${searchResults.length}`);
        } catch (error) {
            console.error('[UI] 搜索出错:', error);
        }
    }

    // 更新搜索结果信息
    function updateSearchResultsInfo(count, isSearch, query = '') {
        if (isSearch) {
            searchResultsInfo.textContent = `找到 ${count} 张包含"${query}"的照片`;
        } else {
            searchResultsInfo.textContent = `共 ${count} 张照片`;
        }
    }

    // 清空搜索
    function clearSearch() {
        searchInput.value = '';
        currentSearchQuery = '';
        isSearching = false;
        displayImages(currentPhotos);
        updateSearchResultsInfo(currentPhotos.length, false);
    }

    // 启动实时更新
    function startRealTimeUpdate() {
        stopRealTimeUpdate(); // 先停止现有的定时器
        updateTimer = setInterval(async () => {
            try {
                const updatedPhotos = await window.electronAPI.getPhotosStatus();
                if (hasPhotosChanged(currentPhotos, updatedPhotos)) {
                    console.log('[UI] 检测到照片状态变化，更新界面');
                    currentPhotos = updatedPhotos;
                    
                    // 如果当前在搜索状态，重新执行搜索以更新结果
                    if (isSearching) {
                        performSearch(currentSearchQuery);
                    } else {
                        updateChangedPhotos(updatedPhotos);
                        updateSearchResultsInfo(updatedPhotos.length, false);
                    }
                }
            } catch (error) {
                console.error('[UI] 实时更新出错:', error);
            }
        }, 3000); // 每3秒检查一次
    }

    // 停止实时更新
    function stopRealTimeUpdate() {
        if (updateTimer) {
            clearInterval(updateTimer);
            updateTimer = null;
        }
    }

    // 检查照片数据是否有变化
    function hasPhotosChanged(oldPhotos, newPhotos) {
        if (oldPhotos.length !== newPhotos.length) return true;
        
        for (let i = 0; i < oldPhotos.length; i++) {
            const oldPhoto = oldPhotos[i];
            const newPhoto = newPhotos[i];
            if (oldPhoto.photoId !== newPhoto.photoId || 
                oldPhoto.status !== newPhoto.status || 
                oldPhoto.descriptionAI !== newPhoto.descriptionAI) {
                return true;
            }
        }
        return false;
    }

    // 智能更新变化的照片（避免全量重绘）
    function updateChangedPhotos(newPhotos) {
        newPhotos.forEach(photo => {
            const imageItem = document.querySelector(`[data-photo-id="${photo.photoId}"]`);
            if (imageItem) {
                updateSinglePhotoDisplay(imageItem, photo);
            }
        });
        
        // 如果有新照片添加，进行全量重绘
        if (newPhotos.length > currentPhotos.length) {
            displayImages(newPhotos);
        }
    }

    // 更新单个照片的显示
    function updateSinglePhotoDisplay(imageItem, photo) {
        const descriptionArea = imageItem.querySelector('.description-area');
        const overlay = imageItem.querySelector('.status-overlay');
        
        // 移除处理中的覆盖层
        if (photo.status !== 'processing' && overlay) {
            overlay.remove();
        }
        
        // 添加处理中的覆盖层
        if (photo.status === 'processing' && !overlay) {
            const imageContainer = imageItem.querySelector('.image-container');
            const newOverlay = document.createElement('div');
            newOverlay.className = 'status-overlay';
            newOverlay.textContent = 'AI处理中...';
            imageContainer.appendChild(newOverlay);
        }
        
        // 更新描述区域
        if (descriptionArea) {
            descriptionArea.innerHTML = '';
            
            if (photo.status === 'completed' && photo.descriptionAI) {
                const descriptionText = document.createElement('p');
                descriptionText.className = 'description-text';
                descriptionText.textContent = photo.descriptionAI;
                descriptionArea.appendChild(descriptionText);
            } else {
                const statusElement = document.createElement('p');
                statusElement.className = `description-status ${photo.status}`;
                statusElement.textContent = getStatusText(photo.status) || '等待AI分析...';
                descriptionArea.appendChild(statusElement);
            }
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

    // 搜索相关事件监听
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        performSearch(query);
    });

    clearSearchBtn.addEventListener('click', () => {
        clearSearch();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            performSearch(query);
        }
    });

    // 实时搜索（可选）- 用户停止输入0.5秒后自动搜索
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value.trim();
            performSearch(query);
        }, 500);
    });

    // 调试功能：检查数据库描述
    window.debugDescriptions = async () => {
        console.log('[UI] Debugging descriptions...');
        const descriptions = await window.electronAPI.debugGetDescriptions();
        console.log('[UI] Retrieved descriptions:', descriptions);
        return descriptions;
    };

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

    // 页面关闭时清理定时器
    window.addEventListener('beforeunload', () => {
        stopRealTimeUpdate();
    });

    // 启动！
    initialize();
}); 