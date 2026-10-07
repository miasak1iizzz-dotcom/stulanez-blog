import type { APIRoute } from "astro";
import { hostAllowed, isPrivateHost, isSafeHttpsUrl } from "@/utils/pull/hosts";
import { fetchBinary } from "@/utils/pull/http";

export const prerender = false;

/** Gallery tiles burst dozens of proxy requests at once; douyinpic's edge
 * occasionally 403s/times out a few of them. One broken tile has no browser
 * retry, so retry here before giving up. */
const UPSTREAM_ATTEMPTS = 3;
const UPSTREAM_TIMEOUT_MS = 4500;

const MAX_BYTES = 28 * 1024 * 1024;

const REFERER_BY_HOST: Array<{ test: RegExp; referer: string }> = [
	{ test: /sinaimg\.cn|weibo\.cn/i, referer: "https://weibo.com/" },
	{ test: /xhscdn|xiaohongshu/i, referer: "https://www.xiaohongshu.com/" },
	{
		test: /douyinpic|byteimg|ibyteimg|douyincdn/i,
		referer: "https://www.douyin.com/",
	},
	{
		test: /cdninstagram|fbcdn|instagram/i,
		referer: "https://www.instagram.com/",
	},
];

function bad(message: string, status = 400): Response {
	return new Response(message, { status });
}

export const GET: APIRoute = async ({ url }) => {
	const target = url.searchParams.get("url") || "";
	const download = url.searchParams.get("download") === "1";
	const filename = (url.searchParams.get("filename") || "image.jpg").replace(
		/[^\w.-]+/g,
		"_",
	);
	if (!isSafeHttpsUrl(target)) return bad("链接不安全。");
	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return bad("链接无效。");
	}
	if (isPrivateHost(parsed.hostname) || !hostAllowed(parsed.hostname)) {
		return bad("这个图床不在白名单里。");
	}

	const referer =
		REFERER_BY_HOST.find((row) => row.test.test(parsed.hostname))?.referer ||
		`${parsed.origin}/`;

	const upstreamHeaders = {
		Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
		Referer: referer,
	};

	let lastStatus = 0;
	let lastTimedOut = false;
	for (let attempt = 0; attempt < UPSTREAM_ATTEMPTS; attempt++) {
		if (attempt > 0) {
			await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
		}
		try {
			const upstream = await fetchBinary(target, {
				timeoutMs: UPSTREAM_TIMEOUT_MS,
				headers: upstreamHeaders,
			});
			if (
				upstream.status >= 200 &&
				upstream.status < 300 &&
				upstream.body.length
			) {
				if (upstream.body.length > MAX_BYTES) {
					return bad("图太大了。", 413);
				}
				const type = upstream.contentType || "image/jpeg";
				if (type.startsWith("text/html")) continue;
				const headers = new Headers();
				headers.set("content-type", type);
				headers.set("cache-control", "private, max-age=3600");
				headers.set(
					"content-disposition",
					`${download ? "attachment" : "inline"}; filename="${filename}"`,
				);
				return new Response(new Uint8Array(upstream.body), {
					status: 200,
					headers,
				});
			}
			lastStatus = upstream.status;
		} catch {
			lastTimedOut = true;
		}
	}
	if (lastTimedOut) return bad("原图超时。", 504);
	return bad("原图拿不到。", 502);
};
