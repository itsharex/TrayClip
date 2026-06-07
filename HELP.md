# TrayClip Help

## Overview
TrayClip is a local clipboard manager built around history, grouping, pinning, quick search, and fast copy. It also includes a quick panel, theme switching, language switching, backup and restore, and optional AI enhancement settings.

## Window Operations
- Main window: open it from the system tray icon, tray menu, or a global hotkey.
- Quick panel: use this lightweight floating window for quick search and copy. Press `Esc` or click elsewhere to close it.
- Drag to move: both windows can be dragged by their top area.
- Close behavior: closing the main window normally hides it to the tray, and this can be changed in Settings.

## Clipboard Records
- Auto capture: TrayClip records clipboard content automatically, including plain text, rich text, images, and file paths.
- Copy back: click the Copy button or double-click the record content area to write it back to the clipboard.
- Context menu: right-click a record for quick actions. JSON content supports formatted copy, and URLs can be opened directly.
- Pinning: pinned records are kept from auto cleanup.
- Delete: records can be removed permanently after confirmation.
- Search: the search box filters by content, source app, and file path.
- Image preview: image records show thumbnails, and image files referenced in file paths can preview too.
- Content truncation: long text is truncated and marked as truncated.

## Group Management
- New group: click the `+` button on the group bar, enter a name, and press `Enter`.
- Rename group: double-click a group tag, enter a new name, and press `Enter` to confirm or `Esc` to cancel.
- Delete group: right-click a group tag and confirm deletion. Records move back to ungrouped.
- Filter by group: click a group tag to filter records, or click `All` to show everything.
- Move to group: use the group action in a record to choose a target group.

## Keyboard Shortcuts
- Use `↑` / `↓` to select records, then press `Enter` to copy the selected item.
- Double-click the record content area to copy quickly.
- Right-click a record to open the context menu.
- `Esc` clears search first; if search is already empty, it hides the window.
- The quick panel auto-selects the first item on open, so `Enter` can copy immediately.

## Settings
- Hotkeys: customize the hotkeys for the main window and quick panel, then restore defaults when needed.
- Retention limit: set the maximum number of retained records from 50 to 10000.
- Pause capture: temporarily stop clipboard capture.
- Quick paste: Windows only, automatically paste to the previous app window after copying from the quick panel.
- URL toast: show a toast notification when copied content contains a URL.
- Launch on startup: start TrayClip automatically when the system starts.
- Close behavior: choose hide to tray, exit directly, or ask every time.
- Quick panel position: choose screen center or follow mouse.
- Theme and language: switch light/dark theme and interface language from the title bar.
- Data backup: export all records, groups, and settings as a ZIP backup.
- Data restore: import a previously exported ZIP backup. This replaces all current data and restarts the app.
- Clear history: remove all non-pinned records.
- AI enhancement: configure API URL, API Key, model name, and AI translation options.

## About
The About page shows the version, storage location, supported platforms, license, and update checker.

## Files
- `README.md` and `README_EN.md` cover the project overview and usage at a glance.
- `help.md` and `help.zh.md` provide the full help reference for English and Chinese readers.
