const apiKeyInput = document.getElementById('api-key');
const endpointUrlInput = document.getElementById('endpoint-url');
const saveBtn = document.getElementById('save-btn');
const statusDiv = document.getElementById('status');

// 打开Moonshot AI官网
function openMoonshotSite() {
    window.electronAPI.openExternal('https://platform.moonshot.cn/');
}

// 显示状态消息
function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = type;
    
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 3000);
}

// 验证API Key格式
function validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim() === '') {
        return '请输入API Key';
    }
    if (apiKey.length < 10) {
        return 'API Key格式不正确，长度过短';
    }
    return null;
}

// 验证Endpoint URL格式
function validateEndpointUrl(url) {
    if (!url || url.trim() === '') {
        return null; // 可选字段
    }
    try {
        new URL(url);
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return 'Endpoint URL必须以http://或https://开头';
        }
        return null;
    } catch (e) {
        return 'Endpoint URL格式不正确';
    }
}

// 页面加载时，自动从主进程获取并填充配置
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const config = await window.electronAPI.getApiConfig();
        if (config) {
            apiKeyInput.value = config.apiKey || '';
            endpointUrlInput.value = config.endpointUrl || 'https://api.moonshot.cn/v1/chat/completions';
        } else {
            // 设置默认端点
            endpointUrlInput.value = 'https://api.moonshot.cn/v1/chat/completions';
        }
        
        // 如果已有API Key，显示成功状态
        if (config && config.apiKey) {
            showStatus('已加载现有配置');
        }
    } catch (error) {
        showStatus('加载配置失败: ' + error.message, 'error');
    }
});

// 实时验证输入
apiKeyInput.addEventListener('input', () => {
    const error = validateApiKey(apiKeyInput.value);
    if (error) {
        apiKeyInput.style.borderColor = '#dc3545';
    } else {
        apiKeyInput.style.borderColor = '#28a745';
    }
});

endpointUrlInput.addEventListener('input', () => {
    const error = validateEndpointUrl(endpointUrlInput.value);
    if (error) {
        endpointUrlInput.style.borderColor = '#dc3545';
    } else {
        endpointUrlInput.style.borderColor = '#28a745';
    }
});

// 保存按钮的点击事件
saveBtn.addEventListener('click', async () => {
    // 禁用按钮防止重复提交
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ 保存中...';
    
    try {
        // 验证输入
        const apiKeyError = validateApiKey(apiKeyInput.value);
        if (apiKeyError) {
            showStatus(apiKeyError, 'error');
            return;
        }
        
        const endpointError = validateEndpointUrl(endpointUrlInput.value);
        if (endpointError) {
            showStatus(endpointError, 'error');
            return;
        }
        
        const config = {
            apiKey: apiKeyInput.value.trim(),
            endpointUrl: endpointUrlInput.value.trim() || 'https://api.moonshot.cn/v1/chat/completions'
        };
        
        await window.electronAPI.setApiConfig(config);
        
        showStatus('✅ 配置保存成功！现在可以开始使用AI描述功能了', 'success');
        
        // 短暂延迟后关闭窗口
        setTimeout(() => {
            window.close();
        }, 2000);
        
    } catch (error) {
        showStatus('❌ 保存失败: ' + error.message, 'error');
    } finally {
        // 恢复按钮状态
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 保存配置';
    }
}); 