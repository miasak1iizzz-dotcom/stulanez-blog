import type { APIRoute } from "astro";
import { askLimit, clientIp } from "@/utils/videos/limit";
import { askAboutNote } from "@/utils/videos/llm";

export const prerender = false;
export const maxDuration = 60;

function json(
	data: { ok: boolean; answer?: string; error?: string },
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
		question?: unknown;
		context?: unknown;
		owner?: unknown;
	};
	const question = typeof rec.question === "string" ? rec.question.trim() : "";
	const context = typeof rec.context === "string" ? rec.context : "";
	if (!question) return json({ ok: false, error: "先写一句要问的。" }, 400);
	if (!context.trim()) {
		return json({ ok: false, error: "还没有笔记可问。" }, 400);
	}
	const limited = askLimit(clientIp(request), rec.owner === true);
	if (limited) return json({ ok: false, error: limited }, 429);
	try {
		const answer = await askAboutNote(question, context);
		return json({ ok: true, answer });
	} catch (error) {
		return json({ ok: false, error: (error as Error).message }, 502);
	}
};
