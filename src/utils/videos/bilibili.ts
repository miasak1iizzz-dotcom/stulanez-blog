import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { playApi, playerApi, viewApi } from "./bili-fetch";
import { formatClock } from "./clock";
import { readRemoteJson } from "./relay";
import type { VideoMeta } from "./types";

export { formatClock, parseClock } from "./clock";

const PLAYER_WBI = "https://api.bilibili.com/x/player/wbi/v2";
const CONCLUSION =
	"https://api.bilibili.com/x/web-interface/view/conclusion/get";
const NAV = "https://api.bilibili.com/x/web-interface/nav";
const harvestStore = new AsyncLocalStorage<Record<string, unknown>>();
const MIXIN = [
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
	26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
	20, 34, 44, 52,
];

export function peelBilibili(input: string): string {
	const raw = input.trim();
	const bv = /BV[0-9A-Za-z]+/.exec(raw);
	if (bv) return `https://www.bilibili.com/video/${bv[0]}/`;
	const av = /(?:av|AV)(\d+)/.exec(raw);
	if (av) return `https://www.bilibili.com/video/av${av[1]}/`;
	const http = /https?:\/\/[^\s]+/i.exec(raw);
	return http?.[0] || raw;
}

export function bvidOf(input: string): string | null {
	return /BV[0-9A-Za-z]+/.exec(input)?.[0] ?? null;
}

function headers(): Record<string, string> {
	const cookie = (process.env.BILIBILI_SESSDATA || "").trim();
	return {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
		Origin: "https://www.bilibili.com",
		Accept: "application/json,text/plain,*/*",
		...(cookie ? { Cookie: `SESSDATA=${cookie}` } : {}),
	};
}

export function withBiliHarvest<T>(
	bag: Record<string, unknown>,
	fn: () => Promise<T>,
): Promise<T> {
	return harvestStore.run(bag, fn);
}

async function readJson(url: string): Promise<unknown> {
	const hit = harvestStore.getStore()?.[url];
	if (hit) return hit;
	return readRemoteJson(url, headers());
}

