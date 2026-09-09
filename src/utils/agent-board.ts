// Agent 看板数据加载工具 — 认领卡解析 / 新数据模型（tasks + inbox + agents）
// 构建时（Vercel）.ai-work 不存在 → 认领返回空数组；本地 dev 实时读取
// 面向用户的三个数据文件：agents.json / tasks.json / inbox.json（规范见 docs/AI-COLLABORATION.md）
// mail.json / experience.json / CURRENT-STATE.md 仍是 AI 内部文件，但不再上看板渲染

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface ClaimCard {
	file: string;
	owner: string;
	task: string;
	status: string;
	started: string;
	updated: string;
	exclusivePaths: string[];
	generatedOutputs: string[];
}

export interface ClaimConflict {
	leftClaim: string;
	leftOwner: string;
	leftPath: string;
	rightClaim: string;
	rightOwner: string;
	rightPath: string;
}

export interface SharedBoardClaimViolation {
	claim: string;
	owner: string;
	path: string;
}

export interface BoardWriteLock {
	owner: string;
	task: string;
	acquiredAt: string;
}

export const SHARED_BOARD_PATHS = [
	"src/data/agent-board/agents.json",
	"src/data/agent-board/tasks.json",
	"src/data/agent-board/inbox.json",
	"src/data/agent-board/mail.json",
	"src/data/agent-board/experience.json",
	"src/data/agent-board/CURRENT-STATE.md",
	"src/data/agent-board/desires.json",
] as const;

/** 任务分类（看板展示用，代码内维护，不再单独放数据文件） */
export const TASK_CATEGORIES: Record<string, { label: string; emoji: string }> =
	{
		assets: { label: "图库资产", emoji: "🖼️" },
		site: { label: "网站功能", emoji: "🛠️" },
		ops: { label: "工具基建", emoji: "🧰" },
	};

export const DEFAULT_COVER = "/assets/images/agent-board/lol-zoe.jpg";

export interface AgentInfo {
	id: string;
	name: string;
	vendor: string;
	model: string;
	port: number | null;
	color: string;
	role: string;
	plain: string;
	status: string;
	currentTask: string | null;
	summaries: string[];
	/** 客户端展示名（离线时提示「打开哪个客户端」），如 zcode / Deepseek harness EAC / codex / Cursor */
	client?: string;
	/** 该客户端在本机的进程名（子串匹配，不区分大小写），用于判断是否离线 */
	processNames?: string[];
}

/** 任务主理人交接记录（卡片详情「主理人跟踪」竖向时间轴） */
export interface OwnershipEvent {
	/** 代理 id：bigmodel / deepseek / codex / cursor / user / all */
	owner: string;
	/** 日期 YYYY-MM-DD */
	at: string;
	/** 大白话：创建 / 接手 / 协助 … */
	note: string;
}

export interface Task {
	id: string;
	title: string;
	/** 当前主理人（卡片左下角只看这个字段） */
	owner: string;
	state: string;
	priority: string;
	deps: string[];
	/** AI 内部简报（术语可保留，仅折叠展示） */
	brief: string;
	/** 一句话大白话（卡片上用，必须写给不懂技术的老板） */
	plain: string;
	/** 大白话分段叙事（进行中/待验收任务必填，翻页卷宗用） */
	story?: string[];
	/** 一行状态（做到哪了） */
	statusLine?: string;
	/** 进度百分比 0-100，估不准就 null 不要编 */
	progress?: number | null;
	/** 大白话下一步 */
	nextStep?: string;
	cover: string;
	cat: string;
	artifacts: string[];
	/**
	 * 主理人跟踪时间轴（从早到晚）。
	 * 接手任务时：把 owner 改成自己，并往本数组追加一条 { owner, at, note }。
	 */
	ownershipHistory?: OwnershipEvent[];
}

export type InboxKind = "review" | "decide" | "resource" | "follow";

export interface InboxPage {
	h: string;
	p: string[];
}

export interface InboxItem {
	id: string;
	kind: InboxKind;
	title: string;
	hook: string;
	taskRef: string;
	owner: string;
	cover: string;
	pages: InboxPage[];
	status: string;
}

