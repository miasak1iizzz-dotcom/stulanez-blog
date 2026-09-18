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

async function jinaJson(
	url: string,
	timeoutMs = 18000,
): Promise<unknown | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(`${JINA_READER}${url}`, {
			headers: { Accept: "text/plain" },
			signal: ctrl.signal,
		});
		if (!res.ok) return null;
		return parseJsonBlob(await res.text());
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
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

export async function harvestBiliBag(
	bvid: string,
): Promise<Record<string, unknown>> {
	const bag: Record<string, unknown> = {};
	const viewUrl = viewApi(bvid);
	const view = await jinaJson(viewUrl);
	if (view) bag[viewUrl] = view;
	const cid =
		Number((view as { data?: { cid?: number } } | null)?.data?.cid) || 0;
	if (!cid) return bag;
	const playerUrl = playerApi(bvid, cid);
	const playUrl = playApi(bvid, cid);
	const [player, play] = await Promise.all([
		jinaJson(playerUrl),
		jinaJson(playUrl),
	]);
	if (player) bag[playerUrl] = player;
	if (play) bag[playUrl] = play;
	const sub = subtitleFile(player);
	if (sub) {
		const body = await jinaJson(sub);
		if (body) bag[sub] = body;
	}
	return bag;
}
