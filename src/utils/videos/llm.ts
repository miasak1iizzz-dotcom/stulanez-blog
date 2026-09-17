import { readFileSync } from "node:fs";
import { bvidOf, fetchSubtitles, peelBilibili } from "./bilibili";
import type { VideoChapter, VideoDigestResult, VideoMeta } from "./types";

function zhipuKey(): string {
	const env = (
		process.env.ZHIPU_API_KEY ||
		process.env.VIDEO_SUM_LLM_API_KEY ||
		""
	).trim();
	if (env) return env;
	try {
		return readFileSync("E:/AI/Harvest/zhipu.key", "utf8").trim();
	} catch {
		return "";
	}
}

export async function summarizeTranscript(
	meta: VideoMeta,
	transcript: string,
): Promise<VideoDigestResult> {
	const key = zhipuKey();
	if (!key) {
		throw new Error(
			"总结模型的密钥没配。本地看 E:\\AI\\Harvest\\zhipu.key，线上配 ZHIPU_API_KEY。",
		);
	}
	const base = (
		process.env.VIDEO_SUM_LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4"
	).replace(/\/$/, "");
	const model = process.env.VIDEO_SUM_LLM_MODEL || "glm-4-flash";
	const res = await fetch(`${base}/chat/completions`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${key}`,
		},
		body: JSON.stringify({
			model,
			temperature: 0.3,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						'你是视频笔记助手。只根据字幕写中文总结。输出 JSON：{"tldr":"一句话","points":["要点"],"chapters":[{"time":"mm:ss","title":"小节","summary":"这段在讲什么"}]}。不要编造字幕里没有的内容。',
				},
				{
					role: "user",
					content: `标题：${meta.title}\nUP：${meta.up}\nBV：${meta.bvid}\n字幕：\n${transcript.slice(0, 12000)}`,
				},
			],
		}),
	});
	if (!res.ok) {
		throw new Error(`总结模型返回 ${res.status}。`);
	}
	const payload = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	const raw = payload.choices?.[0]?.message?.content || "{}";
	let parsed: {
		tldr?: string;
		points?: string[];
		chapters?: Array<{ time?: string; title?: string; summary?: string }>;
	} = {};
	try {
		parsed = JSON.parse(raw) as typeof parsed;
	} catch {
		parsed = { tldr: raw.slice(0, 200), points: [], chapters: [] };
	}
	const chapters: VideoChapter[] = (parsed.chapters || []).map((row) => ({
		time: row.time || "00:00",
		title: row.title || "",
		summary: row.summary || "",
	}));
	const points = (parsed.points || [])
		.map((row) => String(row))
		.filter(Boolean);
	const tldr = parsed.tldr || meta.title;
	const markdown = [
		`# ${meta.title}`,
		"",
		tldr,
		"",
		...points.map((p) => `- ${p}`),
		"",
		...chapters.map((c) => `## ${c.time} ${c.title}\n\n${c.summary}`),
		"",
		meta.url,
	].join("\n");
	return { meta, tldr, points, chapters, markdown };
}

export async function summarizeFromSubtitles(
	source: string,
	meta: VideoMeta,
): Promise<VideoDigestResult | null> {
	const bvid = bvidOf(peelBilibili(source));
	if (!bvid) return null;
	const transcript = await fetchSubtitles(bvid);
	if (!transcript.trim()) return null;
	return summarizeTranscript(meta, transcript);
}
