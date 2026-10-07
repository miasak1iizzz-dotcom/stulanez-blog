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

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

/** 抽到的图 ≤1 张时，把话跟用户说清楚——但别覆盖抽取层更具体的提示 */
function withThinWarning(result: PullSuccess): PullSuccess {
	const count = result.images.length;
	if (count > 1) return result;
	// 抽取层（如 douyin.ts）往往已经给了更贴切的话，那句留着
	if (result.warning) return result;
	return {
		...result,
		warning:
			count === 0
				? "这次一张都没抽到。帖子被删、设为仅自己可见，或者渠道风控都会这样——再点一次「提取图片」通常还有机会。"
				: "这次只抽到 1 张。要是这篇本来是多图，多半是渠道风控，再点一次「提取图片」通常能拿到全量。",
	};
}

/**
 * 抽取的可靠性兜底。抖音对出口 IP 的风控时灵时不灵，而且**没有规律**：
 * 同一条链接这一轮 6 张、下一轮 1 张、再下一轮直接抽空，慢的时候也会只给 1 张。
 * （踩过的坑：曾按「返回得快才重试」来判，结果线上第 1 轮正是「1 张 / 11.7s」，
 * 被判成「这帖本来就一张」，恰好漏掉用户抱怨的那种情况。）
 * 所以改成：预算内最多抽三次，取图最多的那次。
 *   - 拿到 ≥2 张就收工；
 *   - 三次都只有 0/1 张，就把 0/1 张那次带上提示还给用户；
 *   - 三次全失败，把第一次的报错还回去（它最早、也最贴切）。
 */
const ATTEMPT_BUDGET_MS = 40_000; // maxDuration 60s，留足收尾余量
const MAX_ATTEMPTS = 3;
/** 一次都没成功时最多赌两次：链接真的没了（帖子被删）再赌也是白等 */
const MAX_FAILED_ATTEMPTS = 2;
/** 递增退避：风控像是按时间窗来的，连着打三下不如隔开打 */
const RETRY_DELAYS_MS = [800, 2_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function extractWithRetry(
	input: string,
	channel?: PullChannelId,
): Promise<PullResult> {
	const startedAt = Date.now();
	let best: PullSuccess | null = null;
	let firstFailure: PullResult | null = null;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const result = await extractPull(input, channel);
		if (result.ok) {
			if (!best || result.images.length > best.images.length) best = result;
			if (best.images.length > 1) break; // 拿到多图，收工
		} else if (!firstFailure) {
			firstFailure = result;
		}

		if (attempt === MAX_ATTEMPTS) break;
		if (!best && attempt >= MAX_FAILED_ATTEMPTS) break; // 全失败，见好就收
		if (Date.now() - startedAt > ATTEMPT_BUDGET_MS) break;
		await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 2_000);
	}

	if (best) {
		return best.images.length > 1 ? best : withThinWarning(best);
	}
	return (
		firstFailure ?? {
			ok: false,
			error: "提取失败。链接失效、要登录，或渠道改了页面。",
		}
	);
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
