import { pullCacheKey } from "@/utils/pull/cacheKey";
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
 * 不再跟抖音风控赌运气。
 *
 * 键用 `pullCacheKey()` 归一化（帖子 id），所以网页链接、短链、App 口令
 * 只要指向同一条帖子就命中同一条缓存——按原始 URL 存的话，链接形态一变就落空。
 *
 * 两种保鲜期：
 *  - ≥2 张的多图结果 → 7 天（基本可以确定是好的）
 *  - 只有 1 张的结果 → 30 分钟。单图**可能**是被风控打残的残次品，也可能是
 *    这帖本来就一张；服务端已经抽了三次才得出这个结论，所以留一个短缓存，
 *    让单图帖不用每次都让用户等三十秒，又不会把坏结果钉死一周。
 * 再点一次「提取图片」会强制重抽（见 PullVault 的 cacheUsedFor）。
 */
const CACHE_KEY = "pull-extract-cache";
const CACHE_LIMIT = 40;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** 单图结果的短保鲜期 */
const CACHE_THIN_MAX_AGE_MS = 30 * 60 * 1000;

type PullCacheEntry = { key: string; result: PullSuccess; ts: number };

function readPullCache(): PullCacheEntry[] {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as PullCacheEntry[];
		if (!Array.isArray(list)) return [];
		return list.filter(
			(e) =>
				e &&
				typeof e.key === "string" &&
				e.result?.ok &&
				Array.isArray(e.result.images) &&
				e.result.images.length >= 1,
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
	if (!result?.ok || !result.images?.length) return;
	const key = pullCacheKey(url);
	if (!key) return;
	const list = readPullCache().filter((entry) => entry.key !== key);
	list.unshift({ key, result, ts: Date.now() });
	writePullCache(list);
}

export function loadPullCache(
	url: string,
): { result: PullSuccess; ts: number } | null {
	const key = pullCacheKey(url);
	if (!key) return null;
	const hit = readPullCache().find((entry) => entry.key === key);
	if (!hit) return null;
	const ttl =
		hit.result.images.length >= 2 ? CACHE_MAX_AGE_MS : CACHE_THIN_MAX_AGE_MS;
	if (Date.now() - hit.ts > ttl) return null;
	return { result: hit.result, ts: hit.ts };
}
