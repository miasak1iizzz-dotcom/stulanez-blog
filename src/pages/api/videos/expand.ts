import type { APIRoute } from "astro";
import { askLimit, clientIp } from "@/utils/videos/limit";
import { writeLongArticle } from "@/utils/videos/llm";

export const prerender = false;
export const maxDuration = 60;

function json(
	data: { ok: boolean; article?: string; error?: string },
	status = 200,
) {
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
	const rec = body as {
		markdown?: unknown;
		transcript?: unknown;
		owner?: unknown;
	};
	const markdown = typeof rec.markdown === "string" ? rec.markdown : "";
	const transcript = typeof rec.transcript === "string" ? rec.transcript : "";
	if (!markdown.trim()) {
		return json({ ok: false, error: "还没有笔记可写成文章。" }, 400);
	}
	const limited = askLimit(clientIp(request), rec.owner === true);
	if (limited) return json({ ok: false, error: limited }, 429);
	try {
		const article = await writeLongArticle(markdown, transcript);
		if (!article) return json({ ok: false, error: "长文没写成。" }, 502);
		return json({ ok: true, article });
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 502);
	}
};
