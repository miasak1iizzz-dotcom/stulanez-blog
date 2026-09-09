import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";

export const prerender = false;

// T-030 欲望滋生室：读/写 src/data/agent-board/desires.json（老板在指挥看板随手记的天马行空想法）
// 欲望卡分两种：kind=raw 青涩卡（老板原始想法，未剖析）；kind=mature 成熟卡（跟任务卡同架构，已剖析成可落地的卡）。
// 该文件是看板共享状态之一（见 agent-board.ts 的 SHARED_BOARD_PATHS），由老板这张 UI 直接读写；AI 剖析写回时走短锁。
const FILE = path.resolve("src/data/agent-board/desires.json");

export type DesireKind = "raw" | "mature";

export type Desire = {
	id: string;
	kind: DesireKind;
	title: string;
	/** 老板原始想法（青涩卡正文 / 成熟卡的「原始想法」备注） */
	memo: string;
	mood: string;
	createdAt: string;
	// —— 成熟卡字段（kind=mature 时有效，结构与任务卡一致）——
	plain?: string;
	story?: string[];
	statusLine?: string;
	nextStep?: string;
	priority?: string;
	cat?: string;
	cover?: string;
	deps?: string[];
	/** 已转正式任务时填任务号 */
	taskRef?: string;
};

type DesireFile = {
	updated: string;
	note?: string;
	desires: Desire[];
};

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function readFile(): DesireFile {
	try {
		if (!fs.existsSync(FILE)) return { updated: today(), desires: [] };
		const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Partial<DesireFile>;
		return {
			updated: parsed.updated ?? today(),
			note: parsed.note,
			desires: Array.isArray(parsed.desires) ? parsed.desires : [],
		};
	} catch {
		return { updated: today(), desires: [] };
	}
}

function writeFile(data: DesireFile): void {
	fs.mkdirSync(path.dirname(FILE), { recursive: true });
	fs.writeFileSync(FILE, `${JSON.stringify(data, null, "\t")}\n`);
}

function nextId(desires: Desire[]): string {
	let max = 0;
	for (const d of desires) {
		const m = /^D-(\d+)$/.exec(d.id);
		if (m) max = Math.max(max, Number(m[1]));
	}
	return `D-${String(max + 1).padStart(3, "0")}`;
}

function titleFrom(memo: string): string {
	const firstLine = memo.split(/\r?\n/)[0]?.trim() ?? "";
	if (!firstLine) return "一个想法";
	const limit = 26;
	return firstLine.length > limit ? `${firstLine.slice(0, limit)}…` : firstLine;
}

function strArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.map((v) => String(v).trim()).filter(Boolean);
}

export const GET: APIRoute = async () => {
	const data = readFile();
	return new Response(JSON.stringify({ ok: true, ...data }), {
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});
};

export const POST: APIRoute = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response("invalid json", { status: 400 });
	}
	if (!body || typeof body !== "object") {
		return new Response("invalid body", { status: 400 });
	}

	const data = readFile();
	const action = body.action as string;

	// 新增一条青涩欲望卡
	if (action === "add") {
		const memo = String(body.memo ?? "").trim();
		if (!memo) return new Response("empty memo", { status: 400 });
		const desire: Desire = {
			id: nextId(data.desires),
			kind: "raw",
			title: titleFrom(memo),
			memo,
			mood: String(body.mood ?? "想玩").trim() || "想玩",
			createdAt: today(),
		};
		data.desires.unshift(desire);
		data.updated = today();
		writeFile(data);
		return new Response(JSON.stringify({ ok: true, desire }), {
			headers: { "content-type": "application/json" },
		});
	}

	// 就地更新一张卡（可改字段，也可把青涩卡升级成成熟卡）
	if (action === "set") {
		const id = String(body.id ?? "");
		const target = data.desires.find((d) => d.id === id);
		if (!target) return new Response("not found", { status: 404 });

		if (body.kind === "raw" || body.kind === "mature") target.kind = body.kind;
		if (typeof body.title === "string") target.title = body.title.trim() || target.title;
		if (typeof body.memo === "string") target.memo = body.memo;
		if (typeof body.mood === "string") target.mood = body.mood.trim() || target.mood;
		if (typeof body.plain === "string") target.plain = body.plain.trim();
		if (typeof body.statusLine === "string") target.statusLine = body.statusLine.trim();
		if (typeof body.nextStep === "string") target.nextStep = body.nextStep.trim();
		if (typeof body.priority === "string") target.priority = body.priority.trim();
		if (typeof body.cat === "string") target.cat = body.cat.trim();
		if (typeof body.cover === "string") target.cover = body.cover.trim();
		if (typeof body.taskRef === "string") target.taskRef = body.taskRef.trim();
		if (body.story !== undefined) target.story = strArray(body.story) ?? [];
		if (body.deps !== undefined) target.deps = strArray(body.deps) ?? [];
		data.updated = today();
		writeFile(data);
		return new Response(JSON.stringify({ ok: true, desire: target }), {
			headers: { "content-type": "application/json" },
		});
	}

	// 删除一张卡
	if (action === "remove") {
		const id = String(body.id ?? "");
		const before = data.desires.length;
		data.desires = data.desires.filter((d) => d.id !== id);
		if (data.desires.length === before) return new Response("not found", { status: 404 });
		data.updated = today();
		writeFile(data);
		return new Response(JSON.stringify({ ok: true, removed: id }), {
			headers: { "content-type": "application/json" },
		});
	}

	return new Response("unknown action", { status: 400 });
};
