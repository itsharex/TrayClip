use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{app_state::AppState, clipboard, db};

#[cfg(target_os = "linux")]
fn try_read_clipboard(state: &AppState) -> Option<(String, crate::models::NewClipRecord)> {
    let mut cb = state.clipboard.try_lock()?;
    clipboard::read_clipboard_with_state(&state.paths, &mut cb).ok().flatten()
}

#[cfg(not(target_os = "linux"))]
fn try_read_clipboard(state: &AppState) -> Option<(String, crate::models::NewClipRecord)> {
    clipboard::read_clipboard(&state.paths).ok().flatten()
}

pub fn spawn_clipboard_monitor<R: Runtime>(app: AppHandle<R>) {
    thread::spawn(move || {
        let mut was_paused = false;

        loop {
            let state = app.state::<AppState>();
            let settings = state.settings.read().clone();

            if settings.pause_capture {
                was_paused = true;
                thread::sleep(Duration::from_millis(900));
                continue;
            }

            if was_paused {
                was_paused = false;
                if let Some((signature, _)) = try_read_clipboard(&state) {
                    *state.last_clip_signature.lock() = Some(signature);
                }
                thread::sleep(Duration::from_millis(900));
                continue;
            }

            if let Some((signature, clip)) = try_read_clipboard(&state) {
                let mut last_signature = state.last_clip_signature.lock();
                if last_signature.as_ref() != Some(&signature) {
                    let cleanup_images = {
                        let conn = state.conn.lock();
                        db::ingest_clip(&conn, &settings, clip).ok();
                        db::cleanup_overflow(&conn, settings.retention_limit).unwrap_or_default()
                    };
                    for image in cleanup_images {
                        let _ = std::fs::remove_file(image);
                    }
                    *last_signature = Some(signature);
                    let _ = app.emit("clips://updated", ());
                }
            }

            thread::sleep(Duration::from_millis(900));
        }
    });
}
