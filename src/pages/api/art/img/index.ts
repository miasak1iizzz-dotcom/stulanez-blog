/**
 * 艺术馆图片代理 —— 让图片走 CDN 缓存，而不是每个访客每张图都跨洋回源。
 *
 * 为什么用查询参数而不是路径：
 *   站点开了 trailingSlash: "always"，带扩展名的路径会被 308 重定向到加斜杠的形式
 *   （多一次往返，缓存键也变复杂）。/api/art/img/?key=... 是规范路径，一次命中。
 *
 * 为什么需要这层代理：
 *   图片存在美国的私有桶里。早先直接给预签名链接，问题是签名每次不同 →
 *   浏览器与 CDN 都无法缓存 → 每个访客每张图都要跨洋回源一次（实测每张约 2 秒）。
 *   这里用稳定 URL + 长缓存，首次回源后由 CDN 长期供给。
 */
import type { APIRoute } from "astro";
import { presign, READ_EXPIRES, resolveCredentials } from "@/utils/s3-sign";

export const prerender = false;

/** 只代理展品相关路径，别被当成任意文件的通道 */
const ALLOWED_PREFIXES = ["art/img/", "art/thumb/"];

export const GET: APIRoute = async ({ url }) => {
	const key = (url.searchParams.get("key") ?? "").replace(/^\/+/, "");
	if (!key || !ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix))) {
		return new Response("forbidden", { status: 403 });
	}

	const credentials = resolveCredentials();
	if (!credentials) return new Response("storage not configured", { status: 503 });

	let upstream: Response;
	try {
		upstream = await fetch(presign("GET", key, READ_EXPIRES, credentials));
	} catch (error) {
		return new Response(`upstream error: ${(error as Error).message}`, { status: 502 });
	}
	if (!upstream.ok) {
		return new Response("not found", { status: upstream.status === 404 ? 404 : 502 });
	}

	return new Response(upstream.body, {
		status: 200,
		headers: {
			"content-type": upstream.headers.get("content-type") ?? "image/webp",
			// 文件名即内容哈希，内容永不变 → 浏览器与 CDN 都能长期缓存
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
};
