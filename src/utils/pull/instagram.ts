import { fetchText } from "./http";
import {
	collectHttpUrls,
	filenamesFor,
	metaContent,
	needUrl,
	uniqueUrls,
} from "./parse";
import type { PullResult } from "./types";

function shortcode(url: string): string | null {
	const m =
		/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/instagram\.com\/share\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/ddinstagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url) ||
		/instagr\.am\/(?:p|reel)\/([A-Za-z0-9_-]+)/i.exec(url);
	return m?.[1] ?? null;
}

function keepIg(url: string): boolean {
	return /cdninstagram\.com|fbcdn\.net|instagram\.com\/.*\.(jpg|jpeg|png|webp)/i.test(
		url,
	);
}

function upgradeIg(url: string): string {
	return url.replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
}

export async function extractInstagram(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	let working = sourceUrl;
	if (/instagram\.com\/share\/|l\.instagram\.com/i.test(working)) {
		const bounced = await fetchText(working, {
			headers: { Referer: "https://www.instagram.com/" },
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
		headers: {
			Referer: "https://www.instagram.com/",
			Accept: "text/html",
		},
	});

	const pics: string[] = [];
	const display = [
		...html.text.matchAll(/"display_url":"((?:\\.|[^"\\])*)"/g),
	];
	for (const m of display) {
		if (!m[1]) continue;
		try {
			pics.push(upgradeIg(JSON.parse(`"${m[1]}"`)));
		} catch {
			pics.push(upgradeIg(m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/")));
		}
	}
	const videoStill = [...html.text.matchAll(/"video_url":"((?:\\.|[^"\\])*)"/g)];
	if (!pics.length && videoStill.length) {
		const og = metaContent(html.text, "og:image");
		if (og) pics.push(og);
	}

	pics.push(...collectHttpUrls(html.text).filter(keepIg));
	const og = metaContent(html.text, "og:image");
	if (og) pics.push(og);

	const embed = await fetchText(`https://www.instagram.com/p/${code}/embed/captioned/`, {
		headers: { Referer: "https://www.instagram.com/" },
	});
	pics.push(...collectHttpUrls(embed.text).filter(keepIg));
	const embedOg = metaContent(embed.text, "og:image");
	if (embedOg) pics.push(embedOg);

	const images = filenamesFor("instagram", uniqueUrls(pics.map(upgradeIg)).filter(keepIg));
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
	const authorM = /instagram\.com\/([A-Za-z0-9._]+)\/p\//i.exec(html.url);
	let warning: string | undefined;
	if (images.length === 1) {
		warning = "多图帖有时只能先拿到封面。公开帖一般还能再挤出几张。";
	}

	return {
		ok: true,
		channel: "instagram",
		sourceUrl: html.url || sourceUrl,
		title: title.replace(/\s+on Instagram.*$/i, "").slice(0, 80),
		author: authorM?.[1],
		images,
		warning,
	};
}
