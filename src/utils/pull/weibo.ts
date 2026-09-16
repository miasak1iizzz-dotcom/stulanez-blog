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

type WeiboPicInfo = {
	largest?: { url?: string };
	large?: { url?: string };
	original?: { url?: string };
	mw2000?: { url?: string };
};

type WeiboShow = {
	ok?: number;
	data?: {
		text?: string;
		user?: { screen_name?: string };
		pic_ids?: string[];
		pics?: Array<{ pid?: string; large?: { url?: string }; url?: string }>;
		pic_infos?: Record<string, WeiboPicInfo>;
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

function sinaMediaKey(url: string): string {
	try {
		const path = new URL(url).pathname;
		const base = path.split("/").pop() || path;
		return base.replace(/\.(jpe?g|png|gif|webp)$/i, "").toLowerCase();
	} catch {
		return url;
	}
}

function pickInfoUrl(info: WeiboPicInfo): string | undefined {
	return (
		info.original?.url ||
		info.largest?.url ||
		info.large?.url ||
		info.mw2000?.url
	);
}

function collectWeiboPics(blog: NonNullable<WeiboShow["data"]>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (raw?: string) => {
		if (!raw) return;
		const url = upgradeSina(raw);
		if (/avatar|orj480|thumbnail|crop\.|\/50\//i.test(url)) return;
		const key = sinaMediaKey(url);
		if (!key || seen.has(key)) return;
		seen.add(key);
		out.push(url);
	};

	// Prefer pic_infos (has largest) ordered by pic_ids. Do NOT also merge pics —
	// same photo often appears again on another wx CDN host and inflates the count.
	if (blog.pic_infos && Object.keys(blog.pic_infos).length) {
		const order =
			Array.isArray(blog.pic_ids) && blog.pic_ids.length
				? blog.pic_ids
				: Object.keys(blog.pic_infos);
		for (const id of order) {
			const info = blog.pic_infos[id];
			if (info) push(pickInfoUrl(info));
		}
		return out;
	}

	if (blog.pics?.length) {
		for (const pic of blog.pics) {
			push(pic.large?.url || pic.url);
		}
	}
	return out;
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

	const blog = data?.data;
	let pics = blog ? collectWeiboPics(blog) : [];

	if (!pics.length) {
		const html = await fetchText(`https://m.weibo.cn/detail/${id}`, {
			mobile: true,
			headers: { Referer: "https://m.weibo.cn/" },
		});
		const render = html.text.match(/\$render_data\s*=\s*(\[[\s\S]*?\])\s*[;\n]/);
		if (render?.[1]) {
			try {
				const parsed: unknown = JSON.parse(render[1]);
				const walked = walkImageUrls(parsed)
					.filter((u) => /sinaimg\.cn/i.test(u))
					.map(upgradeSina);
				const seen = new Set<string>();
				for (const url of walked) {
					const key = sinaMediaKey(url);
					if (seen.has(key)) continue;
					seen.add(key);
					pics.push(url);
				}
			} catch {
				/* ignore */
			}
		}
		const og = metaContent(html.text, "og:image");
		if (og && /sinaimg\.cn/i.test(og)) {
			const url = upgradeSina(og);
			const key = sinaMediaKey(url);
			if (!pics.some((p) => sinaMediaKey(p) === key)) pics.push(url);
		}
		if (!pics.length && (status >= 400 || html.status >= 400)) {
			return { ok: false, error: "微博没有把图给我。可能要登录，或这条不是公开帖。" };
		}
	}

	const images = filenamesFor("weibo", uniqueUrls(pics));
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
