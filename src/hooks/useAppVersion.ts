import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

export function useAppVersion(fallback = "0.0.0") {
    const [version, setVersion] = useState(fallback);

    useEffect(() => {
        getVersion().then(setVersion).catch(() => {});
    }, []);

    return version;
}
