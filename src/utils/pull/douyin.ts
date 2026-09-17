import { fetchJson, fetchText } from "./http";
import {
	collectHttpUrls,
	filenamesFor,
	metaContent,
	needUrl,
	normalizeImageUrl,
	scriptJson,
	uniqueUrls,
	walkImageUrls,
} from "./parse";
import type { PullResult } from "./types";
import { CRAWLER_UA, IPHONE_UA } from "./types";

function awemeId(url: string): string | null {
	const m =
		/(?:douyin|iesdouyin)\.com\/(?:note|video|share\/video|share\/note|share\/slides|reflow)\/(\d{10,})/i.exec(
			url,
		) ||
		/[?&](?:modal_id|aweme_id|item_ids)=(\d{10,})/i.exec(url) ||
		/\/(\d{19,})(?:\/|\?|$)/.exec(url);
	return m?.[1] ?? null;
}

function keepDouyinPic(url: string): boolean {
	if (!/douyinpic\.com/i.test(url)) return false;
	if (/avatar|aweme-avatar|emoji|forum|pwa/i.test(url)) return false;
	// Comment / related-card thumbs leak in via page HTML (biz_tag=aweme_comment).
	if (/biz_tag=aweme_comment/i.test(url)) return false;
	if (/[?&]sc=thumb(?:&|$)/i.test(url)) return false;
	if (/tplv-p14lwwcsbr/i.test(url)) return false;
	return true;
}

function picObjectId(url: string): string {
	return /\/(o[A-Za-z0-9_-]{8,})~/.exec(url)?.[1] || url.split("?")[0] || url;
}

/** Higher = cleaner. Display/SEO templates bake in the 抖音号 overlay. */
function picScore(url: string): number {
	const u = url.toLowerCase();
	let score = 0;
	if (/tplv-dy-water(?:mark)?|-water-v/.test(u)) score -= 100;
	if (/owner_watermark|user_watermark/.test(u)) score -= 90;
	if (/watermark/.test(u) && !/without_watermark|no[-_]?watermark/.test(u))
		score -= 50;
	if (/tplv-dy-aweme-images/.test(u)) score -= 25;
	if (/origin|original|noop|tplv-obj/.test(u)) score += 60;
	if (/\.jpe?g(?:$|\?)/.test(u)) score += 10;
	if (/\.webp(?:$|\?)/.test(u)) score -= 4;
	if (/q75/.test(u)) score -= 6;
	score += Math.min(url.length, 600) / 300;
	return score;
}

const SKIP_DOUYIN_PIC_KEY =
	/avatar|icon|logo|emoji|sticker|badge|watermark_dot|owner_watermark|user_watermark|comment|related|recommend|aweme_list|hot_list/i;

function walkDouyinPics(
	value: unknown,
	acc: string[] = [],
	depth = 0,
): string[] {
	if (depth > 12 || value == null) return acc;
	if (typeof value === "string") {
		const url = normalizeImageUrl(value);
		if (url && keepDouyinPic(url)) acc.push(url);
		return acc;
	}
	if (Array.isArray(value)) {
		if (value.every((item) => typeof item === "string")) {
			for (const item of value) walkDouyinPics(item, acc, depth + 1);
			return acc;
		}
		for (const item of value) walkDouyinPics(item, acc, depth + 1);
		return acc;
	}
	if (typeof value === "object") {
		const rec = value as Record<string, unknown>;
		const origin = rec.origin_image ?? rec.origin_url;
		if (origin) walkDouyinPics(origin, acc, depth + 1);
		for (const [key, child] of Object.entries(rec)) {
			if (SKIP_DOUYIN_PIC_KEY.test(key)) continue;
			if (key === "origin_image" || key === "origin_url") continue;
			walkDouyinPics(child, acc, depth + 1);
		}
	}
	return acc;
}

function isDouyinHome(url: string): boolean {
	try {
		const u = new URL(url);
		if (!/(^|\.)douyin\.com$/i.test(u.hostname)) return false;
		if (/^v\.|^jx\./i.test(u.hostname)) return false;
		return (
			u.pathname === "/" || u.pathname === "/jingxuan" || u.pathname === ""
		);
	} catch {
		return false;
	}
}

