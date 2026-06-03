import { Copy, X } from "lucide-react";
import { useTranslation } from "../lib/i18n";

interface LLMResultDialogProps {
    loading: boolean;
    action: string;
    result: string | null;
    error: string | null;
    onCopy: () => void;
    onClose: () => void;
}

export default function LLMResultDialog({ loading, action, result, error, onCopy, onClose }: LLMResultDialogProps) {
    const { t } = useTranslation();

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="llm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="llm-dialog__header">{t.aiResult}</div>
                {loading ? (
                    <div className="llm-dialog__loading">{action ? `${action}...` : t.aiProcessing}</div>
                ) : error ? (
                    <div className="llm-dialog__error">{error}</div>
                ) : (
                    <pre className="llm-dialog__content">{result}</pre>
                )}
                <div className="llm-dialog__disclaimer">{t.aiDisclaimer}</div>
                <div className="llm-dialog__actions">
                    <button className="llm-dialog__btn llm-dialog__btn--close" onClick={onClose} title={t.cancel}>
                        <X size={14} />
                    </button>
                    {!loading && !error && result ? (
                        <button className="llm-dialog__btn llm-dialog__btn--copy" onClick={onCopy} title={t.copyResult}>
                            <Copy size={14} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
