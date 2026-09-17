/**
 * 艺术馆图片缓存 Worker —— 把对象存储里的展品图缓存在 Cloudflare 边缘。
 *
 * 为什么需要它：
 *   图片本体在美国的 B2 桶里，国内访客直取每张要 1.5~3 秒（跨太平洋）。
 *   Vercel 函数代理能缓存，但它有冷启动、缓存命中率也不稳（实测未命中时飙到 19.8 秒）。
 *   Cloudflare Worker 没有冷启动，且能用 Cache API 显式缓存，命中后直接由边缘节点返回。
 *
 * 用法：/art-image/?key=art/thumb/e8/e82a1c56437f7ef4-480.webp
 * 缓存：文件名即内容哈希，内容永不变 → 一年 immutable。
 *
 * 需要的 Worker 变量（用 wrangler secret 配置，不写进代码）：
 *   S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET
 */

const ALLOWED = /^art\/(img|thumb)\//;
const CACHE_SECONDS = 31536000; // 一年

const encoder = new TextEncoder();

function toHex(buffer) {
	return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text) {
	return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

/** HMAC-SHA256；raw=true 时返回 ArrayBuffer，否则返回 Uint8Array */
async function hmac(key, data, raw = false) {
	const rawKey = typeof key === "string" ? encoder.encode(key) : key;
	const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
	return raw ? signature : new Uint8Array(signature);
}

/** SigV4 预签名 GET（与站点里的 src/utils/s3-sign.ts 同一套算法） */
async function presignGet(key, env) {
	const endpoint = env.S3_ENDPOINT;
	const region = env.S3_REGION;
	const bucket = env.S3_BUCKET;
	const accessKeyId = env.S3_ACCESS_KEY_ID;
	const secret = env.S3_SECRET_ACCESS_KEY;
	const expires = 604800; // 7 天，够回源用

	const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);
	const scope = `${dateStamp}/${region}/s3/aws4_request`;
	const canonicalUri = `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

	const params = new URLSearchParams();
	params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
	params.set("X-Amz-Credential", `${accessKeyId}/${scope}`);
	params.set("X-Amz-Date", amzDate);
	params.set("X-Amz-Expires", String(expires));
	params.set("X-Amz-SignedHeaders", "host");
	const canonicalQuery = params.toString();

	const canonicalRequest = ["GET", canonicalUri, canonicalQuery, `host:${endpoint}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");

	const kDate = await hmac(`AWS4${secret}`, dateStamp);
	const kRegion = await hmac(kDate, region);
	const kService = await hmac(kRegion, "s3");
	const kSigning = await hmac(kService, "aws4_request");
	const signature = toHex(await hmac(kSigning, stringToSign, true));

	return `https://${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const key = (url.searchParams.get("key") ?? "").replace(/^\/+/, "");
		if (!key || !ALLOWED.test(key)) {
			return new Response("forbidden", { status: 403 });
		}

		// 缓存键只用 key，不含任何会变的东西
		const cacheKey = new Request(`${url.origin}/?key=${encodeURIComponent(key)}`, { method: "GET" });
		const cache = caches.default;

		const cached = await cache.match(cacheKey);
		if (cached) return cached;

		let upstream;
		try {
			upstream = await fetch(await presignGet(key, env));
		} catch (error) {
			return new Response(`upstream error: ${error.message}`, { status: 502 });
		}
		if (!upstream.ok) {
			return new Response("not found", { status: upstream.status === 404 ? 404 : 502 });
		}

		const response = new Response(upstream.body, {
			status: 200,
			headers: {
				"content-type": "image/webp",
				"cache-control": `public, max-age=${CACHE_SECONDS}, immutable`,
			},
		});
		ctx.waitUntil(cache.put(cacheKey, response.clone()));
		return response;
	},
};
