<script lang="ts">
	import { onMount } from "svelte";
	import type { ArtManifest, ArtManifestItem } from "@/types/artManifest";

	// 阶段 2：清单优先从对象存储取；取不到就退回站内 public/art，切换期不会白屏。
	const REMOTE_MANIFEST = "https://img.stulanez.com/art/manifest.json";
	const batchSize = 60;
	const gradeOrder = ["8K", "4K", "2K", "1080P", "HD", "低清"];

	let { owner = false, onLocal, onCurate }: { owner?: boolean; onLocal?: () => void; onCurate?: () => void } = $props();

	let manifest = $state<ArtManifest | null>(null);
	/** 清单实际来自哪里：remote=对象存储，local=站内兜底 */
	let manifestFrom = $state<"remote" | "local">("local");
	let loading = $state(true);
	let failed = $state(false);
	let query = $state("");
	let activeUse = $state("");
	let activeGrade = $state("");
	let page = $state(0);
	let selected = $state<ArtManifestItem | null>(null);
	let dialog: HTMLDialogElement;
	let returnFocus: HTMLElement | null = null;

	const items = $derived(manifest?.items ?? []);
	const uses = $derived([...new Set(items.flatMap(item => item.auto.uses))].sort((a, b) => a.localeCompare(b, "zh-CN")));
	const grades = $derived(gradeOrder.filter(grade => items.some(item => item.auto.grade === grade)));
	const filtered = $derived(
		items.filter(item => {
			if (activeUse && !item.auto.uses.includes(activeUse)) return false;
			if (activeGrade && item.auto.grade !== activeGrade) return false;
			const word = query.trim().toLocaleLowerCase();
			if (!word) return true;
			return `${item.origin.path} ${item.auto.uses.join(" ")} ${item.ratio} ${item.auto.grade}`
				.toLocaleLowerCase()
				.includes(word);
		}),
	);
	const visible = $derived(filtered.slice(0, (page + 1) * batchSize));
	const totalBytes = $derived(items.reduce((sum, item) => sum + item.bytes, 0));
	const currentIndex = $derived(selected ? filtered.findIndex(item => item.id === selected?.id) : -1);

	function assetUrl(key: string): string {
		const remote = manifestFrom === "remote" ? (manifest?.baseUrl ?? "").replace(/\/+$/, "") : "";
		return remote ? `${remote}/${key}` : `/${key}`;
	}

	function thumb(item: ArtManifestItem, size: "480" | "1280"): string {
		return assetUrl(item.thumbs[size] ?? item.thumbs["480"] ?? item.key);
	}

	function name(item: ArtManifestItem): string {
		return item.origin.path.split("/").pop() || item.id;
	}

	onMount(async () => {
		try {
			manifest = await loadManifest();
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	});

	/** 先试对象存储，失败退回站内清单。 */
	async function loadManifest(): Promise<ArtManifest> {
		try {
			const remote = await fetch(REMOTE_MANIFEST, { cache: "no-cache" });
			if (remote.ok) {
				manifestFrom = "remote";
				return (await remote.json()) as ArtManifest;
			}
		} catch {
			// 远端不可用（域名还没接、离线等），走站内兜底
		}
		const local = await fetch("/art/manifest.json", { cache: "no-cache" });
		if (!local.ok) throw new Error(String(local.status));
		manifestFrom = "local";
		return (await local.json()) as ArtManifest;
	}

	$effect(() => {
		query;
		activeUse;
		activeGrade;
		page = 0;
	});

	function reset() {
		query = "";
		activeUse = "";
		activeGrade = "";
	}

	async function open(item: ArtManifestItem) {
		returnFocus = document.activeElement as HTMLElement;
		selected = item;
		await Promise.resolve();
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
		selected = null;
		returnFocus?.focus();
	}

	function move(step: number) {
		if (!selected || currentIndex < 0) return;
		const next = filtered[currentIndex + step];
		if (next) selected = next;
	}

	function download(item: ArtManifestItem) {
		const link = document.createElement("a");
		link.href = thumb(item, "1280");
		link.download = name(item);
		document.body.append(link);
		link.click();
		link.remove();
	}
</script>

<section class="art-gallery" aria-label="艺术馆">
	<header class="masthead">
		<div>
			<span class="eyebrow">STULANEZ / ART MUSEUM</span>
			<h1>艺术馆<span>让喜欢的画面，重新被看见。</span></h1>
		</div>
		<div class="side">
			{#if !loading && !failed && items.length}
				<div class="ledger"><b>{items.length}</b><span>件展品 · {(totalBytes / 1024 / 1024).toFixed(0)} MB</span></div>
			{/if}
			{#if owner && onCurate}
				<button class="local" onclick={onCurate}>策展台<span aria-hidden="true"> ↗</span></button>
			{/if}
			{#if owner && onLocal}
				<button class="soft" onclick={onLocal}>本机图库<span aria-hidden="true"> ↗</span></button>
			{/if}
		</div>
	</header>

	{#if loading}
		<div class="state" role="status"><span class="spinner" aria-hidden="true"></span>正在布置展厅…</div>
	{:else if failed}
		<div class="state"><h2>展厅暂时打不开</h2><p>展品清单没有取到，稍后再来。</p></div>
	{:else if !items.length}
		<div class="state"><h2>新展筹备中</h2><p>第一批展品还在路上，敬请期待。</p></div>
	{:else}
		<div class="searchbox">
			<span aria-hidden="true">⌕</span>
			<input type="search" bind:value={query} placeholder="搜索文件名、用途、比例…" aria-label="搜索展品" />
		</div>
		<nav class="chips" aria-label="按用途筛选">
			<button class:on={!activeUse} onclick={() => (activeUse = "")}>全部用途</button>
			{#each uses as value}<button class:on={activeUse === value} onclick={() => (activeUse = activeUse === value ? "" : value)}>{value}</button>{/each}
		</nav>
		<nav class="chips" aria-label="按分辨率筛选">
			<button class:on={!activeGrade} onclick={() => (activeGrade = "")}>全部等级</button>
			{#each grades as value}<button class:on={activeGrade === value} onclick={() => (activeGrade = activeGrade === value ? "" : value)}>{value}</button>{/each}
		</nav>
		<div class="count">
			{filtered.length} / {items.length} 件
			{#if activeUse || activeGrade || query}<button class="reset" onclick={reset}>重置筛选</button>{/if}
		</div>

		<div class="wall">
			{#each visible as item (item.id)}
				<figure>
					<button class="frame" onclick={() => open(item)} aria-label={`查看大图：${name(item)}`}>
						<img
							src={thumb(item, "480")}
							alt=""
							loading="lazy"
							decoding="async"
							width={item.width}
							height={item.height}
						/>
					</button>
					<figcaption>
						<strong title={item.origin.path}>{name(item)}</strong>
						<span>{item.width}×{item.height} · {item.ratio} · {(item.bytes / 1024).toFixed(0)} KB</span>
						<div class="tags">
							{#each item.auto.uses as use}<i>{use}</i>{/each}
							<i class="grade">{item.auto.grade}</i>
							{#if item.origin.duplicates?.length}<i class="dupe">重复 +{item.origin.duplicates.length}</i>{/if}
						</div>
					</figcaption>
				</figure>
			{/each}
		</div>

		{#if visible.length < filtered.length}
			<div class="more">
				<button onclick={() => (page += 1)}>继续逛 → 还有 {filtered.length - visible.length} 件</button>
			</div>
		{/if}
	{/if}

	<footer>
		艺术馆 · 私藏的另一种打开方式
		<span>{items.length ? `馆藏 ${items.length} 件，来自馆长的私人收藏。` : "相册与私人收藏，留给另一段故事。"}</span>
	</footer>
</section>

<dialog
	bind:this={dialog}
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
	onkeydown={(event) => {
		if (event.key === "ArrowLeft") move(-1);
		if (event.key === "ArrowRight") move(1);
	}}
	aria-label="展品大图"
>
	{#if selected}
		<div class="bar"><span>{name(selected)}</span><button onclick={close} aria-label="关闭大图">✕</button></div>
		<div class="stage"><img src={thumb(selected, "1280")} alt={name(selected)} decoding="async" /></div>
		<div class="details">
			<div>
				<strong>{name(selected)}</strong>
				<p>
					{selected.width}×{selected.height} · {selected.ratio} · {(selected.bytes / 1024).toFixed(0)} KB · {selected.auto.grade}
				</p>
				<div class="tags">
					{#each selected.auto.uses as use}<i>{use}</i>{/each}
					{#each selected.auto.colors as color}<i class="swatch" style={`background:${color}`}></i>{/each}
				</div>
			</div>
			<button class="dl" onclick={() => selected && download(selected)}>下载此图 ↓</button>
		</div>
		<div class="nav">
			<button disabled={currentIndex <= 0} onclick={() => move(-1)}>← 上一张</button>
			<span>{currentIndex + 1} / {filtered.length}</span>
			<button disabled={currentIndex < 0 || currentIndex >= filtered.length - 1} onclick={() => move(1)}>下一张 →</button>
		</div>
	{/if}
</dialog>

<style>
	.art-gallery {
		--ink: #25302b;
		--muted: #737970;
		--paper: #f8f7f3;
		background: var(--paper);
		color: var(--ink);
		border-radius: 18px;
		padding: clamp(20px, 4vw, 46px);
		min-width: 0;
	}
	:global(.dark) .art-gallery {
		--ink: #e7e8df;
		--muted: #a1a89e;
		--paper: #202620;
	}
	button,
	input {
		font: inherit;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #bc7639;
		outline-offset: 3px;
	}
	.masthead {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		align-items: center;
		justify-content: space-between;
	}
	.eyebrow {
		letter-spacing: 0.16em;
		font-size: 10px;
		color: var(--muted);
	}
	h1 {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: clamp(30px, 4vw, 48px);
		font-weight: 500;
		margin: 9px 0 0;
	}
	h1 span {
		display: block;
		font-family: inherit;
		font-size: 13px;
		font-weight: normal;
		color: var(--muted);
		margin-top: 9px;
	}
	.side {
		display: flex;
		gap: 14px;
		align-items: center;
	}
	.ledger {
		text-align: right;
		font-size: 11px;
		color: var(--muted);
	}
	.ledger b {
		display: block;
		font-size: 26px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.1;
	}
	.local {
		background: #324b3d;
		color: #fff;
		border: 0;
		border-radius: 7px;
		padding: 12px 16px;
		font-size: 12px;
		white-space: nowrap;
	}
	.soft {
		background: none;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		color: var(--ink);
		border-radius: 7px;
		padding: 11px 15px;
		font-size: 12px;
		white-space: nowrap;
	}
	.state {
		padding: 70px 10px;
		text-align: center;
		color: var(--muted);
		font-size: 13px;
	}
	.state h2 {
		font-size: 22px;
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 10px;
	}
	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		margin-right: 10px;
		border: 2px solid var(--muted);
		border-top-color: transparent;
		border-radius: 50%;
		vertical-align: -3px;
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
	.searchbox {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 13px 18px;
		margin-top: 26px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		border: 1px solid color-mix(in srgb, var(--ink) 9%, transparent);
		border-radius: 8px;
	}
	.searchbox > span {
		font-size: 26px;
		line-height: 1;
	}
	.searchbox input {
		width: 100%;
		border: 0;
		background: transparent;
		outline: none;
		color: var(--ink);
		font-size: 14px;
		min-width: 0;
	}
	.chips {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 14px;
	}
	.chips button {
		padding: 7px 14px;
		font-size: 12px;
		border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		background: transparent;
		color: var(--muted);
		border-radius: 999px;
	}
	.chips button.on {
		background: #324b3d;
		border-color: #324b3d;
		color: #fff;
	}
	.count {
		display: flex;
		gap: 12px;
		align-items: center;
		margin: 20px 0 18px;
		font-size: 12px;
		color: var(--muted);
	}
	.reset {
		background: none;
		border: 0;
		color: var(--muted);
		text-decoration: underline;
		font-size: 11px;
	}
	.wall {
		columns: 4 220px;
		column-gap: 18px;
	}
	figure {
		break-inside: avoid;
		margin: 0 0 20px;
	}
	.frame {
		display: block;
		width: 100%;
		padding: 0;
		border: 0;
		background: #e5e2dc;
		border-radius: 7px;
		overflow: hidden;
	}
	.frame img {
		display: block;
		width: 100%;
		height: auto;
		transition: transform 0.3s;
	}
	.frame:hover img {
		transform: scale(1.02);
	}
	@media (prefers-reduced-motion: reduce) {
		.frame img {
			transition: none;
		}
	}
	figcaption {
		margin-top: 9px;
		font-size: 11px;
		color: var(--muted);
	}
	figcaption strong {
		display: block;
		font-size: 12px;
		font-weight: 500;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tags {
		display: flex;
		gap: 5px;
		flex-wrap: wrap;
		margin-top: 7px;
	}
	.tags i {
		font-style: normal;
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--muted);
	}
	.tags i.grade {
		color: var(--ink);
	}
	.tags i.dupe {
		background: #f6e0d0;
		color: #8a4b1e;
	}
	.tags i.swatch {
		width: 14px;
		height: 14px;
		padding: 0;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.more {
		text-align: center;
		padding: 10px 0 4px;
	}
	.more button {
		padding: 12px 20px;
		font-size: 12px;
		border: 1px solid #859285;
		border-radius: 6px;
		background: transparent;
		color: var(--ink);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
		margin-top: 40px;
		padding-top: 20px;
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
		font-size: 10px;
		color: var(--muted);
	}
	dialog {
		width: min(1040px, 94vw);
		max-height: 94vh;
		padding: 0;
		border: 0;
		border-radius: 10px;
		background: var(--paper);
		color: var(--ink);
	}
	dialog::backdrop {
		background: #080b0cd9;
	}
	.bar,
	.details,
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 20px;
		font-size: 12px;
	}
	.bar span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar button {
		min-width: 32px;
		min-height: 32px;
		background: none;
		border: 0;
		color: var(--ink);
	}
	.stage {
		background: #171819;
		display: grid;
		place-items: center;
		min-height: 50vh;
	}
	.stage img {
		max-width: 100%;
		max-height: min(70vh, 860px);
		display: block;
	}
	.details strong {
		display: block;
		overflow-wrap: anywhere;
	}
	.details p {
		margin: 5px 0 0;
		color: var(--muted);
	}
	.dl {
		flex-shrink: 0;
		background: #324b3d;
		color: #fff;
		border: 0;
		padding: 11px 16px;
		border-radius: 6px;
		font-size: 12px;
	}
	.nav {
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.nav button {
		background: none;
		border: 0;
		color: var(--ink);
		font-size: 12px;
	}
	@media (max-width: 700px) {
		.wall {
			columns: 2 140px;
			column-gap: 12px;
		}
		.ledger {
			text-align: left;
		}
		.details {
			flex-wrap: wrap;
		}
		.nav {
			font-size: 11px;
		}
	}
</style>