function uniqueNotePics(urls: string[]): string[] {
	const best = new Map<string, { url: string; score: number; order: number }>();
	let order = 0;
	for (const raw of urls) {
		const url = raw.replace(/&amp;/g, "&");
		if (!keepDouyinPic(url)) continue;
		const id = picObjectId(url);
		const score = picScore(url);
		const prev = best.get(id);
		if (!prev) {
			best.set(id, { url, score, order });
			order++;
			continue;
		}
		if (score > prev.score) best.set(id, { url, score, order: prev.order });
	}
	return [...best.values()]
		.sort((a, b) => a.order - b.order)
		.map((row) => row.url);
}

function extractJsonObject(html: string, marker: string): unknown | null {
	const start = html.search(new RegExp(`${marker}\\s*=\\s*\\{`));
	if (start < 0) return null;
	const brace = html.indexOf("{", start);
	let depth = 0;
	let inStr = false;
	let esc = false;
	for (let i = brace; i < html.length; i++) {
		const c = html[i];
		if (inStr) {
			if (esc) {
				esc = false;
				continue;
			}
			if (c === "\\") {
				esc = true;
				continue;
			}
			if (c === '"') inStr = false;
			continue;
		}
		if (c === '"') {
			inStr = true;
			continue;
		}
		if (c === "{") depth++;
		else if (c === "}") {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(html.slice(brace, i + 1).replace(/\\u002F/g, "/"));
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

function picsFromLd(html: string): string[] {
	const pics: string[] = [];
	const blocks = html.matchAll(
		/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
	);
	for (const block of blocks) {
		if (!block[1]) continue;
		try {
			const data: unknown = JSON.parse(block[1]);
			walkImageUrls(data, pics);
		} catch {
			/* ignore */
		}
	}
	return pics;
}

function pickMeta(html: string): { title: string; author?: string } {
	const title =
		html
			.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
			?.replace(/\s*-\s*抖音$/, "")
			.trim() ||
		metaContent(html, "og:title") ||
		"";
	const names = [...html.matchAll(/"name"\s*:\s*"([^"]{1,40})"/g)].map(
		(m) => m[1] || "",
	);
	const author =
		names.find((name) => name && name !== "抖音" && name !== "Douyin") ||
		html.match(/"nickname"\s*:\s*"([^"]{1,40})"/)?.[1];
	return { title, author };
}

const SHORT_LINK_ERROR =
	"这条抖音短链在网页里被送回首页了，抽不到。请把 App「复制链接」的整段口令贴过来，或换一条有效短链。";

async function resolveShare(
	input: string,
): Promise<{ url: string; id: string | null; dumpedHome: boolean }> {
	let current = input;
	let dumpedHome = false;
	for (let hop = 0; hop < 5; hop++) {
		const id = awemeId(current);
		if (id) return { url: current, id, dumpedHome };
		if (
			!/v\.douyin\.com|jx\.douyin\.com|iesdouyin\.com\/share/i.test(current) &&
			hop > 0
		) {
			break;
		}

		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), 8000);
		try {
			const res = await fetch(current, {
				redirect: "manual",
				signal: ctrl.signal,
				headers: {
					"User-Agent": IPHONE_UA,
					Accept: "text/html,*/*",
					"Accept-Language": "zh-CN,zh;q=0.9",
				},
			});
			const loc = res.headers.get("location");
			if (!loc) break;
			current = new URL(loc, current).href;
			if (isDouyinHome(current)) {
				dumpedHome = true;
				break;
			}
		} catch {
			dumpedHome = true;
			break;
		} finally {
			clearTimeout(timer);
		}
	}
	return { url: current, id: awemeId(current), dumpedHome };
}

function awemeIdOf(value: Record<string, unknown>): string | null {
	const raw = value.aweme_id ?? value.awemeId ?? value.itemId ?? value.item_id;
	return typeof raw === "string" || typeof raw === "number" ? String(raw) : null;
}

function findAweme(
	value: unknown,
	id: string,
	depth = 0,
): AwemeDetail | null {
	if (depth > 14 || value == null) return null;
	if (Array.isArray(value)) {
		for (const item of value) {
			const hit = findAweme(item, id, depth + 1);
			if (hit) return hit;
		}
		return null;
	}
	if (typeof value === "object") {
		const rec = value as Record<string, unknown>;
		if (awemeIdOf(rec) === id && (rec.images || rec.image_post_info)) {
			return rec as AwemeDetail;
		}
		for (const child of Object.values(rec)) {
			const hit = findAweme(child, id, depth + 1);
			if (hit) return hit;
		}
	}
	return null;
}

