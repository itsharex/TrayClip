import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error" | "not-available";

export interface UpdaterState {
    status: UpdateStatus;
    version: string;
    body: string;
    downloadedBytes: number;
    totalBytes: number;
    error: string | null;
}

const initialState: UpdaterState = {
    status: "idle",
    version: "",
    body: "",
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
};

export function useUpdater(autoCheck = false) {
    const [state, setState] = useState<UpdaterState>(initialState);
    const updateRef = useRef<Update | null>(null);
    const checkedRef = useRef(false);

    const doCheck = useCallback(async () => {
        setState((s) => ({ ...s, status: "checking", error: null }));
        try {
            const update = await check();
            if (update) {
                updateRef.current = update;
                setState({
                    status: "available",
                    version: update.version,
                    body: update.body ?? "",
                    downloadedBytes: 0,
                    totalBytes: 0,
                    error: null,
                });
            } else {
                setState((s) => ({ ...s, status: "not-available" }));
            }
        } catch (e) {
            setState((s) => ({ ...s, status: "error", error: String(e) }));
        }
    }, []);

    const doDownload = useCallback(async () => {
        const update = updateRef.current;
        if (!update) return;
        setState((s) => ({ ...s, status: "downloading", downloadedBytes: 0, totalBytes: 0, error: null }));
        try {
            let downloaded = 0;
            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        setState((s) => ({ ...s, totalBytes: event.data.contentLength ?? 0 }));
                        break;
                    case "Progress":
                        downloaded += event.data.chunkLength;
                        setState((s) => ({ ...s, downloadedBytes: downloaded }));
                        break;
                    case "Finished":
                        setState((s) => ({ ...s, status: "downloaded" }));
                        break;
                }
            });
        } catch (e) {
            setState((s) => ({ ...s, status: "error", error: String(e) }));
        }
    }, []);

    const doRelaunch = useCallback(async () => {
        try {
            await relaunch();
        } catch (e) {
            setState((s) => ({ ...s, status: "error", error: String(e) }));
        }
    }, []);

    // Auto-check on mount
    useEffect(() => {
        if (autoCheck && !checkedRef.current) {
            checkedRef.current = true;
            void doCheck();
        }
    }, [autoCheck, doCheck]);

    return { ...state, doCheck, doDownload, doRelaunch };
}
