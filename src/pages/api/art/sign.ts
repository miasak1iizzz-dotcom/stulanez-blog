/**
 * 艺术馆发布签名接口 —— 给站长的浏览器发「上传许可证」（预签名 PUT URL）。
 *
 * 为什么要有它：策展台要把缩略图和清单直接传进对象存储，但不能把存储密钥放进网页。
 * 所以由这个接口用服务端密钥签出有时效的 PUT 地址，浏览器拿着它直传，
 * 图片字节完全不经过本站服务器。
 *
 * 凭据与签名实现见 src/utils/s3-sign.ts（支持 B2 与 R2 两家）。
 * 鉴权用站长口令 ART_PUBLISH_TOKEN，策展台里填一次。
 *
 * 部署要求：需要服务端运行，不能是纯静态。astro.config 已配 vercel 适配器。
 */
import type { APIRoute } from "astro";
import { presign, resolveCredentials, WRITE_EXPIRES } from "@/utils/s3-sign";

export const prerender = false;

/** 只允许写这三个前缀，防止签名接口被拿来当任意文件的通行证 */
const ALLOWED_PREFIXES = ["art/img/", "art/thumb/", "art/manifest.json"];

interface SignRequest {
	token?: string;
	keys?: string[];
}

function env(name: string, fallback = ""): string {
	return (process.env[name] ?? fallback).trim();
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
}

export const POST: APIRoute = async ({ request }) => {
	const expected = env("ART_PUBLISH_TOKEN");
	if (!expected) return json({ error: "服务端还没配 ART_PUBLISH_TOKEN，发布功能未启用" }, 503);

	let payload: SignRequest;
	try {
		payload = (await request.json()) as SignRequest;
	} catch {
		return json({ error: "请求不是合法 JSON" }, 400);
	}
	if (payload.token !== expected) return json({ error: "站长口令不对" }, 401);

	const credentials = resolveCredentials();
	if (!credentials) return json({ error: "服务端存储凭证没配齐（R2_* 或 S3_* 任一组）" }, 503);

	const keys = Array.isArray(payload.keys) ? payload.keys.filter(k => typeof k === "string" && k.length > 0) : [];
	if (!keys.length) return json({ error: "没给要签的 key" }, 400);
	if (keys.length > 500) return json({ error: "一次最多签 500 个文件" }, 400);

	for (const key of keys) {
		if (!ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix))) {
			return json({ error: `不允许写这个路径：${key}` }, 403);
		}
	}

	const urls: Record<string, string> = {};
	for (const key of keys) urls[key] = presign("PUT", key, WRITE_EXPIRES, credentials);
	return json({ expiresIn: WRITE_EXPIRES, urls });
};
