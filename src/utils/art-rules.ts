/**
 * 艺术馆判图规则 —— 单一真相源。
 *
 * 两处共用这份规则，避免各写一份导致漂移：
 *   1. 本地管线 scripts/art-scan.ts（Node + sharp）
 *   2. 浏览器策展台 src/utils/art-curate.ts（canvas）
 *
 * 说明见 docs/ai/art-museum-spec.md §5.1。
 */

export interface UseInput {
	width: number;
	height: number;
	bytes: number;
}

export interface Palette {
	/** 主色，最多 5 个，形如 #303050 */
	colors: string[];
	/** 平均亮度 0–1 */
	brightness: number;
	/** 平均饱和度 0–1 */
	saturation: number;
}

/**
 * 用途标签：宽高比 + 分辨率 + 体积，纯客观判定，不看内容。
 * 比例用「相对容差」匹配而不是死区间——同一批壁纸里 4000×2360 和 3840×2160
 * 只差 4.6%，不该被劈成两类（踩过的坑）。
 */
const RATIO_BUCKETS: { target: number; tol: number; use: string }[] = [
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

/** 分辨率等级，从高到低。展厅按这个顺序排列筛选项。 */
export const GRADE_ORDER: string[] = ["8K", "4K", "2K", "1080P", "HD", "低清"];

export function detectUses({ width, height, bytes }: UseInput): string[] {
	const long = Math.max(width, height);
	const short = Math.min(width, height);
	const ratio = width / height;
	const uses: string[] = [];
	if (long < 1280) {
		uses.push("仅预览");
	} else {
		let best: { err: number; use: string } | null = null;
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
export function gradeOf(long: number): string {
	if (long >= 7680) return "8K";
	if (long >= 3840) return "4K";
	if (long >= 2560) return "2K";
	if (long >= 1920) return "1080P";
	if (long >= 1280) return "HD";
	return "低清";
}

/** 化简比例标签，如 16:9；化简后太夸张就退回两位小数。 */
export function ratioLabel(width: number, height: number): string {
	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
	const g = gcd(width, height) || 1;
	const w = width / g;
	const h = height / g;
	if (w > 64 || h > 64) return `${(width / height).toFixed(2)}:1`;
	return `${w}:${h}`;
}

/**
 * 主色与明暗：输入任意尺寸的 RGB(A) 像素（调用方负责先缩到 16×16）。
 * 按 3 位/通道（8 级）量化取前 5 色，避免近色被拆散。
 */
export function paletteFromRgb(
	data: Uint8ClampedArray | Uint8Array,
	width: number,
	height: number,
	channels: number,
): Palette {
	const pixels = width * height;
	if (!pixels) return { colors: [], brightness: 0, saturation: 0 };
	const buckets = new Map<number, number>();
	let brightness = 0;
	let saturation = 0;
	for (let i = 0; i < pixels; i++) {
		const r = data[i * channels] ?? 0;
		const g = data[i * channels + 1] ?? 0;
		const b = data[i * channels + 2] ?? 0;
		const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
		buckets.set(key, (buckets.get(key) ?? 0) + 1);
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

/**
 * 感知哈希 dhash：输入 9×8 的灰度像素（调用方负责缩放与取灰度），
 * 比较水平相邻像素得到 64 位，输出 16 位十六进制。
 */
export function dhashFromGray(gray: ArrayLike<number>, width: number): string {
	let bits = "";
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			bits += (gray[y * width + x] ?? 0) < (gray[y * width + x + 1] ?? 0) ? "1" : "0";
		}
	}
	let hex = "";
	for (let i = 0; i < 64; i += 4) hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
	return hex;
}
