# 📸 PicUp 智能相册

<div align="center">

![PicUp Logo](assets/icon.png)

**基于 AI 的智能照片管理与搜索工具**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Electron](https://img.shields.io/badge/Electron-36.5.0-blue.svg)](https://electronjs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/daikunpeng/picup/releases)
[![GitHub Stars](https://img.shields.io/github/stars/daikunpeng/picup.svg)](https://github.com/daikunpeng/picup/stargazers)

[📥 下载体验](#-快速开始) • [📖 使用指南](#-使用指南) • [🛠️ 开发文档](#-开发指南) • [🤝 参与贡献](#-贡献指南)

</div>

---

## ✨ 项目简介

你是否遇到过当你印象中有一张户外的美照，但是由于相册内有千上万的照片想要翻到它非常耗时，甚至眼花缭乱了也没有找到这样的场景？ **PicUp** 是一款桌面项目，可以利用人工智能技术拯救你~

**PicUp** 是本人第一个完整的 Vibe Coding 项目，它是一款现代化的智能相册桌面应用，专为注重隐私的用户设计。它采用"工程文件夹"的管理理念，将您的所有照片和元数据集中存储在本地，结合先进的 AI 技术自动生成中文描述，让您的照片管理和搜索变得前所未有的智能和便捷。

👉 [Bilibili 演示视频](https://www.bilibili.com/video/BV1aG3FzeEXK/?vd_source=96be048691ba7a45009977af72651287)

### 🎯 核心理念

- **🔒 隐私优先**：所有数据本地存储，绝不上传云端
- **🧠 AI 驱动**：自动生成精准的中文照片描述
- **📁 工程化管理**：统一的项目文件夹，便于备份和迁移
- **🔍 智能搜索**：基于 AI 描述的全文搜索功能

## 🚀 核心特性

### 📋 已实现功能

- ✅ **工程化管理**：创建和管理照片工程文件夹
- ✅ **智能导入**：支持单张照片和文件夹批量导入
- ✅ **AI 描述生成**：集成 Moonshot AI，自动生成中文照片描述
- ✅ **全文搜索**：基于 FTS5 的高效中文搜索
- ✅ **实时更新**：处理状态实时可见，无需手动刷新
- ✅ **描述编辑**：支持用户编辑和完善 AI 生成的描述
- ✅ **现代化 UI**：卡片式布局，流畅的用户体验
- ✅ **EXIF 支持**：自动提取照片的拍摄时间和位置信息

### 🔄 开发中功能

- 🔲 **多语言支持**：界面本地化
- 🔲 **标签系统**：自定义照片分类标签
- 🔲 **高级搜索**：时间范围、位置等多维度搜索
- 🔲 **数据导出**：支持导出搜索结果和元数据

## 📥 快速开始

### 方式一：下载预编译版本（推荐）

1. 前往 [Releases 页面](https://github.com/daikunpeng/picup/releases)
2. 下载适合您系统的安装包
3. 运行安装程序并按提示完成安装

### 方式二：从源码构建

```bash
# 克隆项目
git clone https://github.com/daikunpeng/picup.git
cd picup

# 安装依赖
npm install

# 启动开发版本
npm start

# 构建生产版本
npm run build:win  # Windows
```

## 🛠️ 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+

## 📖 使用指南

### 1. 首次启动

1. **创建工程**：首次启动时，点击"选择工程文件夹"创建或选择一个文件夹作为您的照片工程
2. **配置 AI 服务**：点击设置按钮，配置 Moonshot AI 的 API 密钥

### 2. 配置 Moonshot AI

PicUp 使用 Moonshot AI 为照片生成中文描述。您需要：

1. 访问 [Moonshot AI 控制台](https://platform.moonshot.cn/)
2. 注册账号并获取 API Key
3. 在 PicUp 设置中填入您的 API Key

> 💡 **提示**：Moonshot AI 需要付费使用，充值50元就能够使用本仓库。后续将支持更多VLM模型。

### 3. 导入照片

- **单张导入**：点击"导入单张照片"选择图片文件
- **批量导入**：点击"导入文件夹"选择包含照片的文件夹

### 4. AI 描述生成

- 导入的照片会自动排队等待 AI 处理
- 处理状态实时显示：等待中 → 处理中 → 完成
- 可以手动编辑 AI 生成的描述

### 5. 智能搜索

- 在搜索框中输入关键词，如"小狗"、"海滩"、"夕阳"
- 支持中文分词和模糊匹配
- 搜索结果会高亮显示匹配的文本

## ⚙️ 配置说明

### API 配置

```javascript
// 默认配置
{
  "apiKey": "your-moonshot-api-key",
  "endpointUrl": "https://api.moonshot.cn/v1/chat/completions"
}
```

### 支持的图片格式

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **WebP** (.webp)
- **GIF** (.gif)
- **BMP** (.bmp)

## 🏗️ 技术架构

### 技术栈

- **前端框架**: Electron 36.5.0
- **数据库**: SQLite (better-sqlite3)
- **全文搜索**: FTS5 (SQLite 扩展)
- **AI 集成**: Moonshot AI Vision API
- **配置管理**: electron-store
- **图片处理**: exif-parser

### 架构设计

```
┌─────────────────────────────────────────┐
│         Electron 桌面应用框架            │
├─────────────────────────────────────────┤
│  前端界面 (HTML/CSS/JS)                  │
│  ├─ 主界面 (index.html)                  │
│  ├─ 设置界面 (settings.html)             │
│  └─ 渲染逻辑 (renderer.js)               │
├─────────────────────────────────────────┤
│  主进程逻辑 (Node.js)                    │
│  ├─ 核心业务 (main.js)                   │
│  ├─ 安全桥接 (preload.js)                │
│  └─ 设置管理 (settings.js)               │
├─────────────────────────────────────────┤
│  数据存储层                              │
│  ├─ SQLite 数据库                        │
│  ├─ FTS5 全文搜索                        │
│  └─ 配置存储 (electron-store)            │
├─────────────────────────────────────────┤
│  外部服务                                │
│  └─VLM AI API                           │
└─────────────────────────────────────────┘
```

### 数据模型

```sql
-- 照片主表
CREATE TABLE photos (
  photoId INTEGER PRIMARY KEY AUTOINCREMENT,
  filePath TEXT NOT NULL UNIQUE,
  descriptionAI TEXT,
  status TEXT DEFAULT 'pending',
  isEdited BOOLEAN DEFAULT FALSE,
  takenAt TEXT,
  location TEXT,
  createdAt TEXT DEFAULT (datetime('now','localtime'))
);

-- FTS5 全文搜索表
CREATE VIRTUAL TABLE photos_fts USING fts5(
  photoId UNINDEXED,
  descriptionAI,
  tokenize='unicode61 remove_diacritics 0'
);
```

## 🛠️ 开发指南

### 开发环境搭建

```bash
# 克隆项目
git clone https://github.com/daikunpeng/picup.git
cd picup

# 安装依赖
npm install

# 启动开发模式
npm start

# 启用热重载（可选）
npm install --save-dev electron-reload
```

### 项目结构

```
picup/
├── main.js           # Electron 主进程
├── preload.js        # 安全桥接层
├── renderer.js       # 渲染进程逻辑
├── index.html        # 主界面
├── settings.html     # 设置界面
├── settings.js       # 设置窗口逻辑
├── assets/           # 静态资源
├── docs/             # 文档
├── package.json      # 项目配置
└── README.md         # 项目说明
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork 项目**到您的 GitHub 账号
2. **创建功能分支**：`git checkout -b feature/amazing-feature`
3. **提交更改**：`git commit -m 'Add some amazing feature'`
4. **推送分支**：`git push origin feature/amazing-feature`
5. **创建 Pull Request**

### 贡献类型

- 🐛 **Bug 报告**：发现问题请提交 Issue
- 💡 **功能建议**：有好想法请告诉我们
- 📝 **文档改进**：帮助完善文档
- 🔧 **代码贡献**：修复 Bug 或添加新功能
- 🌍 **本地化**：帮助翻译界面

### 开发规范

- 使用 ESLint 保持代码风格一致
- 提交信息遵循 [Conventional Commits](https://conventionalcommits.org/)
- 为新功能添加适当的测试

## 📄 许可证

本项目采用 [ISC 许可证](LICENSE)。

## 🙏 致谢

- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Moonshot AI](https://platform.moonshot.cn/) - AI 视觉理解服务
- [SQLite](https://sqlite.org/) - 轻量级数据库引擎
- [FTS5](https://sqlite.org/fts5.html) - 全文搜索扩展

## 📞 联系我们

- **GitHub Issues**: [提交问题](https://github.com/daikunpeng/picup/issues)
- **GitHub Discussions**: [参与讨论](https://github.com/daikunpeng/picup/discussions)
- **Email**: [项目邮箱](mailto:kpdai@qq.com)

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

[⬆️ 回到顶部](#-picup-智能相册)

</div> 