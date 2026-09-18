import { bvidOf, formatClock } from "./bilibili";
import type { VideoDigestResult, VideoJobStatus, VideoMeta } from "./types";

export interface EngineTask {
	task_id?: string;
	status?: string;
	title?: string;
	source?: string;
	error_message?: string;
	result?: {
		overview?: string;
		knowledge_note_markdown?: string;
		key_points?: string[];
		timeline?: Array<{ title?: string; start?: number; summary?: string }>;
	};
}

export function digestFromEngine(
	body: EngineTask,
	meta: VideoMeta,
): {
	status: VideoJobStatus;
	message: string;
	error?: string;
	result?: VideoDigestResult;
} {
	const status = (body.status || "running") as VideoJobStatus;
	if (status === "failed" || status === "cancelled") {
		return {
			status,
			message: body.error_message || "引擎没做成。",
			error: body.error_message || "引擎没做成。",
		};
	}
	if (status !== "completed" || !body.result) {
		return {
			status: status === "queued" ? "queued" : "running",
			message: status === "queued" ? "排队中" : "引擎正在拆这一条",
		};
	}
	const timeline = body.result.timeline || [];
	const chapters = timeline.map((row) => ({
		time: formatClock(Number(row.start) || 0),
		title: String(row.title || ""),
		summary: String(row.summary || ""),
	}));
	const points = (body.result.key_points || [])
		.map((row) => String(row))
		.filter(Boolean);
	const tldr = body.result.overview || meta.title;
	const markdown =
		body.result.knowledge_note_markdown ||
		[`# ${meta.title}`, "", tldr, "", ...points.map((p) => `- ${p}`)].join(
			"\n",
		);
	const bvid = bvidOf(body.source || meta.url) || meta.bvid;
	return {
		status: "completed",
		message: "做好了",
		result: {
			meta: {
				...meta,
				bvid,
				title: body.title || meta.title,
				url: meta.url,
			},
			tldr,
			points,
			cards: [],
			chapters,
			markdown,
		},
	};
}