export async function fetchVideoMeta(source: string): Promise<VideoMeta> {
	const url = peelBilibili(source);
	const bvid = bvidOf(url);
	if (!bvid) throw new Error("请贴一条带 BV 号的 B 站链接。");
	const payload = (await readJson(viewApi(bvid))) as {
		code?: number;
		message?: string;
		data?: {
			bvid?: string;
			title?: string;
			duration?: number;
			pic?: string;
			owner?: { name?: string };
		};
	};
	if (payload.code !== 0 || !payload.data) {
		throw new Error(payload.message || "B 站没把视频信息给我。");
	}
	const data = payload.data;
	const cover = data.pic
		? data.pic.replace(/^http:\/\//, "https://")
		: undefined;
	return {
		bvid: data.bvid || bvid,
		title: data.title || bvid,
		up: data.owner?.name || "",
		duration: Number(data.duration) || 0,
		cover,
		url: `https://www.bilibili.com/video/${data.bvid || bvid}/`,
	};
}

type SubtitleRow = {
	subtitle_url?: string;
	lan?: string;
	lan_doc?: string;
};

export async function fetchViewCore(bvid: string): Promise<{
	cid: number;
	aid: number;
	mid: number;
}> {
	const view = (await readJson(viewApi(bvid))) as {
		data?: {
			cid?: number;
			aid?: number;
			owner?: { mid?: number };
		};
	};
	return {
		cid: Number(view.data?.cid) || 0,
		aid: Number(view.data?.aid) || 0,
		mid: Number(view.data?.owner?.mid) || 0,
	};
}

function pickSubtitleUrl(list: SubtitleRow[]): string {
	const preferred =
		list.find((row) => /zh|中/.test(`${row.lan || ""}${row.lan_doc || ""}`)) ||
		list[0];
	const file = preferred?.subtitle_url || "";
	if (!file) return "";
	return file.startsWith("//") ? `https:${file}` : file;
}

async function subtitleListFromPlayer(url: string): Promise<SubtitleRow[]> {
	const player = (await readJson(url)) as {
		data?: { subtitle?: { subtitles?: SubtitleRow[] } };
	};
	return player.data?.subtitle?.subtitles || [];
}

export async function fetchSubtitles(bvid: string): Promise<string> {
	const { cid, aid } = await fetchViewCore(bvid);
	if (!cid) return "";
	let list = await subtitleListFromPlayer(playerApi(bvid, cid));
	if (!list.length && aid) {
		const query = await wbiQuery({
			aid: String(aid),
			cid: String(cid),
		});
		list = await subtitleListFromPlayer(`${PLAYER_WBI}?${query}`);
	}
	const subUrl = pickSubtitleUrl(list);
	if (!subUrl) return "";
	const body = (await readJson(subUrl)) as {
		body?: Array<{ content?: string; from?: number }>;
	};
	return (body.body || [])
		.map((row) => {
			const text = String(row.content || "").trim();
			if (!text) return "";
			return `${formatClock(Number(row.from) || 0)} ${text}`;
		})
		.filter(Boolean)
		.join("\n");
}

let mixinKey = "";

async function getMixinKey(): Promise<string> {
	if (mixinKey) return mixinKey;
	const nav = (await readJson(NAV)) as {
		data?: { wbi_img?: { img_url?: string; sub_url?: string } };
	};
	const img = (nav.data?.wbi_img?.img_url || "").split("/").pop() || "";
	const sub = (nav.data?.wbi_img?.sub_url || "").split("/").pop() || "";
	const raw = `${img.split(".")[0] || ""}${sub.split(".")[0] || ""}`;
	mixinKey = MIXIN.map((i) => raw[i] || "")
		.join("")
		.slice(0, 32);
	return mixinKey;
}

async function wbiQuery(params: Record<string, string>): Promise<string> {
	const mixin = await getMixinKey();
	const signed: Record<string, string> = {
		...params,
		wts: String(Math.floor(Date.now() / 1000)),
	};
	const query = Object.keys(signed)
		.sort()
		.map(
			(key) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(signed[key]).replace(/[!'()*]/g, "")}`,
		)
		.join("&");
	const wrid = createHash("md5").update(`${query}${mixin}`).digest("hex");
	return `${query}&w_rid=${wrid}`;
}

export async function fetchOfficialSummary(bvid: string): Promise<string> {
	const { cid, mid } = await fetchViewCore(bvid);
	if (!cid) return "";
	const query = await wbiQuery({
		bvid,
		cid: String(cid),
		up_mid: String(mid),
	});
	const payload = (await readJson(`${CONCLUSION}?${query}`)) as {
		code?: number;
		message?: string;
		data?: {
			code?: number;
			model_result?: {
				summary?: string;
				outline?: Array<{
					title?: string;
					timestamp?: number;
					part_outline?: Array<{ content?: string; timestamp?: number }>;
				}>;
			};
		};
	};
	const model = payload.data?.model_result;
	if (!model?.summary && !model?.outline?.length) return "";
	const lines = [model.summary || ""];
	for (const part of model.outline || []) {
		const clock = formatClock(Number(part.timestamp) || 0);
		lines.push(`${clock} ${part.title || ""}`.trim());
		for (const item of part.part_outline || []) {
			const text = String(item.content || "").trim();
			if (text) lines.push(`- ${text}`);
		}
	}
	return lines.filter(Boolean).join("\n");
}

export async function fetchHtml5PlayUrl(bvid: string): Promise<string> {
	const { cid } = await fetchViewCore(bvid);
	if (!cid) return "";
	const payload = (await readJson(playApi(bvid, cid))) as {
		data?: { durl?: Array<{ url?: string; backup_url?: string[] }> };
	};
	const first = payload.data?.durl?.[0];
	return first?.url || first?.backup_url?.[0] || "";
}
