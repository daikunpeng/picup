const importBtn = document.getElementById('import-btn');
const imageContainer = document.getElementById('image-container');

importBtn.addEventListener('click', async () => {
  // 调用 preload 脚本中暴露的 API
  const imagePaths = await window.electronAPI.openFolderDialog();
  
  // 清空上一次的图片
  imageContainer.innerHTML = ''; 

  imagePaths.forEach(filePath => {
    const imgElement = document.createElement('img');
    
    // 在 Windows 上, Node.js 返回的路径是反斜杠 (\).
    // <img> 标签的 src 属性需要的是 web-friendly 的正斜杠 (/).
    // 同时，为了让 Electron 正确加载本地文件, 我们需要 'file://' 协议头.
    const fileSrc = `file://${filePath.replace(/\\/g, '/')}`;
    
    imgElement.src = fileSrc;
    imgElement.title = filePath; // 鼠标悬停时显示完整路径
    
    imageContainer.appendChild(imgElement);
  });
}); 