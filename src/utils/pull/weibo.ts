import { fetchJson, fetchText } from "./http";
import { filenamesFor, metaContent, needUrl, uniqueUrls, walkImageUrls } from "./parse";
import type { PullResult } from "./types";

function weiboId(url: string): string | null {
	const u = url.replace(/[?#].*$/, "");
	const reserved = new Set(["status", "detail", "u", "n", "p", "ajax", "ttarticle", "l"]);
	const patterns = [
		/weibo\.com\/(?:detail|status)\/(\w+)/i,
		/weibo\.com\/\d+\/(?:status\/)?(\w+)/i,
		/weibo\.com\/ttarticle\/p\/show\?id=(\w+)/i,
		/m\.weibo\.cn\/(?:detail|status)\/(\w+)/i,
		/m\.weibo\.cn\/\d+\/(\w+)/i,
		/weibo\.cn\/(?:detail|status)\/(\w+)/i,
		/weibo\.com\/ajax\/statuses\/show\?id=(\w+)/i,
	];
	for (const re of patterns) {
		const m = re.exec(u) || re.exec(url);
		if (m?.[1] && !reserved.has(m[1].toLowerCase())) return m[1];
	}
	return null;
}

type WeiboShow = {
	ok?: number;
	data?: {
		text?: string;
		user?: { screen_name?: string };
		pics?: Array<{ large?: { url?: string }; url?: string }>;
		pic_infos?: Record<string, { largest?: { url?: string }; large?: { url?: string } }>;
		page_info?: { pics?: { large?: { url?: string } } };
	};
	msg?: string;
};

function upgradeSina(url: string): string {
	return url
		.replace(/\/orj\d+\//, "/large/")
		.replace(/\/mw\d+\//, "/large/")
		.replace(/\/thumb\d+\//, "/large/")
		.replace(/\/bmiddle\//, "/large/")
		.replace(/\/small\//, "/large/");
}

export async function extractWeibo(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	let working = sourceUrl;
	if (/t\.cn\/|sinaurl|weibo\.cn\/sinaurl/i.test(working)) {
		const bounced = await fetchText(working, {
			mobile: true,
			headers: { Referer: "https://m.weibo.cn/" },
		});
		working = bounced.url || working;
	}
	const id = weiboId(working);
	if (!id) {
		return { ok: false, error: "这不像微博帖。请贴微博分享口令、t.cn 短链，或正文页链接。" };
	}

	const api = `https://m.weibo.cn/statuses/show?id=${encodeURIComponent(id)}`;
	const { data, status } = await fetchJson<WeiboShow>(api, {
		mobile: true,
		headers: {
			Referer: "https://m.weibo.cn/",
			"X-Requested-With": "XMLHttpRequest",
		},
	});

	if (data && data.ok === 0) {
		return {
			ok: false,
			error: data.msg || "这条微博抽不到。可能删了，或要登录。",
		};
	}

	const pics: string[] = [];
	const blog = data?.data;
	if (blog?.pics) {
		for (const pic of blog.pics) {
			if (pic.large?.url) pics.push(pic.large.url);
			else if (pic.url) pics.push(pic.url);
		}
	}
	if (blog?.pic_infos) {
		for (const info of Object.values(blog.pic_infos)) {
			const u = info.largest?.url || info.large?.url;
			if (u) pics.push(u);
		}
	}

	if (!pics.length) {
		const html = await fetchText(`https://m.weibo.cn/detail/${id}`, {
			mobile: true,
			headers: { Referer: "https://m.weibo.cn/" },
		});
		const render = html.text.match(/\$render_data\s*=\s*(\[[\s\S]*?\])\s*[;\n]/);
		if (render?.[1]) {
			try {
				const parsed: unknown = JSON.parse(render[1]);
				pics.push(...walkImageUrls(parsed));
			} catch {
				/* ignore */
			}
		}
		const og = metaContent(html.text, "og:image");
		if (og) pics.push(og);
		if (!pics.length && (status >= 400 || html.status >= 400)) {
			return { ok: false, error: "微博没有把图给我。可能要登录，或这条不是公开帖。" };
		}
	}

	const images = filenamesFor("weibo", uniqueUrls(pics.map(upgradeSina)));
	if (!images.length) {
		return { ok: false, error: "这条微博里没有抽出图片。" };
	}

	const title =
		(blog?.text || "").replace(/<[^>]+>/g, "").trim() ||
		`微博 ${id}`;
	return {
		ok: true,
		channel: "weibo",
		sourceUrl: working,
		title: title.slice(0, 80),
		author: blog?.user?.screen_name,
		images,
	};
}
