import { useState } from "react";
import { Copy, X, Languages } from "lucide-react";
import { bingTranslate } from "../lib/api";
import { translateText } from "../lib/llm";
import type { LLMConfig } from "../lib/llm";
import { useTranslation } from "../lib/i18n";

interface TranslateDialogProps {
    text: string;
    llmConfig: LLMConfig;
    llmEnabled: boolean;
    aiTranslate: boolean;
    onClose: () => void;
}

const LANGUAGES = [
    { code: "zh-Hans", label: "中文", llmCode: "zh" },
    { code: "en", label: "English", llmCode: "en" },
    { code: "ja", label: "日本語", llmCode: "ja" },
    { code: "ko", label: "한국어", llmCode: "ko" },
    { code: "fr", label: "Français", llmCode: "fr" },
    { code: "es", label: "Español", llmCode: "es" },
    { code: "de", label: "Deutsch", llmCode: "de" },
    { code: "ru", label: "Русский", llmCode: "ru" },
];

export default function TranslateDialog({ text, llmConfig, llmEnabled, aiTranslate, onClose }: TranslateDialogProps) {
    const useAI = aiTranslate && llmEnabled;
    const { t, locale } = useTranslation();
    const [targetLang, setTargetLang] = useState(() => locale === "zh-CN" ? "zh-Hans" : "en");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTranslate = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            let translated: string;
            if (useAI) {
                const lang = LANGUAGES.find((l) => l.code === targetLang);
                translated = await translateText(llmConfig, text, lang?.llmCode ?? targetLang);
            } else {
                translated = await bingTranslate(text, "", targetLang);
            }
            setResult(translated);
        } catch {
            setError(t.translateFailed);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (result) void navigator.clipboard.writeText(result);
        onClose();
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="llm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="llm-dialog__header"><Languages size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{t.translate}</div>
                <div className="translate-dialog__controls">
                    <label className="translate-dialog__label">{t.translateTarget}</label>
                    <select className="translate-dialog__select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <button className="llm-dialog__btn llm-dialog__btn--copy" onClick={() => void handleTranslate()} disabled={loading} style={{ marginTop: 8 }}>
                        {loading ? t.translating : t.translateBtn}
                    </button>
                </div>
                {loading ? (
                    <div className="llm-dialog__loading">{t.translating}</div>
                ) : error ? (
                    <div className="llm-dialog__error">{error}</div>
                ) : result ? (
                    <pre className="llm-dialog__content">{result}</pre>
                ) : null}
                <div className="llm-dialog__disclaimer">{useAI ? t.aiDisclaimer : t.bingSource}</div>
                <div className="llm-dialog__actions">
                    <button className="llm-dialog__btn llm-dialog__btn--close" onClick={onClose} title={t.cancel}>
                        <X size={14} />
                    </button>
                    {!loading && !error && result ? (
                        <button className="llm-dialog__btn llm-dialog__btn--copy" onClick={handleCopy} title={t.copyResult}>
                            <Copy size={14} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
