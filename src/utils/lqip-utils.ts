// LQIP 方案来源: https://blog.cosine.ren/post/astro-lqip-implementation

import lqipData from "@constants/lqips.json";
import { assetPathname } from "@/utils/url-utils";

const lqips: Record<string, string> = lqipData as Record<string, string>;

const DEFAULT_GRADIENT =
	"linear-gradient(135deg, #d6d3d1 0%, #a8a29e 50%, #d6d3d1 100%)";

function publicAssetKey(src: string): string {
	try {
		const base = "https://stulanez.com";
		const parsed = src.startsWith("/") || src.startsWith("http")
			? new URL(src, base)
			: null;
		const key = parsed?.searchParams.get("key");
		if (key) return key.replace(/^\//, "");
	} catch {
		/* 不是可解析的地址时按路径处理 */
	}
	return assetPathname(src).replace(/^\//, "");
}

function normalizePath(p: string): string {
	return p.replace(/\/\.\//g, "/").replace(/\/+/g, "/");
}

/**
 * 将 LQIP 紧凑格式（18 字符 hex）解码为 CSS 线性渐变
 * 格式：6e3b38ae7472af7574 → linear-gradient(135deg, #6e3b38 0%, #ae7472 50%, #af7574 100%)
 */
export function getLqipGradient(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): string | undefined {
	if (isPublic) {
		const relativePath = publicAssetKey(src);
		const compact = lqips[`public:${relativePath}`] || lqips[relativePath];
		if (compact?.length !== 18) return undefined;
		const c1 = `#${compact.slice(0, 6)}`;
		const c2 = `#${compact.slice(6, 12)}`;
		const c3 = `#${compact.slice(12, 18)}`;
		return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
	}

	// src 图片：key 格式为 src:xxx
	const fullPath = basePath ? normalizePath(`${basePath}/${src}`) : src;
	const compact =
		lqips[`src:${fullPath}`] ||
		lqips[`src:${src}`] ||
		lqips[fullPath] ||
		lqips[src];
	if (compact?.length !== 18) return undefined;

	const c1 = `#${compact.slice(0, 6)}`;
	const c2 = `#${compact.slice(6, 12)}`;
	const c3 = `#${compact.slice(12, 18)}`;
	return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
}

function isHostedSiteAsset(src: string): boolean {
	const pathname = assetPathname(src);
	return pathname.startsWith("/gallery/") || pathname.startsWith("/assets/");
}

/** 判断是否为外部图片 */
export function isExternalImage(src: string): boolean {
	return (
		src.startsWith("http://") ||
		src.startsWith("https://") ||
		src.startsWith("data:")
	);
}

/** 获取 LQIP 内联样式 */
export function getLqipStyle(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): string | undefined {
	if (isExternalImage(src) && !isHostedSiteAsset(src)) return undefined;
	const gradient = getLqipGradient(src, basePath, isPublic);
	return gradient ? `background: ${gradient}` : undefined;
}

/** 获取 LQIP props（用于 Astro 组件），外部图片自动降级 */
export function getLqipProps(
	src: string,
	basePath?: string,
	isPublic?: boolean,
): { style: string } {
	if (isExternalImage(src) && !isHostedSiteAsset(src)) {
		return { style: "background: var(--muted)" };
	}
	const style = getLqipStyle(src, basePath, isPublic || isHostedSiteAsset(src));
	return { style: style || `background: ${DEFAULT_GRADIENT}` };
}

/**
 * LQIP fade-in：图片加载完成后淡出占位渐变。
 * 纯函数（本模块被 frontmatter 导入，顶层不能有 DOM 副作用），
 * 监听器由 layout-init.ts 注册。
 */
export function initImageLoadFadeIn(): void {
	const placeholders =
		document.querySelectorAll<HTMLElement>(".lqip-placeholder");
	placeholders.forEach((placeholder) => {
		const container = placeholder.parentElement;
		if (!container) return;
		const img = container.querySelector<HTMLImageElement>("img, picture img");
		if (!img) return;

		if (img.complete && img.naturalWidth > 0) {
			img.style.opacity = "1";
			placeholder.classList.add("loaded");
		} else {
			img.addEventListener(
				"load",
				() => {
					img.style.opacity = "1";
					placeholder.classList.add("loaded");
				},
				{ once: true },
			);
			img.addEventListener(
				"error",
				() => {
					if (!container.classList.contains("cover-image-container")) {
						placeholder.classList.add("loaded");
					}
				},
				{ once: true },
			);
		}
	});
}
