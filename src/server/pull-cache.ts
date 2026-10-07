import cacheFile from "@/data/pull-cache.json";
import type { PullSuccess } from "@/utils/pull/types";

/**
 * 抽取结果的**构建期缓存**（烤进产物，Vercel 侧零网络依赖）。
 *
 * 为什么不是服务端数据库/OSS：实测 Vercel 的函数**连不上阿里云 OSS**
 * （ali-oss 报 `Connect timeout for 5000ms`；浏览器直连 OSS 没问题，
 * 所以 `/api/media` 那种「只签名、浏览器自己去取」的路径一直正常）。
 * 机房到国内对象存储这条路不通，就不该在请求路径上等它。
 *
 * 所以改成：本机（出口干净、能拿到全量）抽取 → 写 `src/data/pull-cache.json`
 * → 随构建进产物。这条帖子以后再遇到渠道风控，接口就把烤好的全量端出来。
 *
 * 刷新办法（在 Lowkey 目录）：
 *   npx tsx .ai-work/_seed-pull-cache.ts <帖子id> [更多id...]
 * 客户端自己那份 localStorage 缓存仍然负责「刚抽过的那次」（7 天）。
 */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 天

type CacheFile = Record<string, { result: PullSuccess; ts: number }>;

const cache = (cacheFile ?? {}) as CacheFile;

export type CachedPull = { result: PullSuccess; ts: number };

let lastError: string | null = null;

export function pullCacheDiagnostics(): {
	entries: number;
	lastError: string | null;
} {
	return { entries: Object.keys(cache).length, lastError };
}

export function readCachedPull(key: string): CachedPull | null {
	if (!key) return null;
	const hit = cache[key];
	if (!hit?.result?.ok || !hit.result.images?.length) {
		lastError = hit ? "bad-payload" : "miss";
		return null;
	}
	if (Date.now() - hit.ts > MAX_AGE_MS) {
		lastError = "expired";
		return null;
	}
	lastError = null;
	return hit;
}
