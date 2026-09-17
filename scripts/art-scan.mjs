#!/usr/bin/env node
/**
 * art-scan — 艺术馆判图管线（阶段 0）
 *
 * 只在本机运行，不联网、不上传。扫描一个本地目录，对每张图片做客观判定，
 * 产出 manifest.json（站上页面唯一真相源）与两档缩略图。
 *
 * 用法：
 *   node scripts/art-scan.mjs --in "素材/壁纸" [--out .ai-work/art-scan] [--limit 200] [--no-thumb]
 *
 * 说明见 docs/ai/art-museum-spec.md §4 / §5.1。
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp", ".tiff", ".tif"]);
const SKIP_DIR = /^(?:\.|_代|_隔离|thumbs?$)|隔离|待删/;
const CONCURRENCY = 6;
const THUMB_WIDTHS = [480, 1280];
const BASE_URL = "https://img.stulanez.com"; // 阶段 2 接 R2 自定义域后生效

function parseArgs(argv) {
	const out = { inp: "", out: ".ai-work/art-scan", limit: 0, thumb: true, madeDirs: new Set() };
	for (let i = 0; i < argv.length; i++) {
		const key = argv[i];
		if (key === "--in") out.inp = argv[++i];
		else if (key === "--out") out.out = argv[++i];
		else if (key === "--limit") out.limit = Number(argv[++i]) || 0;
		else if (key === "--no-thumb") out.thumb = false;
	}
	return out;
}

async function walk(root) {
	const found = [];
	const stack = [root];
	while (stack.length) {
		const dir = stack.pop();
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

/**
 * 用途标签：宽高比 + 分辨率 + 体积，纯客观判定，不看内容。
 * 比例用「相对容差」匹配而不是死区间——同一批壁纸里 4000×2360 和 3840×2160
 * 只差 4.6%，不该被劈成两类（踩过的坑）。
 */
const RATIO_BUCKETS = [
	{ target: 9 / 19.5, tol: 0.05, use: "手机壁纸" }, // 全面屏竖屏
	{ target: 9 / 16, tol: 0.05, use: "手机壁纸" },
	{ target: 4 / 5, tol: 0.05, use: "社交背景" },
	{ target: 3 / 4, tol: 0.05, use: "社交背景" },
	{ target: 1, tol: 0.08, use: "方图" },
	{ target: 3 / 2, tol: 0.05, use: "摄影原图" }, // 相机原生比例
	{ target: 4 / 3, tol: 0.05, use: "摄影原图" },
	{ target: 16 / 10, tol: 0.04, use: "桌面壁纸" },
	{ target: 16 / 9, tol: 0.05, use: "桌面壁纸" },
	{ target: 21 / 9, tol: 0.05, use: "超宽壁纸" },
];

function detectUses({ width, height, bytes }) {
	const long = Math.max(width, height);
	const short = Math.min(width, height);
	const ratio = width / height;
	const uses = [];
	if (long < 1280) {
		uses.push("仅预览");
	} else {
		let best = null;
		for (const bucket of RATIO_BUCKETS) {
			const err = Math.abs(ratio - bucket.target) / bucket.target;
			if (err <= bucket.tol && (!best || err < best.err)) best = { err, use: bucket.use };
		}
		if (best) uses.push(best.use);
		else if (ratio < 0.5) uses.push("长图");
		else if (ratio < 0.9) uses.push("竖图");
		else if (ratio <= 1.1) uses.push("方图");
		else if (ratio < 2.2) uses.push("横图");
		else uses.push("全景");
	}
	if (Math.abs(ratio - 1) <= 0.08 && short <= 1024) uses.push("头像");
	if (Math.abs(ratio - 1) <= 0.08 && bytes <= 400 * 1024) uses.push("表情包");
	return [...new Set(uses)];
}

/** 分辨率等级：单独一维，便于展厅按「够不够当壁纸」筛。 */
function gradeOf(long) {
	if (long >= 7680) return "8K";
	if (long >= 3840) return "4K";
	if (long >= 2560) return "2K";
	if (long >= 1920) return "1080P";
	if (long >= 1280) return "HD";
	return "低清";
}

function ratioLabel(width, height) {
	const gcd = (a, b) => (b ? gcd(b, a % b) : a);
	const g = gcd(width, height) || 1;
	const w = width / g;
	const h = height / g;
	// 化简后太夸张（如 1234:567）就退回两位小数
	if (w > 64 || h > 64) return `${(width / height).toFixed(2)}:1`;
	return `${w}:${h}`;
}

/** 感知哈希 dhash：缩到 9x8 灰度，比较水平相邻像素，得 64 位。 */
async function dhashOf(buffer) {
	const { data } = await sharp(buffer).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
	let bits = "";
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? "1" : "0";
	}
	let hex = "";
	for (let i = 0; i < 64; i += 4) hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
	return hex;
}

