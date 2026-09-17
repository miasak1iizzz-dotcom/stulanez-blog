/**
 * 工具页（取图 / 艺术馆 / TFT）与主页 MainGrid 壳结构不同。
 * 跨壳不能只换内层 6 个容器（会半截拆样式、闪裸文字），改为替换 `#page-shell`：
 * 整页视觉换新，但 body 上的音频节点和 `window.__fireflyMusic` 还在，歌接着放。
 * 遮罩仍在替换期间盖住，避免换壳那一帧露馅。
 */

export type PageShell = "tool" | "grid";

const VEIL_KEY = "stulanez.shell-veil";
const REVEAL_MS = 200;
const PAGE_SHELL_CONTAINER = "#page-shell";
const GRID_CONTAINERS = [
	"#banner-overlay-container",
	"#banner-dim-container",
	"#swup-container",
	"#left-sidebar-dynamic",
	"#right-sidebar-dynamic",
	"#floating-toc-wrapper",
];
const HTML_SHELL_ATTRS = [
	"data-page-shell",
	"data-has-wallpaper",
	"data-wallpaper-mode",
	"data-tag-style",
	"data-category-style",
] as const;

type SwupVisit = {
	from?: { url?: string };
	to: { url: string; document?: Document };
	abort: () => void;
	containers?: string[];
	animation?: { animate?: boolean };
};

export function resolvePageShell(pathname: string): PageShell {
	const path = pathname.split(/[?#]/)[0] || "/";
	if (
		path === "/pull" ||
		path.startsWith("/pull/") ||
		path === "/art" ||
		path.startsWith("/art/") ||
		path === "/tft" ||
		path.startsWith("/tft/") ||
		path === "/library" ||
		path.startsWith("/library/") ||
		path === "/lab" ||
		path.startsWith("/lab/") ||
		path === "/dynamic/comments" ||
		path.startsWith("/dynamic/comments/")
	) {
		return "tool";
	}
	return "grid";
}

/** 任一侧是工具壳：整块换 `#page-shell`，不要走 MainGrid 那 6 个内层容器 */
export function shouldSwapPageShell(fromPath: string, toPath: string): boolean {
	return (
		resolvePageShell(fromPath) === "tool" || resolvePageShell(toPath) === "tool"
	);
}

function setVeilFlag(): void {
	try {
		sessionStorage.setItem(VEIL_KEY, "1");
	} catch {
		/* ignore */
	}
}

function consumeVeilFlag(): boolean {
	try {
		if (sessionStorage.getItem(VEIL_KEY) !== "1") return false;
		sessionStorage.removeItem(VEIL_KEY);
		return true;
	} catch {
		return false;
	}
}

function reduceMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visitPath(visit: { to: { url: string } }): string {
	try {
		return new URL(visit.to.url, window.location.href).pathname;
	} catch {
		return visit.to.url;
	}
}

function visitFromPath(visit: SwupVisit): string {
	const raw = visit.from?.url;
	if (!raw) return window.location.pathname;
	try {
		return new URL(raw, window.location.href).pathname;
	} catch {
		return raw;
	}
}

export function visitNeedsPageShell(visit: SwupVisit): boolean {
	const toPath = visitPath(visit);
	const fromPath = visitFromPath(visit);
	if (shouldSwapPageShell(fromPath, toPath)) return true;
	const htmlShell = document.documentElement.dataset.pageShell;
	const toShell = resolvePageShell(toPath);
	return Boolean(htmlShell) && htmlShell !== toShell;
}

/** 浏览器整页跳（刷新、显式 data-no-swup、Swup 还没就绪）：把进度交给下一页续上 */
function hardNavigate(href: string): void {
	try {
		window.__fireflyMusic?.persistForNavigation?.();
	} catch {
		/* ignore */
	}
	setVeilFlag();
	document.documentElement.classList.add("is-shell-leaving");
	window.location.assign(href);
}

function shouldIgnoreClick(
	event: MouseEvent,
	anchor: HTMLAnchorElement,
): boolean {
	if (event.defaultPrevented) return true;
	if (event.button !== 0) return true;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return true;
	if (anchor.target && anchor.target !== "_self") return true;
	if (anchor.hasAttribute("download")) return true;
	const rel = (anchor.getAttribute("rel") || "").toLowerCase();
	if (rel.includes("external")) return true;
	return false;
}

function resolveInternalUrl(anchor: HTMLAnchorElement): URL | null {
	const raw = anchor.getAttribute("href");
	if (
		!raw ||
		raw.startsWith("#") ||
		raw.startsWith("mailto:") ||
		raw.startsWith("tel:")
	) {
		return null;
	}
	if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("http")) {
		return null;
	}
	try {
		const url = new URL(raw, window.location.href);
		if (url.origin !== window.location.origin) return null;
		return url;
	} catch {
		return null;
	}
}

function onClick(event: MouseEvent): void {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const anchor = target.closest("a[href]");
	if (!(anchor instanceof HTMLAnchorElement)) return;
	if (shouldIgnoreClick(event, anchor)) return;

	const url = resolveInternalUrl(anchor);
	if (!url) return;

	const nextPath = url.pathname;
	const samePath =
		nextPath.replace(/\/$/, "") ===
			window.location.pathname.replace(/\/$/, "") &&
		url.search === window.location.search;
	if (samePath) return;

	const href = `${url.pathname}${url.search}${url.hash}`;
	// data-no-swup 不再整页硬跳：跨壳靠 #page-shell 软切，音频才能接着。
	// 仍带该属性的链接交给页面自己处理（如动态锚点），这里不拦截。
	if (anchor.hasAttribute("data-no-swup")) return;

	if (!shouldSwapPageShell(window.location.pathname, nextPath)) return;
	document.documentElement.classList.add("is-shell-leaving");
	if (!window.swup) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		hardNavigate(href);
	}
}

