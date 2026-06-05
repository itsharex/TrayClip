import { useEffect, useRef, useState } from "react";
import { loadImageDataUrl } from "../lib/api";

export function useImagePreview(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!path) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setSrc(null);
      return;
    }

    void loadImageDataUrl(path)
      .then((dataUrl) => {
        if (cancelled) return;
        // Convert data URL to blob URL to reduce memory overhead
        fetch(dataUrl)
          .then((r) => r.blob())
          .then((blob) => {
            if (cancelled) {
              URL.revokeObjectURL(URL.createObjectURL(blob));
              return;
            }
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            setSrc(url);
          })
          .catch(() => { if (!cancelled) setSrc(dataUrl); }); // fallback to data URL
      })
      .catch(() => { if (!cancelled) setSrc(null); });

    return () => {
      cancelled = true;
    };
  }, [path]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return src;
}