/** 主色与明暗：16x16 缩略统计，按 3 位/通道（8 级）量化取前 5 色，避免近色被拆散。 */
async function paletteOf(buffer) {
	const { data, info } = await sharp(buffer).resize(16, 16, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true });
	const channels = info.channels;
	const buckets = new Map();
	let brightness = 0;
	let saturation = 0;
	const pixels = info.width * info.height;
	for (let i = 0; i < pixels; i++) {
		const r = data[i * channels];
		const g = data[i * channels + 1];
		const b = data[i * channels + 2];
		const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
		buckets.set(key, (buckets.get(key) || 0) + 1);
		brightness += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		saturation += max === 0 ? 0 : (max - min) / max;
	}
	const colors = [...buckets.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([key]) => {
			const r = (((key >> 6) & 7) << 5) + 16;
			const g = (((key >> 3) & 7) << 5) + 16;
			const b = ((key & 7) << 5) + 16;
			return `#${[r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, "0")).join("")}`;
		});
	return {
		colors,
		brightness: Number((brightness / pixels).toFixed(3)),
		saturation: Number((saturation / pixels).toFixed(3)),
	};
}

async function analyze(file, root, options) {
	const buffer = await readFile(file);
	const meta = await sharp(buffer).metadata();
	const width = meta.width || 0;
	const height = meta.height || 0;
	if (!width || !height) return null;
	const id = createHash("sha1").update(buffer).digest("hex").slice(0, 16);

	const [dhash, palette] = await Promise.all([dhashOf(buffer), paletteOf(buffer)]);
	const rel = path.relative(root, file).split(path.sep).join("/");
	const bytes = buffer.length;

	const thumbs = {};
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
		key: `art/img/${id.slice(0, 2)}/${id}.${(meta.format || "jpg").replace("jpeg", "jpg")}`,
		thumbs,
		width,
		height,
		bytes,
		format: meta.format || "unknown",
		ratio: ratioLabel(width, height),
		auto: {
			uses: detectUses({ width, height, bytes }),
			grade: gradeOf(Math.max(width, height)),
			colors: palette.colors,
			dhash,
			brightness: palette.brightness,
			saturation: palette.saturation,
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

async function run() {
	const options = parseArgs(process.argv.slice(2));
	if (!options.inp) {
		console.error("用法: node scripts/art-scan.mjs --in <目录> [--out <目录>] [--limit N] [--no-thumb]");
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

	const items = [];
	let done = 0;
	const started = Date.now();
	const queue = [...files];
	async function worker() {
		while (queue.length) {
			const file = queue.shift();
			try {
				const item = await analyze(file, root, options);
				if (item) {
					// 本机绝对路径不进清单（清单将来是公开的）
					const clean = { ...item };
					delete clean._source;
					items.push(clean);
				}
			} catch (error) {
				console.warn(`跳过（判图失败）: ${path.relative(root, file)} — ${error.message}`);
			}
			done++;
			if (done % 50 === 0 || done === files.length) console.log(`  ${done}/${files.length}`);
		}
	}
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	// 字节级重复（sha1 相同）合并为一条，其余来源记进 origin.duplicates
	const dedup = new Map();
	for (const item of items) {
		const prev = dedup.get(item.id);
		if (prev) {
			prev.origin.duplicates = [...(prev.origin.duplicates || []), item.origin.path];
			continue;
		}
		dedup.set(item.id, item);
	}
	const finalItems = [...dedup.values()].sort((a, b) => a.origin.path.localeCompare(b.origin.path, "zh-CN", { numeric: true }));

	const manifest = {
		version: 1,
		updatedAt: new Date().toISOString(),
		generator: "art-scan/0.1",
		baseUrl: BASE_URL,
		items: finalItems,
	};
	await writeFile(path.join(options.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

	// 概要：用途分布、体积、重复
	const useCount = new Map();
	for (const item of finalItems) for (const use of item.auto.uses) useCount.set(use, (useCount.get(use) || 0) + 1);
	const gradeCount = new Map();
	for (const item of finalItems) gradeCount.set(item.auto.grade, (gradeCount.get(item.auto.grade) || 0) + 1);
	const exactDupes = finalItems.filter(item => item.origin.duplicates?.length);
	const byDhash = new Map();
	for (const item of finalItems) {
		const list = byDhash.get(item.auto.dhash) || [];
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
	for (const grade of ["8K", "4K", "2K", "1080P", "低清"]) {
		if (gradeCount.has(grade)) console.log(`  ${grade.padEnd(8, "　")} ${gradeCount.get(grade)}`);
	}
	if (exactDupes.length) {
		console.log(`\n完全重复 ${exactDupes.length} 组（同内容不同文件名，已合并）：`);
		for (const item of exactDupes.slice(0, 10)) {
			console.log(`  ${item.origin.path}  ←  ${item.origin.duplicates.join(" , ")}`);
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
