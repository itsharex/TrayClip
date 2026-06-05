import { useEffect, useRef, useState } from "react";
import type { AppSettings, ClipGroup, ClipRecord } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { ClipCard } from "@/components/ClipCard";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClipListProps {
  clips: ClipRecord[];
  groups: ClipGroup[];
  settings: AppSettings;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onRecopy: (clipId: number) => void;
  onPinToggle: (clipId: number, pinned: boolean) => void;
  onMoveGroup: (clipId: number, groupId: number | null) => void;
  onDelete: (clipId: number) => void;
}

export function ClipList({
  clips,
  groups,
  settings,
  scrollRef,
  onRecopy,
  onPinToggle,
  onMoveGroup,
  onDelete,
}: ClipListProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedIndexRef = useRef(selectedIndex);
  const pendingDeltaRef = useRef(0);
  const flushRafRef = useRef(0);
  const internalRef = useRef<HTMLDivElement>(null);
  const listRef = scrollRef ?? internalRef;

  useEffect(() => { setSelectedIndex(-1); selectedIndexRef.current = -1; }, [clips]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (clips.length === 0) return;
      if (e.key === "Enter" && selectedIndexRef.current >= 0 && clips[selectedIndexRef.current]) {
        e.preventDefault();
        onRecopy(clips[selectedIndexRef.current].id);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        pendingDeltaRef.current += 1;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        pendingDeltaRef.current -= 1;
      } else {
        return;
      }
      if (!flushRafRef.current) {
        flushRafRef.current = requestAnimationFrame(() => {
          flushRafRef.current = 0;
          const delta = pendingDeltaRef.current;
          pendingDeltaRef.current = 0;
          if (delta === 0) return;
          setSelectedIndex((prev) => {
            const next = prev === -1 ? 0 : prev + delta;
            const clamped = Math.max(0, Math.min(clips.length - 1, next));
            selectedIndexRef.current = clamped;
            return clamped;
          });
        });
      }
    };
    document.addEventListener("keydown", handleKeydown, true);
    return () => {
      document.removeEventListener("keydown", handleKeydown, true);
      cancelAnimationFrame(flushRafRef.current);
    };
  }, [clips, onRecopy]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    requestAnimationFrame(() => {
      listRef.current?.querySelector("[data-selected]")?.scrollIntoView({ block: "nearest" });
    });
  }, [selectedIndex, listRef]);

  if (clips.length === 0) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-1 p-8">
        <p className="text-xs text-muted-foreground/40">{t.emptyRecords}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full flex-1" ref={listRef}>
      <div className="flex w-full flex-col gap-1.5 px-1.5 pt-1.5 pb-1.5">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            data-selected={index === selectedIndex ? "" : undefined}
            className="group"
          >
            <ClipCard
              clip={clip}
              selected={index === selectedIndex}
              groups={groups}
              settings={settings}
              onRecopy={onRecopy}
              onPinToggle={onPinToggle}
              onMoveGroup={onMoveGroup}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
