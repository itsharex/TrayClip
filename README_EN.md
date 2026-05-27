<div align="center">
    <img src="public/logo.png" alt="TrayClip" width="128" />
</div>

<h1 align="center">TrayClip</h1>

<p align="center">
  TrayClip is a local-only clipboard manager focused on copy, paste, history, groups, pinning, and hotkey management. No online services required.
</p>

---

<div align="center">

English | [简体中文](README.md)

</div>

<div align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb.svg?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-3178c6.svg?logo=typescript" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-1.75-9978c6.svg?logo=rust" />
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.0-3018c6.svg?logo=tauri" />
</div>

---

## Features

- Local-only storage, data stays on your machine
- Clipboard history: plain text, images, file paths
- Group management, pinning, customizable retention limit
- Quick Panel: standalone floating window, hotkey-activated, search-and-copy
- Light / dark theme toggle
- Customizable hotkeys, system tray resident
- Data Backup and Recovery
- Supports Windows / macOS / Linux

## Hotkeys

| Function | Windows / Linux | macOS       |
|----------|----------------|-------------|
| Open main window | `Ctrl+Shift+Space` | `⌃+⇧+P` |
| Open quick panel | `Ctrl+Shift+V` | `⌃+P`     |

Hotkeys can be customized in Settings.

## Prerequisites

- Node.js 20+
- Rust 1.75+
- npm 10+

## Development

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run build
npm run tauri:build
```

## Project Structure

- `src/` — Frontend (React + TypeScript)
- `src-tauri/` — Desktop backend (Rust + Tauri v2)

## License

[MIT](LICENSE)
