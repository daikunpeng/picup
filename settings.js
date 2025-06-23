const apiKeyInput = document.getElementById('api-key');
const endpointUrlInput = document.getElementById('endpoint-url');
const saveBtn = document.getElementById('save-btn');
const statusDiv = document.getElementById('status');

// 页面加载时，自动从主进程获取并填充配置
document.addEventListener('DOMContentLoaded', async () => {
    const config = await window.electronAPI.getApiConfig();
    if (config) {
        apiKeyInput.value = config.apiKey || '';
        endpointUrlInput.value = config.endpointUrl || '';
    }
});

// 保存按钮的点击事件
saveBtn.addEventListener('click', async () => {
    const config = {
        apiKey: apiKeyInput.value,
        endpointUrl: endpointUrlInput.value
    };
    
    await window.electronAPI.setApiConfig(config);

    // 提供用户反馈
    statusDiv.textContent = '保存成功!';
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 2000); // 2秒后清除提示
}); 