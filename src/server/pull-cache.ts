import type OSS from "ali-oss";
import { getOssClient } from "@/server/oss-sign";
import type { PullSuccess } from "@/utils/pull/types";

/**
 * 抽取结果的服务端缓存（放在已有的私有 OSS 桶里）。
 *
 * 为什么需要它：抖音这类渠道对**机房 IP** 的风控时灵时不灵——同一帖子
 * 可能这轮给 69 张、下轮只给 1 张，重试也只能提高命中率。但只要**任何一次**
 * 抽成功过，就把结果记下来；以后再遇到风控，直接把上次的好结果端出去，
 * 用户就不会再看到「只剩一张」。
 *
 * 客户端跟环境变量解析都复用 `oss-sign.ts`（`/api/media` 用的那套，dev 与线上都验过）。
 */
const PREFIX = "pull-cache/";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

function ossClient(): OSS | null {
	return getOssClient();
}

function objectKey(key: string): string {
	// 键里只会有 [a-z0-9:_]，再兜一层，绝不拼出越界路径
	const safe = key.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
	return `${PREFIX}${safe}.json`;
}

export type CachedPull = { result: PullSuccess; ts: number };

export async function readCachedPull(key: string): Promise<CachedPull | null> {
	if (!key) return null;
	const oss = ossClient();
	if (!oss) return null;
	try {
		const got = await oss.get(objectKey(key), { timeout: 5000 });
		const raw = got.content.toString("utf8");
		const parsed = JSON.parse(raw) as CachedPull;
		if (!parsed?.result?.ok || !parsed.result.images?.length) return null;
		if (Date.now() - parsed.ts > MAX_AGE_MS) return null;
		return parsed;
	} catch {
		return null; // 不存在、超时、解析失败都当作没有缓存
	}
}

export async function writeCachedPull(
	key: string,
	result: PullSuccess,
): Promise<void> {
	if (!key || !result.ok || result.images.length < 2) return; // 只记「好的」结果
	const oss = ossClient();
	if (!oss) return;
	try {
		await oss.put(
			objectKey(key),
			Buffer.from(JSON.stringify({ result, ts: Date.now() }), "utf8"),
			{
				timeout: 6000,
				mime: "application/json",
				headers: { "cache-control": "private, max-age=3600" },
			},
		);
	} catch (error) {
		// 写不进去不影响抽取本身，但要在日志里留痕，方便判断缓存有没有在工作
		console.warn(
			"[pull-cache] 写入失败:",
			error instanceof Error ? error.message : String(error),
		);
	}
}
