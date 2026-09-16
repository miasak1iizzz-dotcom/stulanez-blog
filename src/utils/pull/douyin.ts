import { fetchJson, fetchText } from "./http";
import {
	collectHttpUrls,
	filenamesFor,
	metaContent,
	needUrl,
	scriptJson,
	uniqueUrls,
	walkImageUrls,
} from "./parse";
import { CRAWLER_UA, IPHONE_UA } from "./types";
import type { PullResult } from "./types";

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
	return /douyinpic\.com/i.test(url) && !/avatar|aweme-avatar|emoji|forum|pwa/i.test(url);
}

function isDouyinHome(url: string): boolean {
	try {
		const u = new URL(url);
		if (!/(^|\.)douyin\.com$/i.test(u.hostname)) return false;
		if (/^v\.|^jx\./i.test(u.hostname)) return false;
		return u.pathname === "/" || u.pathname === "/jingxuan" || u.pathname === "";
	} catch {
		return false;
	}
}

function uniqueNotePics(urls: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of urls) {
		const url = raw.replace(/&amp;/g, "&");
		if (!keepDouyinPic(url)) continue;
		const id = /\/(o[A-Za-z0-9_-]{8,})~/.exec(url)?.[1] || url.split("?")[0] || url;
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(url);
	}
	return out;
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
	const blocks = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
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
		html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*-\s*抖音$/, "").trim() ||
		metaContent(html, "og:title") ||
		"";
	const names = [...html.matchAll(/"name"\s*:\s*"([^"]{1,40})"/g)].map((m) => m[1] || "");
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
		if (!/v\.douyin\.com|jx\.douyin\.com|iesdouyin\.com\/share/i.test(current) && hop > 0) {
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

function collectFromHtml(html: string): string[] {
	const pics: string[] = [];
	pics.push(...picsFromLd(html));
	const render =
		scriptJson(html, "RENDER_DATA") ||
		scriptJson(html, "RENDER-DATA") ||
		extractJsonObject(html, "_ROUTER_DATA");
	if (render) pics.push(...walkImageUrls(render).filter(keepDouyinPic));
	pics.push(...collectHttpUrls(html).filter(keepDouyinPic));
	const og = metaContent(html, "og:image");
	if (og) pics.push(og);
	return pics;
}

async function readNotePage(id: string): Promise<{ pics: string[]; title: string; author?: string }> {
	const pages = [`https://www.douyin.com/note/${id}`, `https://www.douyin.com/video/${id}`];
	for (const pageUrl of pages) {
		const html = await fetchText(pageUrl, {
			headers: {
				"User-Agent": CRAWLER_UA,
				Accept: "text/html,*/*",
			},
		});
		const pics = uniqueNotePics(collectFromHtml(html.text));
		if (pics.length) {
			const meta = pickMeta(html.text);
			return { pics, title: meta.title, author: meta.author };
		}
	}
	return { pics: [], title: "" };
}

export async function extractDouyin(input: string): Promise<PullResult> {
	const sourceUrl = needUrl(input);
	const needsHop = /v\.douyin\.com|jx\.douyin\.com/i.test(sourceUrl) && !awemeId(sourceUrl);
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

		if (!pics.length) {
			const item = await fetchJson<{
				item_list?: Array<{
					desc?: string;
					author?: { nickname?: string };
					images?: Array<{ url_list?: string[] }>;
					image_post_info?: { images?: Array<{ display_image?: { url_list?: string[] } }> };
					video?: { cover?: { url_list?: string[] }; origin_cover?: { url_list?: string[] } };
				}>;
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
				if (aweme.images) {
					for (const img of aweme.images) {
						const last = img.url_list?.at(-1);
						if (last) pics.push(last);
					}
				}
				const postImgs = aweme.image_post_info?.images;
				if (postImgs) {
					for (const img of postImgs) {
						const last = img.display_image?.url_list?.at(-1);
						if (last) pics.push(last);
					}
				}
				if (!pics.length) {
					const cover =
						aweme.video?.origin_cover?.url_list?.at(-1) || aweme.video?.cover?.url_list?.at(-1);
					if (cover) {
						pics.push(cover);
						warning = "这是视频帖，先给你封面。图文笔记才能抽一组图。";
					}
				}
			}
		}

		if (!pics.length) {
			for (const pageUrl of [
				`https://www.iesdouyin.com/share/note/${id}/`,
				`https://www.iesdouyin.com/share/video/${id}/`,
				working,
			]) {
				const html = await fetchText(pageUrl, {
					mobile: true,
					headers: { Referer: "https://www.iesdouyin.com/" },
				});
				pics.push(...collectFromHtml(html.text));
				if (!title) {
					const meta = pickMeta(html.text);
					title = meta.title;
					author = author || meta.author;
				}
				if (uniqueNotePics(pics).length) break;
			}
		}
	}

	const images = filenamesFor("douyin", uniqueUrls(uniqueNotePics(pics)));
	if (!images.length) {
		if (!id) {
			return {
				ok: false,
				error: "这不像抖音帖。请贴 App「复制链接」的整段口令，或网页地址栏里的链接。",
			};
		}
		return {
			ok: false,
			error: "抖音网页没有把图给我。把 App 分享口令整段贴过来再试一次。",
		};
	}

	if (!warning && images.length === 1) {
		warning = "这是视频帖的话，目前只能先给你封面。";
	}

	return {
		ok: true,
		channel: "douyin",
		sourceUrl: id ? `https://www.douyin.com/note/${id}` : working || sourceUrl,
		title: (title || `抖音 ${id || ""}`).replace(/\s*-\s*抖音$/, "").slice(0, 80),
		author,
		images,
		warning,
	};
}
