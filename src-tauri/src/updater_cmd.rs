use std::io::Read;
use std::path::PathBuf;

use base64::Engine;
use serde::Serialize;
use tauri::AppHandle;

use crate::app_state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub download_url: String,
    pub signature: String,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_update(state: tauri::State<'_, AppState>) -> Result<Option<UpdateInfo>, String> {
    let settings = state.settings.read();
    let endpoints = vec![
        "https://github.com/Heyiki/TrayClip/releases/latest/download/latest.json".to_string(),
    ];
    drop(settings);

    let current_version = semver::Version::parse(env!("CARGO_PKG_VERSION"))
        .map_err(|e| format!("invalid current version: {e}"))?;

    let client = reqwest::Client::builder()
        .user_agent("trayclip-updater")
        .build()
        .map_err(|e| format!("build client: {e}"))?;

    let mut last_err = None;
    for endpoint in &endpoints {
        match client.get(endpoint).send().await {
            Ok(resp) if resp.status().is_success() => {
                let json: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("parse json: {e}"))?;

                let version_str = json["version"]
                    .as_str()
                    .ok_or("missing version field")?;
                let remote_version = semver::Version::parse(version_str.trim_start_matches('v'))
                    .map_err(|e| format!("invalid remote version: {e}"))?;

                if remote_version <= current_version {
                    return Ok(None);
                }

                let platforms = json["platforms"].as_object().ok_or("missing platforms")?;

                let target = resolve_target();
                let platform = platforms
                    .get(&target)
                    .or_else(|| platforms.get(&fallback_target()))
                    .ok_or(format!("no release for platform {target}"))?;

                let download_url = platform["url"]
                    .as_str()
                    .ok_or("missing url in platform")?
                    .to_string();
                let signature = platform["signature"]
                    .as_str()
                    .ok_or("missing signature in platform")?
                    .to_string();
                let body = json["notes"].as_str().map(|s| s.to_string());

                return Ok(Some(UpdateInfo {
                    version: version_str.to_string(),
                    download_url,
                    signature,
                    body,
                }));
            }
            Ok(resp) => {
                last_err = Some(format!("HTTP {}", resp.status()));
            }
            Err(e) => {
                last_err = Some(format!("request error: {e}"));
            }
        }
    }

    if let Some(err) = last_err {
        Err(err)
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn download_and_install_update(
    app: AppHandle,
    download_url: String,
    signature: String,
    on_progress: tauri::ipc::Channel<DownloadProgress>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("trayclip-updater")
        .build()
        .map_err(|e| format!("build client: {e}"))?;

    // Download
    let resp = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("download: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("download failed: HTTP {}", resp.status()));
    }

    let total = resp.content_length().unwrap_or(0);
    let _ = on_progress.send(DownloadProgress {
        event: "started".into(),
        content_length: Some(total),
        chunk_length: 0,
    });

    let mut bytes = Vec::new();
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download chunk: {e}"))?;
        let _ = on_progress.send(DownloadProgress {
            event: "progress".into(),
            content_length: None,
            chunk_length: chunk.len() as u64,
        });
        bytes.extend(chunk);
    }

    let _ = on_progress.send(DownloadProgress {
        event: "finished".into(),
        content_length: None,
        chunk_length: 0,
    });

    // Verify signature
    verify_signature(&bytes, &signature)?;

    // Install
    install_installer(&app, &bytes)?;

    Ok(())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub event: String,
    pub content_length: Option<u64>,
    pub chunk_length: u64,
}

