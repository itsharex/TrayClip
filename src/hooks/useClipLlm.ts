import { useCallback, useMemo, useRef, useState } from "react";
import type { AppSettings } from "@/lib/types";
import { extractKeywords, summarizeText } from "@/lib/llm";
import { useTranslation } from "@/lib/i18n";

interface LlmState {
    loading: boolean;
    action: string;
    result: string | null;
    error: string | null;
}

const IDLE: LlmState = { loading: false, action: "", result: null, error: null };

export function useClipLlm(settings: AppSettings) {
    const { t } = useTranslation();
    const [llmState, setLlmState] = useState<LlmState>(IDLE);
    const abortRef = useRef<AbortController | null>(null);

    const config = useMemo(
        () => ({ apiUrl: settings.llm_api_url, apiKey: settings.llm_api_key, model: settings.llm_model }),
        [settings.llm_api_url, settings.llm_api_key, settings.llm_model],
    );

    const enabled = !!(settings.llm_enabled && settings.llm_api_url && settings.llm_api_key && settings.llm_model);

    const start = useCallback((action: string) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLlmState({ loading: true, action, result: null, error: null });
        return controller.signal;
    }, []);

    const close = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLlmState(IDLE);
    }, []);

    const handleExtractKeywords = useCallback(async (text: string) => {
        const signal = start(t.extractKeywords);
        try {
            const keywords = await extractKeywords(config, text, signal);
            setLlmState({ loading: false, action: "", result: keywords, error: null });
        } catch {
            if (!signal.aborted) setLlmState({ loading: false, action: "", result: null, error: t.aiFailed });
        }
    }, [config, start, t.extractKeywords, t.aiFailed]);

    const handleSummarize = useCallback(async (text: string) => {
        const signal = start(t.aiSummarize);
        try {
            const summary = await summarizeText(config, text, signal);
            setLlmState({ loading: false, action: "", result: summary, error: null });
        } catch {
            if (!signal.aborted) setLlmState({ loading: false, action: "", result: null, error: t.aiFailed });
        }
    }, [config, start, t.aiSummarize, t.aiFailed]);

    return { llmState, enabled, config, close, handleExtractKeywords, handleSummarize };
}
