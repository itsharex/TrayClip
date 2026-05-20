use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{app_state::AppState, clipboard, db};

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
                if let Ok(Some((signature, _))) = clipboard::read_clipboard(&state.paths) {
                    *state.last_clip_signature.lock() = Some(signature);
                }
                thread::sleep(Duration::from_millis(900));
                continue;
            }

            match clipboard::read_clipboard(&state.paths) {
                Ok(Some((signature, clip))) => {
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
                Ok(None) => {}
                Err(_) => {}
            }

            thread::sleep(Duration::from_millis(900));
        }
    });
}
