import { useEffect, useState } from "react";
import { loadImageDataUrl } from "../lib/api";

export function useImagePreview(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!path) {
      setSrc(null);
      return;
    }

    setSrc(null);
    void loadImageDataUrl(path)
      .then((value) => {
        if (!cancelled) {
          setSrc(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return src;
}
