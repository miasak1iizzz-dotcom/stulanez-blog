import { isCdnImageUrl, hostAllowed } from "./hosts";
import { peelUrl } from "./peel";
import type { PullChannelId, PullImage } from "./types";

export { peelUrl } from "./peel";

export function decodeMaybeUri(value: string): string {
	try {
		if (/%[0-9A-Fa-f]{2}/.test(value)) return decodeURIComponent(value);
	} catch {
		/* keep */
	}
	return value;
}

export function unescapeJsonString(value: string): string {
	return value
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.replace(/\\\//g, "/")
		.replace(/\\"/g, '"');
}

export function uniqueUrls(urls: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of urls) {
		const url = normalizeImageUrl(raw);
		if (!url || seen.has(url)) continue;
		seen.add(url);
		out.push(url);
	}
	return out;
}

export function normalizeImageUrl(raw: string): string | null {
	if (!raw) return null;
	let url = unescapeJsonString(raw.trim()).replace(/&amp;/g, "&");
	if (url.startsWith("//")) url = `https:${url}`;
	if (url.startsWith("http://")) {
		try {
			const host = new URL(url).hostname;
			if (hostAllowed(host)) url = `https://${url.slice("http://".length)}`;
		} catch {
			/* keep */
		}
	}
	if (!/douyinpic\.com/i.test(url)) url = decodeMaybeUri(url);
	if (!isCdnImageUrl(url)) return null;
	return url.split("#")[0] ?? url;
}

export function filenamesFor(channel: PullChannelId, urls: string[]): PullImage[] {
	return urls.map((url, index) => {
		let ext = "jpg";
		try {
			const path = new URL(url).pathname;
			const m = /\.(jpe?g|png|webp|gif|bmp|heic|avif)(?:$|\?)/i.exec(path);
			if (m?.[1]) ext = m[1].toLowerCase().replace("jpeg", "jpg");
		} catch {
			/* default */
		}
		const n = String(index + 1).padStart(2, "0");
		return { url, filename: `${channel}-${n}.${ext}` };
	});
}

export function metaContent(html: string, key: string): string | undefined {
	return metaContents(html, key)[0];
}

export function metaContents(html: string, key: string): string[] {
	const out: string[] = [];
	const patterns = [
		new RegExp(
			`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
			"gi",
		),
		new RegExp(
			`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
			"gi",
		),
	];
	for (const re of patterns) {
		for (const m of html.matchAll(re)) {
			if (m[1]) out.push(decodeHtml(m[1]));
		}
	}
	return out;
}

export function decodeHtml(value: string): string {
	return value
		.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, num: string) =>
			String.fromCharCode(Number(num)),
		)
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

export function collectHttpUrls(text: string): string[] {
	const found: string[] = [];
	const re = /https?:\\?\/\\?\/[^\s"'<>\\]+/g;
	for (const m of text.matchAll(re)) {
		found.push(unescapeJsonString(m[0]));
	}
	return uniqueUrls(found);
}

export function walkImageUrls(value: unknown, acc: string[] = [], depth = 0): string[] {
	if (depth > 12 || value == null) return acc;
	if (typeof value === "string") {
		const url = normalizeImageUrl(value);
		if (url) acc.push(url);
		return acc;
	}
	if (Array.isArray(value)) {
		if (value.every((v) => typeof v === "string")) {
			const list = value as string[];
			const last = list[list.length - 1];
			if (last) walkImageUrls(last, acc, depth + 1);
			else for (const item of list) walkImageUrls(item, acc, depth + 1);
			return acc;
		}
		for (const item of value) walkImageUrls(item, acc, depth + 1);
		return acc;
	}
	if (typeof value === "object") {
		const rec = value as Record<string, unknown>;
		for (const [key, child] of Object.entries(rec)) {
			if (/avatar|icon|logo|emoji|sticker|badge|watermark_dot/i.test(key)) continue;
			walkImageUrls(child, acc, depth + 1);
		}
	}
	return acc;
}

export function scriptJson(html: string, id: string): unknown | null {
	const re = new RegExp(
		`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)</script>`,
		"i",
	);
	const m = re.exec(html);
	if (!m?.[1]) return null;
	const raw = decodeMaybeUri(m[1].trim());
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function detectChannel(input: string): PullChannelId | null {
	let raw = peelUrl(input);
	if (!raw) return null;
	let host = "";
	try {
		host = new URL(raw).hostname.toLowerCase();
	} catch {
		return null;
	}
	if (
		host.includes("instagram.com") ||
		host.includes("instagr.am") ||
		host.includes("ddinstagram.com")
	) {
		return "instagram";
	}
	if (host.includes("douyin.com") || host.includes("iesdouyin.com")) {
		return "douyin";
	}
	if (host.includes("xiaohongshu.com") || host.includes("xhslink.com")) {
		return "xiaohongshu";
	}
	if (
		host === "t.cn" ||
		host.includes("weibo.com") ||
		host.includes("weibo.cn") ||
		host.includes("sina.cn")
	) {
		return "weibo";
	}
	return null;
}

export function needUrl(input: string): string {
	const found = peelUrl(input);
	if (!found) throw new Error("请先贴一条链接。");
	return found;
}
