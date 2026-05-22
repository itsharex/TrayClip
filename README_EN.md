# TrayClip

[中文](README.md)

TrayClip is a local-only clipboard manager focused on copy, paste, history, groups, pinning, and hotkey management. No online services required.

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
| Open main window | `Ctrl+Shift+Space` | `⌘+⇧+T` |
| Open quick panel | `Ctrl+Shift+V` | `⌘+⇧+C`     |

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

[CC BY-NC 4.0](LICENSE) — Attribution-NonCommercial
