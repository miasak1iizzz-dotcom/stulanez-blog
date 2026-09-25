import OSS from "ali-oss";

const WINDOW_SECONDS = 6 * 60 * 60;

const ALLOWED =
	/^(gallery\/[^/]+\/.+\.(jpe?g|png|webp|avif|gif)|assets\/music\/.+\.(mp3|jpg|jpeg|png|webp)|assets\/images\/wallpaper\/.+\.webp)$/i;

let client: OSS | null = null;

function envValue(name: keyof ImportMetaEnv): string {
	const fromProcess = process.env[name];
	if (fromProcess) return fromProcess;
	return import.meta.env[name] ?? "";
}

function ossClient(): OSS | null {
	const accessKeyId = envValue("OSS_ACCESS_KEY_ID");
	const accessKeySecret = envValue("OSS_ACCESS_KEY_SECRET");
	const bucket = envValue("OSS_BUCKET");
	const region = envValue("OSS_REGION") || "oss-cn-hangzhou";
	if (!accessKeyId || !accessKeySecret || !bucket) return null;
	if (!client) {
		client = new OSS({
			region,
			accessKeyId,
			accessKeySecret,
			bucket,
			secure: true,
			timeout: 15000,
		});
	}
	return client;
}

/** 同一时间窗内签名相同，浏览器才能缓存，不会每次换页都重新下。 */
function stableExpires(): number {
	const now = Math.floor(Date.now() / 1000);
	let end = Math.ceil(now / WINDOW_SECONDS) * WINDOW_SECONDS;
	if (end - now < 180) end += WINDOW_SECONDS;
	return end - now;
}

export function isAllowedOssKey(key: string): boolean {
	const clean = key.replace(/^\/+/, "").replace(/\.\./g, "");
	return ALLOWED.test(clean);
}

export function signOssKey(key: string): string | null {
	const clean = key.replace(/^\/+/, "").split("?")[0] ?? "";
	if (!isAllowedOssKey(clean)) return null;
	const oss = ossClient();
	if (!oss) return null;
	const expires = stableExpires();
	return oss.signatureUrl(clean, {
		expires,
		response: {
			"cache-control": "public, max-age=21600",
		},
	});
}

export function signExpiresSeconds(): number {
	return stableExpires();
}
