import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

export const prerender = false;

const PREFS_PATH = path.resolve(".ai-work/douyin-roster-prefs.json");

export const GET: APIRoute = async () => {
	if (!fs.existsSync(PREFS_PATH)) {
		return new Response(JSON.stringify({ ok: true, prefs: null }), {
			headers: { "content-type": "application/json" },
		});
	}
	const prefs = JSON.parse(fs.readFileSync(PREFS_PATH, "utf8"));
	return new Response(JSON.stringify({ ok: true, prefs, path: PREFS_PATH }), {
		headers: { "content-type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response("invalid json", { status: 400 });
	}
	if (!body || typeof body !== "object") {
		return new Response("invalid body", { status: 400 });
	}
	fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true });
	fs.writeFileSync(PREFS_PATH, `${JSON.stringify(body, null, "\t")}\n`);
	return new Response(
		JSON.stringify({
			ok: true,
			path: ".ai-work/douyin-roster-prefs.json",
			absolute: PREFS_PATH,
		}),
		{ headers: { "content-type": "application/json" } },
	);
};
