/**
 * 艺术馆清单接口 —— 从对象存储取清单，并把每张图换成带签名的临时链接。
 *
 * 为什么需要它：图片存在私有桶里，浏览器不能直接访问。这个接口读一次清单，
 * 顺手给每张图签一个有时效的链接（7 天），访客的浏览器再直接去对象存储拉图——
 * 图片字节不经过本站服务器，本站只出一个清单。
 *
 * 失败时返回 503/502，展厅会自动退回站内清单，不会白屏。
 */
import type { APIRoute } from "astro";
import { getObjectText, resolveCredentials } from "@/utils/s3-sign";

export const prerender = false;

const MANIFEST_KEY = "art/manifest.json";

interface ManifestItem {
	thumbs?: Record<string, string>;
	[key: string]: unknown;
}

interface Manifest {
	items?: ManifestItem[];
	[key: string]: unknown;
}

function json(body: unknown, status = 200, maxAge = 0): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": maxAge > 0 ? `public, s-maxage=${maxAge}, stale-while-revalidate=600` : "no-store",
		},
	});
}

export const GET: APIRoute = async () => {
	const credentials = resolveCredentials();
	if (!credentials) return json({ error: "服务端存储凭证没配齐" }, 503);

	let text: string | null = null;
	try {
		text = await getObjectText(MANIFEST_KEY, credentials);
	} catch (error) {
		return json({ error: `读取清单失败：${(error as Error).message}` }, 502);
	}
	if (!text) return json({ error: "对象存储里还没有清单，先发布一次" }, 404);

	let manifest: Manifest;
	try {
		manifest = JSON.parse(text) as Manifest;
	} catch {
		return json({ error: "清单不是合法 JSON" }, 502);
	}

	const items = Array.isArray(manifest.items) ? manifest.items : [];
	// 图片改成走站内代理（URL 稳定、可被 CDN 长期缓存）。
	// 早先直接给对象存储的签名链接，结果每次签名都不同 → 浏览器与 CDN 都缓存不了，
	// 每个访客每张图都得跨洋回源一次（实测每张约 2 秒）。
	for (const item of items) {
		if (!item.thumbs) continue;
		const proxied: Record<string, string> = {};
		for (const [width, key] of Object.entries(item.thumbs)) {
			proxied[width] = `/api/art/img/${String(key)}`;
		}
		item.thumbs = proxied;
	}

	return json(manifest, 200, 60);
};
