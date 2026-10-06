/**
 * 站长活动流水（协议「站长与游客」+ 2026-10 改版期）。
 *
 * 只做三件事：
 *   1. 在【站长设备】上把"今天在站里做了什么"记进 localStorage；
 *   2. 给 /today 页面汇总成一句可以直接发的动态草稿；
 *   3. 顺手把 logActivity 挂到 window 上，供 inline 脚本（音乐播放器等）调用。
 *
 * 不上传、不联网、不写 cookie、游客设备上完全不记录。
 */

import { isOwnerDevice } from "@/utils/owner";

const KEY = "stulanez.activity.v1";
const MAX = 800;

export type ActivityKind = "pull" | "music" | "dynamic" | "note" | "tool";

export interface Activity {
	t: number;
	kind: ActivityKind;
	label: string;
	detail?: string;
}

declare global {
	interface Window {
		__logActivity?: (kind: ActivityKind, label: string, detail?: string) => void;
	}
}

export function loadActivity(): Activity[] {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item): item is Activity =>
				typeof item === "object" &&
				item !== null &&
				typeof (item as Activity).t === "number" &&
				typeof (item as Activity).kind === "string" &&
				typeof (item as Activity).label === "string",
		);
	} catch {
		return [];
	}
}

/** 记一笔。游客设备直接丢弃，隐私模式下静默失败。 */
export function logActivity(
	kind: ActivityKind,
	label: string,
	detail: string = "",
): void {
	if (!isOwnerDevice()) return;
	try {
		const list = loadActivity();
		list.push({ t: Date.now(), kind, label, detail });
		localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
		window.dispatchEvent(
			new CustomEvent("stulanez:activity", { detail: { kind, label, detail } }),
		);
	} catch {
		/* 隐私模式 / 配额满：忽略，不影响页面 */
	}
}

export function clearActivity(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		/* 忽略 */
	}
}

/** 本地时区的 YYYY-MM-DD */
export function dayKey(t: number): string {
	const d = new Date(t);
	const p = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function activityOfDay(day: string = dayKey(Date.now())): Activity[] {
	return loadActivity().filter((a) => dayKey(a.t) === day);
}

export interface DaySummary {
	day: string;
	total: number;
	pull: number;
	musicCount: number;
	musicNames: string[];
	notes: string[];
	draft: string;
}

/** 把一天的流水压成一句可以直接发出去的话。 */
export function summarizeDay(events: Activity[]): DaySummary {
	const pullEvents = events.filter((a) => a.kind === "pull");
	const musicEvents = events.filter((a) => a.kind === "music");
	const notes = events.filter((a) => a.kind === "note").map((a) => a.label);

	const musicNames: string[] = [];
	for (const m of musicEvents) {
		if (!musicNames.includes(m.label)) musicNames.push(m.label);
	}

	const parts: string[] = [];
	if (pullEvents.length > 0) {
		const sources: string[] = [];
		for (const p of pullEvents) {
			if (p.detail && !sources.includes(p.detail)) sources.push(p.detail);
		}
		parts.push(
			`用取图收了 ${pullEvents.length} 次${sources.length ? `（${sources.join("、")}）` : ""}`,
		);
	}
	if (musicNames.length > 0) {
		const head = musicNames.slice(0, 3).join("、");
		parts.push(
			`听了 ${musicNames.length} 首${musicNames.length > 3 ? `，从 ${head} 开始` : `（${head}）`}`,
		);
	}
	if (notes.length > 0) parts.push(notes.join("；"));

	return {
		day: events.length > 0 ? dayKey(events[0].t) : dayKey(Date.now()),
		total: events.length,
		pull: pullEvents.length,
		musicCount: musicNames.length,
		musicNames,
		notes,
		draft: parts.length > 0 ? parts.join("，") + "。" : "",
	};
}

/* inline 脚本（音乐播放器等）没有模块作用域，走 window 这个口子 */
if (typeof window !== "undefined") {
	window.__logActivity = logActivity;
}