function revealAfterVeil(): void {
	const root = document.documentElement;
	root.classList.remove("is-shell-veiling", "is-shell-leaving");
	if (reduceMotion()) return;
	root.classList.add("is-shell-revealing");
	window.setTimeout(() => {
		root.classList.remove("is-shell-revealing");
	}, REVEAL_MS);
}

function syncHtmlFromNextPage(visit: SwupVisit): void {
	const next = visit.to.document?.documentElement;
	if (!next) return;
	const curr = document.documentElement;
	for (const name of HTML_SHELL_ATTRS) {
		const val = next.getAttribute(name);
		if (val === null) curr.removeAttribute(name);
		else curr.setAttribute(name, val);
	}
	const wm = curr.getAttribute("data-wallpaper-mode");
	document.body.classList.toggle(
		"wallpaper-transparent",
		wm === "overlay" || wm === "fullscreen",
	);
}

/**
 * 首帧遮罩由 Layout head 内联脚本挂上。
 * 点击拦遮罩；跨壳让 Swup 换 `#page-shell`，音频继续。
 * data-no-swup 不再触发整页硬跳（会掐音乐）。
 */
export function setupShellNav(): void {
	if (window.__fireflyShellNav) return;
	window.__fireflyShellNav = true;

	const shell = resolvePageShell(window.location.pathname);
	document.documentElement.dataset.pageShell = shell;

	if (
		consumeVeilFlag() ||
		document.documentElement.classList.contains("is-shell-veiling")
	) {
		requestAnimationFrame(() => {
			requestAnimationFrame(revealAfterVeil);
		});
	}

	document.addEventListener("click", onClick, true);

	let shellSwapActive = false;

	const prepareShellVisit = (visit: SwupVisit): void => {
		const toPath = visitPath(visit);
		if (!visitNeedsPageShell(visit)) {
			shellSwapActive = false;
			visit.containers = GRID_CONTAINERS;
			return;
		}
		if (!document.getElementById("page-shell")) {
			visit.abort();
			hardNavigate(visit.to.url);
			return;
		}
		shellSwapActive = true;
		visit.containers = [PAGE_SHELL_CONTAINER];
		if (visit.animation) visit.animation.animate = false;
		document.documentElement.classList.add("is-shell-leaving");
		document.documentElement.dataset.pageShell = resolvePageShell(toPath);
	};

	const bindSwup = (): void => {
		if (!window.swup?.hooks) return;
		window.swup.hooks.on("visit:start", prepareShellVisit);
		window.swup.hooks.on("content:replace", (visit: SwupVisit) => {
			if (!shellSwapActive) return;
			syncHtmlFromNextPage(visit);
		});
		window.swup.hooks.on("visit:end", () => {
			if (!shellSwapActive) return;
			shellSwapActive = false;
			revealAfterVeil();
		});
	};
	if (window.swup?.hooks) bindSwup();
	else document.addEventListener("swup:enable", bindSwup);

	window.addEventListener("pageshow", (event) => {
		if (event.persisted) {
			document.documentElement.classList.remove(
				"is-shell-veiling",
				"is-shell-leaving",
				"is-shell-revealing",
			);
		}
	});
}
