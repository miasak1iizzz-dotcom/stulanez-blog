<script lang="ts">
import { pullFileUrl, safePullName } from "@/utils/pull/fileUrl";
import type { PullImage, PullSuccess } from "@/utils/pull/types";
import { buildZip } from "@/utils/pull/zip";

type Props = {
	result: PullSuccess;
	onClear: () => void;
};

type PageSize = 10 | 20 | 50;
type OrderMode = "seq" | "shuffle";
type Axis = "vertical" | "marquee";
type Range = "page" | "selected" | "all";
type Pack = "each" | "zip";

let { result, onClear }: Props = $props();

const PAGE_KEY = "pull-gallery-page-size";
const ORDER_KEY = "pull-gallery-order";
const AXIS_KEY = "pull-gallery-axis";

let pageSize = $state<PageSize>(10);
let orderMode = $state<OrderMode>("seq");
let axis = $state<Axis>("marquee");
let range = $state<Range>("page");
let pack = $state<Pack>("each");
let grabbing = $state(false);
let page = $state(1);
let deck = $state<PullImage[]>([]);
let selected = $state<Record<string, boolean>>({});
let busy = $state("");
let note = $state("");
let sourceKey = "";
let fancyReady = false;
let marqueeEl = $state<HTMLDivElement | undefined>(undefined);
let trackEl = $state<HTMLDivElement | undefined>(undefined);
let skipClick = false;
let dragActive = false;
let offsetX = 0;
let velocity = 0;
let loopWidth = 0;
let lastPointerX = 0;
let lastPointerTs = 0;
let movedPx = 0;

const selectedCount = $derived(Object.values(selected).filter(Boolean).length);
const pages = $derived(Math.max(1, Math.ceil(deck.length / pageSize)));
const pageImages = $derived.by(() => {
	const start = (page - 1) * pageSize;
	return deck.slice(start, start + pageSize);
});
const marqueeImages = $derived(
	pageImages.length ? [...pageImages, ...pageImages] : [],
);
const pageStart = $derived((page - 1) * pageSize);

function shuffle(list: PullImage[]): PullImage[] {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const a = out[i];
		const b = out[j];
		if (a && b) {
			out[i] = b;
			out[j] = a;
		}
	}
	return out;
}

function persist(): void {
	try {
		localStorage.setItem(PAGE_KEY, String(pageSize));
		localStorage.setItem(ORDER_KEY, orderMode);
		localStorage.setItem(AXIS_KEY, axis);
	} catch {
		/* ignore */
	}
}

$effect(() => {
	if (typeof window === "undefined") return;
	const size = Number(localStorage.getItem(PAGE_KEY));
	if (size === 10 || size === 20 || size === 50) pageSize = size;
	const order = localStorage.getItem(ORDER_KEY);
	if (order === "seq" || order === "shuffle") orderMode = order;
	const nextAxis = localStorage.getItem(AXIS_KEY);
	if (nextAxis === "vertical" || nextAxis === "marquee") axis = nextAxis;
});

$effect(() => {
	const key = `${result.sourceUrl}:${result.images.length}:${orderMode}`;
	if (key === sourceKey) return;
	sourceKey = key;
	deck = orderMode === "shuffle" ? shuffle(result.images) : [...result.images];
	page = 1;
	selected = {};
	note = "";
});

$effect(() => {
	if (page > pages) page = pages;
});

function setPageSize(next: PageSize): void {
	pageSize = next;
	page = 1;
	persist();
}

function setOrder(next: OrderMode): void {
	orderMode = next;
	persist();
}

function setAxis(next: Axis): void {
	axis = next;
	persist();
}

function toggle(url: string): void {
	if (skipClick) {
		skipClick = false;
		return;
	}
	selected = { ...selected, [url]: !selected[url] };
}

function pickAllPage(): void {
	const next = { ...selected };
	for (const image of pageImages) next[image.url] = true;
	selected = next;
}

function clearPick(): void {
	selected = {};
}

function wrapOffset(value: number): number {
	if (loopWidth <= 0) return value;
	let next = value % loopWidth;
	if (next > 0) next -= loopWidth;
	return next;
}

function paintTrack(): void {
	if (trackEl) trackEl.style.transform = `translate3d(${offsetX}px, 0, 0)`;
}

