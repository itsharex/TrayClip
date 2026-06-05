import { useCallback, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { ClipGroup } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GroupBarProps {
  groups: ClipGroup[];
  selectedGroupId: number | null;
  onSelect: (groupId: number | null) => void;
  onCreate: (name: string) => void;
  onRename: (groupId: number, name: string) => void;
  onDelete: (group: ClipGroup) => void;
}

export function GroupBar({
  groups,
  selectedGroupId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: GroupBarProps) {
  const { t } = useTranslation();
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    if (name) {
      onCreate(name);
      setNewName("");
      setShowInput(false);
    }
  }, [newName, onCreate]);

  const handleCommitRename = useCallback(() => {
    if (renamingId !== null) {
      const name = renameValue.trim();
      if (name) onRename(renamingId, name);
      setRenamingId(null);
    }
  }, [renamingId, renameValue, onRename]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToElement = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const container = scrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
      const target = btnCenter - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    });
  }, []);

  return (
    <div ref={scrollRef} className="flex flex-shrink-0 items-center gap-1.5 overflow-x-auto bg-muted px-3 py-1.5 scrollbar-none">
      <button
        className={`inline-flex h-[26px] shrink-0 items-center rounded-md px-2.5 text-xs font-medium transition-all duration-150 ${
          selectedGroupId === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/70 hover:bg-muted hover:text-foreground"
        }`}
        onClick={(e) => { onSelect(null); scrollToElement(e); }}
      >
        {t.all}
      </button>

      {groups.map((group) =>
        renamingId === group.id ? (
          <Input
            key={group.id}
            autoFocus
            className="h-[26px] w-20 shrink-0 rounded-md border-0 bg-muted px-2.5 text-xs"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommitRename();
              if (e.key === "Escape") setRenamingId(null);
            }}
            onBlur={handleCommitRename}
            maxLength={10}
          />
        ) : (
          <button
            key={group.id}
            className={`inline-flex h-[26px] shrink-0 items-center rounded-md px-2.5 text-xs font-medium transition-all duration-150 ${
              selectedGroupId === group.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`}
            onClick={(e) => { onSelect(group.id); scrollToElement(e); }}
            onDoubleClick={() => {
              setRenamingId(group.id);
              setRenameValue(group.name);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onDelete(group);
            }}
            title={t.renameGroupHint(group.name)}
          >
            {group.name}
          </button>
        )
      )}

      {showInput ? (
        <Input
          autoFocus
          className="h-[26px] w-20 shrink-0 rounded-md border-0 bg-muted px-2.5 text-xs"
          placeholder={t.groupNamePlaceholder}
          maxLength={10}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") { setShowInput(false); setNewName(""); }
          }}
          onBlur={() => { if (!newName.trim()) setShowInput(false); }}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-[26px] w-[26px] shrink-0 rounded-md text-muted-foreground/50 hover:text-foreground"
          onClick={() => setShowInput(true)}
          title={t.createGroup}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}

    </div>
  );
}
