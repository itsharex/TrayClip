export interface LLMConfig {
    apiUrl: string;
    apiKey: string;
    model: string;
}

const SYSTEM_PROMPT = "You are a text processing assistant. Output result only, no explanation.";

async function callLLM(
    config: LLMConfig,
    taskPrompt: string,
    userContent: string,
    options?: { temperature?: number; signal?: AbortSignal },
): Promise<string> {
    const url = config.apiUrl.replace(/\/+$/, "") + "/chat/completions";
    const userMessage = `${taskPrompt}\n\n<clipboard>\n${userContent}\n</clipboard>`;
    const resp = await fetch(url, {
        method: "POST",
        signal: options?.signal,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            temperature: options?.temperature ?? 0.2,
        }),
    });

    if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function extractKeywords(config: LLMConfig, text: string, signal?: AbortSignal): Promise<string> {
    return callLLM(
        config,
        "Extract the main keywords from the text. Return them as a comma-separated list. Use the same language as the source text.",
        text,
        { temperature: 0.2, signal },
    );
}

export async function summarizeText(config: LLMConfig, text: string, signal?: AbortSignal): Promise<string> {
    return callLLM(
        config,
        "Provide a concise summary of the text. Use the same language as the source text.",
        text,
        { temperature: 0.3, signal },
    );
}

export async function translateText(config: LLMConfig, text: string, targetLang: string, signal?: AbortSignal): Promise<string> {
    const langNames: Record<string, string> = {
        zh: "Chinese",
        en: "English",
        ja: "Japanese",
        ko: "Korean",
        fr: "French",
        es: "Spanish",
        de: "German",
        ru: "Russian",
    };
    const langName = langNames[targetLang] ?? targetLang;
    return callLLM(
        config,
        `Translate the following text into ${langName}. If the text is already in ${langName}, translate it into English instead.`,
        text,
        { temperature: 0, signal },
    );
}
