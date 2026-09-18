import { parseJsonBlob } from "./bili-fetch";

const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

type Attempt = { href: string; headers: Record<string, string> };

function jinaKey(): string {
	return (process.env.JINA_API_KEY || "").trim();
}

function jinaHeaders(
	extra: Record<string, string> = {},
): Record<string, string> {
	const key = jinaKey();
	return {
		Accept: "text/plain",
		"User-Agent": UA,
		...extra,
		...(key ? { Authorization: `Bearer ${key}` } : {}),
	};
}

function attemptsFor(url: string): Attempt[] {
	return [
		{
			href: `https://r.jina.ai/${url}`,
			headers: jinaHeaders({
				"X-Engine": "direct",
				"X-Respond-With": "text",
			}),
		},
		{
			href: `https://r.jina.ai/${url}`,
			headers: jinaHeaders(),
		},
		{
			href: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
			headers: { Accept: "*/*", "User-Agent": UA },
		},
		{
			href: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
			headers: { Accept: "*/*", "User-Agent": UA },
		},
		{
			href: `https://corsproxy.io/?${encodeURIComponent(url)}`,
			headers: { Accept: "*/*", "User-Agent": UA },
		},
	];
}

async function fetchOnce(
	href: string,
	headers: Record<string, string>,
	timeoutMs: number,
): Promise<{ ok: boolean; status: number; text: string }> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(href, {
			headers,
			signal: ctrl.signal,
			redirect: "follow",
		});
		return { ok: res.ok, status: res.status, text: await res.text() };
	} catch {
		return { ok: false, status: 0, text: "" };
	} finally {
		clearTimeout(timer);
	}
}

function looksBlocked(text: string): boolean {
	const head = text.slice(0, 500).toLowerCase();
	return (
		head.includes("just a moment") ||
		head.includes("cf-browser-verification") ||
		head.includes("attention required") ||
		(head.includes("<!doctype html") && !head.includes("{"))
	);
}

export async function readRemoteText(
	url: string,
	directHeaders?: Record<string, string>,
): Promise<string> {
	const direct = await fetchOnce(
		url,
		{
			"User-Agent": UA,
			Referer: "https://www.bilibili.com/",
			Origin: "https://www.bilibili.com",
			Accept: "application/json,text/plain,*/*",
			...directHeaders,
		},
		12000,
	);
	if (direct.ok && direct.text.trim() && !looksBlocked(direct.text)) {
		return direct.text;
	}
	let last = direct.status || 403;
	for (const attempt of attemptsFor(url)) {
		const got = await fetchOnce(attempt.href, attempt.headers, 15000);
		if (got.status) last = got.status;
		if (got.ok && got.text.trim() && !looksBlocked(got.text)) return got.text;
	}
	if (last === 403 || last === 412 || last === 522) {
		throw new Error(
			"片子这边被拦了。刷新后再贴一次；还不行就换一条还能打开的。",
		);
	}
	throw new Error(`中转接口 ${last}`);
}

export async function readRemoteJson(
	url: string,
	directHeaders?: Record<string, string>,
): Promise<unknown> {
	return parseJsonBlob(await readRemoteText(url, directHeaders));
}
