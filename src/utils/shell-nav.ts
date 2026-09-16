/**
 * 工具页（取图 / 艺术馆 / TFT）与主页 MainGrid 壳之间不能走 Swup：
 * 工具页没有完整 `#swup-container` 网格，Swup 半截替换会闪「怪帧」或把壳嵌错。
 * 跨壳点击改为整页跳转，并用遮罩淡出/淡入盖住白屏与未就绪布局。
 */

export type PageShell = "tool" | "grid";

const VEIL_KEY = "stulanez.shell-veil";
const LEAVE_MS = 150;
const REVEAL_MS = 220;

export function resolvePageShell(pathname: string): PageShell {
	const path = pathname.split(/[?#]/)[0] || "/";
	if (
		path === "/pull" ||
		path.startsWith("/pull/") ||
		path === "/art" ||
		path.startsWith("/art/") ||
		path === "/tft" ||
		path.startsWith("/tft/")
	) {
		return "tool";
	}
	return "grid";
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

function hardNavigate(href: string): void {
	setVeilFlag();
	const root = document.documentElement;
	if (reduceMotion()) {
		window.location.assign(href);
		return;
	}
	root.classList.add("is-shell-leaving");
	window.setTimeout(() => {
		window.location.assign(href);
	}, LEAVE_MS);
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
		// stulanez-deck:// 等自定义协议
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

function needsHardNav(anchor: HTMLAnchorElement, nextPath: string): boolean {
	if (anchor.hasAttribute("data-no-swup")) return true;
	const from = resolvePageShell(window.location.pathname);
	const to = resolvePageShell(nextPath);
	return from !== to;
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

	if (!needsHardNav(anchor, nextPath)) return;

	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();
	hardNavigate(`${url.pathname}${url.search}${url.hash}`);
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

/** 首帧遮罩由 Layout head 内联脚本根据 session 旗标挂上；此处负责揭开与点击拦截 */
export function setupShellNav(): void {
	if (window.__fireflyShellNav) return;
	window.__fireflyShellNav = true;

	const shell = resolvePageShell(window.location.pathname);
	document.documentElement.dataset.pageShell = shell;

	if (
		consumeVeilFlag() ||
		document.documentElement.classList.contains("is-shell-veiling")
	) {
		// 等一帧让首屏样式就位，再淡入，避免露出半成品布局
		requestAnimationFrame(() => {
			requestAnimationFrame(revealAfterVeil);
		});
	}

	document.addEventListener("click", onClick, true);

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