function measureLoop(): void {
	if (!trackEl) return;
	loopWidth = trackEl.scrollWidth / 2;
}

function resetReel(): void {
	offsetX = 0;
	velocity = 0;
	paintTrack();
}

function onMarqueeDown(event: PointerEvent): void {
	if (event.button !== 0 || !marqueeEl) return;
	const target = event.target;
	if (
		target instanceof Element &&
		target.closest(".check, .zoom, footer button")
	) {
		return;
	}
	dragActive = true;
	grabbing = true;
	velocity = 0;
	movedPx = 0;
	skipClick = false;
	lastPointerX = event.clientX;
	lastPointerTs = event.timeStamp;
	try {
		marqueeEl.setPointerCapture(event.pointerId);
	} catch {
		/* synthetic or already-released pointer */
	}
}

function onMarqueeMove(event: PointerEvent): void {
	if (!dragActive) return;
	const dx = event.clientX - lastPointerX;
	const dt = Math.max(8, event.timeStamp - lastPointerTs);
	velocity = Math.max(-3.8, Math.min(3.8, dx / dt));
	lastPointerX = event.clientX;
	lastPointerTs = event.timeStamp;
	movedPx += Math.abs(dx);
	measureLoop();
	offsetX = wrapOffset(offsetX + dx);
	paintTrack();
	if (movedPx > 7) skipClick = true;
	event.preventDefault();
}

function onMarqueeUp(event: PointerEvent): void {
	if (!dragActive) return;
	dragActive = false;
	grabbing = false;
	if (movedPx <= 7) velocity = 0;
	else velocity *= 1.18;
	try {
		marqueeEl?.releasePointerCapture(event.pointerId);
	} catch {
		/* already released */
	}
}

$effect(() => {
	pageImages;
	if (axis !== "marquee") return;
	resetReel();
});

$effect(() => {
	if (axis !== "marquee" || typeof window === "undefined") return;
	void pageImages.length;
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let live = true;
	let prev = performance.now();
	let rafId = 0;
	const tick = (now: number) => {
		if (!live) return;
		const dt = Math.min(32, now - prev);
		prev = now;
		measureLoop();
		if (!dragActive) {
			if (Math.abs(velocity) > 0.02) {
				offsetX = wrapOffset(offsetX + velocity * dt);
				velocity *= 0.955 ** (dt / 16);
				if (Math.abs(velocity) < 0.02) velocity = 0;
				paintTrack();
			} else if (!reduced && loopWidth > 0) {
				const seconds = Math.max(28, pageImages.length * 5.2);
				offsetX = wrapOffset(offsetX - (loopWidth / (seconds * 1000)) * dt);
				paintTrack();
			}
		}
		rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);
	return () => {
		live = false;
		cancelAnimationFrame(rafId);
	};
});

async function saveOne(image: PullImage): Promise<void> {
	const a = document.createElement("a");
	a.href = pullFileUrl(image, true);
	a.download = image.filename;
	a.rel = "noreferrer";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

function targets(): PullImage[] {
	if (range === "selected") return deck.filter((image) => selected[image.url]);
	if (range === "all") return deck;
	return pageImages;
}

async function ensureFancybox(): Promise<
	typeof import("@fancyapps/ui")["Fancybox"]
> {
	const mod = await import("@fancyapps/ui");
	if (!fancyReady) {
		const css = await import("@fancyapps/ui/dist/fancybox/fancybox.css?url");
		const href = css.default;
		if (
			typeof href === "string" &&
			!document.head.querySelector(`link[href="${href}"]`)
		) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = href;
			document.head.appendChild(link);
		}
		fancyReady = true;
	}
	return mod.Fancybox;
}

async function zoomAt(index: number): Promise<void> {
	const Fancybox = await ensureFancybox();
	const local = index - pageStart;
	Fancybox.show(
		pageImages.map((image) => ({
			src: pullFileUrl(image),
			type: "image" as const,
			caption: image.filename,
		})),
		{ startIndex: Math.max(0, local) },
	);
}

