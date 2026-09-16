import { fetchText } from "./http";
import {
	collectHttpUrls,
	decodeHtml,
	filenamesFor,
	metaContent,
	needUrl,
	unescapeJsonString,
	uniqueUrls,
} from "./parse";
import type { PullResult } from "./types";
import { IPHONE_UA } from "./types";

function shortcode(url: string): string | null {
	const m =
		/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/instagram\.com\/share\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/ddinstagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/instagr\.am\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url);
	return m?.[1] ?? null;
}

function keepIg(url: string): boolean {
	if (/static\.cdninstagram\.com|\/rsrc\.php\//i.test(url)) return false;
	if (/scontent[^/]*\.cdninstagram\.com/i.test(url)) return true;
	if (/fbcdn\.net/i.test(url) && /\/t\d+\./i.test(url)) return true;
	return /instagram\.com\/.*\.(jpg|jpeg|png|webp)/i.test(url);
}

function upgradeIg(url: string): string {
	return unescapeJsonString(url).replace(/&amp;/g, "&");
}

function mediaKey(url: string): string {
	try {
		const path = new URL(url).pathname;
		const base = path.split("/").pop() || path;
		return base.replace(/\.(jpe?g|png|webp|heic)$/i, "");
	} catch {
		return url;
	}
}

function scoreIg(url: string): number {
	let score = 0;
	if (!/[?&]stp=/i.test(url)) score += 50;
	const size = /[?&]stp=[^&]*p(\d+)x(\d+)/i.exec(url);
	if (size) score += Number(size[1]) || 0;
	const box = /[?&]stp=[^&]*s(\d+)x(\d+)/i.exec(url);
	if (box) score += (Number(box[1]) || 0) * 0.5;
	if (/dst-jpg|dst-webp/i.test(url)) score += 5;
	return score;
}

function pickBestPerMedia(urls: string[]): string[] {
	const best = new Map<string, string>();
	for (const url of urls) {
		if (!keepIg(url)) continue;
		const key = mediaKey(url);
		const prev = best.get(key);
		if (!prev || scoreIg(url) > scoreIg(prev)) best.set(key, url);
	}
	return [...best.values()];
}

function extractCandidateUrls(html: string): string[] {
	const pics: string[] = [];

	for (const m of html.matchAll(/"display_url":"((?:\\.|[^"\\])*)"/g)) {
		if (!m[1]) continue;
		try {
			pics.push(upgradeIg(JSON.parse(`"${m[1]}"`)));
		} catch {
			pics.push(upgradeIg(m[1]));
		}
	}

	for (const m of html.matchAll(/"url":"(https:[^"]+scontent[^"]+)"/g)) {
		if (m[1]) pics.push(upgradeIg(m[1]));
	}

	for (const m of html.matchAll(/https:\\\/\\\/scontent[^"\\]+/g)) {
		pics.push(upgradeIg(m[0]));
	}

	pics.push(...collectHttpUrls(html).filter(keepIg));

	const og = metaContent(html, "og:image");
	if (og) pics.push(upgradeIg(og));

	return pics;
}

export async function extractInstagram(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	let working = sourceUrl;
	if (/instagram\.com\/share\/|l\.instagram\.com/i.test(working)) {
		const bounced = await fetchText(working, {
			mobile: true,
			headers: {
				"User-Agent": IPHONE_UA,
				Referer: "https://www.instagram.com/",
			},
		});
		working = bounced.url || working;
	}
	const code = shortcode(working);
	if (!code) {
		return {
			ok: false,
			error: "这不像 Instagram 帖。请贴 App 分享链接，或 /p/、/reel/ 网页地址。",
		};
	}

	const pageUrl = `https://www.instagram.com/p/${code}/`;
	const html = await fetchText(pageUrl, {
		mobile: true,
		headers: {
			"User-Agent": IPHONE_UA,
			Referer: "https://www.instagram.com/",
			Accept: "text/html",
		},
	});

	const pics = extractCandidateUrls(html.text);

	if (!pics.length) {
		const embed = await fetchText(`https://www.instagram.com/p/${code}/embed/captioned/`, {
			mobile: true,
			headers: {
				"User-Agent": IPHONE_UA,
				Referer: "https://www.instagram.com/",
			},
		});
		pics.push(...extractCandidateUrls(embed.text));
	}

	const images = filenamesFor("instagram", pickBestPerMedia(uniqueUrls(pics)));
	if (!images.length) {
		return {
			ok: false,
			error: "Instagram 没有把图给我。登录墙或私密帖会这样。公开帖再试一次。",
		};
	}

	const title =
		metaContent(html.text, "og:title") ||
		metaContent(html.text, "og:description") ||
		`Instagram ${code}`;
	const authorM =
		/instagram\.com\/([A-Za-z0-9._]+)\/(?:p|reel)\//i.exec(html.url) ||
		/"username":"([A-Za-z0-9._]+)"/.exec(html.text);

	let warning: string | undefined;
	if (images.length === 1) {
		warning = "多图帖有时只能先拿到封面。";
	}

	return {
		ok: true,
		channel: "instagram",
		sourceUrl: html.url || sourceUrl,
		title: decodeHtml(title)
			.replace(/\s+on Instagram.*$/i, "")
			.replace(/\s+的 Instagram.*$/u, "")
			.slice(0, 80),
		author: authorM?.[1],
		images,
		warning,
	};
}
