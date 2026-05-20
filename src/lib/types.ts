export type ClipContentType = "plain_text" | "rich_text" | "image" | "file_paths";

export interface ClipRecord {
  id: number;
  content_type: ClipContentType;
  plain_text: string | null;
  rich_text: string | null;
  summary: string;
  image_path: string | null;
  file_paths: string[];
  source_app: string;
  is_pinned: boolean;
  is_truncated: boolean;
  group_id: number | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface ClipGroup {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  retention_limit: number;
  launch_on_startup: boolean;
  pause_capture: boolean;
  locale: string;
  accessibility_prompted: boolean;
  close_behavior: "hide" | "exit" | "ask";
  panel_position: "center" | "follow_mouse";
}

export type HotkeyActionKey = "open_main_window" | "open_quick_panel";

export interface HotkeySetting {
  action_key: HotkeyActionKey;
  hotkey_value: string;
}

export interface ListClipsRequest {
  page: number;
  page_size: number;
  keyword?: string;
  group_id?: number | null;
  pinned_only?: boolean;
}

export interface ListClipsResponse {
  items: ClipRecord[];
  total: number;
  has_more: boolean;
}

export interface PermissionState {
  accessibility_granted: boolean;
  accessibility_required_for_paste: boolean;
}

export interface BootstrapPayload {
  clips: ListClipsResponse;
  groups: ClipGroup[];
  settings: AppSettings;
  hotkeys: HotkeySetting[];
  permissions: PermissionState;
}

export interface ExportHistoryRequest {
  format: "json" | "csv";
  scope: "all" | "current_group" | "pinned";
  group_id?: number | null;
  output_dir?: string | null;
}
