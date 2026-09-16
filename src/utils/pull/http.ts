import { BROWSER_UA, IPHONE_UA } from "./types";

export type FetchTextResult = {
	url: string;
	text: string;
	status: number;
};

export async function fetchText(
	url: string,
	init: RequestInit & { timeoutMs?: number; mobile?: boolean } = {},
): Promise<FetchTextResult> {
	const { timeoutMs = 18000, mobile, ...rest } = init;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const headers = new Headers(rest.headers);
		if (!headers.has("user-agent")) {
			headers.set("User-Agent", mobile ? IPHONE_UA : BROWSER_UA);
		}
		if (!headers.has("accept")) {
			headers.set(
				"Accept",
				"text/html,application/json;q=0.9,application/xhtml+xml;q=0.8,*/*;q=0.7",
			);
		}
		if (!headers.has("accept-language")) {
			headers.set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8");
		}
		const res = await fetch(url, {
			...rest,
			redirect: "follow",
			signal: ctrl.signal,
			headers,
		});
		const text = await res.text();
		return { url: res.url, text, status: res.status };
	} finally {
		clearTimeout(timer);
	}
}

export async function fetchJson<T>(
	url: string,
	init: RequestInit & { timeoutMs?: number; mobile?: boolean } = {},
): Promise<{ url: string; data: T | null; status: number; raw: string }> {
	const got = await fetchText(url, init);
	try {
		return { url: got.url, data: JSON.parse(got.text) as T, status: got.status, raw: got.text };
	} catch {
		return { url: got.url, data: null, status: got.status, raw: got.text };
	}
}
