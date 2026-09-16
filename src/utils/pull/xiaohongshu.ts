import { fetchText } from "./http";
import {
	collectHttpUrls,
	filenamesFor,
	metaContent,
	needUrl,
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

function preferOriginal(urls: string[]): string[] {
	const originals = urls.filter((u) => /\/notes_pre_post\/|\/spectrum\/|ny_|original/i.test(u));
	return originals.length ? uniqueUrls(originals) : uniqueUrls(urls);
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
	const initial =
		scriptJson(html.text, "initial-state") ||
		extractInitialState(html.text);
	if (initial) pics.push(...walkImageUrls(initial));

	const og = metaContent(html.text, "og:image");
	if (og) pics.push(og);
	pics.push(
		...collectHttpUrls(html.text).filter((u) =>
			/xhscdn|xiaohongshu\.com\/.*\.(jpg|jpeg|png|webp)/i.test(u),
		),
	);

	const images = filenamesFor(
		"xiaohongshu",
		preferOriginal(pics).filter(
			(u) => !/avatar|fe-platform|sns-avatar|icon/i.test(u),
		),
	);

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
		warning: images.length === 1 ? "目前只拿到封面或首图。带 xsec_token 的完整链接往往能拿齐。" : undefined,
	};
}

function extractInitialState(html: string): unknown | null {
	const m = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*(?:;|<\/script>)/);
	if (!m?.[1]) return null;
	try {
		return JSON.parse(m[1].replace(/undefined/g, "null"));
	} catch {
		return null;
	}
}
