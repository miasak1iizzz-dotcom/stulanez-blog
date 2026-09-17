/**
 * 艺术馆图片代理 —— 让图片走 CDN 缓存，而不是每个访客每张图都跨洋回源。
 *
 * 为什么需要它：图片存在美国的私有桶里，直接给带签名的对象存储链接有两个问题——
 *   1. 签名每次不同 → 浏览器与 CDN 都无法缓存 → 每个访客、每张图都要重新跨洋拉一次（实测每张 2 秒）
 *   2. 私有桶的链接 7 天过期，收藏或分享会失效
 * 改成走这个站内地址（URL 稳定、按内容哈希命名），首次回源后由 CDN 长期缓存。
 *
 * 缓存策略：内容按内容哈希命名，文件内容永不改变，所以可以 immutable 长缓存。
 */
import type { APIRoute } from "astro";
import { presign, READ_EXPIRES, resolveCredentials } from "@/utils/s3-sign";

export const prerender = false;

/** 只代理展品相关路径，别被当成任意文件的通道 */
const ALLOWED_PREFIXES = ["art/img/", "art/thumb/"];

export const GET: APIRoute = async ({ params }) => {
	const key = (params.path ?? "").replace(/^\/+/, "");
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
