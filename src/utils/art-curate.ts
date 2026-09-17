/**
 * 浏览器端判图 —— 站长策展台用。
 *
 * 与本地管线 scripts/art-scan.ts 共用 src/utils/art-rules.ts 的判定规则，
 * 保证「浏览器里看到的标签」和「管线跑出来的标签」是同一套。
 * 全部在本机浏览器内完成：不上传、不联网。
 */
import type { ArtManifestAuto, ArtManifestItem, ArtManifestTags } from "@/types/artManifest";
import { dhashFromGray, detectUses, gradeOf, paletteFromRgb, ratioLabel } from "./art-rules";

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;
const SKIP_DIR = /^(?:\.|_代|_隔离|thumbs?$)|隔离|待删/;
const THUMB_WIDTHS = [480, 1280];
const THUMB_QUALITY = 0.8;

/** 目录句柄最小契约（浏览器 File System Access API 的子集）。 */
export interface CurateFileHandle {
	kind: "file";
	name: string;
	getFile(): Promise<File>;
}
export interface CurateDirectoryHandle {
	kind: "directory";
	name: string;
	values(): AsyncIterable<CurateDirectoryHandle | CurateFileHandle>;
}

export interface CurateItem {
	/** 内容哈希前 16 位，与管线一致 */
	id: string;
	/** 清单里的目标 key（阶段 2 上传后生效） */
	key: string;
	name: string;
	/** 相对所选目录的路径 */
	path: string;
	width: number;
	height: number;
	bytes: number;
	format: string;
	ratio: string;
	auto: ArtManifestAuto;
	tags: ArtManifestTags;
	public: boolean;
	addedAt: string;
	/** 浏览器内生成的缩略图，键为宽度 */
	thumbs: Record<string, Blob>;
	/** 给界面预览用的 480 缩略图地址（记得 revoke） */
	previewUrl: string;
	/** 同内容的其他文件名 */
	duplicates: string[];
	/** 原始文件，将来直传对象存储时用 */
	file: File;
}

export interface CurateProgress {
	done: number;
	total: number;
	current: string;
}

function shard(id: string): string {
	return id.slice(0, 2);
}

async function sha1Id(file: File): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-1", await file.arrayBuffer());
	const bytes = new Uint8Array(digest).slice(0, 8);
	return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("画布不可用");
	return { canvas, ctx };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("缩略图编码失败"))), "image/webp", THUMB_QUALITY);
	});
}

