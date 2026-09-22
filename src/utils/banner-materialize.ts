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
	} else if (img) {
		img.setAttribute("loading", "eager");
		img.setAttribute("fetchpriority", "low");
	}
	el.appendChild(frag);
	tpl.remove();
	fadeInWhenLoaded(el);
	return true;
}

function materializeAhead(slides: Element[], index: number): boolean {
	if (slides.length < 2) return false;
	let did = materialize(slides[(index + 1) % slides.length], false);
	if (slides.length < 3) return did;
	const plus2 = slides[(index + 2) % slides.length];
	const warm = (): void => {
		materialize(plus2, false);
	};
	if (typeof requestIdleCallback === "function") {
		requestIdleCallback(warm, { timeout: 2500 });
	} else {
		window.setTimeout(warm, 800);
	}
	return did;
}

/**
 * 壁纸图故意躺在 <template> 里，首屏靠内联脚本实例化。
 * 跨壳（取图 ↔ 首页）会整块换掉 #page-shell，轮播脚本要重跑；
 * 回来时 template 还在、图没出来，只剩 --page-bg。这里补一次实例化，并热下一张。
 */
export function materializeBannerImages(): boolean {
	const container = document.getElementById("banner-images-container");
	if (!container) return false;
	if (!container.querySelector("template")) return false;

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
		let did = false;
		if (first) did = materialize(first, true) || did;
		did = materializeAhead(slides, startIdx) || did;
		return did;
	}

	let did = false;
	for (const slot of container.querySelectorAll(".banner-image-slot")) {
		if (visibleOnThisBreakpoint(slot)) did = materialize(slot, true) || did;
	}
	return did;
}

function reconnectWaves(): void {
	const waves = window.wavesManager;
	if (!waves) return;
	if (waves.canvas?.isConnected) return;
	waves.stop();
	void waves.init();
}

function carouselShouldPlay(): boolean {
	const container = document.getElementById("banner-images-container");
	if (!container) return false;
	const mode = document.documentElement.getAttribute("data-wallpaper-mode");
	if (mode !== "banner" && mode !== "fullscreen") return false;
	const switchable = container.dataset.carouselSwitchable === "true";
	const defaultEnabled = container.dataset.carouselEnabled === "true";
	if (!switchable) return defaultEnabled;
	try {
		const stored = localStorage.getItem("bannerCarouselEnabled");
		if (stored === null) return defaultEnabled;
		return stored === "true";
	} catch {
		return defaultEnabled;
	}
}

/** 跨壳换回主站之后：壁纸属性、图片、水波都按新 DOM 再挂一次。 */
export function restoreBannerAfterSwup(): void {
	const wrapper = document.getElementById("wallpaper-wrapper");
	if (wrapper) document.documentElement.setAttribute("data-has-wallpaper", "");
	else document.documentElement.removeAttribute("data-has-wallpaper");
	initWallpaperMode();
	const didMaterialize = materializeBannerImages();
	if (didMaterialize && carouselShouldPlay()) {
		window.dispatchEvent(
			new CustomEvent("bannerCarouselChange", { detail: { enabled: true } }),
		);
	}
	reconnectWaves();
}
