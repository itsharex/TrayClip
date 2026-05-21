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
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let app_state = h.state::<AppState>();
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
            let state = build_state(&app.handle()).context("failed to initialize app state")?;
            app.manage(state);
            {
                let state = app.state::<AppState>();
                if let Ok(Some(signature)) = clipboard::peek_clipboard_signature(&state.paths) {
                    *state.last_clip_signature.lock() = Some(signature);
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

            let handle = app.handle().clone();
            if let Err(e) = register_global_shortcuts(&handle) {
                eprintln!("failed to register global shortcuts: {}", e);
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
            commands::export_history,
            commands::import_history,
            commands::load_image_data_url,
            commands::get_permissions,
            commands::request_accessibility_permission,
            commands::hide_window,
            commands::quit_app,
            commands::toggle_quick_panel,
            commands::hide_quick_panel,
            commands::set_dragging,
            commands::check_update,
            commands::reload_global_shortcuts
        ])
        .run(tauri::generate_context!())
        .expect("error while running trayclip");
}

