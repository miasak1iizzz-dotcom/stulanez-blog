import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type LibraryGroup = "protocol" | "log" | "history";
export interface LibraryEntry {
	id: string;
	title: string;
	group: LibraryGroup;
	topic: string;
	source: string;
	updated: string;
	summary: string;
}
export interface LibrarySection {
	id: string;
	title: string;
	body: string;
}
export interface LibraryDocument extends LibraryEntry {
	body: string;
	sections: LibrarySection[];
	absolutePath: string;
}

const documents = [
	["entry", "AI 工作总入口", "通用", "AGENTS.md"],
	["index", "按任务查规则", "通用", "docs/ai/INDEX.md"],
	["coordination", "写入与协作", "通用", "docs/ai/coordination.md"],
	["board", "看板公共协议", "看板", "docs/ai/board.md"],
	["desires", "欲望滋生室", "看板", "docs/ai/board-desires.md"],
	["tasks", "协作指挥与任务卡", "看板", "docs/ai/board-tasks.md"],
	["inbox", "等你过目与反馈", "看板", "docs/ai/board-inbox.md"],
	["team", "AI 团队与工作报告", "看板", "docs/ai/board-team.md"],
	["library", "协议与日志书使用约定", "看板", "docs/ai/board-library.md"],
	["site", "网站代码与验证", "网站", "docs/ai/site.md"],
	["content", "文章创作与 Grok 封面", "网站", "docs/CONTENT-PUBLISHING.md"],
	["assets", "图库与数字资产", "图库", "docs/ai/assets.md"],
	["deployment", "部署、域名与公网边界", "部署", "docs/ai/deployment.md"],
	["memory", "协议与记忆维护", "通用", "docs/ai/memory.md"],
] as const;
const archives = [
	["history-index", "历史与记忆索引", "索引", "docs/ai/HISTORY.md"],
	["migration", "协议整理记录 · 09.09", "交接", "docs/ai/MIGRATION.md"],
	[
		"old-protocol",
		"整理前的协作协议",
		"旧协议",
		"docs/ai/reference/collaboration-2026-09-09.md",
	],
	[
		"architecture",
		"旧架构参考",
		"架构",
		"docs/ai/reference/site-architecture.md",
	],
	[
		"asset-origin",
		"数字资产库的初衷与旧规格",
		"图库",
		".ai-work/asset-library-spec.md",
	],
	[
		"kpop-desire",
		"爱豆图库 · 欲望讨论",
		"欲望",
		".ai-work/memory/desire-kpop-2026-09-09.md",
	],
] as const;
const reportOwners = ["codex", "cursor", "deepseek", "bigmodel"] as const;

// Only these explicitly selected sources are readable. Never accept a path from a request.
const allowedSources = new Set<string>([
	...documents.map((d) => d[3]),
	...archives.map((d) => d[3]),
	"src/data/agent-board/CURRENT-STATE.md",
	"src/data/agent-board/experience.json",
	...reportOwners.map((owner) => `src/data/agent-board/reports/${owner}.json`),
]);

function readSource(source: string): {
	text: string;
	updated: string;
	absolutePath: string;
} {
	if (!allowedSources.has(source)) throw new Error("资料不在目录中");
	const root = fs.realpathSync(process.cwd());
	const file = fs.realpathSync(path.join(root, source));
	const relative = path.relative(root, file);
	if (relative.startsWith("..") || path.isAbsolute(relative))
		throw new Error("资料路径不可用");
	const stat = fs.statSync(file);
	if (!stat.isFile() || stat.size > 2_000_000)
		throw new Error("资料过大或不可读取");
	return {
		text: redact(fs.readFileSync(file, "utf8")),
		updated: stat.mtime.toISOString(),
		absolutePath: file.replaceAll("\\", "/"),
	};
}

function redact(text: string): string {
	return text
		.replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/g, "[凭证已隐藏]")
		.replace(/\bBearer\s+[A-Za-z0-9._~+/-]{12,}/gi, "Bearer [已隐藏]")
		.replace(
			/((?:api[_-]?key|access[_-]?token|secret|cookie)\s*[=:]\s*)[^\s,;，；]{8,}/gi,
			"$1[已隐藏]",
		);
}

