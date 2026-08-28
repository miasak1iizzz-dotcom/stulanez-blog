// Agent 看板数据加载工具 — 认领卡解析 / 工作总结文档读取
// 构建时（Vercel）.ai-work 不存在 → 认领返回空数组；本地 dev 实时读取
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
	"src/data/agent-board/decisions.json",
	"src/data/agent-board/mail.json",
	"src/data/agent-board/experience.json",
	"src/data/agent-board/CURRENT-STATE.md",
] as const;

export interface AgentInfo {
	id: string;
	name: string;
	vendor: string;
	model: string;
	port: number | null;
	color: string;
	role: string;
	status: string;
	currentTask: string | null;
	summaries: string[];
}

export interface Task {
	id: string;
	title: string;
	owner: string;
	state: string;
	priority: string;
	deps: string[];
	brief: string;
	artifacts: string[];
}

export interface Decision {
	id: string;
	question: string;
	options: string[];
	recommendation: string;
	status: string;
	askedBy: string;
}

export interface Msg {
	id: string;
	from: string;
	to: string;
	type: string;
	task: string;
	body: string;
	reply: string | null;
	time: string;
	status: string;
}

export interface Exp {
	id: string;
	domain: string;
	title: string;
	scenario: string;
	method: string;
	pitfall?: string;
	date: string;
}

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

export function getClaims(): ClaimCard[] {
	const dir = path.join(process.cwd(), ".ai-work", "claims");
	if (!fs.existsSync(dir)) return [];
	const out: ClaimCard[] = [];
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith(".md")) continue;
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
