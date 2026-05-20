use std::path::PathBuf;

use anyhow::Context;
use tauri::Manager;

#[derive(Debug, Clone)]
pub struct AppPaths {
    #[allow(dead_code)]
    pub root_dir: PathBuf,
    pub db_path: PathBuf,
    pub images_dir: PathBuf,
    pub exports_dir: PathBuf,
}

impl AppPaths {
    pub fn resolve<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> anyhow::Result<Self> {
        let resolver = app.path();
        let install_dir = resolver
            .resource_dir()
            .or_else(|_| resolver.app_config_dir())
            .or_else(|_| resolver.app_data_dir())
            .context("failed to resolve application directories")?;

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
        let exports_dir = root_dir.join("exports");

        std::fs::create_dir_all(&images_dir)?;
        std::fs::create_dir_all(&exports_dir)?;

        Ok(Self {
            root_dir,
            db_path,
            images_dir,
            exports_dir,
        })
    }
}
