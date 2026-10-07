import type { PullSuccess } from "@/utils/pull/types";

const KEY = "pull-browse-session";

export type PullSession = {
	url: string;
	result: PullSuccess;
};

export function savePullSession(session: PullSession): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(session));
	} catch {
		/* ignore */
	}
}

export function loadPullSession(): PullSession | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as PullSession;
		if (!data?.result?.ok || !data.result.images?.length) return null;
		return data;
	} catch {
		return null;
	}
}

export function clearPullSession(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}

/**
 * 抽取结果的持久缓存：同一帖子的链接再点一次，直接用上次抽好的结果，
 * 不再跟抖音风控赌运气。只缓存 ≥2 张的成功结果——单图结果可能是被
 * 风控打残的残次品，缓存它等于把坏结果钉死。
 */
const CACHE_KEY = "pull-extract-cache";
const CACHE_LIMIT = 40;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type PullCacheEntry = { url: string; result: PullSuccess; ts: number };

function readPullCache(): PullCacheEntry[] {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as PullCacheEntry[];
		if (!Array.isArray(list)) return [];
		return list.filter(
			(e) =>
				e &&
				typeof e.url === "string" &&
				e.result?.ok &&
				Array.isArray(e.result.images) &&
				e.result.images.length >= 2,
		);
	} catch {
		return [];
	}
}

function writePullCache(list: PullCacheEntry[]): void {
	try {
		localStorage.setItem(
			CACHE_KEY,
			JSON.stringify(list.slice(0, CACHE_LIMIT)),
		);
	} catch {
		/* ignore */
	}
}

export function savePullCache(url: string, result: PullSuccess): void {
	if (!result?.ok || !result.images?.length || result.images.length < 2) return;
	const list = readPullCache().filter((entry) => entry.url !== url);
	list.unshift({ url, result, ts: Date.now() });
	writePullCache(list);
}

export function loadPullCache(
	url: string,
): { result: PullSuccess; ts: number } | null {
	const hit = readPullCache().find((entry) => entry.url === url);
	if (!hit) return null;
	if (Date.now() - hit.ts > CACHE_MAX_AGE_MS) return null;
	return { result: hit.result, ts: hit.ts };
}
