export const BILI_VIEW = "https://api.bilibili.com/x/web-interface/view";
export const BILI_PLAYER = "https://api.bilibili.com/x/player/v2";
export const BILI_PLAYURL = "https://api.bilibili.com/x/player/playurl";
export const JINA_READER = "https://r.jina.ai/";

export function parseJsonBlob(text: string): unknown {
	const trimmed = text.trim();
	if (
		!trimmed ||
		/just a moment|cf-browser-verification|attention required/i.test(
			trimmed.slice(0, 800),
		)
	) {
		throw new Error("中转被拦了。");
	}
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		return JSON.parse(trimmed);
	}
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start >= 0 && end > start) {
		return JSON.parse(trimmed.slice(start, end + 1));
	}
	throw new Error("中转没有把数据给我。");
}

export function viewApi(bvid: string): string {
	return `${BILI_VIEW}?bvid=${encodeURIComponent(bvid)}`;
}

export function playerApi(bvid: string, cid: number): string {
	return `${BILI_PLAYER}?bvid=${encodeURIComponent(bvid)}&cid=${cid}`;
}

export function playApi(bvid: string, cid: number): string {
	return `${BILI_PLAYURL}?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=16&fnval=1&fnver=0&fourk=0&platform=html5&high_quality=1`;
}

export function pageUrl(bvid: string): string {
	return `https://www.bilibili.com/video/${encodeURIComponent(bvid)}/`;
}

export function biliFailCopy(
	code?: number,
	message?: string,
	extra = "",
): string | null {
	const blob = `${code ?? ""} ${message || ""} ${extra}`;
	if (code === 62004 || /审核中/.test(blob)) {
		return "这条片子还在审核，暂时看不到。换一条已经能打开的。";
	}
	if (
		code === -404 ||
		code === 62002 ||
		/啥都木有|稿件不存在|稿件不可见|视频去哪了|视频不见了/.test(blob)
	) {
		return "这条片子已经看不到了。换一条还能打开的 B 站链接。";
	}
	return null;
}

function inBrowser(): boolean {
	return typeof document !== "undefined" && typeof window !== "undefined";
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

async function jsonpJson(
	url: string,
	timeoutMs = 10000,
): Promise<unknown | null> {
	if (!inBrowser()) return null;
	const cb = `__stulanezBili${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
	const href = `${url}${url.includes("?") ? "&" : "?"}jsonp=jsonp&callback=${cb}`;
	return new Promise((resolve) => {
		const script = document.createElement("script");
		let done = false;
		const finish = (value: unknown | null) => {
			if (done) return;
			done = true;
			window.clearTimeout(timer);
			script.remove();
			const bag = window as unknown as Record<string, unknown>;
			try {
				delete bag[cb];
			} catch {
				bag[cb] = undefined;
			}
			resolve(value);
		};
		const timer = window.setTimeout(() => finish(null), timeoutMs);
		(
			window as unknown as Record<string, (data: unknown) => void>
		)[cb] = (data: unknown) => finish(data);
		script.onerror = () => finish(null);
		script.src = href;
		document.head.appendChild(script);
	});
}

async function fetchPlain(
	url: string,
	timeoutMs = 14000,
): Promise<string | null> {
	const relays = [
		`${JINA_READER}${url}`,
		`https://corsproxy.io/?${encodeURIComponent(url)}`,
	];
	for (const href of relays) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			const res = await fetch(href, {
				headers: { Accept: "text/plain, */*" },
				signal: ctrl.signal,
			});
			if (!res.ok) continue;
			const text = await res.text();
			if (!text.trim() || looksBlocked(text)) continue;
			return text;
		} catch {
			/* next hop */
		} finally {
			clearTimeout(timer);
		}
	}
	return null;
}

async function fetchJson(url: string): Promise<unknown | null> {
	const jsonp = await jsonpJson(url);
	if (jsonp && typeof jsonp === "object") return jsonp;
	const text = await fetchPlain(url);
	if (!text) return null;
	try {
		return parseJsonBlob(text);
	} catch {
		return null;
	}
}

function subtitleFile(player: unknown): string {
	const list =
		(
			player as {
				data?: {
					subtitle?: {
						subtitles?: Array<{
							subtitle_url?: string;
							lan?: string;
							lan_doc?: string;
						}>;
					};
				};
			} | null
		)?.data?.subtitle?.subtitles || [];
	const preferred =
		list.find((row) => /zh|中/.test(`${row.lan || ""}${row.lan_doc || ""}`)) ||
		list[0];
	const file = preferred?.subtitle_url || "";
	if (!file) return "";
	return file.startsWith("//") ? `https:${file}` : file;
}

function bagGone(
	bag: Record<string, unknown>,
	code?: number,
	message?: string,
	extra = "",
): boolean {
	const gone = biliFailCopy(code, message, extra);
	if (!gone) return false;
	bag.__gone = gone;
	return true;
}

export async function harvestBiliBag(
	bvid: string,
): Promise<Record<string, unknown>> {
	const bag: Record<string, unknown> = {};
	const viewUrl = viewApi(bvid);
	const view = await fetchJson(viewUrl);
	if (view) {
		bag[viewUrl] = view;
		const rec = view as { code?: number; message?: string };
		if (bagGone(bag, rec.code, rec.message)) return bag;
	} else {
		const page = await fetchPlain(pageUrl(bvid), 8000);
		if (page && bagGone(bag, undefined, undefined, page.slice(0, 6000))) {
			return bag;
		}
	}
	const cid =
		Number((view as { data?: { cid?: number } } | null)?.data?.cid) || 0;
	if (!cid) return bag;
	const playerUrl = playerApi(bvid, cid);
	const playUrl = playApi(bvid, cid);
	const [player, play] = await Promise.all([
		fetchJson(playerUrl),
		fetchJson(playUrl),
	]);
	if (player) bag[playerUrl] = player;
	if (play) bag[playUrl] = play;
	const sub = subtitleFile(player);
	if (sub) {
		const body = await fetchJson(sub);
		if (body) bag[sub] = body;
	}
	return bag;
}