/** 每个 AI 的任务报告/总结（reports/<agentId>.json）：taskRef 为任务号或短标签 */
export interface Report {
	taskRef: string;
	at: string;
	text: string;
}

export const INBOX_KIND_META: Record<
	InboxKind,
	{ label: string; emoji: string }
> = {
	review: { label: "验收", emoji: "🔍" },
	decide: { label: "拍板", emoji: "⚖️" },
	resource: { label: "要资源", emoji: "🔑" },
	follow: { label: "跟进", emoji: "📌" },
};

export function ownerToAgentId(owner: string): string {
	const o = owner.toLowerCase();
	if (o.includes("deepseek")) return "deepseek";
	if (o.includes("bigmodel") || o.includes("glm")) return "bigmodel";
	if (o.includes("codex")) return "codex";
	if (o.includes("cursor")) return "cursor";
	return "user";
}

export function isClaimActive(status: string): boolean {
	return /^(active|running|doing|in[- ]?progress|进行中)/i.test(status.trim());
}

/** 客户端进程快照缓存（跨请求短缓存，避免每次打开看板都跑慢速 tasklist） */
let _procCache: { at: number; names: Set<string> } | null = null;
let _procFailed = false;
const PROCESS_TTL_MS = 30_000;
const PROC_CACHE_FILE = path.join(
	process.cwd(),
	".ai-work",
	"agent-proc-cache.json",
);

function readProcFileCache(): Set<string> | null {
	try {
		const raw = JSON.parse(fs.readFileSync(PROC_CACHE_FILE, "utf8")) as {
			at?: number;
			names?: string[];
		};
		if (!raw.at || !Array.isArray(raw.names)) return null;
		if (Date.now() - raw.at > PROCESS_TTL_MS) return null;
		return new Set(raw.names.map((n) => n.toLowerCase()));
	} catch {
		return null;
	}
}

function writeProcFileCache(names: Set<string>): void {
	try {
		fs.mkdirSync(path.dirname(PROC_CACHE_FILE), { recursive: true });
		fs.writeFileSync(
			PROC_CACHE_FILE,
			`${JSON.stringify({ at: Date.now(), names: [...names] })}\n`,
			"utf8",
		);
	} catch {
		/* 本地缓存写失败不影响看板 */
	}
}

/**
 * 只探测候选进程名。有短缓存则同步返回；缓存未命中时不阻塞首屏，
 * 后台暖缓存，本轮用心跳状态顶上（避免每次打开看板卡 1–2 秒）。
 */
function probeRunningProcessNames(candidates: string[]): Set<string> | null {
	if (_procFailed) return null;
	const now = Date.now();
	if (_procCache && now - _procCache.at < PROCESS_TTL_MS)
		return _procCache.names;
	const fileCached = readProcFileCache();
	if (fileCached) {
		_procCache = { at: now, names: fileCached };
		return fileCached;
	}
	scheduleProcRefresh(candidates);
	return null;
}

let _procRefreshing = false;
function scheduleProcRefresh(candidates: string[]): void {
	if (_procRefreshing || _procFailed) return;
	_procRefreshing = true;
	const needles = [
		...new Set(
			candidates
				.map((n) =>
					n
						.trim()
						.toLowerCase()
						.replace(/\.exe$/i, ""),
				)
				.filter(Boolean),
		),
	];
	const run = () => {
		try {
			if (needles.length === 0) {
				_procCache = { at: Date.now(), names: new Set() };
				writeProcFileCache(_procCache.names);
				return;
			}
			const listed = needles.map((n) => `'${n.replace(/'/g, "''")}'`).join(",");
			const out = execSync(
				`powershell -NoProfile -Command "Get-Process -Name ${listed} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName"`,
				{ encoding: "utf8", windowsHide: true, timeout: 2500 },
			);
			const names = new Set(
				out
					.split(/\r?\n/)
					.map((line) => line.trim().toLowerCase())
					.filter(Boolean),
			);
			_procCache = { at: Date.now(), names };
			writeProcFileCache(names);
		} catch {
			_procFailed = true;
		} finally {
			_procRefreshing = false;
		}
	};
	// 不挡本次 SSR；下一趟打开看板即可命中缓存
	setTimeout(run, 0);
}

