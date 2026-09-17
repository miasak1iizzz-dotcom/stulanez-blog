/**
 * S3 兼容对象存储的签名与读取 —— 发布接口（写）与清单接口（读）共用。
 *
 * 支持两家的环境变量（见 docs/ai/art-museum-spec.md §7）：
 *   R2_*  ：Cloudflare R2（需要绑卡）
 *   S3_*  ：Backblaze B2 或任何 S3 兼容服务（B2 不用绑卡）
 *
 * 密钥只从服务端环境变量读，绝不进浏览器。
 */
import crypto from "node:crypto";

export interface S3Credentials {
	/** 形如 s3.us-east-005.backblazeb2.com（不带协议） */
	endpoint: string;
	/** B2 是 us-east-005 之类；R2 固定 auto */
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
}

/** 写签名短一点（发布当场用完即弃）；读签名长一点，覆盖访客整个浏览会话。 */
export const WRITE_EXPIRES = 900;
export const READ_EXPIRES = 604800; // SigV4 上限 7 天

const SERVICE = "s3";

function env(name: string, fallback = ""): string {
	return (process.env[name] ?? fallback).trim();
}

/** 从环境变量里认出一家可用的存储。 */
export function resolveCredentials(): S3Credentials | null {
	const accessKeyId = env("S3_ACCESS_KEY_ID") || env("R2_ACCESS_KEY_ID");
	const secretAccessKey = env("S3_SECRET_ACCESS_KEY") || env("R2_SECRET_ACCESS_KEY");
	const bucket = env("S3_BUCKET") || env("R2_BUCKET", "stulanez");
	if (!accessKeyId || !secretAccessKey) return null;

	let endpoint = env("S3_ENDPOINT")
		.replace(/^https?:\/\//, "")
		.replace(/\/+$/, "");
	let region = env("S3_REGION", "auto");
	if (!endpoint) {
		const accountId = env("R2_ACCOUNT_ID");
		if (!accountId) return null;
		endpoint = `${accountId}.r2.cloudflarestorage.com`;
		region = "auto";
	}
	return { endpoint, region, accessKeyId, secretAccessKey, bucket };
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

export function objectUrl(key: string, credentials: S3Credentials): string {
	return `https://${credentials.endpoint}/${credentials.bucket}/${key.split("/").map(encodeKeyPart).join("/")}`;
}

/** 生成预签名 URL（SigV4，UNSIGNED-PAYLOAD，路径风格）。 */
export function presign(method: "GET" | "PUT" | "DELETE", key: string, expires: number, credentials: S3Credentials): string {
	const { endpoint, region, accessKeyId, secretAccessKey, bucket } = credentials;
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
	const dateStamp = amzDate.slice(0, 8);
	const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
	const canonicalUri = `/${bucket}/${key.split("/").map(encodeKeyPart).join("/")}`;

	// 键必须按字典序，这个插入顺序正好是
	const params = new URLSearchParams();
	params.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
	params.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
	params.set("X-Amz-Date", amzDate);
	params.set("X-Amz-Expires", String(expires));
	params.set("X-Amz-SignedHeaders", "host");
	const canonicalQuery = params.toString();

	const canonicalRequest = [method, canonicalUri, canonicalQuery, `host:${endpoint}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
	const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
	const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), SERVICE), "aws4_request");
	const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

	return `${objectUrl(key, credentials)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** 读一个对象的文本内容（用于取清单）。取不到返回 null。 */
export async function getObjectText(key: string, credentials: S3Credentials): Promise<string | null> {
	const response = await fetch(presign("GET", key, READ_EXPIRES, credentials), { cache: "no-store" });
	if (!response.ok) return null;
	return await response.text();
}
