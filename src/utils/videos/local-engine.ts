import { bvidOf, peelBilibili } from "./bilibili";
import { digestFromEngine, type EngineTask } from "./engine-map";
import type { VideoDigestResult, VideoMeta } from "./types";

export const LOCAL_ENGINE_URL = "http://127.0.0.1:3839";
/** 只打本机 BiliSum，外网访问不到。 */
const LOCAL_ENGINE_TOKEN = "stulanez-vg2026";

function engineHeaders(json = false): HeadersInit {
	return {
		accept: "application/json",
		authorization: `Bearer ${LOCAL_ENGINE_TOKEN}`,
		...(json ? { "content-type": "application/json" } : {}),
	};
}

function stubMeta(source: string): VideoMeta {
	const bvid = bvidOf(peelBilibili(source)) || "";
	return {
		bvid,
		title: bvid,
		up: "",
		duration: 0,
		url: bvid ? `https://www.bilibili.com/video/${bvid}/` : source,
	};
}

export async function localEngineAlive(): Promise<boolean> {
	try {
		const res = await fetch(`${LOCAL_ENGINE_URL}/health`, {
			signal: AbortSignal.timeout(1800),
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function createLocalEngineTask(source: string): Promise<string> {
	const url = peelBilibili(source);
	const res = await fetch(`${LOCAL_ENGINE_URL}/api/v1/tasks`, {
		method: "POST",
		headers: engineHeaders(true),
		body: JSON.stringify({
			input_type: "url",
			source: url,
			options: {
				language: "zh",
				prefer_subtitles: true,
				summary_scope: "knowledge_note",
			},
		}),
	});
	if (res.status === 401 || res.status === 403) {
		throw new Error("本机引擎令牌不对。");
	}
	if (!res.ok) throw new Error(`本机引擎创建任务失败（${res.status}）。`);
	const body = (await res.json()) as EngineTask;
	if (!body.task_id) throw new Error("本机引擎没返回任务号。");
	return body.task_id;
}

export async function readLocalEngineTask(
	id: string,
	source: string,
): Promise<{
	status: string;
	message: string;
	error?: string;
	result?: VideoDigestResult;
}> {
	const res = await fetch(
		`${LOCAL_ENGINE_URL}/api/v1/tasks/${encodeURIComponent(id)}`,
		{ headers: engineHeaders() },
	);
	if (res.status === 404) {
		return { status: "failed", message: "任务不存在", error: "任务不存在。" };
	}
	if (!res.ok) {
		return {
			status: "failed",
			message: "本机引擎读任务失败",
			error: `引擎 ${res.status}`,
		};
	}
	const body = (await res.json()) as EngineTask;
	return digestFromEngine(body, stubMeta(source));
}

export function publicApiBlocked(error: string | undefined): boolean {
	const text = error || "";
	return (
		text.includes("412") ||
		text.includes("B 站接口") ||
		text.includes("没有公开字幕") ||
		text.includes("公网没有引擎")
	);
}
