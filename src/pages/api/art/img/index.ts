/**
 * 艺术馆图片代理（旧地址兜底）。
 * 新清单已经把图签成直连对象存储的 URL；这里碰到还在用 /api/art/img/?key= 的请求，
 * 302 到同一把稳定签名，不再把字节从美国经 Vercel 函数再转给访客。
 */
import type { APIRoute } from "astro";
import {
	frozenSigningDate,
	presign,
	READ_EXPIRES,
	resolveCredentials,
} from "@/utils/s3-sign";

export const prerender = false;

const ALLOWED_PREFIXES = ["art/img/", "art/thumb/"];

export const GET: APIRoute = async ({ url }) => {
	const key = (url.searchParams.get("key") ?? "").replace(/^\/+/, "");
	if (!key || !ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
		return new Response("forbidden", { status: 403 });
	}

	const credentials = resolveCredentials();
	if (!credentials)
		return new Response("storage not configured", { status: 503 });

	const location = presign(
		"GET",
		key,
		READ_EXPIRES,
		credentials,
		frozenSigningDate(READ_EXPIRES),
	);
	return new Response(null, {
		status: 302,
		headers: {
			location,
			"cache-control": "public, max-age=86400",
		},
	});
};
