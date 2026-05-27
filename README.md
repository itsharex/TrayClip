<div align="center">
    <img src="public/logo.png" alt="TrayClip" width="128" />
</div>

<h1 align="center">TrayClip</h1>

<p align="center">
  TrayClip 是一款纯本地剪贴板工具，专注于复制、粘贴、历史记录、分组、置顶和快捷键管理，不依赖任何线上接口。
</p>

---

<div align="center">

[English](README_EN.md) | 简体中文

</div>

<div align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb.svg?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3178c6.svg?logo=typescript" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75-9978c6.svg?logo=rust" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.0-3018c6.svg?logo=tauri" />
</div>

---

## 特性

- 纯本地保存，数据落在用户本机
- 剪贴板历史记录，支持纯文本、图片、文件路径
- 分组管理、置顶、自定义保留条数
- 快捷面板：独立浮窗，快捷键呼出，搜索即复制
- 亮色 / 暗色主题切换
- 自定义快捷键，托盘常驻
- 数据备份与恢复
- 支持 Windows / macOS / Linux

## 快捷键

| 功能 | Windows / Linux | macOS       |
|------|----------------|-------------|
| 打开主窗口 | `Ctrl+Shift+Space` | `⌃+⇧+P` |
| 打开快捷面板 | `Ctrl+Shift+V` | `⌃+P`     |

快捷键可在设置页面自定义。

## 开发环境

- Node.js 20+
- Rust 1.75+
- npm 10+

## 启动

```bash
npm install
npm run tauri:dev
```

## 构建

```bash
npm run build
npm run tauri:build
```

## 目录

- `src/` 前端界面（React + TypeScript）
- `src-tauri/` 桌面端后端（Rust + Tauri v2）

## 开源协议

[MIT](LICENSE)
