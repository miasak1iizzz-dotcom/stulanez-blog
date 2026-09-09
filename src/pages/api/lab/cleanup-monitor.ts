import fs from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";

export const prerender = false;

// T-011 图库清理挂机管线监控:读 .ai-work/quality-review 聚合给看板「图库清理」TAB
const QR = path.resolve(".ai-work/quality-review");
const STATE = path.join(QR, "full-run-state.json");
const SCAN = path.join(QR, "scan-kpop.json");
const GPU_HEALTH = "http://127.0.0.1:8080/health";

function readJson<T>(p: string, fallback: T): T {
	try {
		if (!fs.existsSync(p)) return fallback;
		return JSON.parse(fs.readFileSync(p, "utf8")) as T;
	} catch {
		return fallback;
	}
}

type Verdict = {
	eliminate?: boolean | null;
	err?: string;
	missing?: boolean;
	tag?: string;
};
const vCountCache = new Map<string, { mtime: number; n: number; el: number }>();
const cleanupCache: { at: number; data: Record<string, unknown> | null } = {
	at: 0,
	data: null,
};

function verdictCounts(file: string): { n: number; el: number } {
	const p = path.join(QR, file);
	try {
		const mtime = fs.statSync(p).mtimeMs;
		const c = vCountCache.get(file);
		if (c && c.mtime === mtime) return c;
		const v = readJson<Record<string, Verdict>>(p, {});
		let el = 0;
		for (const o of Object.values(v)) if (o && o.eliminate === true) el++;
		const nc = { mtime, n: Object.keys(v).length, el };
		vCountCache.set(file, nc);
		return nc;
	} catch {
		return { n: 0, el: 0 };
	}
}

export const GET: APIRoute = async () => {
	// 10秒服务端缓存:看板15s轮询,避免每次重解析5MB清单+全部verdict文件拖垮dev服务器
	if (cleanupCache.at > Date.now() - 10_000 && cleanupCache.data) {
		return new Response(JSON.stringify(cleanupCache.data), {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			},
		});
	}
	const scan = readJson<string[] | Array<{ file: string }>>(SCAN, []);
	const members = [
		...new Set(
			scan.map((e) => {
				const parts = (typeof e === "string" ? e : e.file).split("/");
				return parts.length >= 3 ? parts.slice(0, 2).join("/") : parts[0];
			}),
		),
	];
	const state = readJson<{
		done?: Record<
			string,
			{
				prescreen?: string;
				vlm?: string;
				onDisk?: number;
				noface?: number;
				withface?: number;
				secs?: number;
			}
		>;
		startedAt?: string;
	}>(STATE, {});
	const done = state.done ?? {};

	const perMember: Array<{
		m: string;
		onDisk?: number;
		noface?: number;
		withface?: number;
		vlm?: string;
		secs?: number;
	}> = [];
	let sumOnDisk = 0,
		sumNoface = 0,
		sumWithface = 0,
		judged = 0,
		eliminated = 0,
		vlmDone = 0,
		prescreenDone = 0;

	let verdictFiles: string[] = [];
	try {
		verdictFiles = fs
			.readdirSync(QR)
			.filter((f) => /^vlm-verdicts-vlm-.+\.json$/.test(f));
	} catch {}
	for (const f of verdictFiles) {
		const c = verdictCounts(f);
		judged += c.n;
		eliminated += c.el;
	}
	for (const m of members) {
		const d = done[m] ?? {};
		if (d.prescreen === "ok") prescreenDone++;
		if (d.vlm === "ok" || d.vlm === "none-needed") vlmDone++;
		sumOnDisk += d.onDisk ?? 0;
		sumNoface += d.noface ?? 0;
		sumWithface += d.withface ?? 0;
		if (d.prescreen) perMember.push({ m, ...d });
	}

	// 当前成员:第一个 VLM 未完成的
	const safe = (m: string) => m.replace("/", "_");
	let current: {
		m: string;
		listN: number;
		judged: number;
		eliminated: number;
		prescreen: string;
	} | null = null;
	for (const m of members) {
		const d = done[m] ?? {};
		if (d.vlm === "ok" || d.vlm === "none-needed") continue;
		const list = readJson<string[]>(
			path.join(QR, `list-vlm-${safe(m)}.json`),
			[],
		);
		const ver = readJson<Record<string, Verdict>>(
			path.join(QR, `vlm-verdicts-vlm-${safe(m)}.json`),
			{},
		);
		let el = 0;
		for (const o of Object.values(ver)) if (o && o.eliminate === true) el++;
		current = {
			m,
			listN: list.length,
			judged: Object.keys(ver).length,
			eliminated: el,
			prescreen: d.prescreen ?? "pending",
		};
		break;
	}

	// GPU 服务健康
	let gpu = false;
	try {
		const r = await fetch(GPU_HEALTH, { signal: AbortSignal.timeout(1200) });
		gpu = r.ok;
	} catch {}

	// 驱动活性:状态文件 40 分钟内有过写盘(大成员判图可 ~20 分钟不落盘)
	const stateAgeMin = fs.existsSync(STATE)
		? (Date.now() - fs.statSync(STATE).mtimeMs) / 60000
		: Number.MAX_SAFE_INTEGER;
	const driverAlive = stateAgeMin < 40;

	// ETA:有脸占比按已预筛样本外推全库,速度按全程均速(含预筛,偏保守)
	const startedAt = state.startedAt
		? new Date(state.startedAt).getTime()
		: Date.now();
	const elapsedH = (Date.now() - startedAt) / 3600e3;
	const rate = elapsedH > 0.02 ? judged / elapsedH : 0;
	const withfaceRatio = sumOnDisk > 50 ? sumWithface / sumOnDisk : 0.9;
	const estTotalWithface = Math.min(
		Math.round(scan.length * withfaceRatio),
		scan.length,
	);
	const remainImgs = Math.max(estTotalWithface - judged, 0);
	const etaH = rate > 0 ? remainImgs / rate : null;

	const payload = {
		ok: true,
		now: new Date().toISOString(),
		membersTotal: members.length,
		scanTotal: scan.length,
		estTotalWithface,
		prescreenDone,
		vlmDone,
		sumOnDisk,
		sumNoface,
		sumWithface,
		judged,
		eliminated,
		current,
		gpu,
		driverAlive,
		stateAgeMin: Math.round(stateAgeMin),
		elapsedH: Number(elapsedH.toFixed(2)),
		rate: Math.round(rate),
		etaH: etaH == null ? null : Number(etaH.toFixed(1)),
		perMember: perMember
			.sort((a, b) => (b.secs ?? 0) - (a.secs ?? 0))
			.slice(0, 500),
	};
	cleanupCache.at = Date.now();
	cleanupCache.data = payload;
	return new Response(JSON.stringify(payload), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
		},
	});
};
