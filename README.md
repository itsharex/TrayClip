# TrayClip

[English](README_EN.md)

TrayClip 是一款纯本地剪贴板工具，专注于复制、粘贴、历史记录、分组、置顶和快捷键管理，不依赖任何线上接口。

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

[CC BY-NC 4.0](LICENSE) — 署名-非商业性使用
