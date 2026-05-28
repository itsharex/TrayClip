#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod clipboard;
mod commands;
mod db;
mod models;
mod monitor;
mod paths;

use anyhow::Context;
use app_state::AppState;
use parking_lot::{Mutex, RwLock};
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

fn apply_pending_restore(app: &tauri::AppHandle) {
    let resolver = app.path();

    // Find root_dir (same logic as AppPaths::resolve)
    let install_dir = resolver
        .resource_dir()
        .or_else(|_| resolver.app_config_dir())
        .or_else(|_| resolver.app_data_dir());
    let Ok(install_dir) = install_dir else { return };

    let candidate_dirs = [
        install_dir.join("data"),
        resolver.app_data_dir().unwrap_or_else(|_| install_dir.clone()),
    ];

    let default_root_dir = candidate_dirs
        .iter()
        .find(|dir| dir.join("trayclip.db").exists())
        .cloned()
        .or_else(|| candidate_dirs.iter().find(|dir| std::fs::create_dir_all(dir).is_ok()).cloned());

    let Some(default_root_dir) = default_root_dir else { return };

    // Check for marker in app_data_dir (writable) first, then root_dir (legacy)
    let marker = resolver.app_data_dir().ok()
        .map(|d| d.join(".restore-pending"))
        .filter(|p| p.exists())
        .unwrap_or_else(|| default_root_dir.join(".restore-pending"));
    let Ok(marker_content) = std::fs::read_to_string(&marker) else { return };

    let mut lines = marker_content.lines();
    let staging_path = lines.next().unwrap_or("").to_string();
    // Second line is the root_dir written by restore_backup (uses the same AppPaths::resolve)
    let root_dir = lines.next()
        .map(std::path::PathBuf::from)
        .filter(|p| p.exists())
        .unwrap_or(default_root_dir);

    let staging_dir = std::path::PathBuf::from(&staging_path);
    if !staging_dir.exists() {
        let _ = std::fs::remove_file(&marker);
        return;
    }

    eprintln!("[restore] staging_dir={}, root_dir={}", staging_dir.display(), root_dir.display());

    // Replace database
    let src_db = staging_dir.join("trayclip.db");
    let dst_db = root_dir.join("trayclip.db");
    if src_db.exists() {
        // Remove destination first to avoid file-lock issues with overwrite
        let _ = std::fs::remove_file(&dst_db);
        let _ = std::fs::remove_file(root_dir.join("trayclip.db-wal"));
        let _ = std::fs::remove_file(root_dir.join("trayclip.db-shm"));
        match std::fs::copy(&src_db, &dst_db) {
            Ok(bytes) => eprintln!("[restore] db copy ok, {} bytes", bytes),
            Err(e) => eprintln!("[restore] db copy failed: {}", e),
        }
    } else {
        eprintln!("[restore] source db not found at {}", src_db.display());
    }

    // Replace images
    let src_images = staging_dir.join("images");
    let dst_images = root_dir.join("images");
    if src_images.exists() {
        let _ = std::fs::remove_dir_all(&dst_images);
        if let Err(e) = std::fs::create_dir_all(&dst_images) {
            eprintln!("[restore] failed to create images dir: {}", e);
        }
        copy_dir_recursive(&src_images, &dst_images);
    }

    // Cleanup
    let _ = std::fs::remove_dir_all(&staging_dir);
    let _ = std::fs::remove_file(&marker);
    // Also clean legacy marker location
    let _ = std::fs::remove_file(root_dir.join(".restore-pending"));
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) {
    for entry in std::fs::read_dir(src).into_iter().flatten().flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            let _ = std::fs::create_dir_all(&dst_path);
            copy_dir_recursive(&src_path, &dst_path);
        } else {
            let _ = std::fs::copy(&src_path, &dst_path);
        }
    }
}

fn build_state(app: &tauri::AppHandle) -> anyhow::Result<AppState> {
    let paths = paths::AppPaths::resolve(app)?;
    let conn = db::open_database(&paths)?;
    let settings = db::load_settings(&conn)?;
    Ok(AppState {
        conn: Mutex::new(conn),
        paths,
        settings: RwLock::new(settings),
        permissions: RwLock::new(models::PermissionState::default()),
        last_clip_signature: Mutex::new(None),
        is_dragging: std::sync::Arc::new(Mutex::new(false)),
        #[cfg(target_os = "windows")]
        previous_hwnd: Mutex::new(0),
        #[cfg(target_os = "linux")]
        clipboard: Mutex::new(arboard::Clipboard::new().context("failed to initialize clipboard")?),
    })
}

fn show_main_window_centered(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // If already visible and focused, do nothing
        if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
            return;
        }
        if let Ok(Some(monitor)) = window.current_monitor() {
            let size = monitor.size();
            let pos = monitor.position();
            let win_w = 400;
            let win_h = 500;
            let x = pos.x + (size.width as i32 - win_w) / 2;
            let y = pos.y + (size.height as i32 - win_h) / 2;
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
        }
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("focus-main-search", ());
    }
}

