<script lang="ts">
import { untrack } from "svelte";

const PIN_KEY = "pull-nav-pinned";

let pinned = $state(false);
let open = $state(false);
let suppressed = $state(false);
let lastY = 0;
let ticking = false;
let leaveTimer = 0;
let dockEl: HTMLDivElement | null = null;

function atTop(): boolean {
	return window.scrollY <= 8;
}

function apply(): void {
	document.body.classList.toggle("pull-nav-pinned", pinned);
	document.body.classList.toggle("pull-nav-open", open || pinned);
	document.body.classList.toggle("pull-nav-at-top", atTop());
	placeDock();
}

function setOpen(next: boolean): void {
	if (pinned) {
		open = true;
		apply();
		return;
	}
	open = next;
	apply();
}

function fold(event?: MouseEvent): void {
	event?.stopPropagation();
	cancelClose();
	pinned = false;
	suppressed = true;
	open = false;
	try {
		localStorage.setItem(PIN_KEY, "0");
	} catch {
		/* ignore */
	}
	apply();
}

function togglePin(): void {
	pinned = !pinned;
	if (pinned) {
		suppressed = false;
		open = true;
	}
	try {
		localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
	} catch {
		/* ignore */
	}
	apply();
}

function scheduleClose(): void {
	window.clearTimeout(leaveTimer);
	leaveTimer = window.setTimeout(() => {
		if (pinned) return;
		if (atTop() && !suppressed) return;
		setOpen(false);
	}, 220);
}

function cancelClose(): void {
	window.clearTimeout(leaveTimer);
}

function reveal(): void {
	cancelClose();
	suppressed = false;
	setOpen(true);
	if (pinned || atTop()) return;
	leaveTimer = window.setTimeout(() => {
		if (pinned) return;
		if (atTop() && !suppressed) return;
		const top = document.getElementById("top-row");
		if (top?.matches(":hover") || dockEl?.matches(":hover")) return;
		setOpen(false);
	}, 2800);
}

function placeDock(): void {
	if (!dockEl) return;
	const nav = document.getElementById("navbar");
	const logo = nav?.querySelector("a");
	if (!nav) return;
	const bar = nav.getBoundingClientRect();
	const mark = logo?.getBoundingClientRect();
	const left = Math.max(10, (mark?.left ?? bar.left) + 8);
	dockEl.style.left = `${left}px`;
	dockEl.style.top = `${bar.bottom - 13}px`;
}

$effect(() => {
	if (typeof window === "undefined") return;
	const stored = localStorage.getItem(PIN_KEY) === "1";
	untrack(() => {
		pinned = stored;
		open = stored || atTop();
		apply();
	});
	lastY = window.scrollY;

	const top = document.getElementById("top-row");
	const onScroll = (): void => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			const y = window.scrollY;
			const goingDown = y > lastY + 4;
			lastY = y;
			if (pinned) {
				apply();
				return;
			}
			if (goingDown && y > 12) {
				suppressed = false;
				cancelClose();
				setOpen(false);
				return;
			}
			if (atTop() && !suppressed) setOpen(true);
			else apply();
		});
	};

	const onResize = (): void => placeDock();
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", onResize);
	top?.addEventListener("mouseenter", reveal);
	top?.addEventListener("mouseleave", scheduleClose);
	top?.addEventListener("transitionend", placeDock);
	requestAnimationFrame(placeDock);

	return () => {
		window.removeEventListener("scroll", onScroll);
		window.removeEventListener("resize", onResize);
		top?.removeEventListener("mouseenter", reveal);
		top?.removeEventListener("mouseleave", scheduleClose);
		top?.removeEventListener("transitionend", placeDock);
		window.clearTimeout(leaveTimer);
		document.body.classList.remove(
			"pull-nav-open",
			"pull-nav-pinned",
			"pull-nav-at-top",
		);
	};
});
</script>

<div
	id="pull-nav-hotspot"
	role="presentation"
	onmouseenter={reveal}
	onclick={reveal}
></div>

{#if !open && !pinned}
	<button
		type="button"
		class="pull-tab"
		aria-label="展开顶栏"
		title="展开顶栏"
		onclick={reveal}
	>
		<span class="cord"></span>
		<span class="dock-btn">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="currentColor"
					d="M6.7 9.3a1 1 0 0 1 1.4 0L12 13.58l3.9-3.88a1 1 0 1 1 1.4 1.4l-4.6 4.6a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4"
				/>
			</svg>
		</span>
	</button>
{/if}

<div
	id="pull-nav-dock"
	class="dock"
	class:away={!open && !pinned}
	bind:this={dockEl}
	role="toolbar"
	aria-label="导航栏锁定"
	onmouseenter={cancelClose}
	onmouseleave={scheduleClose}
>
	<button
		type="button"
		class="dock-btn"
		class:on={pinned}
		aria-pressed={pinned}
		aria-label={pinned ? "解锁顶栏" : "钉住顶栏"}
		title={pinned ? "解锁顶栏" : "钉住顶栏"}
		onclick={togglePin}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="currentColor"
				d="M14.7 3.3a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-1.8 1.8a1 1 0 0 1-1.2.2l-2.3-.9-4.6 4.6 1.1 1.1a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0l1.1 1.1 4.6-4.6-.9-2.3a1 1 0 0 1 .2-1.2zM5.3 18.3 3 21l2.7-2.3z"
			/>
		</svg>
	</button>
	<button
		type="button"
		class="dock-btn"
		aria-label="收起顶栏"
		title="收起顶栏"
		onclick={fold}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="currentColor"
				d="M6.7 14.7a1 1 0 0 1 0-1.4l4.6-4.6a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 1 1-1.4 1.4L12 11.42l-3.9 3.88a1 1 0 0 1-1.4 0"
			/>
		</svg>
	</button>
</div>

<style>
	#pull-nav-hotspot {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 22px;
		z-index: 90;
		pointer-events: none;
	}

	:global(body:has(.pull-tool-main):not(.pull-nav-open):not(.pull-nav-pinned))
		#pull-nav-hotspot {
		pointer-events: auto;
	}

	.pull-tab {
		position: fixed;
		top: 0;
		left: 50%;
		z-index: 92;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translateX(-50%);
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.cord {
		width: 1.5px;
		height: 9px;
		background: rgba(107, 55, 67, 0.38);
	}

	.dock {
		position: fixed;
		z-index: 91;
		display: flex;
		gap: 0.22rem;
		pointer-events: auto;
	}

	.dock.away {
		opacity: 0;
		pointer-events: none;
	}

	.dock-btn {
		display: grid;
		place-items: center;
		width: 1.55rem;
		height: 1.55rem;
		padding: 0;
		border: 1px solid rgba(200, 185, 170, 0.55);
		border-radius: 999px;
		background: rgba(255, 248, 246, 0.94);
		color: #6b3743;
		box-shadow: 0 4px 12px rgba(107, 55, 67, 0.12);
		cursor: pointer;
		transition:
			transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
			background 0.2s ease,
			color 0.2s ease;
	}

	.dock-btn:hover,
	.pull-tab:hover .dock-btn {
		transform: translateY(-1px);
		background: #fff;
	}

	.dock-btn.on {
		background: #241b1a;
		border-color: #241b1a;
		color: #f6ecea;
	}

	.dock-btn svg {
		width: 0.82rem;
		height: 0.82rem;
	}

	.dock-btn.on svg {
		transform: rotate(35deg);
	}
</style>
