use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri::Position;

use crate::{app_state::AppState, clipboard, db, models::{AppSettings, BootstrapPayload, ClipGroup, ExportHistoryRequest, HotkeySetting, ListClipsRequest, ListClipsResponse, PermissionState}};

fn runtime_error(error: anyhow::Error) -> String {
    error.to_string()
}

fn recopy_clip_impl(state: &State<'_, AppState>, clip_id: i64) -> Result<(), String> {
    let record = {
        let conn = state.conn.lock();
        let record = db::get_clip_by_id(&conn, clip_id).map_err(runtime_error)?;
        db::mark_clip_used(&conn, clip_id).map_err(runtime_error)?;
        record
    };
    clipboard::write_clipboard(&record).map_err(runtime_error)
}

#[tauri::command]
pub fn get_bootstrap(state: State<'_, AppState>) -> Result<BootstrapPayload, String> {
    let conn = state.conn.lock();
    let clips = db::list_clips(&conn, &ListClipsRequest { page: 1, page_size: 100, keyword: None, group_id: None, pinned_only: Some(false) }).map_err(runtime_error)?;
    let groups = db::list_groups(&conn).map_err(runtime_error)?;
    let settings = db::load_settings(&conn).map_err(runtime_error)?;
    let hotkeys = db::list_hotkeys(&conn).map_err(runtime_error)?;
    let permissions = state.permissions.read().clone();

    Ok(BootstrapPayload { clips, groups, settings, hotkeys, permissions })
}

#[tauri::command]
pub fn list_clips(state: State<'_, AppState>, payload: ListClipsRequest) -> Result<ListClipsResponse, String> {
    let conn = state.conn.lock();
    db::list_clips(&conn, &payload).map_err(runtime_error)
}

#[tauri::command]
pub fn list_groups(state: State<'_, AppState>) -> Result<Vec<ClipGroup>, String> {
    let conn = state.conn.lock();
    db::list_groups(&conn).map_err(runtime_error)
}

#[tauri::command]
pub fn recopy_clip(state: State<'_, AppState>, clip_id: i64) -> Result<(), String> {
    recopy_clip_impl(&state, clip_id)
}

#[tauri::command]
pub fn pin_toggle(state: State<'_, AppState>, clip_id: i64, pinned: bool) -> Result<(), String> {
    let conn = state.conn.lock();
    db::pin_toggle(&conn, clip_id, pinned).map_err(runtime_error)
}

#[tauri::command]
pub fn save_group(state: State<'_, AppState>, group_id: Option<i64>, group_name: String) -> Result<ClipGroup, String> {
    let conn = state.conn.lock();
    db::save_group(&conn, group_id, group_name.trim()).map_err(runtime_error)
}

#[tauri::command]
pub fn delete_group(state: State<'_, AppState>, group_id: i64) -> Result<(), String> {
    let conn = state.conn.lock();
    db::delete_group(&conn, group_id).map_err(runtime_error)
}

#[tauri::command]
pub fn move_clip_to_group(state: State<'_, AppState>, clip_id: i64, group_id: Option<i64>) -> Result<(), String> {
    let conn = state.conn.lock();
    db::move_clip_to_group(&conn, clip_id, group_id).map_err(runtime_error)
}

#[tauri::command]
pub fn delete_clip(state: State<'_, AppState>, app: AppHandle, clip_id: i64) -> Result<(), String> {
    let image_path = {
        let conn = state.conn.lock();
        db::delete_clip(&conn, clip_id).map_err(runtime_error)?
    };
    if let Some(path) = image_path {
        let _ = std::fs::remove_file(path);
    }
    let _ = app.emit("clips://updated", ());
    Ok(())
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let images = {
        let conn = state.conn.lock();
        db::clear_history(&conn).map_err(runtime_error)?
    };
    for path in images {
        let _ = std::fs::remove_file(path);
    }
    let _ = app.emit("clips://updated", ());
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let conn = state.conn.lock();
    db::load_settings(&conn).map_err(runtime_error)
}

#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, payload: AppSettings) -> Result<AppSettings, String> {
    let next_settings = {
        let conn = state.conn.lock();
        db::save_settings(&conn, &payload).map_err(runtime_error)?
    };
    *state.settings.write() = next_settings.clone();
    Ok(next_settings)
}

#[tauri::command]
pub fn get_hotkeys(state: State<'_, AppState>) -> Result<Vec<HotkeySetting>, String> {
    let conn = state.conn.lock();
    db::list_hotkeys(&conn).map_err(runtime_error)
}