fn setup_tray(app: &tauri::App) -> anyhow::Result<()> {
    let show_item = MenuItemBuilder::new("显示窗口").id("show").build(app)?;
    let quit_item = MenuItemBuilder::new("退出").id("quit").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("TrayClip")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window_centered(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    show_main_window_centered(app);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

pub fn register_global_shortcuts(handle: &tauri::AppHandle) -> anyhow::Result<()> {
    let state = handle.state::<AppState>();
    let hotkeys = {
        let conn = state.conn.lock();
        db::list_hotkeys(&conn).unwrap_or_default()
    };

    for hotkey in &hotkeys {
        let Ok(shortcut) = hotkey.hotkey_value.parse::<tauri_plugin_global_shortcut::Shortcut>() else {
            continue;
        };
        let action = hotkey.action_key.clone();
        let h = handle.clone();
        let _ = handle.global_shortcut().on_shortcut(
            shortcut,
            move |_app, _shortcut, event| {
                if event.state != tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    return;
                }
                match action.as_str() {
                    "open_main_window" => {
                        show_main_window_centered(&h);
                    }
                    "open_quick_panel" => {
                        if let Some(window) = h.get_webview_window("quick-panel") {
                            if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let app_state = h.state::<AppState>();
                                #[cfg(target_os = "windows")]
                                {
                                    let hwnd = unsafe { windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow() };
                                    if !hwnd.is_null() {
                                        *app_state.previous_hwnd.lock() = hwnd as usize;
                                    }
                                }
                                let panel_position = app_state.settings.read().panel_position.clone();
                                commands::position_quick_panel(&window, &panel_position);
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("focus-quick-search", ());
                            }
                        }
                    }
                    _ => {}
                }
            },
        );
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            // Hide Dock icon on macOS — keep only the menu bar tray icon
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            apply_pending_restore(app.handle());
            let state = build_state(&app.handle()).context("failed to initialize app state")?;
            app.manage(state);
            {
                let state = app.state::<AppState>();
                #[cfg(target_os = "linux")]
                {
                    let mut cb = state.clipboard.lock();
                    if let Ok(Some(signature)) = clipboard::peek_signature_with_state(&state.paths, &mut cb) {
                        *state.last_clip_signature.lock() = Some(signature);
                    }
                }
                #[cfg(not(target_os = "linux"))]
                {
                    if let Ok(Some(signature)) = clipboard::peek_clipboard_signature(&state.paths) {
                        *state.last_clip_signature.lock() = Some(signature);
                    }
                }
            }
            monitor::spawn_clipboard_monitor(app.handle().clone());
            setup_tray(app).context("failed to setup tray")?;

            if let Some(window) = app.get_webview_window("main") {
                let w = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = w.emit("close-requested", ());
                    }
                });
                // Ensure main window is focused on startup so frontend renders data
                let _ = window.show();
                let _ = window.set_focus();
            }

            {
                let state = app.state::<AppState>();
                let is_dragging = state.is_dragging.clone();
                if let Some(qp) = app.get_webview_window("quick-panel") {
                    let w = qp.clone();
                    qp.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(false) = event {
                            if !*is_dragging.lock() {
                                let _ = w.hide();
                            }
                        }
                    });
                }
            }

            // Auto-hide url-toast window on focus loss
            if let Some(ut) = app.get_webview_window("url-toast") {
                let w = ut.clone();
                ut.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = w.hide();
                    }
                });
            }

            let handle = app.handle().clone();
            if let Err(e) = register_global_shortcuts(&handle) {
                eprintln!("failed to register global shortcuts: {}", e);
            }

            // Sync autostart in background to avoid blocking startup
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    use tauri_plugin_autostart::ManagerExt;
                    let state = handle.state::<AppState>();
                    let launch = handle.autolaunch();
                    let want_enabled = state.settings.read().launch_on_startup;
                    let currently_enabled = launch.is_enabled().unwrap_or(false);
                    if want_enabled && !currently_enabled {
                        let _ = launch.enable().map_err(|e| eprintln!("[autostart] enable failed: {}", e));
                    } else if !want_enabled && currently_enabled {
                        let _ = launch.disable().map_err(|e| eprintln!("[autostart] disable failed: {}", e));
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap,
            commands::list_clips,
            commands::list_groups,
            commands::recopy_clip,
            commands::pin_toggle,
            commands::save_group,
            commands::delete_group,
            commands::move_clip_to_group,
            commands::delete_clip,
            commands::clear_history,
            commands::get_settings,
            commands::update_settings,
            commands::get_hotkeys,
            commands::update_hotkey_setting,
            commands::load_image_data_url,
            commands::get_permissions,
            commands::request_accessibility_permission,
            commands::hide_window,
            commands::quit_app,
            commands::toggle_quick_panel,
            commands::hide_quick_panel,
            commands::set_dragging,
            commands::simulate_paste,
            commands::check_update,
            commands::get_installer_type,
            commands::reload_global_shortcuts,
            commands::backup_data,
            commands::restore_backup,
            commands::show_url_toast
        ])
        .run(tauri::generate_context!())
        .expect("error while running trayclip");
}
