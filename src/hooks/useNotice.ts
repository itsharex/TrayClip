import { useCallback, useEffect, useRef, useState } from "react";

export function useNotice(duration = 1500) {
    const [notice, setNotice] = useState<string | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    const showNotice = useCallback((message: string) => {
        setNotice(message);
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
            setNotice(null);
            timerRef.current = null;
        }, duration);
    }, [duration]);

    return { notice, showNotice };
}
