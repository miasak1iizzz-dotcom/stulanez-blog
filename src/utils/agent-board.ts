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
}

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
				status: grab(/^\s*-\s*Status:\s*`?([^`\n]+?)\s*(?:（[^）]*）)?`?\s*$/m) || "unknown",
				started: grab(/^\s*-\s*Started:\s*`?([^`\n]+)`?\s*$/m),
				updated: grab(/^\s*-\s*(?:Updated|Expected finish):\s*`?([^`\n]+)`?\s*$/m),
			});
		} catch {}
	}
	return out.sort((a, b) => (a.status.startsWith("active") ? -1 : 0) - (b.status.startsWith("active") ? -1 : 0));
}

export function getClaimsFor(ownerId: string): ClaimCard[] {
	return getClaims().filter((c) => ownerToAgentId(c.owner) === ownerId);
}

export function readDoc(relPathFromCwd: string): string | null {
	const fp = path.join(process.cwd(), relPathFromCwd);
	if (!fs.existsSync(fp)) return null;
	return fs.readFileSync(fp, "utf-8");
}
