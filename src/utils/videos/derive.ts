import { formatClock } from "./clock";
import type {
	VideoDigestResult,
	VideoFlashcard,
	VideoMindNode,
	VideoSlide,
} from "./types";

export interface LaidNode {
	id: string;
	title: string;
	time?: string;
	x: number;
	y: number;
	w: number;
	h: number;
	depth: number;
}

export interface LaidEdge {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const NODE_W = 176;
const NODE_H = 42;
const GAP_X = 44;
const GAP_Y = 12;

function stampOf(text: string): string {
	return /^(\d{1,2}:\d{2}(?::\d{2})?)/.exec(text.trim())?.[1] || "";
}

function short(text: string, max = 18): string {
	const cleaned = text.replace(/\s+/g, " ").trim();
	return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export function deriveMindmap(note: VideoDigestResult): VideoMindNode {
	return {
		id: "root",
		title: short(note.meta.title, 22),
		children: [
			{ id: "tldr", title: short(note.tldr, 28) },
			{
				id: "know",
				title: "知识卡片",
				children: (note.cards || []).slice(0, 8).map((card, i) => ({
					id: `k${i}`,
					title: short(card.title, 16),
					time: stampOf(card.body),
				})),
			},
			{
				id: "ch",
				title: "章节",
				children: (note.chapters || []).map((chapter, i) => ({
					id: `c${i}`,
					title: short(chapter.title, 16),
					time: chapter.time,
				})),
			},
		],
	};
}

export function deriveFlashcards(note: VideoDigestResult): VideoFlashcard[] {
	const cards = (note.cards || []).map((card) => ({
		q: card.title,
		a: card.body,
		time: stampOf(card.body),
	}));
	if (cards.length >= 6) return cards.slice(0, 12);
	for (const chapter of note.chapters || []) {
		if (cards.length >= 10) break;
		cards.push({
			q: chapter.title,
			a: chapter.summary,
			time: chapter.time,
		});
	}
	return cards;
}

export function deriveSlides(note: VideoDigestResult): VideoSlide[] {
	const bullets = (note.points || [])
		.slice(0, 5)
		.map((row) => row.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, ""));
	const title: VideoSlide = {
		time: "00:00",
		title: note.meta.title,
		body: note.tldr,
		bullets,
	};
	const rest = (note.chapters || []).map((chapter) => ({
		time: chapter.time,
		title: chapter.title,
		body: chapter.summary,
		bullets: chapter.summary
			.split(/[。；;]/)
			.map((row) => row.trim())
			.filter((row) => row.length > 8)
			.slice(0, 4),
	}));
	return [title, ...rest];
}

export function deriveArticle(note: VideoDigestResult): string {
	const length = note.meta.duration ? formatClock(note.meta.duration) : "";
	return [
		`# ${note.meta.title}`,
		"",
		[note.meta.up, length, note.meta.url].filter(Boolean).join(" · "),
		"",
		`> ${note.tldr}`,
		"",
		"## 要点",
		"",
		...(note.points || []).map((point) => `- ${point}`),
		"",
		"## 知识卡片",
		"",
		...(note.cards || []).flatMap((card) => [
			`### ${card.title}`,
			"",
			card.body,
			"",
		]),
		"## 按时间轴",
		"",
		...(note.chapters || []).flatMap((chapter) => [
			`### ${chapter.time} ${chapter.title}`,
			"",
			chapter.summary,
			"",
		]),
	].join("\n");
}

export function deriveProducts(
	note: VideoDigestResult,
): Pick<VideoDigestResult, "mindmap" | "flashcards" | "slides" | "article"> {
	return {
		mindmap: note.mindmap || deriveMindmap(note),
		flashcards: note.flashcards?.length
			? note.flashcards
			: deriveFlashcards(note),
		slides: note.slides?.length ? note.slides : deriveSlides(note),
		article: note.article || deriveArticle(note),
	};
}

function subtreeHeight(node: VideoMindNode): number {
	if (!node.children?.length) return NODE_H;
	return Math.max(
		NODE_H,
		node.children.reduce((sum, child) => sum + subtreeHeight(child), 0) +
			GAP_Y * (node.children.length - 1),
	);
}

export function layoutMind(root: VideoMindNode): {
	nodes: LaidNode[];
	edges: LaidEdge[];
	width: number;
	height: number;
} {
	const nodes: LaidNode[] = [];
	const edges: LaidEdge[] = [];

	function walk(node: VideoMindNode, depth: number, x: number, top: number) {
		const block = subtreeHeight(node);
		const y = top + (block - NODE_H) / 2;
		nodes.push({
			id: node.id,
			title: node.title,
			time: node.time,
			x,
			y,
			w: NODE_W,
			h: NODE_H,
			depth,
		});
		let childTop = top;
		for (const child of node.children || []) {
			const childBlock = subtreeHeight(child);
			edges.push({
				x1: x + NODE_W,
				y1: y + NODE_H / 2,
				x2: x + NODE_W + GAP_X,
				y2: childTop + childBlock / 2,
			});
			walk(child, depth + 1, x + NODE_W + GAP_X, childTop);
			childTop += childBlock + GAP_Y;
		}
	}

	walk(root, 0, 8, 8);
	const width = Math.max(640, ...nodes.map((node) => node.x + node.w + 24));
	const height = Math.max(280, subtreeHeight(root) + 24);
	return { nodes, edges, width, height };
}

export function mermaidOf(note: VideoDigestResult): string {
	const root = note.mindmap || deriveMindmap(note);
	const lines = ["mindmap", `  root((${root.title.replace(/[()]/g, "")}))`];
	for (const branch of root.children || []) {
		lines.push(`    ${branch.title}`);
		for (const leaf of branch.children || []) {
			lines.push(`      ${leaf.title}`);
		}
	}
	return lines.join("\n");
}

export function ankiCsv(note: VideoDigestResult): string {
	const cards = note.flashcards?.length
		? note.flashcards
		: deriveFlashcards(note);
	const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
	return [
		"问题,答案,时间",
		...cards.map((card) =>
			[esc(card.q), esc(card.a), esc(card.time || "")].join(","),
		),
	].join("\n");
}
