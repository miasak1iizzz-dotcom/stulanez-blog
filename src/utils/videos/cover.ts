import { formatClock, parseClock } from "./bilibili";
import type {
	VideoCard,
	VideoChapter,
	VideoDigestResult,
	VideoMeta,
} from "./types";

interface Cue {
	time: string;
	sec: number;
	text: string;
}

export function parseCues(transcript: string): Cue[] {
	return transcript
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const hit = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/.exec(line);
			if (!hit) return { time: "", sec: 0, text: line };
			return { time: hit[1], sec: parseClock(hit[1]), text: hit[2] };
		});
}

function titleOf(text: string, fallback: string): string {
	const cleaned = text.replace(/[，。！？,.!?]/g, " ").trim();
	const cut = cleaned.slice(0, 18);
	return cut || fallback;
}

export function asPoints(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row) => {
			if (typeof row === "string") return row.trim();
			if (!row || typeof row !== "object") return "";
			const rec = row as { time?: unknown; text?: unknown; body?: unknown };
			const time = String(rec.time || "").trim();
			const text = String(rec.text || rec.body || "").trim();
			if (!text) return "";
			return time ? `${time} ${text}` : text;
		})
		.filter(Boolean);
}

export function asCards(raw: unknown): VideoCard[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((row) => {
			if (!row || typeof row !== "object") return null;
			const rec = row as { title?: unknown; body?: unknown; time?: unknown };
			const title = String(rec.title || "").trim();
			const time = String(rec.time || "").trim();
			const body = String(rec.body || "").trim();
			if (!title || !body) return null;
			return {
				title,
				body: time && !body.startsWith(time) ? `${time} ${body}` : body,
			};
		})
		.filter((row): row is VideoCard => Boolean(row));
}

export function ensureChapters(
	meta: VideoMeta,
	transcript: string,
	incoming: VideoChapter[],
): VideoChapter[] {
	const duration = Math.max(1, Number(meta.duration) || 0);
	const need = Math.max(6, Math.round(duration / 42));
	const chapters = incoming.filter((row) => row.title || row.summary);
	const last = parseClock(chapters.at(-1)?.time || "00:00");
	const covered =
		last >= duration * 0.8 && chapters.length >= Math.max(5, need - 3);
	if (covered) return chapters;

	const cues = parseCues(transcript).filter((cue) => cue.time);
	if (!cues.length) return chapters.length ? chapters : incoming;

	const span = Math.max(30, Math.floor(duration / need));
	const filled: VideoChapter[] = [];
	for (
		let start = 0, i = 0;
		start < duration && i < need + 2;
		start += span, i += 1
	) {
		const end = Math.min(duration, start + span);
		const slice = cues.filter((cue) => cue.sec >= start && cue.sec < end);
		const seed =
			slice[0] || cues.find((cue) => cue.sec >= start) || cues[cues.length - 1];
		const llm = chapters.find((row) => {
			const sec = parseClock(row.time);
			return sec >= start && sec < end;
		});
		if (llm) {
			filled.push(llm);
			continue;
		}
		const summary = (slice.length ? slice : [seed])
			.map((cue) => cue.text)
			.join(" ")
			.slice(0, 160);
		filled.push({
			time: formatClock(seed?.sec ?? start),
			title: titleOf(seed?.text || "", `第${filled.length + 1}段`),
			summary: summary || "这一段继续展开前面的内容。",
		});
	}
	return filled.length ? filled : chapters;
}

export function polishNote(
	row: VideoDigestResult,
	transcript = row.transcript || "",
): VideoDigestResult {
	return {
		...row,
		cards: row.cards || [],
		transcript,
		chapters: ensureChapters(row.meta, transcript, row.chapters || []),
	};
}
