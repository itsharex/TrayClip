use std::sync::Arc;
#[cfg(target_os = "linux")]
use arboard::Clipboard;
use parking_lot::{Mutex, RwLock};
use rusqlite::Connection;

use crate::{models::{AppSettings, PermissionState}, paths::AppPaths};

pub struct AppState {
    pub conn: Mutex<Connection>,
    pub paths: AppPaths,
    pub settings: RwLock<AppSettings>,
    pub permissions: RwLock<PermissionState>,
    pub last_clip_signature: Mutex<Option<String>>,
    pub is_dragging: Arc<Mutex<bool>>,
    #[cfg(target_os = "windows")]
    pub previous_hwnd: Mutex<usize>,
    #[cfg(target_os = "linux")]
    pub clipboard: Mutex<Clipboard>,
}
