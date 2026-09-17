import type { VideoMeta } from "./types";

const VIEW = "https://api.bilibili.com/x/web-interface/view";
const PLAYER = "https://api.bilibili.com/x/player/v2";

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

function headers(): HeadersInit {
	const cookie = (process.env.BILIBILI_SESSDATA || "").trim();
	return {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
		Referer: "https://www.bilibili.com/",
		Accept: "application/json,text/plain,*/*",
		...(cookie ? { Cookie: `SESSDATA=${cookie}` } : {}),
	};
}

async function readJson(url: string): Promise<unknown> {
	const res = await fetch(url, { headers: headers() });
	if (!res.ok) throw new Error(`B 站接口 ${res.status}`);
	return res.json();
}

export async function fetchVideoMeta(source: string): Promise<VideoMeta> {
	const url = peelBilibili(source);
	const bvid = bvidOf(url);
	if (!bvid) throw new Error("请贴一条带 BV 号的 B 站链接。");
	const payload = (await readJson(
		`${VIEW}?bvid=${encodeURIComponent(bvid)}`,
	)) as {
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
	return {
		bvid: data.bvid || bvid,
		title: data.title || bvid,
		up: data.owner?.name || "",
		duration: Number(data.duration) || 0,
		cover: data.pic,
		url: `https://www.bilibili.com/video/${data.bvid || bvid}/`,
	};
}

export async function fetchSubtitles(bvid: string): Promise<string> {
	const view = (await readJson(`${VIEW}?bvid=${encodeURIComponent(bvid)}`)) as {
		data?: { cid?: number };
	};
	const cid = view.data?.cid;
	if (!cid) return "";
	const player = (await readJson(
		`${PLAYER}?bvid=${encodeURIComponent(bvid)}&cid=${cid}`,
	)) as {
		data?: {
			subtitle?: { subtitles?: Array<{ subtitle_url?: string }> };
		};
	};
	const list = player.data?.subtitle?.subtitles || [];
	const file = list[0]?.subtitle_url;
	if (!file) return "";
	const subUrl = file.startsWith("//") ? `https:${file}` : file;
	const body = (await readJson(subUrl)) as {
		body?: Array<{ content?: string; from?: number }>;
	};
	return (body.body || [])
		.map((row) => String(row.content || "").trim())
		.filter(Boolean)
		.join("\n");
}

export function formatClock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