fn verify_signature(data: &[u8], signature_b64: &str) -> Result<(), String> {
    use minisign_verify::{PublicKey, Signature};

    let pubkey_b64 = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDUzNDU4RDI3NkNGODI4MjIKUldRaUtQaHNKNDFGVStYMXBVbE0zTThFZUdGbWlQUHU1RFFxS2xMYmtVc0JrcVdWbmJkMnQ5anAK";

    let pub_key_str = String::from_utf8(
        base64::engine::general_purpose::STANDARD
            .decode(pubkey_b64)
            .map_err(|e| format!("decode pubkey: {e}"))?,
    )
    .map_err(|_| "pubkey is not valid utf8")?;

    let sig_str = String::from_utf8(
        base64::engine::general_purpose::STANDARD
            .decode(signature_b64)
            .map_err(|e| format!("decode signature: {e}"))?,
    )
    .map_err(|_| "signature is not valid utf8")?;

    let public_key = PublicKey::decode(&pub_key_str).map_err(|e| format!("parse pubkey: {e}"))?;
    let signature = Signature::decode(&sig_str).map_err(|e| format!("parse signature: {e}"))?;

    public_key
        .verify(data, &signature, true)
        .map_err(|_| "signature verification failed".to_string())?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn install_installer(app: &AppHandle, bytes: &[u8]) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOW;

    // Extract EXE from ZIP or use raw EXE
    let exe_path = if is_zip(bytes) {
        extract_exe_from_zip(bytes)?
    } else if is_exe(bytes) {
        write_to_temp(bytes, ".exe")?
    } else {
        return Err("unknown installer format".into());
    };

    let exe_path_str: Vec<u16> = exe_path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let args: Vec<u16> = "/SILENT /ARGS\0"
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    // Cleanup before exit
    app.cleanup_before_exit();

    unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            windows_sys::w!("open"),
            exe_path_str.as_ptr(),
            args.as_ptr(),
            std::ptr::null(),
            SW_SHOW,
        );
    }

    std::process::exit(0);
}

#[cfg(not(target_os = "windows"))]
fn install_installer(_app: &AppHandle, _bytes: &[u8]) -> Result<(), String> {
    Err("auto-install not supported on this platform".into())
}

fn is_zip(bytes: &[u8]) -> bool {
    bytes.len() >= 4 && bytes[0] == 0x50 && bytes[1] == 0x4B && bytes[2] == 0x03 && bytes[3] == 0x04
}

fn is_exe(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == 0x4D && bytes[1] == 0x5A
}

fn extract_exe_from_zip(bytes: &[u8]) -> Result<PathBuf, String> {
    let reader = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("open zip: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("read zip entry: {e}"))?;
        let name = entry.name().to_string();

        if name.ends_with(".exe") {
            let temp_dir = tempfile::Builder::new()
                .prefix("trayclip-update-")
                .tempdir()
                .map_err(|e| format!("create tempdir: {e}"))?;

            let exe_path = temp_dir.path().join(
                std::path::Path::new(&name)
                    .file_name()
                    .unwrap_or(std::ffi::OsStr::new("installer.exe")),
            );

            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("read exe from zip: {e}"))?;

            std::fs::write(&exe_path, &buf).map_err(|e| format!("write exe: {e}"))?;

            // Keep the tempdir so it isn't cleaned up before the installer runs
            let _ = temp_dir.keep();
            return Ok(exe_path);
        }
    }

    Err("no .exe found in zip".into())
}

fn write_to_temp(bytes: &[u8], ext: &str) -> Result<PathBuf, String> {
    let temp_dir = tempfile::Builder::new()
        .prefix("trayclip-update-")
        .tempdir()
        .map_err(|e| format!("create tempdir: {e}"))?;

    let file_path = temp_dir
        .path()
        .join(format!("installer{ext}"));

    std::fs::write(&file_path, bytes).map_err(|e| format!("write installer: {e}"))?;

    // Keep the tempdir so it isn't cleaned up before the installer runs
    let _ = temp_dir.keep();
    Ok(file_path)
}

fn resolve_target() -> String {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x86_64"
    };

    // Windows NSIS builds use "windows-x86_64" key (no installer suffix)
    // because tauri-action generates latest.json with that key
    format!("{os}-{arch}")
}

fn fallback_target() -> String {
    resolve_target()
}