/** 打开看板前先暖一次缓存，避免每个 agent 各探测一次 */
export function warmAgentProcessCache(agents: AgentInfo[]): void {
	const candidates = agents.flatMap((a) => a.processNames ?? []);
	probeRunningProcessNames(candidates);
}

/**
 * 该 AI 的客户端进程是否在本机打开——「离线」的唯一依据（老板 2026-09-07 定）。
 * - agent 未配置 processNames → null（未知，不强制判离线）
 * - 探测不可用（远程构建/非 Windows）→ null（未知）
 */
export function isAgentClientOnline(agent: AgentInfo): boolean | null {
	if (!agent.processNames || agent.processNames.length === 0) return null;
	const running = probeRunningProcessNames(agent.processNames);
	if (!running) return null;
	const needles = agent.processNames.map((p) =>
		p.toLowerCase().replace(/\.exe$/i, ""),
	);
	return needles.some((needle) =>
		[...running].some((name) => name.includes(needle)),
	);
}

/** 心跳文件：每位 AI 在工作开始时把 state 写成 working、干完停下时写成 idle（本地、gitignore） */
const PRESENCE_FILE = path.join(
	process.cwd(),
	".ai-work",
	"agent-presence.json",
);
/** 心跳超过该时长未更新 → 视为已停下（空闲），即使还标着 working */
const PRESENCE_STALE_MS = 10 * 60 * 1000;
const PRESENCE_TTL_MS = 2000;

let _presenceCache: {
	at: number;
	data: Record<string, { state?: string; at?: string }>;
} | null = null;

function getAgentPresence(): Record<string, { state?: string; at?: string }> {
	const now = Date.now();
	if (_presenceCache && now - _presenceCache.at < PRESENCE_TTL_MS) {
		return _presenceCache.data;
	}
	try {
		const data = JSON.parse(fs.readFileSync(PRESENCE_FILE, "utf8")) as Record<
			string,
			{ state?: string; at?: string }
		>;
		_presenceCache = { at: now, data };
		return data;
	} catch {
		return {};
	}
}

/**
 * 该 AI 当前的心跳状态：working（正在干/心跳新鲜）| idle（明说停下或心跳过期）| null（无心跳记录）。
 * 有记录就以心跳为准；无记录返回 null，由调用方回退到任务启发式。
 */
export function getPresenceState(agentId: string): "working" | "idle" | null {
	const p = getAgentPresence()[agentId];
	if (!p) return null;
	if (p.state === "working") {
		const at = p.at ? Date.parse(p.at) : Number.NaN;
		if (!Number.isNaN(at) && Date.now() - at < PRESENCE_STALE_MS)
			return "working";
		return "idle";
	}
	if (p.state === "idle") return "idle";
	return null;
}

export type AgentStatusKey = "working" | "idle" | "offline";

/**
 * 代理实时状态：三态——工作中 / 空闲中 / 离线（老板 2026-09-07 定）。
 * 离线 = 客户端进程没在本机打开（唯一依据）。
 * 在线时「工作中/空闲中」以**心跳**为准（老板 2026-09-07 两次反馈：状态要反映“此刻有没有在干活”）：
 *   - 心跳 working 且新鲜 → 工作中；心跳 idle 或过期 → 空闲中；
 *   - 无心跳记录 → 回退启发式：挂着 doing 任务 = 工作中，否则空闲中（认领卡与 review 不算）。
 * 前提：前两态只在该看板本地在线时才有意义（看板本就是本地工具）。agents.json 的 status 不再参与推导。
 */
