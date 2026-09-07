import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";
import roster from "@/data/douyin-roster/roster.json";

export const prerender = false;

const RUN = path.resolve(".ai-work/douyin-dl-run");
const STATE = path.join(RUN, "state.json");
const SUMMARY = path.join(RUN, "summary.json");
const LOG = path.join(RUN, "console.out.log");
const RUN_LOG = path.join(RUN, "run.log");

type DoneEntry = {
	count: number;
	folder?: string;
	at?: string;
	ok?: boolean;
};

function readJson<T>(p: string, fallback: T): T {
	try {
		if (!fs.existsSync(p)) return fallback;
		return JSON.parse(fs.readFileSync(p, "utf8")) as T;
	} catch {
		return fallback;
	}
}

function tailLines(p: string, n = 30): string[] {
	if (!fs.existsSync(p)) return [];
	const text = fs.readFileSync(p, "utf8").replace(/\0/g, "");
	return text
		.trim()
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.slice(-n);
}

function countFiles(folder: string | undefined): number | null {
	if (!folder || !fs.existsSync(folder)) return null;
	try {
		return fs
			.readdirSync(folder)
			.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
	} catch {
		return null;
	}
}

export const GET: APIRoute = async () => {
	const state = readJson<{
		done?: Record<string, DoneEntry>;
		failed?: Record<string, { at?: string; reason?: string }>;
	}>(STATE, {});
	const summary = readJson<Record<string, unknown>>(SUMMARY, {});
	const done = state.done ?? {};
	const failed = state.failed ?? {};

	const logPath = fs.existsSync(LOG) ? LOG : RUN_LOG;
	// Prefer run.log (unbuffered append) when console redirect is noisy
	const preferRun = fs.existsSync(RUN_LOG) ? RUN_LOG : logPath;
	const lines = tailLines(preferRun, 60).concat(tailLines(LOG, 20));
	const lastLine = [...lines].reverse().find((l) => l.includes("|") || l.includes("[") || /done ok=/i.test(l)) ?? lines[lines.length - 1] ?? "";
	const logMtime = Math.max(
		fs.existsSync(LOG) ? fs.statSync(LOG).mtimeMs : 0,
		fs.existsSync(RUN_LOG) ? fs.statSync(RUN_LOG).mtimeMs : 0,
	);
	const running = Date.now() - logMtime < 3 * 60 * 1000 && !/done ok=/i.test(lastLine);

	const currentMatch =
		lastLine.match(/([A-Za-z0-9()[\]_.\-\s]+)\|([A-Za-z0-9_.\-]+)\s+query=/) ||
		lastLine.match(/\[(\d+)\/(\d+)\]\s+([^/]+)\/(\S+)\s+->/);

	let currentKey: string | null = null;
	if (currentMatch) {
		if (currentMatch[1] && currentMatch[2] && !currentMatch[3]) {
			currentKey = `${currentMatch[1].trim()}|${currentMatch[2].trim()}`;
		} else if (currentMatch[3] && currentMatch[4]) {
			currentKey = `${currentMatch[3].trim()}|${currentMatch[4].trim()}`;
		}
	}

	const qtyDefault = (roster as { defaults?: { memberQty?: number } }).defaults?.memberQty ?? 10;
	const groups = (
		roster as {
			groups: Array<{
				group: string;
				avatar: string | null;
				members: Array<{
					idol: string;
					stageName: string;
					avatar: string | null;
					qty?: number;
				}>;
			}>;
		}
	).groups;

	type MemberRow = {
		key: string;
		group: string;
		idol: string;
		stageName: string;
		avatar: string | null;
		groupAvatar: string | null;
		wanted: number;
		got: number;
		status: "done" | "running" | "partial" | "failed" | "pending";
		at: string | null;
		reason: string | null;
		folder: string | null;
	};

	const members: MemberRow[] = [];
	for (const g of groups) {
		for (const m of g.members) {
			const key = `${g.group}|${m.idol}`;
			const wanted = m.qty ?? qtyDefault;
			const d = done[key];
			const f = failed[key];
			const disk = countFiles(d?.folder);
			const got = disk ?? d?.count ?? 0;
			let status: MemberRow["status"] = "pending";
			if (got >= wanted) status = "done";
			else if (key === currentKey && running) status = "running";
			else if (got > 0) status = "partial";
			else if (f) status = "failed";

			members.push({
				key,
				group: g.group,
				idol: m.idol,
				stageName: m.stageName,
				avatar: m.avatar,
				groupAvatar: g.avatar,
				wanted,
				got,
				status,
				at: d?.at ?? f?.at ?? null,
				reason: f?.reason ?? null,
				folder: d?.folder ?? null,
			});
		}
	}

	const imagesGot = members.reduce((n, m) => n + m.got, 0);
	const imagesWanted = members.reduce((n, m) => n + m.wanted, 0);
	const doneCount = members.filter((m) => m.status === "done").length;
	const partialCount = members.filter((m) => m.status === "partial" || m.status === "running").length;
	const failCount = members.filter((m) => m.status === "failed").length;

	const byGroup = groups.map((g) => {
		const ms = members.filter((m) => m.group === g.group);
		const got = ms.reduce((n, m) => n + m.got, 0);
		const wanted = ms.reduce((n, m) => n + m.wanted, 0);
		const finished = ms.filter((m) => m.status === "done").length;
		return {
			group: g.group,
			avatar: g.avatar,
			members: ms.length,
			finished,
			got,
			wanted,
			pct: wanted ? Math.round((got / wanted) * 100) : 0,
		};
	});

	return new Response(
		JSON.stringify({
			ok: true,
			updated: new Date().toISOString(),
			running,
			currentKey,
			lastLine: lastLine.slice(0, 240),
			totals: {
				members: members.length,
				done: doneCount,
				partial: partialCount,
				failed: failCount,
				pending: members.length - doneCount - partialCount - failCount,
				imagesGot,
				imagesWanted,
				pct: imagesWanted ? Math.round((imagesGot / imagesWanted) * 100) : 0,
			},
			byGroup,
			members,
			summary,
		}),
		{
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			},
		},
	);
};