async function runDownload(): Promise<void> {
	const list = targets();
	if (!list.length) {
		note = range === "selected" ? "还没有勾选图片。" : "这一页没有图。";
		return;
	}
	note = "";
	if (pack === "each") {
		busy = `逐张 0/${list.length}`;
		try {
			for (let i = 0; i < list.length; i++) {
				const image = list[i];
				if (!image) continue;
				busy = `逐张 ${i + 1}/${list.length}`;
				await saveOne(image);
				await new Promise((r) => setTimeout(r, 360));
			}
		} finally {
			busy = "";
		}
		return;
	}

	busy = `打包 0/${list.length}`;
	const entries: { name: string; data: Uint8Array }[] = [];
	let failed = 0;
	try {
		for (let i = 0; i < list.length; i++) {
			const image = list[i];
			if (!image) continue;
			busy = `打包 ${i + 1}/${list.length}`;
			try {
				const res = await fetch(pullFileUrl(image));
				if (!res.ok) {
					failed += 1;
					continue;
				}
				entries.push({
					name: safePullName(image.filename, i),
					data: new Uint8Array(await res.arrayBuffer()),
				});
			} catch {
				failed += 1;
			}
		}
		if (!entries.length) {
			note = "卡包是空的，原图没拿到。";
			return;
		}
		const blob = await buildZip(entries);
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${result.channel}-${entries.length}p.zip`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		note = failed
			? `ZIP 已收下，有 ${failed} 张没打进去。`
			: `ZIP 卡包 ${entries.length} 张。`;
	} finally {
		busy = "";
	}
}
</script>

<section class="gallery" aria-label="取图画廊">
	<div class="hud">
		<div class="hud-copy">
			<p class="kicker">{result.channel}</p>
			<h3>{result.title}</h3>
			{#if result.author}
				<p class="author">@{result.author}</p>
			{/if}
			{#if result.warning}
				<p class="warn">{result.warning}</p>
			{/if}
		</div>
		<div class="hud-stats">
			<span>{deck.length} 张</span>
			<span>{page}/{pages} 页</span>
			{#if selectedCount}
				<span>{selectedCount} 已选</span>
			{/if}
		</div>
	</div>

	<div class="console" role="toolbar" aria-label="浏览选项">
		<div class="seg">
			<span>每页</span>
			{#each [10, 20, 50] as size (size)}
				<button
					type="button"
					class:on={pageSize === size}
					onclick={() => setPageSize(size as PageSize)}>{size}</button
				>
			{/each}
		</div>
		<div class="seg">
			<span>顺序</span>
			<button type="button" class:on={orderMode === "seq"} onclick={() => setOrder("seq")}
				>按序</button
			>
			<button
				type="button"
				class:on={orderMode === "shuffle"}
				onclick={() => setOrder("shuffle")}>乱序</button
			>
		</div>
		<div class="seg">
			<span>预览</span>
			<button type="button" class:on={axis === "vertical"} onclick={() => setAxis("vertical")}
				>上下</button
			>
			<button type="button" class:on={axis === "marquee"} onclick={() => setAxis("marquee")}
				>左右</button
			>
		</div>
		<div class="seg">
			<span>勾选</span>
			<button type="button" onclick={pickAllPage}>本页全选</button>
			<button type="button" onclick={clearPick}>清空勾选</button>
		</div>
	</div>

	<div class="console pack">
		<div class="seg">
			<span>范围</span>
			<button type="button" class:on={range === "page"} onclick={() => (range = "page")}
				>本页</button
			>
			<button
				type="button"
				class:on={range === "selected"}
				onclick={() => (range = "selected")}>已选</button
			>
			<button type="button" class:on={range === "all"} onclick={() => (range = "all")}
				>全部</button
			>
		</div>
		<div class="seg">
			<span>收下</span>
			<button type="button" class:on={pack === "each"} onclick={() => (pack = "each")}
				>逐张</button
			>
			<button type="button" class:on={pack === "zip"} onclick={() => (pack = "zip")}
				>ZIP 卡包</button
			>
		</div>
		<button type="button" class="wipe" onclick={onClear}>清空浏览</button>
		<button type="button" class="go" disabled={Boolean(busy)} onclick={() => void runDownload()}>
			{busy || (pack === "zip" ? "下载卡包" : "下载到文件夹")}
		</button>
		<p class="hint">点图片勾选。按住左右拖，松手会滑出去。右上放大镜看大图。右键仍可另开原图。卡包这版做 ZIP。</p>
	</div>

	{#if note}
		<p class="note">{note}</p>
	{/if}

	<div class="pager">
		<button type="button" disabled={page <= 1} onclick={() => (page -= 1)}>上一页</button>
		<ol>
			{#each Array.from({ length: pages }, (_, i) => i + 1) as n (n)}
				{#if pages <= 9 || n === 1 || n === pages || Math.abs(n - page) <= 2}
					<li>
						<button type="button" class:on={page === n} onclick={() => (page = n)}>{n}</button>
					</li>
				{:else if n === page - 3 || n === page + 3}
					<li class="gap">…</li>
				{/if}
			{/each}
		</ol>
		<button type="button" disabled={page >= pages} onclick={() => (page += 1)}>下一页</button>
	</div>

	{#snippet frame(image: PullImage, index: number, cover: boolean)}
		<div class="card" class:cover class:picked={selected[image.url]}>
			<button
				type="button"
				class="check"
				class:on={selected[image.url]}
				aria-pressed={selected[image.url]}
				aria-label={selected[image.url] ? "取消选择" : "选择这张"}
				onclick={() => toggle(image.url)}
			>
				{#if selected[image.url]}
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							fill="currentColor"
							d="M9.2 16.6 4.8 12.2l1.4-1.4 3 3 8.6-8.6 1.4 1.4z"
						/>
					</svg>
				{/if}
			</button>
			<button
				type="button"
				class="zoom"
				aria-label="放大预览"
				title="放大预览"
				onclick={() => void zoomAt(index)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12m0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8m6.3 9.9 4.4 4.4-1.4 1.4-4.4-4.4a8 8 0 1 1 1.4-1.4M9 7h2v2h2v2h-2v2H9v-2H7V9h2z"
					/>
				</svg>
			</button>
			<button
				type="button"
				class="pick"
				aria-pressed={selected[image.url]}
				aria-label={selected[image.url] ? `取消选择图 ${index + 1}` : `选择图 ${index + 1}`}
				onclick={() => toggle(image.url)}
			>
				<img
					src={pullFileUrl(image)}
					alt={`图 ${index + 1}`}
					loading="lazy"
					draggable="false"
				/>
			</button>
			<footer>
				<span>{String(index + 1).padStart(2, "0")}</span>
				<button type="button" onclick={() => void saveOne(image)}>下载</button>
			</footer>
		</div>
	{/snippet}

	{#if axis === "marquee"}
		<div
			bind:this={marqueeEl}
			class="marquee is-grab"
			class:is-grabbing={grabbing}
			role="region"
			aria-label="左右跑马灯预览"
			onpointerdown={onMarqueeDown}
			onpointermove={onMarqueeMove}
			onpointerup={onMarqueeUp}
			onpointercancel={onMarqueeUp}
		>
			<div class="track" bind:this={trackEl}>
				{#each marqueeImages as image, i (image.url + ":" + i)}
					{@render frame(image, pageStart + (i % pageImages.length), true)}
				{/each}
			</div>
		</div>
	{:else}
		<div class="photo-grid">
			{#each pageImages as image, i (image.url)}
				{@render frame(image, pageStart + i, false)}
			{/each}
		</div>
	{/if}
</section>

<style>
	.gallery {
		margin-top: 0.85rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.hud {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
		flex-wrap: wrap;
		width: 100%;
		max-width: 100%;
		padding: 0 1.2rem;
		margin-bottom: 0.75rem;
		box-sizing: border-box;
	}

	.kicker,
	.author,
	.hud-stats span,
	.hint,
	.note,
	.card footer,
	.seg > span {
		color: #cbb7b4;
	}

	.kicker,
	.seg > span {
		margin: 0 0 0.28rem;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h3 {
		margin: 0 0 0.25rem;
		font-size: 1.12rem;
		color: #fff;
	}

	.author,
	.warn {
		margin: 0;
		font-size: 0.85rem;
	}

	.warn {
		color: #e8c4a0;
		margin-top: 0.3rem;
	}

	.hud-stats {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
	}

	.hud-stats span,
	.wipe {
		padding: 0.28rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 0.72rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.wipe {
		color: #f6ecea;
		cursor: pointer;
	}

	.console {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1rem;
		align-items: center;
		margin: 0 1.2rem 0.55rem;
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.seg {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
	}

	.seg > span {
		margin: 0 0.15rem 0 0;
		width: 2.1rem;
	}

	.seg button,
	.pager button,
	.card footer button {
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: transparent;
		color: #f6ecea;
		border-radius: 999px;
		padding: 0.32rem 0.78rem;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.seg button.on,
	.pager button.on,
	.go {
		background: #c67b55;
		border-color: #c67b55;
		color: #fff;
		font-weight: 650;
	}

	.go {
		margin-left: auto;
		padding: 0.55rem 1.1rem;
		border: 0;
		border-radius: 999px;
		cursor: pointer;
	}

	.go:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.hint,
	.note {
		margin: 0;
		width: 100%;
		font-size: 0.75rem;
		line-height: 1.55;
	}

	.note {
		color: #e8c4a0;
		margin: 0 1.2rem 0.7rem;
	}

	.pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin: 0.15rem 0 0.7rem;
	}

	.pager ol {
		display: flex;
		gap: 0.28rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.pager .gap {
		color: #cbb7b4;
		padding: 0.2rem 0.15rem;
		font-size: 0.78rem;
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.55rem;
		padding: 0 0.55rem 0.5rem;
	}

	.card {
		position: relative;
		overflow: hidden;
		border-radius: 16px;
		background: #120e0d;
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: pointer;
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
	}

	.card.picked {
		border-color: #4d8dff;
		box-shadow: 0 0 0 2px #4d8dff;
	}

	.pick {
		display: block;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		background: #120e0d;
		cursor: pointer;
	}

	.pick img {
		display: block;
		width: 100%;
		height: auto;
	}

	.card.cover .pick,
	.card.cover .pick img {
		height: 100%;
	}

	.card.cover .pick img {
		object-fit: cover;
	}

	.card footer {
		position: absolute;
		z-index: 2;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.45rem;
		padding: 1.6rem 0.75rem 0.7rem;
		font-size: 0.78rem;
		background: linear-gradient(180deg, transparent, rgba(8, 6, 6, 0.82));
		color: #fff;
		pointer-events: none;
	}

	.card footer button {
		pointer-events: auto;
	}

	.check,
	.zoom {
		position: absolute;
		z-index: 3;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		cursor: pointer;
	}

	.check {
		top: 0.72rem;
		left: 0.72rem;
		border: 2px solid rgba(255, 255, 255, 0.88);
		background: rgba(8, 8, 8, 0.18);
		backdrop-filter: blur(8px);
		color: #fff;
	}

	.check.on {
		background: #2f6dff;
		border-color: #2f6dff;
	}

	.zoom {
		top: 0.72rem;
		right: 0.72rem;
		border: 0;
		background: rgba(8, 8, 8, 0.58);
		color: #fff;
		backdrop-filter: blur(8px);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
	}

	.check svg,
	.zoom svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.marquee {
		overflow: hidden;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		height: max(560px, calc(100dvh - 16.5rem));
		margin: 0;
		border-radius: 0 0 16px 16px;
		touch-action: pan-y;
		user-select: none;
		cursor: grab;
		background:
			radial-gradient(1200px 280px at 50% 100%, rgba(198, 123, 85, 0.12), transparent),
			rgba(0, 0, 0, 0.28);
		mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
	}

	.marquee.is-grabbing {
		cursor: grabbing;
	}

	.track {
		display: flex;
		align-items: stretch;
		gap: 1rem;
		height: 100%;
		width: max-content;
		padding: 0.9rem 1.2rem;
		will-change: transform;
	}

	.track .card,
	.track .pick {
		cursor: grab;
	}

	.marquee.is-grabbing .card,
	.marquee.is-grabbing .pick {
		cursor: grabbing;
	}

	.track .card {
		height: 100%;
		width: calc(max(560px, 100dvh - 16.5rem) * 0.72);
		flex: 0 0 calc(max(560px, 100dvh - 16.5rem) * 0.72);
	}

	@media (max-width: 720px) {
		.hud,
		.console {
			display: grid;
			margin-left: 0.7rem;
			margin-right: 0.7rem;
		}

		.go {
			margin-left: 0;
		}

		.photo-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.track .card {
			width: calc(min(64vh, 720px) * 0.72);
			flex-basis: calc(min(64vh, 720px) * 0.72);
		}
	}
</style>