export function deriveAgentStatus(
	agent: AgentInfo,
	claims: ClaimCard[],
	tasks: Task[],
): { key: AgentStatusKey; label: string } {
	if (agent.id === "user") {
		return tasks.some((t) => t.owner === "user" && t.state === "doing")
			? { key: "working", label: "亲自干活中" }
			: { key: "idle", label: "待命" };
	}
	const online = isAgentClientOnline(agent);
	if (online === false) {
		return {
			key: "offline",
			label: agent.client ? `离线 · 打开${agent.client}` : "离线",
		};
	}
	// 在线时先看心跳；无心跳记录再回退到 doing 任务启发式。
	const pres = getPresenceState(agent.id);
	if (pres === "working") return { key: "working", label: "工作中" };
	if (pres === "idle") return { key: "idle", label: "空闲中" };
	// 无心跳记录 → 回退：挂着 doing 任务 = 工作中；认领卡与 review 不算。
	const hasDoingTask = tasks.some(
		(t) => ownerToAgentId(t.owner) === agent.id && t.state === "doing",
	);
	if (hasDoingTask) return { key: "working", label: "工作中" };
	return { key: "idle", label: "空闲中" };
}

function parseSectionPaths(raw: string, heading: string): string[] {
	const lines = raw.split(/\r?\n/);
	const paths: string[] = [];
	let inSection = false;
	for (const line of lines) {
		const section = line.match(/^##\s+(.+?)\s*$/);
		if (section) {
			inSection = section[1].trim().toLowerCase() === heading.toLowerCase();
			continue;
		}
		if (!inSection || !/^\s*-\s+/.test(line)) continue;
		const inlineCode = [...line.matchAll(/`([^`]+)`/g)].map(
			(match) => match[1],
		);
		const candidates =
			inlineCode.length > 0
				? inlineCode
				: [
						line
							.replace(/^\s*-\s+/, "")
							.replace(/（.*$/, "")
							.trim(),
					];
		for (const candidate of candidates.flatMap((value) => value.split("、"))) {
			const value = candidate.trim();
			if (!value || /^(none|<none|无$)/i.test(value)) continue;
			paths.push(value);
		}
	}
	return paths;
}

function normalizeClaimPath(value: string): string {
	let normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
	const workspace = process.cwd().replace(/\\/g, "/").replace(/\/$/, "");
	if (normalized.toLowerCase().startsWith(`${workspace.toLowerCase()}/`)) {
		normalized = normalized.slice(workspace.length + 1);
	}
	return normalized.replace(/\/+$/, "").toLowerCase();
}

function claimPathsOverlap(left: string, right: string): boolean {
	const makeScope = (value: string) => {
		const normalized = normalizeClaimPath(value);
		const wildcardAt = normalized.search(/[?*]/);
		const isDirectory = /[\\/]$/.test(value.trim());
		const base = (
			wildcardAt >= 0 ? normalized.slice(0, wildcardAt) : normalized
		).replace(/\/+$/, "");
		return { normalized, base, broad: wildcardAt >= 0 || isDirectory };
	};
	const a = makeScope(left);
	const b = makeScope(right);
	if (!a.normalized || !b.normalized) return false;
	if (a.normalized === b.normalized) return true;
	if (
		a.broad &&
		(b.normalized === a.base || b.normalized.startsWith(`${a.base}/`))
	) {
		return true;
	}
	if (
		b.broad &&
		(a.normalized === b.base || a.normalized.startsWith(`${b.base}/`))
	) {
		return true;
	}
	return (
		a.broad &&
		b.broad &&
		(a.base.startsWith(`${b.base}/`) || b.base.startsWith(`${a.base}/`))
	);
}

export function getClaimConflicts(claims: ClaimCard[]): ClaimConflict[] {
	const active = claims.filter((claim) => isClaimActive(claim.status));
	const conflicts: ClaimConflict[] = [];
	for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
		const left = active[leftIndex];
		const leftPaths = [...left.exclusivePaths, ...left.generatedOutputs];
		for (
			let rightIndex = leftIndex + 1;
			rightIndex < active.length;
			rightIndex += 1
		) {
			const right = active[rightIndex];
			const rightPaths = [...right.exclusivePaths, ...right.generatedOutputs];
			for (const leftPath of leftPaths) {
				for (const rightPath of rightPaths) {
					if (!claimPathsOverlap(leftPath, rightPath)) continue;
					conflicts.push({
						leftClaim: left.file,
						leftOwner: left.owner,
						leftPath,
						rightClaim: right.file,
						rightOwner: right.owner,
						rightPath,
					});
				}
			}
		}
	}
	return conflicts;
}

export function getSharedBoardClaimViolations(
	claims: ClaimCard[],
): SharedBoardClaimViolation[] {
	const violations: SharedBoardClaimViolation[] = [];
	for (const claim of claims.filter((item) => isClaimActive(item.status))) {
		for (const claimedPath of claim.exclusivePaths) {
			if (
				!SHARED_BOARD_PATHS.some((sharedPath) =>
					claimPathsOverlap(claimedPath, sharedPath),
				)
			) {
				continue;
			}
			violations.push({
				claim: claim.file,
				owner: claim.owner,
				path: claimedPath,
			});
		}
	}
	return violations;
}

export function getBoardWriteLock(): BoardWriteLock | null {
	const lockPath = path.join(
		process.cwd(),
		".ai-work",
		"claims",
		".board-write.lock.json",
	);
	if (!fs.existsSync(lockPath)) return null;
	try {
		const value = JSON.parse(
			fs.readFileSync(lockPath, "utf-8"),
		) as Partial<BoardWriteLock>;
		if (!value.owner || !value.task || !value.acquiredAt) return null;
		return {
			owner: value.owner,
			task: value.task,
			acquiredAt: value.acquiredAt,
		};
	} catch {
		return null;
	}
}

let _claimsCache: { at: number; cards: ClaimCard[] } | null = null;
const CLAIMS_TTL_MS = 5_000;

export function getClaims(): ClaimCard[] {
	const now = Date.now();
	if (_claimsCache && now - _claimsCache.at < CLAIMS_TTL_MS) {
		return _claimsCache.cards;
	}
	const dir = path.join(process.cwd(), ".ai-work", "claims");
	if (!fs.existsSync(dir)) return [];
	const out: ClaimCard[] = [];
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith(".md") || f.startsWith(".")) continue;
		try {
			const raw = fs.readFileSync(path.join(dir, f), "utf-8");
			const grab = (re: RegExp): string => {
				const m = raw.match(re);
				return m ? m[1].trim() : "";
			};
			const title = grab(/^#\s+(.+)$/m) || f.replace(/\.md$/, "");
			out.push({
				file: f.replace(/\.md$/, ""),
				owner: grab(/^\s*-\s*Owner:\s*`?([^`\n]+)`?\s*$/m) || "unknown",
				task: title.replace(/^Work claim[^—]*—\s*/, ""),
				status:
					grab(/^\s*-\s*Status:\s*`?([^`\n]+?)\s*(?:（[^）]*）)?`?\s*$/m) ||
					"unknown",
				started: grab(/^\s*-\s*Started:\s*`?([^`\n]+)`?\s*$/m),
				updated: grab(
					/^\s*-\s*(?:Updated|Expected finish):\s*`?([^`\n]+)`?\s*$/m,
				),
				exclusivePaths: parseSectionPaths(raw, "Exclusive paths"),
				generatedOutputs: parseSectionPaths(raw, "Generated outputs"),
			});
		} catch {}
	}
	_claimsCache = { at: now, cards: out };
	return out.sort(
		(a, b) => Number(isClaimActive(b.status)) - Number(isClaimActive(a.status)),
	);
}

export function getClaimsFor(ownerId: string): ClaimCard[] {
	return getClaims().filter((c) => ownerToAgentId(c.owner) === ownerId);
}

export function readDoc(relPathFromCwd: string): string | null {
	const fp = path.join(process.cwd(), relPathFromCwd);
	if (!fs.existsSync(fp)) return null;
	return fs.readFileSync(fp, "utf-8");
}

const REPORTS_DIR = path.join(
	process.cwd(),
	"src",
	"data",
	"agent-board",
	"reports",
);

/** 读取某个 AI 的任务报告/总结（reports/<agentId>.json）；文件不存在或解析失败时返回空数组 */
export function loadReportsFor(agentId: string): Report[] {
	const fp = path.join(REPORTS_DIR, `${agentId}.json`);
	if (!fs.existsSync(fp)) return [];
	try {
		const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as {
			reports?: Report[];
		};
		return Array.isArray(parsed.reports) ? parsed.reports : [];
	} catch {
		return [];
	}
}
