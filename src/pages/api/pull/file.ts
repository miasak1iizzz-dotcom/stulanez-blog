import type { APIRoute } from "astro";
import { BROWSER_UA } from "@/utils/pull/types";
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

	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 20000);
	try {
		const upstream = await fetch(target, {
			redirect: "follow",
			signal: ctrl.signal,
			headers: {
				"User-Agent": BROWSER_UA,
				Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
				Referer: referer,
			},
		});
		if (!upstream.ok || !upstream.body) {
			return bad("原图拿不到。", 502);
		}
		const length = Number(upstream.headers.get("content-length") || "0");
		if (length > MAX_BYTES) return bad("图太大了。", 413);
		const type = upstream.headers.get("content-type") || "image/jpeg";
		if (type.startsWith("text/html")) return bad("渠道拦住了原图。", 502);

		const headers = new Headers();
		headers.set("content-type", type);
		headers.set("cache-control", "private, max-age=3600");
		headers.set(
			"content-disposition",
			`${download ? "attachment" : "inline"}; filename="${filename}"`,
		);
		return new Response(upstream.body, { status: 200, headers });
	} catch {
		return bad("原图超时。", 504);
	} finally {
		clearTimeout(timer);
	}
};
