import { peelBilibili } from "./bilibili";
import { digestFromEngine, type EngineTask } from "./engine-map";
import type { VideoMeta } from "./types";

function engineBase(): string {
	const fromEnv = (process.env.BILISUM_ENGINE_URL || "")
		.trim()
		.replace(/\/+$/, "");
	if (fromEnv) return fromEnv;
	if (import.meta.env.DEV) return "http://127.0.0.1:3839";
	return "";
}

function engineToken(): string {
	return (
		process.env.BILISUM_TOKEN ||
		process.env.VIDEO_SUM_ACCESS_TOKEN ||
		""
	).trim();
}

export function engineConfigured(): boolean {
	return Boolean(engineBase());
}

async function engineFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const base = engineBase();
	if (!base) throw new Error("视频引擎没接上。");
	const token = engineToken();
	const headers = new Headers(init.headers);
	headers.set("accept", "application/json");
	if (token) headers.set("authorization", `Bearer ${token}`);
	if (init.body && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	return fetch(`${base}${path}`, { ...init, headers });
}

export async function findCompletedTask(bvid: string): Promise<string | null> {
	try {
		const res = await engineFetch("/api/v1/tasks");
		if (!res.ok) return null;
		const list = (await res.json()) as EngineTask[];
		const hit = list.find(
			(row) =>
				row.status === "completed" &&
				typeof row.source === "string" &&
				row.source.includes(bvid),
		);
		return hit?.task_id || null;
	} catch {
		return null;
	}
}

export async function createEngineTask(source: string): Promise<string> {
	const url = peelBilibili(source);
	const res = await engineFetch("/api/v1/tasks", {
		method: "POST",
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
		throw new Error("视频引擎令牌不对。");
	}
	if (!res.ok) {
		throw new Error(`引擎创建任务失败（${res.status}）。`);
	}
	const body = (await res.json()) as EngineTask;
	if (!body.task_id) throw new Error("引擎没返回任务号。");
	return body.task_id;
}

export async function readEngineTask(
	id: string,
	meta: VideoMeta,
): Promise<{
	status: VideoJobStatus;
	message: string;
	error?: string;
	result?: VideoDigestResult;
}> {
	const res = await engineFetch(`/api/v1/tasks/${encodeURIComponent(id)}`);
	if (res.status === 404) {
		return { status: "failed", message: "任务不存在", error: "任务不存在。" };
	}
	if (!res.ok) {
		return {
			status: "failed",
			message: "引擎读任务失败",
			error: `引擎 ${res.status}`,
		};
	}
	const body = (await res.json()) as EngineTask;
	return digestFromEngine(body, meta);
}
