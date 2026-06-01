import { useCallback, useEffect, useRef, useState } from "react";

export interface ContextMenuItem {
    label: string;
    danger?: boolean;
    separator?: boolean;
    onClick?: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x, y });

    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let nx = x;
        let ny = y;
        if (x + rect.width > vw) nx = vw - rect.width - 4;
        if (y + rect.height > vh) ny = vh - rect.height - 4;
        if (nx < 0) nx = 4;
        if (ny < 0) ny = 4;
        if (nx !== x || ny !== y) setPos({ x: nx, y: ny });
    }, [x, y]);

    const handleClickOutside = useCallback(
        (e: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        },
        [onClose],
    );

    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("pointerdown", handleClickOutside, true);
        document.addEventListener("keydown", handleKeydown, { once: true });
        return () => {
            document.removeEventListener("pointerdown", handleClickOutside, true);
            document.removeEventListener("keydown", handleKeydown);
        };
    }, [handleClickOutside, onClose]);

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{ left: pos.x, top: pos.y }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            {items.map((item, i) =>
                item.separator ? (
                    <div key={i} className="context-menu__separator" />
                ) : (
                    <button
                        key={i}
                        className={`context-menu__item${item.danger ? " context-menu__item--danger" : ""}`}
                        onClick={() => {
                            item.onClick?.();
                            onClose();
                        }}
                    >
                        {item.label}
                    </button>
                ),
            )}
        </div>
    );
}
