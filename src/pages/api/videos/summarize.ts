import type { APIRoute } from "astro";
import { bvidOf, fetchVideoMeta, peelBilibili } from "@/utils/videos/bilibili";
import { cachedDigest } from "@/utils/videos/cache";
import {
	createEngineTask,
	engineConfigured,
	findCompletedTask,
	readEngineTask,
} from "@/utils/videos/engine";
import { clientIp, rateLimit } from "@/utils/videos/limit";
import { summarizeFromSubtitles } from "@/utils/videos/llm";
import type { VideoJob } from "@/utils/videos/types";

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
	const rec = body as { url?: unknown; owner?: unknown };
	const url = typeof rec.url === "string" ? rec.url : "";
	const owner = rec.owner === true;
	if (!url.trim())
		return json({ ok: false, error: "请先贴一条 B 站链接。" }, 400);

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

	const peeled = peelBilibili(url);
	const knownBvid = bvidOf(peeled);
	let meta: Awaited<ReturnType<typeof fetchVideoMeta>>;
	try {
		meta = await fetchVideoMeta(url);
	} catch (error) {
		const message = (error as Error).message;
		if (engineConfigured() && knownBvid) {
			meta = {
				bvid: knownBvid,
				title: knownBvid,
				up: "",
				duration: 0,
				url: `https://www.bilibili.com/video/${knownBvid}/`,
			};
		} else if (message.includes("412")) {
			return json(
				{
					ok: false,
					bvid: knownBvid || undefined,
					error: "B 站把这台公网机器拦住了，视频信息没拿到。",
				},
				422,
			);
		} else {
			return json({ ok: false, error: message }, 422);
		}
	}

	const bvid = meta.bvid || bvidOf(peelBilibili(url));
	if (engineConfigured()) {
		try {
			const existing = bvid ? await findCompletedTask(bvid) : null;
			const id = existing || (await createEngineTask(url));
			if (existing) {
				const done = await readEngineTask(id, meta);
				if (done.result) {
					return json({
						ok: true,
						id,
						bvid: meta.bvid,
						status: "completed",
						message: "这条以前拆过，直接给你。",
						result: done.result,
					});
				}
			}
			return json({
				ok: true,
				id,
				bvid: meta.bvid,
				status: "queued",
				message: "已经交给引擎，正在拆。",
			});
		} catch (error) {
			return json({ ok: false, error: (error as Error).message }, 502);
		}
	}

	try {
		const result = await summarizeFromSubtitles(url, meta);
		if (!result) {
			return json(
				{
					ok: false,
					error:
						"这条没有公开字幕，在线模型没东西可总结。云端函数也下不了 B 站音轨做转写。",
				},
				422,
			);
		}
		return json({ ok: true, status: "completed", result, message: "做好了" });
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 502);
	}
};

export const GET: APIRoute = async ({ url }) => {
	const id = url.searchParams.get("id") || "";
	const bvid = url.searchParams.get("bvid") || "";
	if (!id) return json({ ok: false, error: "缺少任务号。" }, 400);
	if (!engineConfigured()) {
		return json({ ok: false, error: "公网没有引擎可查进度。" }, 404);
	}
	try {
		const meta = {
			bvid,
			title: "",
			up: "",
			duration: 0,
			url: bvid ? `https://www.bilibili.com/video/${bvid}/` : "",
		};
		const done = await readEngineTask(id, meta);
		if (done.error && done.status === "failed") {
			return json({ ok: false, id, status: done.status, error: done.error });
		}
		return json({
			ok: true,
			id,
			status: done.status,
			message: done.message,
			result: done.result,
		});
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 502);
	}
};
