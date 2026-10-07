import type { APIRoute } from "astro";
import { extractPull } from "@/utils/pull";
import type { PullChannelId, PullResult, PullSuccess } from "@/utils/pull/types";

export const prerender = false;

/** Hobby default is 10s; Douyin SSR often needs a couple of retries. */
export const maxDuration = 60;

const CHANNELS = new Set<PullChannelId>([
	"instagram",
	"douyin",
	"xiaohongshu",
	"weibo",
]);

/** 重试的延迟：给渠道一点喘息，别紧接着打第二次 */
const RETRY_DELAY_MS = 700;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

/** 抽到的图 ≤1 张时，把话跟用户说清楚（多数是渠道风控） */
function withThinWarning(result: PullSuccess): PullSuccess {
	const count = result.images.length;
	if (count > 1) return result;
	return {
		...result,
		warning:
			count === 0
				? "这次一张都没抽到。帖子被删、设为仅自己可见，或者渠道风控都会这样——再点一次「提取图片」通常还有机会。"
				: "这次只抽到 1 张。要是这篇本来是多图，多半是渠道风控，再点一次「提取图片」通常能拿到全量。",
	};
}

/**
 * 抽取的可靠性兜底：抖音对 Vercel 出口 IP 的风控时灵时不灵，
 * 同一条链接上一轮抽到 69 张、下一轮只剩 1 张。所以拿到 ≤1 张时再赌一次，
 * 两次里取图多的那次，并如实告诉用户发生了什么。
 *
 * 只在「又少又快」时重试：快速返回 1 张，像是被风控打残的预览页；
 * 慢速返回说明回退链（note 页 → detail API → iteminfo）已经全跑过一遍，
 * 这帖本来就只有一张图，再赌一次只会让用户白等。
 */
const THIN_FAST_MS = 6_000;

async function extractWithRetry(
	input: string,
	channel?: PullChannelId,
): Promise<PullResult> {
	const startedAt = Date.now();
	const first = await extractPull(input, channel);
	// 多图结果、以及本来就失败的结果，都不折腾：失败的原因里没有「再来一次就好」这条
	if (!first.ok || first.images.length > 1) return first;
	const firstMs = Date.now() - startedAt;
	if (firstMs > THIN_FAST_MS) return withThinWarning(first);

	await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
	const second = await extractPull(input, channel);
	if (second.ok && second.images.length > first.images.length) {
		return {
			...second,
			warning: `第一次只抽到 ${first.images.length} 张，重试后拿到 ${second.images.length} 张。`,
		};
	}
	return withThinWarning(first);
}

export const POST: APIRoute = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: "请求不是 JSON。" }, 400);
	}
	if (!body || typeof body !== "object") {
		return json({ ok: false, error: "请求内容不对。" }, 400);
	}
	const rec = body as { url?: unknown; channel?: unknown };
	const url = typeof rec.url === "string" ? rec.url : "";
	const channel =
		typeof rec.channel === "string" && CHANNELS.has(rec.channel as PullChannelId)
			? (rec.channel as PullChannelId)
			: undefined;
	if (!url.trim()) return json({ ok: false, error: "请先贴一条链接。" }, 400);
	const result = await extractWithRetry(url, channel);
	return json(result, result.ok ? 200 : 422);
};

export const GET: APIRoute = async ({ url }) => {
	const target = url.searchParams.get("url") || "";
	const channelRaw = url.searchParams.get("channel") || "";
	const channel = CHANNELS.has(channelRaw as PullChannelId)
		? (channelRaw as PullChannelId)
		: undefined;
	if (!target.trim()) return json({ ok: false, error: "请先贴一条链接。" }, 400);
	const result = await extractWithRetry(target, channel);
	return json(result, result.ok ? 200 : 422);
};
