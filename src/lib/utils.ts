export function isJson(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
    try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === "object" && parsed !== null;
    } catch {
        return false;
    }
}

export function extractUrl(text: string): string | null {
    const start = text.indexOf("http://");
    const idx = start >= 0 ? start : text.indexOf("https://");
    if (idx < 0) return null;
    const rest = text.slice(idx);
    const end = rest.search(/\s/);
    const url = end >= 0 ? rest.slice(0, end) : rest;
    const protoIdx = url.indexOf("://");
    if (protoIdx < 0) return null;
    const afterProto = url.slice(protoIdx + 3);
    if (!afterProto) return null;
    const host = afterProto.split("/")[0] || "";
    if (!host || host.startsWith(":")) return null;
    if (host === "localhost" || host.startsWith("localhost:")) return url;
    if (host.split(":")[0].split(".").every((p) => /^\d+$/.test(p) && Number(p) <= 255)) return url;
    if (host.includes(".")) return url;
    return null;
}
