import { initWallpaperMode } from "@/utils/setting-utils";

function visibleOnThisBreakpoint(el: Element): boolean {
	const isLg = window.innerWidth >= 1024;
	if (isLg && el.classList.contains("lg:hidden")) return false;
	if (
		!isLg &&
		el.classList.contains("hidden") &&
		!el.classList.contains("lg:hidden")
	) {
		return false;
	}
	return true;
}

function fadeInWhenLoaded(root: Element): void {
	const ph = root.querySelector(".lqip-placeholder");
	const img = root.querySelector("img");
	if (!img) return;
	const done = (): void => {
		img.style.opacity = "1";
		ph?.classList.add("loaded");
	};
	if (img.complete && img.naturalWidth > 0) {
		done();
		return;
	}
	img.addEventListener("load", done, { once: true });
	img.addEventListener(
		"error",
		() => {
			ph?.classList.add("loaded");
		},
		{ once: true },
	);
}

function materialize(el: Element, high: boolean): boolean {
	const tpl = el.querySelector("template");
	if (!tpl) return false;
	const frag = tpl.content.cloneNode(true) as DocumentFragment;
	const img = frag.querySelector("img");
	const ph = frag.querySelector(".lqip-placeholder");
	if (img && high) {
		img.setAttribute("fetchpriority", "high");
		img.classList.remove(
			"opacity-0",
			"transition-opacity",
			"duration-500",
			"ease-out",
		);
		img.style.opacity = "1";
		if (ph instanceof HTMLElement) ph.style.transition = "none";
	}
	el.appendChild(frag);
	tpl.remove();
	fadeInWhenLoaded(el);
	return true;
}

/**
 * 壁纸图故意躺在 <template> 里，首屏靠内联脚本实例化。
 * 跨壳（取图 ↔ 首页）会整块换掉 #page-shell，那脚本带 data-swup-ignore-script，
 * 回来时 template 还在、图没出来，只剩 --page-bg。这里补一次实例化。
 */
export function materializeBannerImages(): void {
	const container = document.getElementById("banner-images-container");
	if (!container) return;
	if (!container.querySelector("template")) return;

	const slides = Array.from(container.querySelectorAll(".slide-item")).filter(
		visibleOnThisBreakpoint,
	);
	if (slides.length) {
		let startIdx = 0;
		try {
			const pinnedRaw = localStorage.getItem("bannerWallpaperIndex");
			if (pinnedRaw !== null) {
				const parsed = Number.parseInt(pinnedRaw, 10);
				if (parsed >= 0 && parsed < slides.length) startIdx = parsed;
			}
		} catch {
			/* ignore */
		}
		for (let i = 0; i < slides.length; i++) {
			slides[i]?.classList.toggle("active", i === startIdx);
		}
		const first = slides[startIdx];
		if (first) materialize(first, true);
		return;
	}

	for (const slot of container.querySelectorAll(".banner-image-slot")) {
		if (visibleOnThisBreakpoint(slot)) materialize(slot, true);
	}
}

function reconnectWaves(): void {
	const waves = window.wavesManager;
	if (!waves) return;
	if (waves.canvas?.isConnected) return;
	waves.stop();
	void waves.init();
}

/** 跨壳换回主站之后：壁纸属性、图片、水波都按新 DOM 再挂一次。 */
export function restoreBannerAfterSwup(): void {
	const wrapper = document.getElementById("wallpaper-wrapper");
	if (wrapper) document.documentElement.setAttribute("data-has-wallpaper", "");
	else document.documentElement.removeAttribute("data-has-wallpaper");
	initWallpaperMode();
	materializeBannerImages();
	reconnectWaves();
}
