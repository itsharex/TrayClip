const version = import.meta.env.TAURI_ENV_VERSION ?? "0.0.0";

export function useAppVersion() {
    return version;
}
