import { useState, useCallback } from "react";
import type { ConfirmState } from "@/lib/types";

export function useConfirmDialog() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!confirm) return;
    try {
      await confirm.onConfirm();
    } catch {
      // ignore
    } finally {
      setConfirm(null);
    }
  }, [confirm]);

  const handleCancel = useCallback(async () => {
    if (!confirm) return;
    try {
      if (confirm.onCancel) await confirm.onCancel();
    } catch {
      // ignore
    } finally {
      setConfirm(null);
    }
  }, [confirm]);

  return { confirm, setConfirm, handleConfirm, handleCancel };
}