function collectFromHtml(html: string, id?: string | null): string[] {
	const pics: string[] = [];
	const render =
		scriptJson(html, "RENDER_DATA") ||
		scriptJson(html, "RENDER-DATA") ||
		extractJsonObject(html, "_ROUTER_DATA");
	if (id && render) {
		const aweme = findAweme(render, id);
		if (aweme) pics.push(...picsFromAwemeDetail(aweme));
	}
	if (!pics.length && render) pics.push(...walkDouyinPics(render));
	if (!pics.length) {
		pics.push(...picsFromLd(html));
		pics.push(...collectHttpUrls(html).filter(keepDouyinPic));
		const og = metaContent(html, "og:image");
		if (og) pics.push(og);
	}
	return pics;
}

const BINGBOT_UA =
	"Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readOneNotePage(
	pageUrl: string,
	id?: string | null,
): Promise<{ pics: string[]; title: string; author?: string } | null> {
	try {
		const html = await fetchText(pageUrl, {
			timeoutMs: 12000,
			headers: {
				"User-Agent": CRAWLER_UA,
				Accept: "text/html,*/*",
				Referer: "https://www.douyin.com/",
			},
		});
		const pics = uniqueNotePics(
			collectFromHtml(html.text, id || awemeId(pageUrl)),
		);
		const rich =
			/RENDER_DATA|RENDER-DATA|_ROUTER_DATA/i.test(html.text) ||
			pics.length > 1;
		if (!(pics.length && rich)) return null;
		const meta = pickMeta(html.text);
		return { pics, title: meta.title, author: meta.author };
	} catch {
		return null;
	}
}

async function readNotePage(
	id: string,
): Promise<{ pics: string[]; title: string; author?: string }> {
	const pages = [
		`https://www.douyin.com/note/${id}`,
		`https://www.iesdouyin.com/share/slides/${id}`,
		`https://www.iesdouyin.com/share/note/${id}/`,
		`https://www.douyin.com/video/${id}`,
	];
	// Douyin SSR from overseas IPs flaps; retry the note URL before falling through.
	for (let attempt = 0; attempt < 3; attempt++) {
		const hit = await readOneNotePage(pages[0]!, id);
		if (hit && hit.pics.length > 1) return hit;
		if (attempt < 2) await sleep(400 * (attempt + 1));
	}
	for (const pageUrl of pages.slice(1)) {
		const hit = await readOneNotePage(pageUrl, id);
		if (hit && hit.pics.length > 1) return hit;
	}
	return { pics: [], title: "" };
}

type AwemeImage = {
	url_list?: string[];
	download_url_list?: string[];
	origin_url?: { url_list?: string[] };
};

type AwemePostImage = {
	display_image?: { url_list?: string[] };
	origin_image?: { url_list?: string[] };
	thumbnail?: { url_list?: string[] };
};

type AwemeDetail = {
	desc?: string;
	author?: { nickname?: string };
	images?: AwemeImage[];
	image_post_info?: {
		images?: AwemePostImage[];
	};
	video?: {
		cover?: { url_list?: string[] };
		origin_cover?: { url_list?: string[] };
	};
};

function pickBestPic(list?: string[]): string | undefined {
	if (!list?.length) return;
	return uniqueNotePics(list)[0] ?? list.at(-1);
}

function picsFromAwemeDetail(detail: AwemeDetail): string[] {
	const pics: string[] = [];
	if (detail.images?.length) {
		for (const img of detail.images) {
			const chosen =
				pickBestPic(img.origin_url?.url_list) ||
				pickBestPic(img.url_list) ||
				pickBestPic(img.download_url_list);
			if (chosen) pics.push(chosen);
		}
	}
	const postImgs = detail.image_post_info?.images;
	if (postImgs) {
		for (const img of postImgs) {
			const chosen =
				pickBestPic(img.origin_image?.url_list) ||
				pickBestPic(img.display_image?.url_list);
			if (chosen) pics.push(chosen);
		}
	}
	return uniqueNotePics(pics);
}