/** 判一张图：哈希、尺寸、主色、感知哈希、两档缩略图。 */
export async function analyzeFile(file: File, path: string, addedAt: string): Promise<CurateItem> {
	const [id, bitmap] = await Promise.all([sha1Id(file), createImageBitmap(file)]);
	const { width, height } = bitmap;
	try {
		// 主色与明暗：16×16
		const small = makeCanvas(16, 16);
		small.ctx.drawImage(bitmap, 0, 0, 16, 16);
		const smallData = small.ctx.getImageData(0, 0, 16, 16);
		const palette = paletteFromRgb(smallData.data, 16, 16, 4);

		// 感知哈希：9×8 灰度
		const tiny = makeCanvas(9, 8);
		tiny.ctx.drawImage(bitmap, 0, 0, 9, 8);
		const tinyData = tiny.ctx.getImageData(0, 0, 9, 8).data;
		const gray = new Uint8Array(9 * 8);
		for (let i = 0; i < gray.length; i++) {
			const r = tinyData[i * 4] ?? 0;
			const g = tinyData[i * 4 + 1] ?? 0;
			const b = tinyData[i * 4 + 2] ?? 0;
			gray[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
		}
		const dhash = dhashFromGray(gray, 9);

		// 两档缩略图
		const thumbs: Record<string, Blob> = {};
		let previewUrl = "";
		for (const target of THUMB_WIDTHS) {
			const scale = Math.min(1, target / width);
			const w = Math.max(1, Math.round(width * scale));
			const h = Math.max(1, Math.round(height * scale));
			const { canvas, ctx } = makeCanvas(w, h);
			ctx.drawImage(bitmap, 0, 0, w, h);
			const blob = await canvasToBlob(canvas);
			thumbs[String(target)] = blob;
			if (target === 480) previewUrl = URL.createObjectURL(blob);
		}
		if (!previewUrl && thumbs["480"]) previewUrl = URL.createObjectURL(thumbs["480"]);

		const bytes = file.size;
		return {
			id,
			key: `art/img/${shard(id)}/${id}.${(file.type.split("/")[1] || "jpg").replace("jpeg", "jpg")}`,
			name: path.split("/").pop() ?? path,
			path,
			width,
			height,
			bytes,
			format: file.type.split("/")[1] || "unknown",
			ratio: ratioLabel(width, height),
			auto: {
				uses: detectUses({ width, height, bytes }),
				grade: gradeOf(Math.max(width, height)),
				colors: palette.colors,
				dhash,
				brightness: palette.brightness,
				saturation: palette.saturation,
				hasExif: false,
				faces: null,
				nsfw: null,
			},
			tags: { category: "", group: "", member: "", style: "", source: "", year: "", theme: [] },
			public: false,
			addedAt,
			thumbs,
			previewUrl,
			duplicates: [],
			file,
		};
	} finally {
		bitmap.close();
	}
}

/** 递归收集目录里的图片文件（跳过隐藏、隔离、待删、缩略图目录）。 */
async function collectFiles(root: CurateDirectoryHandle): Promise<{ path: string; handle: CurateFileHandle }[]> {
	const out: { path: string; handle: CurateFileHandle }[] = [];
	const stack = [{ handle: root, prefix: root.name }];
	while (stack.length) {
		const current = stack.pop() as { handle: CurateDirectoryHandle; prefix: string };
		for await (const entry of current.handle.values()) {
			const path = `${current.prefix}/${entry.name}`;
			if (entry.kind === "directory") {
				if (!SKIP_DIR.test(entry.name)) stack.push({ handle: entry, prefix: path });
			} else if (IMAGE_EXT.test(entry.name)) {
				out.push({ path, handle: entry });
			}
		}
	}
	return out.sort((a, b) => a.path.localeCompare(b.path, "zh-CN", { numeric: true }));
}

/**
 * 读整个目录并判图。逐张回调进度，可中断。
 * 同一内容（哈希相同）只留一条，其余记进 duplicates。
 */
export async function readCurateDirectory(
	root: CurateDirectoryHandle,
	onProgress: (progress: CurateProgress) => void,
	signal?: AbortSignal,
	concurrency = 4,
): Promise<CurateItem[]> {
	const files = await collectFiles(root);
	const total = files.length;
	const items: CurateItem[] = [];
	const addedAt = new Date().toISOString().slice(0, 10);
	let done = 0;
	const queue = [...files];

	async function worker(): Promise<void> {
		while (queue.length) {
			signal?.throwIfAborted();
			const target = queue.shift() as { path: string; handle: CurateFileHandle };
			try {
				const file = await target.handle.getFile();
				const item = await analyzeFile(file, target.path, addedAt);
				items.push(item);
			} catch (error) {
				if ((error as Error).name === "AbortError") throw error;
				console.warn("跳过（判图失败）", target.path, error);
			}
			done++;
			onProgress({ done, total, current: target.path });
		}
	}
	await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

	// 字节级去重
	const dedup = new Map<string, CurateItem>();
	for (const item of items) {
		const prev = dedup.get(item.id);
		if (prev) {
			prev.duplicates.push(item.path);
			URL.revokeObjectURL(item.previewUrl);
			continue;
		}
		dedup.set(item.id, item);
	}
	return [...dedup.values()].sort((a, b) => a.path.localeCompare(b.path, "zh-CN", { numeric: true }));
}

/** 释放该条目的预览地址。 */
export function revokeItem(item: CurateItem): void {
	if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

/** 把策展结果转成清单条目（去掉浏览器专属字段）。 */
export function toManifestItem(item: CurateItem): ArtManifestItem {
	return {
		id: item.id,
		key: item.key,
		thumbs: Object.fromEntries(THUMB_WIDTHS.map(w => [String(w), `art/thumb/${shard(item.id)}/${item.id}-${w}.webp`])),
		width: item.width,
		height: item.height,
		bytes: item.bytes,
		format: item.format,
		ratio: item.ratio,
		auto: item.auto,
		tags: item.tags,
		public: item.public,
		addedAt: item.addedAt,
		origin: item.duplicates.length ? { path: item.path, duplicates: item.duplicates } : { path: item.path },
	};
}
