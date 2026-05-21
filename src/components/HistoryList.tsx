import { useEffect, useRef, useState } from "react";
import type { ClipGroup, ClipRecord } from "../lib/types";
import { useTranslation } from "../lib/i18n";
import { useImagePreview } from "../hooks/useImagePreview";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".tiff", ".tif", ".svg"]);

function isImagePath(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

interface GroupSelectPopoverProps {
  groups: ClipGroup[];
  currentGroupId: number | null;
  onSelect: (groupId: number | null) => void;
}

function GroupSelectPopover({ groups, currentGroupId, onSelect }: GroupSelectPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  const currentName = currentGroupId != null ? groups.find((g) => g.id === currentGroupId)?.name ?? t.ungrouped : t.ungrouped;
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(keyword.toLowerCase()));

  return (
    <>
      <button ref={btnRef} className="group-select-btn" onClick={() => setOpen(true)}>{currentName}</button>
      {open ? (
        <div className="group-select-backdrop" onClick={() => { setOpen(false); setKeyword(""); }}>
          <div className="group-select-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="group-select-sheet__header">
              <input autoFocus className="group-select-search" placeholder={t.searchGroup} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>
            <div className="group-select-list">
              <button className={currentGroupId == null ? "group-select-item active" : "group-select-item"} onClick={() => { onSelect(null); setOpen(false); setKeyword(""); }}>{t.ungrouped}</button>
              {filtered.map((group) => (
                <button key={group.id} className={currentGroupId === group.id ? "group-select-item active" : "group-select-item"} onClick={() => { onSelect(group.id); setOpen(false); setKeyword(""); }}>{group.name}</button>
              ))}
              {filtered.length === 0 && groups.length > 0 ? <div className="empty-state">{t.noMatchGroup}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FileThumb({ path }: { path: string }) {
  const thumbSrc = useImagePreview(path);
  return <img className="clip-file-thumb" src={thumbSrc ?? undefined} alt={path.split(/[/\\]/).pop() ?? "图片"} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
}

interface ClipCardProps {
  clip: ClipRecord;
  selected: boolean;
  groups: ClipGroup[];
  onRecopy: (clipId: number) => void;
  onPinToggle: (clipId: number, pinned: boolean) => void;
  onMoveGroup: (clipId: number, groupId: number | null) => void;
  onDelete: (clipId: number) => void;
}

function ClipCard({ clip, selected, groups, onRecopy, onPinToggle, onMoveGroup, onDelete }: ClipCardProps) {
  const { t } = useTranslation();
  const isFilePaths = clip.content_type === "file_paths";
  const imagePaths = isFilePaths ? clip.file_paths.filter(isImagePath) : [];
  const otherPaths = isFilePaths ? clip.file_paths.filter((p) => !isImagePath(p)) : [];
  const singleImage = imagePaths.length === 1 && otherPaths.length === 0;
  const clipImageSrc = useImagePreview(clip.content_type === "image" ? clip.image_path : null);

  return (
    <article className={`clip-card${clip.is_pinned ? " pinned" : ""}${selected ? " selected" : ""}`}>
      <div className="clip-card__header">
        <span className="clip-type">{t.contentType[clip.content_type] ?? clip.content_type}</span>
        {clip.is_pinned ? <span className="clip-pin-badge">{t.pinned}</span> : null}
        {clip.source_app && clip.source_app !== "—" ? <span className="clip-source">{clip.source_app}</span> : null}
        <span className="clip-time">{new Date(clip.updated_at).toLocaleString("zh-CN")}</span>
        {clip.is_truncated ? <span className="clip-tag">{t.contentTruncated}</span> : null}
      </div>

      {clip.content_type === "image" && clip.image_path ? <img className="clip-image-preview" src={clipImageSrc ?? undefined} alt="clipboard image" /> : null}
      {isFilePaths && imagePaths.length > 0 ? <div className="clip-file-images">{imagePaths.slice(0, 2).map((path) => <FileThumb key={path} path={path} />)}</div> : null}

      {isFilePaths ? (
        singleImage ? null : (
          <div className="clip-file-paths" title={clip.file_paths.join("\n")}>
            {otherPaths.slice(0, 2).map((path) => <div key={path} className="clip-file-path">{path}</div>)}
            {otherPaths.length > 2 ? <div className="clip-file-path clip-file-more">{t.moreFiles(otherPaths.length - 2)}</div> : null}
          </div>
        )
      ) : <div className="clip-summary" title={clip.plain_text || clip.summary}>{clip.summary}</div>}

      <div className="clip-actions">
        <button className="primary" onClick={() => onRecopy(clip.id)}>{t.copy}</button>
        <button onClick={() => onPinToggle(clip.id, !clip.is_pinned)}>{clip.is_pinned ? t.unpin : t.pin}</button>
        <GroupSelectPopover groups={groups} currentGroupId={clip.group_id} onSelect={(groupId) => onMoveGroup(clip.id, groupId)} />
        <button className="ghost danger" onClick={() => onDelete(clip.id)}>{t.delete}</button>
      </div>
    </article>
  );
}

interface HistoryListProps {
  clips: ClipRecord[];
  groups: ClipGroup[];
  autoSelect?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onAutoSelectDone?: () => void;
  onRecopy: (clipId: number) => void;
  onPinToggle: (clipId: number, pinned: boolean) => void;
  onMoveGroup: (clipId: number, groupId: number | null) => void;
  onDelete: (clipId: number) => void;
}

export function HistoryList({ clips, groups, autoSelect, scrollRef, onAutoSelectDone, onRecopy, onPinToggle, onMoveGroup, onDelete }: HistoryListProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const internalRef = useRef<HTMLDivElement>(null);
  const listRef = scrollRef ?? internalRef;

  useEffect(() => { setSelectedIndex(-1); }, [clips]);

  useEffect(() => {
    if (autoSelect && clips.length > 0) {
      setSelectedIndex(0);
      onAutoSelectDone?.();
    }
  }, [autoSelect, clips.length, onAutoSelectDone]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (clips.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, clips.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectedIndex >= 0 && clips[selectedIndex]) {
        e.preventDefault();
        onRecopy(clips[selectedIndex].id);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [clips, selectedIndex, onRecopy]);

  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return;
    listRef.current.querySelector(".clip-card.selected")?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (clips.length === 0) {
    return <div className="history-list"><div className="empty-state">{t.emptyRecords}</div></div>;
  }

  return <div className="history-list" ref={listRef}>{clips.map((clip, index) => <ClipCard key={clip.id} clip={clip} selected={index === selectedIndex} groups={groups} onRecopy={onRecopy} onPinToggle={onPinToggle} onMoveGroup={onMoveGroup} onDelete={onDelete} />)}</div>;
}
