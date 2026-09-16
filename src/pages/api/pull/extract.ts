import type { APIRoute } from "astro";
import { extractPull } from "@/utils/pull";
import type { PullChannelId } from "@/utils/pull/types";

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
	const result = await extractPull(url, channel);
	return json(result, result.ok ? 200 : 422);
};

export const GET: APIRoute = async ({ url }) => {
	const target = url.searchParams.get("url") || "";
	const channelRaw = url.searchParams.get("channel") || "";
	const channel = CHANNELS.has(channelRaw as PullChannelId)
		? (channelRaw as PullChannelId)
		: undefined;
	if (!target.trim()) return json({ ok: false, error: "请先贴一条链接。" }, 400);
	const result = await extractPull(target, channel);
	return json(result, result.ok ? 200 : 422);
};
