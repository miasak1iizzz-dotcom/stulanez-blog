import { fetchText } from "./http";
import {
	collectHttpUrls,
	filenamesFor,
	metaContent,
	metaContents,
	needUrl,
	normalizeImageUrl,
	scriptJson,
	uniqueUrls,
	walkImageUrls,
} from "./parse";
import type { PullResult } from "./types";

function noteId(url: string): string | null {
	const m =
		/xiaohongshu\.com\/(?:explore|discovery\/item|board\/\w+\/item\/)?([0-9a-f]{24})/i.exec(
			url,
		) || /\/(?:item|explore)\/([0-9a-f]{24})/i.exec(url);
	return m?.[1] ?? null;
}

function xhsMediaKey(url: string): string {
	try {
		const path = new URL(url).pathname;
		const m = /\/(spectrum|notes_pre_post|notes_pre_post_img)\/([^!/?]+)/i.exec(path);
		if (m) return `${m[1]}/${m[2]}`;
		return path.replace(/!.*$/, "") || url;
	} catch {
		return url;
	}
}

function upgradeXhs(url: string): string {
	// Keep default scene; preview scene is smaller.
	return url.replace(/!nd_prv_[^/?#]+/i, (m) =>
		m.replace(/nd_prv/i, "nd_dft"),
	);
}

function isXhsPhoto(url: string): boolean {
	if (/avatar|fe-platform|sns-avatar|icon|fe-static|picasso-static|\/api\/|\/explore\/|\/publish\//i.test(url)) {
		return false;
	}
	if (!/xhscdn\.(?:com|net)|ci\.xiaohongshu\.com|sns-webpic|sns-img/i.test(url)) {
		return false;
	}
	return /\/(?:spectrum|notes_pre_post|notes_pre_post_img)\//i.test(url) ||
		/\.(?:jpe?g|png|webp|heic)(?:$|[!?])/i.test(url);
}

function pickBestPerMedia(urls: string[]): string[] {
	const best = new Map<string, string>();
	const score = (url: string) => {
		let s = 0;
		if (/!nd_dft_/i.test(url)) s += 40;
		if (/!nd_prv_/i.test(url)) s -= 20;
		if (/\/spectrum\//i.test(url)) s += 10;
		if (/\/notes_pre_post/i.test(url)) s += 20;
		if (/original|ny_/i.test(url)) s += 30;
		// Prefer complete CDN scene URLs over truncated base paths.
		if (/![a-z0-9_]+$/i.test(url)) s += 15;
		s += Math.min(url.length, 500) / 50;
		return s;
	};
	for (const raw of urls) {
		const url = normalizeImageUrl(upgradeXhs(raw));
		if (!url || !isXhsPhoto(url)) continue;
		const key = xhsMediaKey(url);
		const prev = best.get(key);
		if (!prev || score(url) > score(prev)) best.set(key, url);
	}
	return [...best.values()];
}

function collectFromImageList(initial: unknown): string[] {
	const pics: string[] = [];
	const root = initial as {
		note?: { noteDetailMap?: Record<string, { note?: { imageList?: unknown[] } }> };
	} | null;
	const map = root?.note?.noteDetailMap;
	if (!map) return pics;
	for (const entry of Object.values(map)) {
		const list = entry?.note?.imageList;
		if (!Array.isArray(list)) continue;
		for (const item of list) {
			if (!item || typeof item !== "object") continue;
			const rec = item as {
				urlDefault?: string;
				url?: string;
				urlPre?: string;
				infoList?: Array<{ url?: string; imageScene?: string }>;
			};
			const dft = rec.infoList?.find((x) => /WB_DFT|DFT/i.test(x.imageScene || ""))?.url;
			const anyInfo = rec.infoList?.map((x) => x.url).filter(Boolean) as string[];
			for (const cand of [rec.urlDefault, dft, rec.url, ...(anyInfo || []), rec.urlPre]) {
				if (cand) pics.push(cand);
			}
		}
	}
	return pics;
}

export async function extractXiaohongshu(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	let working = sourceUrl;

	if (/xhslink\.com/i.test(working)) {
		const bounced = await fetchText(working, { mobile: true });
		working = bounced.url || working;
	}

	const html = await fetchText(working, {
		headers: {
			Referer: "https://www.xiaohongshu.com/",
		},
	});

	const pics: string[] = [];
	const initial = scriptJson(html.text, "initial-state") || extractInitialState(html.text);
	if (initial) {
		pics.push(...collectFromImageList(initial));
		pics.push(...walkImageUrls(initial));
	}

	pics.push(...metaContents(html.text, "og:image"));
	pics.push(
		...collectHttpUrls(html.text).filter((u) =>
			/xhscdn|xiaohongshu\.com/i.test(u),
		),
	);

	const images = filenamesFor("xiaohongshu", pickBestPerMedia(uniqueUrls(pics)));

	if (!images.length) {
		const id = noteId(html.url) || noteId(sourceUrl);
		const hint = id
			? "小红书把内容藏起来了。把 App「复制链接」的整段口令，或地址栏里带 xsec_token 的链接再贴一次。"
			: "这不像小红书笔记。请贴 xhslink 短链、分享口令，或笔记网页链接。";
		return { ok: false, error: hint };
	}

	const title =
		metaContent(html.text, "og:title") ||
		metaContent(html.text, "og:description") ||
		"小红书笔记";
	const author = metaContent(html.text, "og:site_name");

	return {
		ok: true,
		channel: "xiaohongshu",
		sourceUrl: html.url || sourceUrl,
		title: title.replace(/ - 小红书$/, "").slice(0, 80),
		author: author === "小红书" ? undefined : author,
		images,
		warning:
			images.length === 1
				? "目前只拿到封面或首图。把带 xsec_token 的完整链接再贴一次往往能拿齐。"
				: undefined,
	};
}

function extractInitialState(html: string): unknown | null {
	const marker = "window.__INITIAL_STATE__";
	const start = html.indexOf(marker);
	if (start < 0) return null;
	const eq = html.indexOf("=", start + marker.length);
	if (eq < 0) return null;
	let i = eq + 1;
	while (i < html.length && /\s/.test(html[i] || "")) i += 1;
	if (html[i] !== "{") return null;
	let depth = 0;
	let end = -1;
	for (let p = i; p < html.length; p += 1) {
		const ch = html[p];
		if (ch === "{") depth += 1;
		else if (ch === "}") {
			depth -= 1;
			if (depth === 0) {
				end = p + 1;
				break;
			}
		}
	}
	if (end < 0) return null;
	try {
		return JSON.parse(html.slice(i, end).replace(/undefined/g, "null"));
	} catch {
		return null;
	}
}