function excerpt(text: string, limit = 200): string {
	return text
		.replace(/^#+\s+.*$/gm, "")
		.replace(/[*`>#]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, limit);
}

export function splitLibrarySections(body: string): LibrarySection[] {
	const result: LibrarySection[] = [];
	let title = "正文";
	let lines: string[] = [];
	let fence = false;
	const flush = () => {
		const text = lines.join("\n").trim();
		if (text)
			result.push({ id: `section-${result.length + 1}`, title, body: text });
		lines = [];
	};
	for (const line of body.split(/\r?\n/)) {
		if (/^\s*```/.test(line)) fence = !fence;
		const heading = !fence && line.match(/^#{1,3}\s+(.+)$/);
		if (heading) {
			flush();
			title = heading[1];
		} else lines.push(line);
	}
	flush();
	return result.length ? result : [{ id: "section-1", title: "正文", body }];
}

function makeDocument(
	entry: LibraryEntry,
	body: string,
	absolutePath: string,
): LibraryDocument {
	return { ...entry, body, sections: splitLibrarySections(body), absolutePath };
}

export function loadProtocolLibrary(
	id?: string,
): LibraryEntry[] | LibraryDocument | null {
	const entries: LibraryEntry[] = [];
	let found: LibraryDocument | null = null;
	const add = (entry: LibraryEntry, body: string, absolutePath: string) => {
		entries.push(entry);
		if (entry.id === id) found = makeDocument(entry, body, absolutePath);
	};
	for (const [group, configs] of [
		["protocol", documents],
		["history", archives],
	] as const) {
		for (const [key, title, topic, source] of configs) {
			if (id && id !== key) continue;
			try {
				const file = readSource(source);
				add(
					{
						id: key,
						title,
						group,
						topic,
						source,
						updated: file.updated,
						summary: excerpt(file.text),
					},
					file.text,
					file.absolutePath,
				);
			} catch {
				// A local-only source may not exist in another checkout; retain a useful catalog entry.
				if (!id)
					entries.push({
						id: key,
						title,
						group,
						topic,
						source,
						updated: "",
						summary: "本机暂无该资料，选择后可重试。",
					});
			}
		}
	}
	const stateSource = "src/data/agent-board/CURRENT-STATE.md";
	if (!id || id === "current-state") {
		try {
			const file = readSource(stateSource);
			add(
				{
					id: "current-state",
					title: "当前工作现状",
					group: "log",
					topic: "现状",
					source: stateSource,
					updated: file.updated,
					summary: "当前任务、交接与待办；具体决定以对应任务最新记录为准。",
				},
				file.text,
				file.absolutePath,
			);
		} catch {
			/* no local state */
		}
	}
	for (const owner of reportOwners) {
		if (id && !id.startsWith(`report-${owner}-`)) continue;
		const source = `src/data/agent-board/reports/${owner}.json`;
		try {
			const file = readSource(source);
			const data = JSON.parse(file.text) as {
				reports?: { taskRef?: string; at?: string; text?: string }[];
			};
			const seen = new Set<string>();
			for (const report of data.reports ?? []) {
				if (typeof report.text !== "string") continue;
				const digest = createHash("sha256")
					.update(JSON.stringify(report))
					.digest("hex")
					.slice(0, 16);
				const key = `report-${owner}-${digest}`;
				if (seen.has(key)) continue;
				seen.add(key);
				if (id && id !== key) continue;
				add(
					{
						id: key,
						title: `${report.taskRef || "工作记录"} · ${owner}`,
						group: "log",
						topic: owner,
						source,
						updated: report.at || file.updated,
						summary: excerpt(report.text),
					},
					report.text,
					file.absolutePath,
				);
			}
		} catch {
			/* a broken report file does not hide the remaining library */
		}
	}
	if (!id || id.startsWith("experience-")) {
		const source = "src/data/agent-board/experience.json";
		try {
			const file = readSource(source);
			const data = JSON.parse(file.text) as {
				entries?: Record<string, unknown>[];
			};
			for (const item of data.entries ?? []) {
				if (typeof item.id !== "string") continue;
				const key = `experience-${item.id}`;
				if (id && id !== key) continue;
				const body = Object.entries(item)
					.filter(([k, v]) => k !== "id" && typeof v === "string")
					.map(([k, v]) => `${k}：${v}`)
					.join("\n\n");
				add(
					{
						id: key,
						title: `${item.id} · ${String(item.title ?? "工作经验")}`,
						group: "log",
						topic: "经验",
						source,
						updated: String(item.date ?? file.updated),
						summary: excerpt(body),
					},
					body,
					file.absolutePath,
				);
			}
		} catch {
			/* optional local experience source */
		}
	}
	return id ? found : entries;
}
