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
                // 描述内容容器
                const descriptionContent = document.createElement('div');
                descriptionContent.className = 'description-content';
                descriptionContent.dataset.photoId = photo.photoId;

                // 描述文本（可编辑）
                const descriptionText = document.createElement('p');
                descriptionText.className = 'description-text editable';
                
                // 如果是搜索结果且有高亮文本，使用高亮版本
                if (isSearchResult && photo.highlightedDescription) {
                    descriptionText.innerHTML = photo.highlightedDescription;
                } else {
                    descriptionText.textContent = photo.descriptionAI;
                }
                
                // 描述元信息和控制按钮
                const descriptionMeta = document.createElement('div');
                descriptionMeta.className = 'description-meta';
                
                // 编辑状态指示器
                if (photo.isEdited) {
                    const editIndicator = document.createElement('span');
                    editIndicator.className = 'edit-indicator';
                    editIndicator.textContent = '✏️ 已编辑';
                    descriptionMeta.appendChild(editIndicator);
                }
                
                // 编辑按钮
                const editBtn = document.createElement('button');
                editBtn.className = 'edit-btn';
                editBtn.textContent = '编辑';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    startEditDescription(photo.photoId, photo.descriptionAI);
                };
                descriptionMeta.appendChild(editBtn);
                
                // 恢复AI原文按钮（仅对编辑过的描述显示）
                if (photo.isEdited && photo.descriptionOriginal) {
                    const restoreBtn = document.createElement('button');
                    restoreBtn.className = 'restore-btn';
                    restoreBtn.textContent = '恢复AI原文';
                    restoreBtn.onclick = (e) => {
                        e.stopPropagation();
                        restoreAiDescription(photo.photoId);
                    };
                    descriptionMeta.appendChild(restoreBtn);
                }
                
                descriptionContent.appendChild(descriptionText);
                descriptionContent.appendChild(descriptionMeta);
                descriptionArea.appendChild(descriptionContent);
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

    // 开始编辑描述
    function startEditDescription(photoId, currentDescription) {
        const descriptionContent = document.querySelector(`[data-photo-id="${photoId}"]`);
        if (!descriptionContent) return;

        const descriptionText = descriptionContent.querySelector('.description-text');
        const descriptionMeta = descriptionContent.querySelector('.description-meta');
        
        if (!descriptionText || !descriptionMeta) return;

        // 创建编辑文本框
        const editTextarea = document.createElement('textarea');
        editTextarea.className = 'description-edit';
        editTextarea.value = currentDescription;
        editTextarea.placeholder = '请输入照片描述...';

        // 创建编辑控制按钮
        const editControls = document.createElement('div');
        editControls.className = 'edit-controls';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.textContent = '💾 保存';
        saveBtn.onclick = () => saveDescription(photoId, editTextarea.value);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '❌ 取消';
        cancelBtn.onclick = () => cancelEdit(photoId);

        const charCount = document.createElement('span');
        charCount.className = 'char-count';
        charCount.textContent = `${editTextarea.value.length} 字符`;

        // 字符计数更新
        editTextarea.addEventListener('input', () => {
            charCount.textContent = `${editTextarea.value.length} 字符`;
        });

        // 键盘快捷键
        editTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelEdit(photoId);
            } else if (e.key === 'Enter' && e.ctrlKey) {
                saveDescription(photoId, editTextarea.value);
            }
        });

        editControls.appendChild(saveBtn);
        editControls.appendChild(cancelBtn);
        editControls.appendChild(charCount);

        // 隐藏原始内容，显示编辑界面
        descriptionText.style.display = 'none';
        descriptionMeta.style.display = 'none';
        
        descriptionContent.appendChild(editTextarea);
        descriptionContent.appendChild(editControls);
        descriptionContent.classList.add('editing');

        // 聚焦并选中文本
        editTextarea.focus();
        editTextarea.select();

        console.log(`[UI] Started editing description for photoId=${photoId}`);
    }

    // 保存描述
    async function saveDescription(photoId, newDescription) {
        if (!newDescription.trim()) {
            alert('描述内容不能为空');
            return;
        }

        try {
            const result = await window.electronAPI.updatePhotoDescription(photoId, newDescription.trim());
            if (result.success) {
                console.log(`[UI] Description saved for photoId=${photoId}`);
                // 重新获取数据以更新界面
                await refreshCurrentView();
            } else {
                console.error('[UI] Failed to save description:', result.error);
                alert('保存失败: ' + result.error);
            }
        } catch (error) {
            console.error('[UI] Error saving description:', error);
            alert('保存失败: ' + error.message);
        }
    }

    // 取消编辑
    function cancelEdit(photoId) {
        const descriptionContent = document.querySelector(`[data-photo-id="${photoId}"]`);
        if (!descriptionContent) return;

        // 移除编辑元素
        const editTextarea = descriptionContent.querySelector('.description-edit');
        const editControls = descriptionContent.querySelector('.edit-controls');
        
        if (editTextarea) editTextarea.remove();
        if (editControls) editControls.remove();

        // 恢复原始显示
        const descriptionText = descriptionContent.querySelector('.description-text');
        const descriptionMeta = descriptionContent.querySelector('.description-meta');
        
        if (descriptionText) descriptionText.style.display = '';
        if (descriptionMeta) descriptionMeta.style.display = '';
        
        descriptionContent.classList.remove('editing');

        console.log(`[UI] Cancelled editing for photoId=${photoId}`);
    }

    // 恢复AI原始描述
    async function restoreAiDescription(photoId) {
        if (!confirm('确定要恢复AI原始描述吗？这将丢失您的编辑内容。')) {
            return;
        }

        try {
            const result = await window.electronAPI.restoreAiDescription(photoId);
            if (result.success) {
                console.log(`[UI] AI description restored for photoId=${photoId}`);
                // 重新获取数据以更新界面
                await refreshCurrentView();
            } else {
                console.error('[UI] Failed to restore description:', result.error);
                alert('恢复失败: ' + result.error);
            }
        } catch (error) {
            console.error('[UI] Error restoring description:', error);
            alert('恢复失败: ' + error.message);
        }
    }

    // 刷新当前视图
    async function refreshCurrentView() {
        if (isSearching) {
            // 如果正在搜索，重新执行搜索
            await performSearch(currentSearchQuery);
        } else {
            // 否则重新获取所有数据
            const data = await window.electronAPI.getPhotosStatus();
            currentPhotos = data;
            displayImages(data);
            updateSearchResultsInfo(data.length, false);
        }
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