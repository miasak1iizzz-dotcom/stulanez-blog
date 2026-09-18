import { youtubeId } from "./clip";
import { formatClock } from "./clock";
import type { VideoMeta } from "./types";

const JINA = "https://r.jina.ai/";
const LANGS = ["zh-Hans", "zh-CN", "zh", "zh-Hant", "en", "en-US", "en-GB"];

async function readText(url: string): Promise<string> {
	const direct = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
			Accept: "*/*",
		},
	});
	if (direct.ok) return direct.text();
	const relay = await fetch(`${JINA}${url}`, {
		headers: { Accept: "text/plain" },
	});
	if (!relay.ok) throw new Error(`YouTube 接口 ${direct.status}`);
	return relay.text();
}

function parseJson3(raw: string): string {
	const payload = JSON.parse(raw) as {
		events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
	};
	return (payload.events || [])
		.map((event) => {
			const text = (event.segs || [])
				.map((seg) => seg.utf8 || "")
				.join("")
				.replace(/\n/g, " ")
				.trim();
			if (!text) return "";
			return `${formatClock((Number(event.tStartMs) || 0) / 1000)} ${text}`;
		})
		.filter(Boolean)
		.join("\n");
}

function parseSrvXml(raw: string): string {
	const rows = [
		...raw.matchAll(/<text[^>]*start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g),
	];
	return rows
		.map((row) => {
			const text = row[2]
				.replace(/<!\[CDATA\[|\]\]>/g, "")
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&#39;/g, "'")
				.replace(/&quot;/g, '"')
				.replace(/\s+/g, " ")
				.trim();
			if (!text) return "";
			return `${formatClock(Number(row[1]) || 0)} ${text}`;
		})
		.filter(Boolean)
		.join("\n");
}

function parseTimedtext(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed || trimmed.startsWith("<html")) return "";
	if (trimmed.startsWith("{")) {
		try {
			return parseJson3(trimmed);
		} catch {
			return "";
		}
	}
	if (trimmed.includes("<text")) return parseSrvXml(trimmed);
	return "";
}

async function tracksFromWatch(id: string): Promise<string[]> {
	const html = await readText(`https://www.youtube.com/watch?v=${id}`);
	const blob = /"captionTracks":(\[.*?\])/.exec(html)?.[1];
	if (!blob) return [];
	try {
		const tracks = JSON.parse(blob.replace(/\\u0026/g, "&")) as Array<{
			baseUrl?: string;
			languageCode?: string;
		}>;
		return tracks
			.sort((a, b) => {
				const score = (code: string) =>
					code.startsWith("zh") ? 0 : code.startsWith("en") ? 1 : 2;
				return score(a.languageCode || "zz") - score(b.languageCode || "zz");
			})
			.map((track) => track.baseUrl || "")
			.filter(Boolean);
	} catch {
		return [];
	}
}

export async function fetchYoutubeMeta(source: string): Promise<VideoMeta> {
	const id = youtubeId(source);
	if (!id) throw new Error("请贴一条 B 站或 YouTube 链接。");
	const watch = `https://www.youtube.com/watch?v=${id}`;
	let title = id;
	let up = "";
	let cover = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
	let duration = 0;
	try {
		const oembed = (await (
			await fetch(
				`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
			)
		).json()) as {
			title?: string;
			author_name?: string;
			thumbnail_url?: string;
		};
		title = oembed.title || title;
		up = oembed.author_name || "";
		cover = oembed.thumbnail_url || cover;
	} catch {
		/* oembed optional */
	}
	try {
		const html = await readText(watch);
		const seconds = /"lengthSeconds":"(\d+)"/.exec(html)?.[1];
		if (seconds) duration = Number(seconds) || 0;
		const htmlTitle = /<title>([^<]+)<\/title>/.exec(html)?.[1];
		if (htmlTitle && title === id) {
			title = htmlTitle.replace(/\s*-\s*YouTube\s*$/, "").trim() || title;
		}
	} catch {
		/* duration optional */
	}
	return {
		bvid: `yt_${id}`,
		platform: "youtube",
		youtube: id,
		title,
		up,
		duration,
		cover,
		url: watch,
	};
}

export async function fetchYoutubeTranscript(id: string): Promise<string> {
	for (const lang of LANGS) {
		for (const extra of ["", "&kind=asr"]) {
			const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(id)}&lang=${lang}&fmt=json3${extra}`;
			try {
				const text = parseTimedtext(await readText(url));
				if (text.trim()) return text;
			} catch {
				/* try next */
			}
		}
	}
	for (const base of await tracksFromWatch(id)) {
		const joined = base.includes("fmt=") ? base : `${base}&fmt=json3`;
		try {
			const text = parseTimedtext(await readText(joined));
			if (text.trim()) return text;
		} catch {
			/* try next */
		}
	}
	return "";
}