async function fetchAwemeDetail(
	id: string,
	attempts = 3,
): Promise<AwemeDetail | null> {
	const detailUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${encodeURIComponent(id)}&aid=6383&device_platform=webapp`;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const got = await fetchText(detailUrl, {
			timeoutMs: 10000,
			headers: {
				"User-Agent": BINGBOT_UA,
				Referer: "https://www.douyin.com/",
				Accept: "application/json,text/plain,*/*",
			},
		});
		try {
			const payload = JSON.parse(got.text) as {
				aweme_detail?: AwemeDetail;
				status_code?: number;
			};
			if (payload.aweme_detail) return payload.aweme_detail;
		} catch {
			/* retry */
		}
	}
	return null;
}

export async function extractDouyin(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	const needsHop =
		/v\.douyin\.com|jx\.douyin\.com/i.test(sourceUrl) && !awemeId(sourceUrl);
	const resolved = needsHop
		? await resolveShare(sourceUrl)
		: { url: sourceUrl, id: awemeId(sourceUrl), dumpedHome: false };

	if (!resolved.id && resolved.dumpedHome) {
		return { ok: false, error: SHORT_LINK_ERROR };
	}

	const working = resolved.url;
	const id = resolved.id || awemeId(sourceUrl);
	let pics: string[] = [];
	let title = "";
	let author: string | undefined;
	let warning: string | undefined;

	if (id) {
		const page = await readNotePage(id);
		pics = page.pics;
		title = page.title;
		author = page.author;

		const detail = await fetchAwemeDetail(id, pics.length > 1 ? 1 : 3);
		if (detail) {
			title = title || detail.desc || "";
			author = author || detail.author?.nickname;
			const fromDetail = picsFromAwemeDetail(detail);
			if (fromDetail.length >= 2) {
				// API album is the post itself; HTML also has comment thumbs.
				pics = fromDetail;
				warning = undefined;
			} else if (fromDetail.length) {
				pics = uniqueNotePics([...fromDetail, ...pics]);
				warning = undefined;
			} else if (!pics.length) {
				const cover =
					detail.video?.origin_cover?.url_list?.at(-1) ||
					detail.video?.cover?.url_list?.at(-1);
				if (cover) {
					pics.push(cover);
					warning = "这是视频帖，先给你封面。图文笔记才能抽一组图。";
				}
			}
		}

		if (pics.length <= 1) {
			const item = await fetchJson<{
				item_list?: AwemeDetail[];
			}>(
				`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?reflow_source=reflow_page&item_ids=${encodeURIComponent(id)}`,
				{
					mobile: true,
					headers: {
						Referer: `https://www.iesdouyin.com/share/note/${id}/`,
					},
				},
			);
			const aweme = item.data?.item_list?.[0];
			if (aweme) {
				title = title || aweme.desc || "";
				author = author || aweme.author?.nickname;
				const fromItem = picsFromAwemeDetail(aweme);
				if (fromItem.length > pics.length) {
					pics = fromItem;
					warning = undefined;
				} else if (!pics.length && fromItem.length) {
					pics = fromItem;
				} else if (!pics.length) {
					const cover =
						aweme.video?.origin_cover?.url_list?.at(-1) ||
						aweme.video?.cover?.url_list?.at(-1);
					if (cover) {
						pics.push(cover);
						warning = "这是视频帖，先给你封面。图文笔记才能抽一组图。";
					}
				}
			}
		}

		if (pics.length <= 1) {
			for (const pageUrl of [
				`https://www.iesdouyin.com/share/slides/${id}`,
				`https://www.iesdouyin.com/share/note/${id}/`,
				`https://www.iesdouyin.com/share/video/${id}/`,
				working,
			]) {
				try {
					const html = await fetchText(pageUrl, {
						timeoutMs: 12000,
						headers: {
							"User-Agent": CRAWLER_UA,
							Accept: "text/html,*/*",
							Referer: "https://www.douyin.com/",
						},
					});
					const more = uniqueNotePics(collectFromHtml(html.text, id));
					if (more.length > pics.length) {
						pics = more;
						warning = undefined;
					}
					if (!title) {
						const meta = pickMeta(html.text);
						title = meta.title;
						author = author || meta.author;
					}
					if (pics.length > 1) break;
				} catch {
					/* next page */
				}
			}
		}
	}

	const images = filenamesFor("douyin", uniqueUrls(uniqueNotePics(pics)));
	if (!images.length) {
		if (!id) {
			return {
				ok: false,
				error:
					"这不像抖音帖。请贴 App「复制链接」的整段口令，或网页地址栏里的链接。",
			};
		}
		return {
			ok: false,
			error: "抖音这边没有把图给我。国外节点有时会抽空，再点一次提取通常就行。",
		};
	}

	if (!warning && images.length === 1) {
		warning = "只抽到 1 张，可能不是图文帖，或这条暂时抽不全。";
	}

	return {
		ok: true,
		channel: "douyin",
		sourceUrl: id ? `https://www.douyin.com/note/${id}` : working || sourceUrl,
		title: (title || `抖音 ${id || ""}`)
			.replace(/\s*-\s*抖音$/, "")
			.slice(0, 80),
		author,
		images,
		warning,
	};
}
