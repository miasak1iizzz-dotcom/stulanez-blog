import { readFileSync } from "node:fs";
import { fetchHtml5PlayUrl, formatClock } from "./bilibili";

const SUBMIT =
	"https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
const TASKS = "https://dashscope.aliyuncs.com/api/v1/tasks";

function dashscopeKey(): string {
	const env = (process.env.DASHSCOPE_API_KEY || "").trim();
	if (env) return env;
	try {
		return (
			readFileSync("E:/AI/Harvest/dashscope.key", "utf8")
				.trim()
				.split(/\r?\n/)[0] || ""
		);
	} catch {
		return "";
	}
}

interface AsrTask {
	output?: {
		task_id?: string;
		task_status?: string;
		results?: Array<{
			transcription_url?: string;
			subtask_status?: string;
			message?: string;
		}>;
		message?: string;
		code?: string;
	};
	message?: string;
	code?: string;
}

function authHeaders(): HeadersInit {
	const key = dashscopeKey();
	if (!key)
		throw new Error(
			"语音识别的密钥没配。本地放 Harvest 的 dashscope.key，线上配 DASHSCOPE_API_KEY。",
		);
	return {
		authorization: `Bearer ${key}`,
		"content-type": "application/json",
	};
}

async function submitFile(fileUrl: string): Promise<string> {
	const res = await fetch(SUBMIT, {
		method: "POST",
		headers: {
			...authHeaders(),
			"X-DashScope-Async": "enable",
		},
		body: JSON.stringify({
			model: "paraformer-v2",
			input: { file_urls: [fileUrl] },
			parameters: { language_hints: ["zh"] },
		}),
	});
	const payload = (await res.json()) as AsrTask;
	const id = payload.output?.task_id;
	if (!id) {
		throw new Error(payload.message || payload.code || "语音识别没接住。");
	}
	return id;
}

async function pollTask(id: string, timeoutMs: number): Promise<AsrTask> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const res = await fetch(`${TASKS}/${id}`, { headers: authHeaders() });
		const payload = (await res.json()) as AsrTask;
		const status = payload.output?.task_status || "";
		if (status === "SUCCEEDED") return payload;
		if (status === "FAILED") {
			throw new Error(
				payload.output?.message || payload.message || "语音识别失败。",
			);
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	throw new Error("语音识别超时了。片子太长的话，过一会儿再贴一次。");
}

async function readTranscript(url: string): Promise<string> {
	try {
		const res = await fetch(url);
		if (!res.ok) return "";
		const payload = (await res.json()) as {
			transcripts?: Array<{
				sentences?: Array<{ begin_time?: number; text?: string }>;
				text?: string;
			}>;
		};
		const sentences = payload.transcripts?.[0]?.sentences || [];
		if (sentences.length) {
			return sentences
				.map((row) => {
					const text = String(row.text || "").trim();
					if (!text) return "";
					return `${formatClock((Number(row.begin_time) || 0) / 1000)} ${text}`;
				})
				.filter(Boolean)
				.join("\n");
		}
		return String(payload.transcripts?.[0]?.text || "").trim();
	} catch {
		return "";
	}
}

export async function transcribeBilibili(
	bvid: string,
	timeoutMs = process.env.VERCEL ? 45_000 : 180_000,
): Promise<string> {
	const fileUrl = await fetchHtml5PlayUrl(bvid);
	if (!fileUrl) return "";
	const taskId = await submitFile(fileUrl);
	const done = await pollTask(taskId, timeoutMs);
	const resultUrl = done.output?.results?.[0]?.transcription_url || "";
	if (!resultUrl) return "";
	return readTranscript(resultUrl);
}
