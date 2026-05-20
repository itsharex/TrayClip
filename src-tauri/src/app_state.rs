use std::sync::Arc;
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
}
