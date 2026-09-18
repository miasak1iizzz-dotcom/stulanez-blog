import { readFileSync } from "node:fs";
import { transcribeBilibili } from "./asr";
import {
	bvidOf,
	fetchOfficialSummary,
	fetchSubtitles,
	formatClock,
	peelBilibili,
} from "./bilibili";
import { asCards, asPoints, ensureChapters } from "./cover";
import type {
	VideoCard,
	VideoChapter,
	VideoDigestResult,
	VideoMeta,
} from "./types";

interface LlmTarget {
	key: string;
	base: string;
	model: string;
}

function readKeyFile(path: string): string {
	try {
		return readFileSync(path, "utf8").trim().split(/\r?\n/)[0] || "";
	} catch {
		return "";
	}
}

function llmTarget(): LlmTarget {
	const deepseek = (
		process.env.DEEPSEEK_API_KEY || readKeyFile("E:/AI/Harvest/deepseek.key")
	).trim();
	if (deepseek) {
		return {
			key: deepseek,
			base: (
				process.env.VIDEO_SUM_LLM_BASE_URL || "https://api.deepseek.com"
			).replace(/\/$/, ""),
			model: process.env.VIDEO_SUM_LLM_MODEL || "deepseek-chat",
		};
	}
	const zhipu = (
		process.env.ZHIPU_API_KEY ||
		process.env.VIDEO_SUM_LLM_API_KEY ||
		readKeyFile("E:/AI/Harvest/zhipu.key")
	).trim();
	if (zhipu) {
		return {
			key: zhipu,
			base: (
				process.env.VIDEO_SUM_LLM_BASE_URL ||
				"https://open.bigmodel.cn/api/paas/v4"
			).replace(/\/$/, ""),
			model: process.env.VIDEO_SUM_LLM_MODEL || "glm-4-flash",
		};
	}
	throw new Error(
		"总结模型的密钥没配。本地放 Harvest 的 deepseek.key，线上配 DEEPSEEK_API_KEY。",
	);
}

const SYSTEM = `你是专业的中文视频知识编辑，对标 BibiGPT / BiliSummary：左边看片，右边是能跳转的知识笔记。
字幕可能是语音识别，有错别字；先结合标题把游戏名、英雄、装备、机制、数字纠正清楚，再写笔记。禁止编造字幕里没有的数字、步骤、结论。
输出 JSON：
{"tldr":"不超过80字，先给结论：这期最重要的发现/方法/结果","points":[{"time":"mm:ss","text":"一条可执行结论或关键数字"}],"cards":[{"title":"词条名","time":"mm:ss","body":"80到120字讲清机制、数值、用法或坑"}],"chapters":[{"time":"mm:ss","title":"小节标题","summary":"100到180字：这段发生了什么、关键数字、结论"}]}
硬性要求：
- points 6到10条，每条必须带 time，不要空话（「值得关注」「需要注意」）。
- cards 4到8张，标题像词条（机制名、数值、阵容、坑），不要「第一部分」。
- chapters 必须从 00:00 覆盖到片尾。最后一条 time 不得早于片长的 85%。大约每 40 到 50 秒一段；6 分钟片子至少 8 段。
- time 必须来自字幕里出现过的时间戳。
- 删除口语、重复、无意义过渡。`;

export async function summarizeTranscript(
	meta: VideoMeta,
	transcript: string,
): Promise<VideoDigestResult> {
	const llm = llmTarget();
	const res = await fetch(`${llm.base}/chat/completions`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${llm.key}`,
		},
		body: JSON.stringify({
			model: llm.model,
			temperature: 0.2,
			max_tokens: 4096,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: SYSTEM },
				{
					role: "user",
					content: `标题：${meta.title}\nUP：${meta.up}\nBV：${meta.bvid}\n片长：${formatClock(meta.duration)}（${meta.duration}秒）\n章节最后一条时间必须接近 ${formatClock(meta.duration)}，禁止只写前两分钟。\n字幕：\n${transcript.slice(0, 32000)}`,
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
	let raw = payload.choices?.[0]?.message?.content || "{}";
	const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
	if (fenced) raw = fenced[1];
	let parsed: {
		tldr?: string;
		points?: unknown;
		cards?: unknown;
		chapters?: Array<{ time?: string; title?: string; summary?: string }>;
	} = {};
	try {
		parsed = JSON.parse(raw) as typeof parsed;
	} catch {
		parsed = { tldr: raw.slice(0, 200), points: [], cards: [], chapters: [] };
	}
	const chapters: VideoChapter[] = ensureChapters(
		meta,
		transcript,
		(parsed.chapters || []).map((row) => ({
			time: row.time || "00:00",
			title: row.title || "",
			summary: row.summary || "",
		})),
	);
	const cards: VideoCard[] = asCards(parsed.cards);
	const points = asPoints(parsed.points);
	const tldr = parsed.tldr || meta.title;
	const markdown = [
		`# ${meta.title}`,
		"",
		tldr,
		"",
		...points.map((p) => `- ${p}`),
		"",
		...cards.map((c) => `### ${c.title}\n\n${c.body}`),
		"",
		...chapters.map((c) => `## ${c.time} ${c.title}\n\n${c.summary}`),
		"",
		meta.url,
	].join("\n");
	return { meta, tldr, points, cards, chapters, markdown, transcript };
}

export async function summarizeFromSubtitles(
	source: string,
	meta: VideoMeta,
): Promise<VideoDigestResult | null> {
	const bvid = bvidOf(peelBilibili(source));
	if (!bvid) return null;
	const captions = await fetchSubtitles(bvid);
	const official = captions.trim() ? "" : await fetchOfficialSummary(bvid);
	let transcript = captions.trim() || official.trim();
	if (!transcript) {
		transcript = (await transcribeBilibili(bvid)).trim();
	}
	if (!transcript) return null;
	return summarizeTranscript(meta, transcript);
}

export async function askAboutNote(
	question: string,
	context: string,
): Promise<string> {
	const llm = llmTarget();
	const res = await fetch(`${llm.base}/chat/completions`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${llm.key}`,
		},
		body: JSON.stringify({
			model: llm.model,
			temperature: 0.3,
			messages: [
				{
					role: "system",
					content:
						"你是这期视频的笔记助理。只根据给定笔记和字幕回答，不知道就说笔记里没有。中文短答，必要时带 mm:ss 方便跳转。",
				},
				{
					role: "user",
					content: `笔记与字幕：\n${context.slice(0, 18000)}\n\n问题：${question.trim()}`,
				},
			],
		}),
	});
	if (!res.ok) throw new Error(`追问模型返回 ${res.status}。`);
	const payload = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>;
	};
	return (payload.choices?.[0]?.message?.content || "").trim() || "没答上来。";
}