#[tauri::command]
pub fn update_hotkey_setting(state: State<'_, AppState>, action_key: String, hotkey_value: String) -> Result<HotkeySetting, String> {
    let conn = state.conn.lock();
    db::save_hotkey(&conn, &action_key, &hotkey_value).map_err(runtime_error)
}

#[tauri::command]
pub fn export_history(state: State<'_, AppState>, payload: ExportHistoryRequest) -> Result<String, String> {
    let conn = state.conn.lock();
    db::export_history(&conn, &state.paths, &payload).map_err(runtime_error)
}

#[tauri::command]
pub fn import_history(state: State<'_, AppState>, file_path: String) -> Result<i64, String> {
    let conn = state.conn.lock();
    db::import_history(&conn, &file_path).map_err(runtime_error)
}

fn normalize_windows_path(file_path: &str) -> String {
    if let Some(stripped) = file_path.strip_prefix("\\\\?\\UNC\\") {
        return format!("\\\\{}", stripped);
    }
    if let Some(stripped) = file_path.strip_prefix("\\\\?\\") {
        return stripped.to_string();
    }
    file_path.to_string()
}

fn mime_from_path(file_path: &str) -> &'static str {
    let lower = file_path.to_ascii_lowercase();
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".tif") || lower.ends_with(".tiff") {
        "image/tiff"
    } else {
        "image/png"
    }
}

#[tauri::command]
pub fn load_image_data_url(file_path: String) -> Result<String, String> {
    let normalized = normalize_windows_path(&file_path);
    let bytes = std::fs::read(&normalized).map_err(|err| err.to_string())?;
    let encoded = STANDARD.encode(bytes);
    Ok(format!("data:{};base64,{}", mime_from_path(&normalized), encoded))
}

#[tauri::command]
pub fn get_permissions(state: State<'_, AppState>) -> Result<PermissionState, String> {
    Ok(state.permissions.read().clone())
}

#[tauri::command]
pub fn request_accessibility_permission(_state: State<'_, AppState>) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.webview_windows().get("main").cloned() {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

pub fn position_quick_panel(window: &tauri::WebviewWindow, panel_position: &str) {
    if panel_position == "follow_mouse" {
        if let Ok(pos) = window.cursor_position() {
            let x = pos.x as i32 + 12;
            let y = pos.y as i32 + 12;
            let _ = window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }));
            return;
        }
    }
    // center: center on current monitor
    if let Ok(Some(monitor)) = window.current_monitor() {
        let size = monitor.size();
        let pos = monitor.position();
        let win_w = 360;
        let win_h = 460;
        let x = pos.x + (size.width as i32 - win_w) / 2;
        let y = pos.y + (size.height as i32 - win_h) / 2;
        let _ = window.set_position(Position::Physical(tauri::PhysicalPosition { x, y }));
    }
}

#[tauri::command]
pub fn toggle_quick_panel(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(window) = app.webview_windows().get("quick-panel").cloned() {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let panel_position = state.settings.read().panel_position.clone();
            position_quick_panel(&window, &panel_position);
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.emit("focus-quick-search", ());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn hide_quick_panel(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.webview_windows().get("quick-panel").cloned() {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn set_dragging(state: State<'_, AppState>, dragging: bool) -> Result<(), String> {
    *state.is_dragging.lock() = dragging;
    Ok(())
}

const GITHUB_REPO: &str = "Heyiki/TrayClip";

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub download_url: String,
    pub body: String,
}

#[tauri::command]
pub fn check_update(current_version: String) -> Result<UpdateInfo, String> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", GITHUB_REPO);

    let output = std::process::Command::new("curl")
        .args(["-sL", "-H", "User-Agent: trayclip", &url])
        .output()
        .map_err(|e| format!("Failed to run curl: {}", e))?;

    if !output.status.success() {
        return Err(format!("curl exited with status {}", output.status));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let tag = json["tag_name"].as_str().unwrap_or("").trim_start_matches('v');
    let body = json["body"].as_str().unwrap_or("").to_string();
    let html_url = json["html_url"].as_str().unwrap_or("").to_string();
    let has_update = version_compare(tag, &current_version);

    Ok(UpdateInfo {
        has_update,
        latest_version: tag.to_string(),
        download_url: html_url,
        body,
    })
}

fn version_compare(latest: &str, current: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> {
        s.split('.').filter_map(|p| p.parse().ok()).collect()
    };
    let l = parse(latest);
    let c = parse(current);
    for i in 0..l.len().max(c.len()) {
        let lv = l.get(i).copied().unwrap_or(0);
        let cv = c.get(i).copied().unwrap_or(0);
        if lv > cv { return true; }
        if lv < cv { return false; }
    }
    false
}
