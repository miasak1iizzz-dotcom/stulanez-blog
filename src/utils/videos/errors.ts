import { biliFailCopy } from "./bili-fetch";

export function explainVideoError(raw: unknown): string {
	const text =
		raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
	const gone = biliFailCopy(undefined, text, text);
	if (gone) return gone;
	const low = text.toLowerCase();
	if (
		/fetch failed|failed to fetch|networkerror|load failed|econnreset|und_err|aborterror|timed? ?out|network request failed/.test(
			low,
		)
	) {
		return "片子这边暂时连不上。刷新后再贴一次；还不行就换一条还能打开的。";
	}
	if (
		/中转接口|中转被拦|中转没有/.test(text) ||
		/\b(403|412|522)\b/.test(text)
	) {
		return "片子这边被拦了。刷新后再贴一次；还不行就换一条还能打开的。";
	}
	if (!text.trim()) return "这次没写成。换一条再试。";
	if (!/[\u4e00-\u9fff]/.test(text)) {
		return "这次没写成。换一条还能打开的 B 站或 YouTube 链接再试。";
	}
	return text;
}
