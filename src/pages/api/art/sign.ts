/**
 * 艺术馆发布签名接口 —— 给站长的浏览器发「上传许可证」（预签名 URL）。
 *
 * 为什么要有它：策展台要把缩略图和清单直接传进 R2，但不能把存储密钥放进网页。
 * 所以由这个接口用服务端密钥签出有时效的 PUT 地址，浏览器拿着它直传 R2，
 * 图片字节完全不经过本站服务器。
 *
 * 需要的环境变量（Vercel 项目设置里配，或本机 .env.local）：
 *   R2_ACCOUNT_ID          Cloudflare 账号 ID
 *   R2_ACCESS_KEY_ID       R2 API 令牌的 Access Key ID
 *   R2_SECRET_ACCESS_KEY   R2 API 令牌的 Secret Access Key
 *   R2_BUCKET              桶名，默认 stulanez
 *   ART_PUBLISH_TOKEN      站长口令，策展台里填一次；没配则接口直接拒绝服务
 *
 * 部署要求：需要服务端运行，不能是纯静态。astro.config 已配 vercel 适配器。
 */
import crypto from "node:crypto";
import type { APIRoute } from "astro";

export const prerender = false;

const REGION = "auto";
const SERVICE = "s3";
const EXPIRES_SECONDS = 900;
/** 只允许写这两个前缀，防止签名接口被拿来当任意文件的通行证 */
const ALLOWED_PREFIXES = ["art/img/", "art/thumb/", "art/manifest.json"];

interface SignRequest {
	token?: string;
	keys?: string[];
}

function env(name: string, fallback = ""): string {
	return (process.env[name] ?? fallback).trim();
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
	return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string): string {
	return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/** encodeURIComponent 之外的额外编码，S3 规范要求 */
function encodeKeyPart(part: string): string {
	return encodeURIComponent(part).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** 生成 R2（S3 兼容）的预签名 PUT URL（SigV4，UNSIGNED-PAYLOAD） */
function presignPut(key: string, credentials: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }): string {
	const { accountId, accessKeyId, secretAccessKey, bucket } = credentials;
	const host = `${accountId}.r2.cloudflarestorage.com`;
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);
	const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
	const canonicalUri = `/${bucket}/${key.split("/").map(encodeKeyPart).join("/")}`;

	// 键必须按字典序，这个插入顺序正好是
	const params = new URLSearchParams();
	params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
	params.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
	params.set("X-Amz-Date", amzDate);
	params.set("X-Amz-Expires", String(EXPIRES_SECONDS));
	params.set("X-Amz-SignedHeaders", "host");
	const canonicalQuery = params.toString();

	const canonicalRequest = ["PUT", canonicalUri, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
	const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), REGION), SERVICE), "aws4_request");
	const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

	return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
}

export const POST: APIRoute = async ({ request }) => {
	const expected = env("ART_PUBLISH_TOKEN");
	if (!expected) {
		return json({ error: "服务端还没配 ART_PUBLISH_TOKEN，发布功能未启用" }, 503);
	}

	let payload: SignRequest;
	try {
		payload = (await request.json()) as SignRequest;
	} catch {
		return json({ error: "请求不是合法 JSON" }, 400);
	}

	if (payload.token !== expected) {
		return json({ error: "站长口令不对" }, 401);
	}

	const accountId = env("R2_ACCOUNT_ID");
	const accessKeyId = env("R2_ACCESS_KEY_ID");
	const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
	const bucket = env("R2_BUCKET", "stulanez");
	if (!accountId || !accessKeyId || !secretAccessKey) {
		return json({ error: "服务端 R2 凭证没配齐" }, 503);
	}

	const keys = Array.isArray(payload.keys) ? payload.keys.filter(k => typeof k === "string" && k.length > 0) : [];
	if (!keys.length) return json({ error: "没给要签的 key" }, 400);
	if (keys.length > 500) return json({ error: "一次最多签 500 个文件" }, 400);

	for (const key of keys) {
		if (!ALLOWED_PREFIXES.some(prefix => key.startsWith(prefix))) {
			return json({ error: `不允许写这个路径：${key}` }, 403);
		}
	}

	const urls: Record<string, string> = {};
	for (const key of keys) {
		urls[key] = presignPut(key, { accountId, accessKeyId, secretAccessKey, bucket });
	}
	return json({ expiresIn: EXPIRES_SECONDS, urls });
};
