import type { BootstrapPayload } from "./types";

export const FALLBACK_BOOTSTRAP: BootstrapPayload = {
    clips: { items: [], total: 0, has_more: false },
    groups: [],
    settings: {
        retention_limit: 200,
        launch_on_startup: false,
        pause_capture: false,
        locale: "zh-CN",
        accessibility_prompted: false,
        close_behavior: "hide",
        panel_position: "center",
        quick_paste: false,
        url_toast: false,
    },
    hotkeys: [],
    permissions: {
        accessibility_granted: false,
        accessibility_required_for_paste: true,
    },
};
