import type { APIRoute } from "astro";
import { fetchBinary } from "@/utils/pull/http";
import { hostAllowed, isPrivateHost, isSafeHttpsUrl } from "@/utils/pull/hosts";

export const prerender = false;

const MAX_BYTES = 28 * 1024 * 1024;

const REFERER_BY_HOST: Array<{ test: RegExp; referer: string }> = [
	{ test: /sinaimg\.cn|weibo\.cn/i, referer: "https://weibo.com/" },
	{ test: /xhscdn|xiaohongshu/i, referer: "https://www.xiaohongshu.com/" },
	{ test: /douyinpic|byteimg|ibyteimg|douyincdn/i, referer: "https://www.douyin.com/" },
	{ test: /cdninstagram|fbcdn|instagram/i, referer: "https://www.instagram.com/" },
];

function bad(message: string, status = 400): Response {
	return new Response(message, { status });
}

export const GET: APIRoute = async ({ url }) => {
	const target = url.searchParams.get("url") || "";
	const download = url.searchParams.get("download") === "1";
	const filename = (url.searchParams.get("filename") || "image.jpg").replace(
		/[^\w.\-]+/g,
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

	try {
		const upstream = await fetchBinary(target, {
			timeoutMs: 25000,
			headers: {
				Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
				Referer: referer,
			},
		});
		if (upstream.status < 200 || upstream.status >= 300 || !upstream.body.length) {
			return bad("原图拿不到。", 502);
		}
		if (upstream.body.length > MAX_BYTES) return bad("图太大了。", 413);
		const type = upstream.contentType || "image/jpeg";
		if (type.startsWith("text/html")) return bad("渠道拦住了原图。", 502);

		const headers = new Headers();
		headers.set("content-type", type);
		headers.set("cache-control", "private, max-age=3600");
		headers.set(
			"content-disposition",
			`${download ? "attachment" : "inline"}; filename="${filename}"`,
		);
		return new Response(new Uint8Array(upstream.body), { status: 200, headers });
	} catch {
		return bad("原图超时。", 504);
	}
};
