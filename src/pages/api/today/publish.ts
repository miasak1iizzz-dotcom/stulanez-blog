import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { siteConfig } from "@/config";

export const prerender = false;

const MAX_CHARS = 2000;
const DYNAMIC_DIR = path.resolve("src/content/dynamic");

/** 与 scripts/new-dynamic.js 同一套时间戳规则，保持文件名与 frontmatter 一致。 */
function stamp(): { timestamp: string; fileName: string } {
	const timezone = siteConfig.timezone || "Asia/Shanghai";
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	})
		.formatToParts(new Date())
		.reduce<Record<string, string>>((acc, part) => {
			if (part.type !== "literal") acc[part.type] = part.value;
			return acc;
		}, {});
	const { year, month, day, hour, minute, second } = parts;
	return {
		timestamp: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
		fileName: `${year}-${month}-${day}-${hour}${minute}${second}.md`,
	};
}

/**
 * 把 /today 的草稿写成一条动态。
 *
 * 只在本机 dev 里可用：线上（Vercel）函数是只读文件系统，写不了仓库文件。
 * 所以站长的写入能力只存在于「本机 dev」——正好和「站长按设备认定」一致。
 */
export const POST: APIRoute = async ({ request }) => {
	if (!import.meta.env.DEV) {
		return new Response(
			JSON.stringify({
				ok: false,
				error: "发布需要在本机 `pnpm dev` 里操作（线上函数写不了仓库文件）。先复制草稿吧。",
			}),
			{ status: 403, headers: { "Content-Type": "application/json; charset=utf-8" } },
		);
	}

	let text = "";
	try {
		const body = (await request.json()) as { text?: unknown };
		text = typeof body.text === "string" ? body.text.trim() : "";
	} catch {
		text = "";
	}

	if (!text) {
		return new Response(JSON.stringify({ ok: false, error: "草稿是空的。" }), {
			status: 400,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	}
	if (text.length > MAX_CHARS) {
		return new Response(
			JSON.stringify({ ok: false, error: `太长了（上限 ${MAX_CHARS} 字），动态不适合长文。` }),
			{ status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } },
		);
	}

	const { timestamp, fileName } = stamp();
	const fullPath = path.join(DYNAMIC_DIR, fileName);

	try {
		fs.mkdirSync(DYNAMIC_DIR, { recursive: true });
		if (fs.existsSync(fullPath)) {
			return new Response(JSON.stringify({ ok: false, error: "同一秒已有文件，稍后再试。" }), {
				status: 409,
				headers: { "Content-Type": "application/json; charset=utf-8" },
			});
		}
		fs.writeFileSync(fullPath, `---\npublished: ${timestamp}\n---\n\n${text}\n`, "utf8");
	} catch (error) {
		return new Response(
			JSON.stringify({ ok: false, error: `写文件失败：${(error as Error).message}` }),
			{ status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } },
		);
	}

	return new Response(
		JSON.stringify({ ok: true, file: `src/content/dynamic/${fileName}`, published: timestamp }),
		{ status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } },
	);
};
