#!/usr/bin/env node
/**
 * art-scan — 艺术馆判图管线
 *
 * 只在本机运行，不联网、不上传。扫描一个本地目录，对每张图片做客观判定，
 * 产出 manifest.json（站上页面唯一真相源）与两档缩略图。
 * 判定规则来自 src/utils/art-rules.ts，与浏览器策展台共用同一份。
 *
 * 用法：
 *   npx tsx scripts/art-scan.ts --in "public/assets/images/wallpaper" --out public/art
 *   npx tsx scripts/art-scan.ts --in "素材/壁纸" --out .ai-work/art-scan --limit 50 --no-thumb
 *
 * 说明见 docs/ai/art-museum-spec.md §4 / §5.1。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { dhashFromGray, detectUses, gradeOf, paletteFromRgb, ratioLabel } from "../src/utils/art-rules";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tiff", ".tif"]);
const SKIP_DIR = /^(?:\.|_代|_隔离|thumbs?$)|隔离|待删/;
const CONCURRENCY = 6;
const THUMB_WIDTHS = [480, 1280];
const BASE_URL = "https://img.stulanez.com"; // 阶段 2 接 R2 自定义域后生效

interface Options {
	inp: string;
	out: string;
	limit: number;
	thumb: boolean;
	madeDirs: Set<string>;
}

interface ArtItem {
	id: string;
	key: string;
	thumbs: Record<string, string>;
	width: number;
	height: number;
	bytes: number;
	format: string;
	ratio: string;
	auto: {
		uses: string[];
		grade: string;
		colors: string[];
		dhash: string;
		brightness: number;
		saturation: number;
		hasExif: boolean;
		faces: number | null;
		nsfw: number | null;
	};
	tags: { category: string; group: string; member: string; style: string; source: string; year: string; theme: string[] };
	public: boolean;
	addedAt: string;
	origin: { path: string; duplicates?: string[] };
	_source?: string;
}

function parseArgs(argv: string[]): Options {
	const out: Options = { inp: "", out: ".ai-work/art-scan", limit: 0, thumb: true, madeDirs: new Set() };
	for (let i = 0; i < argv.length; i++) {
		const key = argv[i];
		if (key === "--in") out.inp = argv[++i] ?? "";
		else if (key === "--out") out.out = argv[++i] ?? "";
		else if (key === "--limit") out.limit = Number(argv[++i]) || 0;
		else if (key === "--no-thumb") out.thumb = false;
	}
	return out;
}

async function walk(root: string): Promise<string[]> {
	const found: string[] = [];
	const stack = [root];
	while (stack.length) {
		const dir = stack.pop() as string;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIR.test(entry.name)) stack.push(full);
				continue;
			}
			if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) found.push(full);
		}
	}
	return found.sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}

async function analyze(file: string, root: string, options: Options): Promise<ArtItem | null> {
	const buffer = await readFile(file);
	const meta = await sharp(buffer).metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	if (!width || !height) return null;
	const id = createHash("sha1").update(buffer).digest("hex").slice(0, 16);

	const [gray, palette] = await Promise.all([
		sharp(buffer).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer(),
		sharp(buffer).resize(16, 16, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true }),
	]);
	const dhash = dhashFromGray(gray, 9);
	const colors = paletteFromRgb(palette.data, palette.info.width, palette.info.height, palette.info.channels);
	const rel = path.relative(root, file).split(path.sep).join("/");
	const bytes = buffer.length;

	const thumbs: Record<string, string> = {};
	if (options.thumb) {
		const shard = id.slice(0, 2);
		if (!options.madeDirs.has(shard)) {
			await mkdir(path.join(options.out, "thumb", shard), { recursive: true });
			options.madeDirs.add(shard);
		}
		for (const w of THUMB_WIDTHS) {
			const name = `${id}-${w}.webp`;
			await sharp(buffer)
				.resize({ width: w, withoutEnlargement: true })
				.webp({ quality: 80 })
				.toFile(path.join(options.out, "thumb", shard, name));
			thumbs[String(w)] = `art/thumb/${shard}/${name}`;
		}
	}

	return {
		id,
		key: `art/img/${id.slice(0, 2)}/${id}.${(meta.format ?? "jpg").replace("jpeg", "jpg")}`,
		thumbs,
		width,
		height,
		bytes,
		format: meta.format ?? "unknown",
		ratio: ratioLabel(width, height),
		auto: {
			uses: detectUses({ width, height, bytes }),
			grade: gradeOf(Math.max(width, height)),
			colors: colors.colors,
			dhash,
			brightness: colors.brightness,
			saturation: colors.saturation,
			hasExif: Boolean(meta.exif),
			faces: null,
			nsfw: null,
		},
		tags: { category: "", group: "", member: "", style: "", source: "", year: "", theme: [] },
		public: false,
		addedAt: new Date().toISOString().slice(0, 10),
		origin: { path: rel },
		_source: file,
	};
}

async function run(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	if (!options.inp) {
		console.error("用法: npx tsx scripts/art-scan.ts --in <目录> [--out <目录>] [--limit N] [--no-thumb]");
		process.exit(1);
	}
	const root = path.resolve(options.inp);
	const rootStat = await stat(root).catch(() => null);
	if (!rootStat) {
		console.error(`目录不存在: ${root}`);
		process.exit(1);
	}
	options.out = path.resolve(options.out);
	await mkdir(path.join(options.out, "thumb"), { recursive: true });

	let files = await walk(root);
	if (options.limit) files = files.slice(0, options.limit);
	console.log(`扫描 ${root}\n找到 ${files.length} 张图片，开始判图…`);

	const items: ArtItem[] = [];
	let done = 0;
	const started = Date.now();
	const queue = [...files];
	async function worker(): Promise<void> {
		while (queue.length) {
			const file = queue.shift() as string;
			try {
				const item = await analyze(file, root, options);
				if (item) {
					// 本机绝对路径不进清单（清单将来是公开的）
					const clean = { ...item };
					delete clean._source;
					items.push(clean);
				}
			} catch (error) {
				console.warn(`跳过（判图失败）: ${path.relative(root, file)} — ${(error as Error).message}`);
			}
			done++;
			if (done % 50 === 0 || done === files.length) console.log(`  ${done}/${files.length}`);
		}
	}
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	// 字节级重复（sha1 相同）合并为一条，其余来源记进 origin.duplicates
	const dedup = new Map<string, ArtItem>();
	for (const item of items) {
		const prev = dedup.get(item.id);
		if (prev) {
			prev.origin.duplicates = [...(prev.origin.duplicates ?? []), item.origin.path];
			continue;
		}
		dedup.set(item.id, item);
	}
	const finalItems = [...dedup.values()].sort((a, b) => a.origin.path.localeCompare(b.origin.path, "zh-CN", { numeric: true }));

	const manifest = {
		version: 1,
		updatedAt: new Date().toISOString(),
		generator: "art-scan/0.2",
		baseUrl: BASE_URL,
		items: finalItems,
	};
	await writeFile(path.join(options.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

	// 概要：用途分布、等级分布、体积、重复
	const useCount = new Map<string, number>();
	for (const item of finalItems) for (const use of item.auto.uses) useCount.set(use, (useCount.get(use) ?? 0) + 1);
	const gradeCount = new Map<string, number>();
	for (const item of finalItems) gradeCount.set(item.auto.grade, (gradeCount.get(item.auto.grade) ?? 0) + 1);
	const exactDupes = finalItems.filter(item => item.origin.duplicates?.length);
	const byDhash = new Map<string, string[]>();
	for (const item of finalItems) {
		const list = byDhash.get(item.auto.dhash) ?? [];
		list.push(item.id);
		byDhash.set(item.auto.dhash, list);
	}
	const similarGroups = [...byDhash.values()].filter(list => list.length > 1);
	const totalBytes = finalItems.reduce((sum, item) => sum + item.bytes, 0);

	console.log("\n=== 判图完成 ===");
	console.log(`条目      ${finalItems.length}${items.length - finalItems.length ? `（合并重复 ${items.length - finalItems.length} 条）` : ""}`);
	console.log(`总体积    ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
	console.log(`耗时      ${((Date.now() - started) / 1000).toFixed(1)} s`);
	console.log(`清单      ${path.join(options.out, "manifest.json")}`);
	console.log(`缩略图    ${path.join(options.out, "thumb")}${options.thumb ? "" : "（本次未生成）"}`);
	console.log("\n用途分布：");
	for (const [use, count] of [...useCount.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${use.padEnd(8, "　")} ${count}`);
	}
	console.log("分辨率等级：");
	for (const [grade, count] of [...gradeCount.entries()].sort((a, b) => b[1] - a[1])) {
		console.log(`  ${grade.padEnd(8, "　")} ${count}`);
	}
	if (exactDupes.length) {
		console.log(`\n完全重复 ${exactDupes.length} 组（同内容不同文件名，已合并）：`);
		for (const item of exactDupes.slice(0, 10)) {
			console.log(`  ${item.origin.path}  ←  ${(item.origin.duplicates ?? []).join(" , ")}`);
		}
	}
	if (similarGroups.length) {
		console.log(`\n视觉相似 ${similarGroups.length} 组（可能是同图的压缩版/裁切版，需人工确认）：`);
		for (const group of similarGroups.slice(0, 10)) console.log(`  ${group.join(" , ")}`);
	}
}

run().catch(error => {
	console.error(error);
	process.exit(1);
});
