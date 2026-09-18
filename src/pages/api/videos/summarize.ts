import type { APIRoute } from "astro";
import { fetchVideoMeta, withBiliHarvest } from "@/utils/videos/bilibili";
import { cachedDigest } from "@/utils/videos/cache";
import { youtubeId } from "@/utils/videos/clip";
import { clientIp, rateLimit } from "@/utils/videos/limit";
import { summarizeFromSubtitles } from "@/utils/videos/llm";
import type { VideoJob } from "@/utils/videos/types";
import { fetchYoutubeMeta } from "@/utils/videos/youtube";

export const prerender = false;
export const maxDuration = 60;

function json(data: VideoJob, status = 200): Response {
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
	const rec = body as { url?: unknown; owner?: unknown; harvest?: unknown };
	const url = typeof rec.url === "string" ? rec.url : "";
	const owner = rec.owner === true;
	const harvest =
		rec.harvest &&
		typeof rec.harvest === "object" &&
		!Array.isArray(rec.harvest)
			? (rec.harvest as Record<string, unknown>)
			: {};
	if (!url.trim())
		return json({ ok: false, error: "请先贴一条 B 站或 YouTube 链接。" }, 400);

	const cached = cachedDigest(url);
	if (cached) {
		return json({
			ok: true,
			bvid: cached.meta.bvid,
			status: "completed",
			message: "做好了",
			result: cached,
		});
	}

	const limited = rateLimit(clientIp(request), owner);
	if (limited) return json({ ok: false, error: limited }, 429);

	let meta: Awaited<ReturnType<typeof fetchVideoMeta>>;
	try {
		meta = await withBiliHarvest(harvest, async () =>
			youtubeId(url) ? await fetchYoutubeMeta(url) : await fetchVideoMeta(url),
		);
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 422);
	}

	try {
		const result = await withBiliHarvest(harvest, () =>
			summarizeFromSubtitles(url, meta),
		);
		if (!result) {
			const youtube = meta.platform === "youtube";
			return json(
				{
					ok: false,
					bvid: meta.bvid,
					error: youtube
						? "这条 YouTube 没有公开字幕。换一条带字幕的，或贴 B 站片子（B 站可以语音识别）。"
						: "这条片子没有公开字幕，语音识别也没听出来。换一条再试，或过一会儿再贴。",
				},
				422,
			);
		}
		return json({
			ok: true,
			bvid: meta.bvid,
			status: "completed",
			message: "做好了",
			result,
		});
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 502);
	}
};
