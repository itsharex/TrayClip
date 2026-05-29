use std::path::PathBuf;

use anyhow::Context;
use tauri::Manager;

#[derive(Debug, Clone)]
pub struct AppPaths {
    #[allow(dead_code)]
    pub root_dir: PathBuf,
    pub db_path: PathBuf,
    pub images_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> anyhow::Result<Self> {
        let resolver = app.path();

        // macOS: data always in app_data_dir(), because resource_dir() is inside
        // the .app bundle and gets replaced on update.
        #[cfg(target_os = "macos")]
        let candidate_dirs = [
            resolver.app_data_dir().context("failed to resolve app data directory")?,
        ];

        // Windows/Linux: resource_dir()/data is safe (persists across updates).
        #[cfg(not(target_os = "macos"))]
        let install_dir = resolver
            .resource_dir()
            .or_else(|_| resolver.app_config_dir())
            .or_else(|_| resolver.app_data_dir())
            .context("failed to resolve application directories")?;

        #[cfg(not(target_os = "macos"))]
        let candidate_dirs = [
            install_dir.join("data"),
            resolver.app_data_dir().context("failed to resolve app data directory")?,
        ];

        let root_dir = candidate_dirs
            .iter()
            .find(|dir| dir.join("trayclip.db").exists())
            .cloned()
            .or_else(|| {
                candidate_dirs
                    .iter()
                    .find(|dir| std::fs::create_dir_all(dir).is_ok())
                    .cloned()
            })
            .context("failed to create writable data directory")?;

        let db_path = root_dir.join("trayclip.db");
        let images_dir = root_dir.join("images");

        std::fs::create_dir_all(&images_dir)?;

        Ok(Self {
            root_dir,
            db_path,
            images_dir,
        })
    }
}
