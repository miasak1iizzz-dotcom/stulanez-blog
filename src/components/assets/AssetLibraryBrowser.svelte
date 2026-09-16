<script lang="ts">
	import type { LibraryAsset } from "@/types/assetLibraryConfig";
	import { assetLibraryConfig } from "@/config/assetLibraryConfig";

	type Props = { assets: LibraryAsset[] };
	let { assets }: Props = $props();

	let category = $state("");
	const filtered = $derived(
		category ? assets.filter((a) => a.category === category) : assets,
	);
	const cats = assetLibraryConfig.categories;
</script>

<section class="lib" aria-label="数字资源库">
	<header>
		<span class="eyebrow">STULANEZ / LIBRARY</span>
		<h1>{assetLibraryConfig.title}<span>{assetLibraryConfig.description}</span></h1>
	</header>

	<nav class="cats" aria-label="分类">
		<button type="button" class:on={!category} onclick={() => (category = "")}>全部</button>
		{#each cats as c}
			<button
				type="button"
				class:on={category === c.id}
				onclick={() => (category = c.id)}>{c.name}</button
			>
		{/each}
	</nav>

	<p class="meta">{filtered.length.toLocaleString()} 张 · 本页只读展示，原图在库目录</p>

	{#if filtered.length}
		<div class="grid">
			{#each filtered as item (item.id)}
				<figure>
					<a href={item.src} target="_blank" rel="noreferrer">
						<img src={item.src} alt={item.title} loading="lazy" />
					</a>
					<figcaption>
						<strong>{item.title}</strong>
						<span>{item.source}</span>
					</figcaption>
				</figure>
			{/each}
		</div>
	{:else}
		<div class="empty">
			<h2>库还是空的</h2>
			<p>下载管线落盘到 <code>public/assets/library/&lt;分类&gt;/</code> 后，这里会自动出现。</p>
		</div>
	{/if}
</section>

<style>
	.lib {
		--ink: #1f2430;
		--muted: #6b7385;
		--paper: #f4f6fb;
		color: var(--ink);
		background: var(--paper);
		border-radius: 18px;
		padding: clamp(1.2rem, 3vw, 2.4rem);
		min-height: 70vh;
	}
	:global(.dark) .lib {
		--ink: #e8ecf5;
		--muted: #9aa3b5;
		--paper: #171b24;
	}
	.eyebrow {
		letter-spacing: 0.16em;
		font-size: 0.68rem;
		color: var(--muted);
	}
	h1 {
		margin: 0.4rem 0 0;
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: clamp(1.8rem, 4vw, 2.6rem);
		font-weight: 500;
	}
	h1 span {
		display: block;
		margin-top: 0.45rem;
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--muted);
	}
	.cats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 1.2rem 0 0.7rem;
	}
	.cats button {
		font: inherit;
		cursor: pointer;
		border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		background: transparent;
		color: var(--muted);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
		font-size: 0.8rem;
	}
	.cats button.on {
		background: var(--ink);
		color: var(--paper);
		border-color: transparent;
	}
	.meta {
		margin: 0 0 1rem;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.9rem;
	}
	figure {
		margin: 0;
	}
	img {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	figcaption {
		margin-top: 0.4rem;
	}
	figcaption strong {
		display: block;
		font-size: 0.78rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	figcaption span {
		font-size: 0.68rem;
		color: var(--muted);
	}
	.empty {
		padding: 3rem 0.5rem;
		text-align: center;
	}
	.empty h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 500;
	}
	.empty p {
		margin: 0.6rem 0 0;
		color: var(--muted);
		font-size: 0.88rem;
	}
	code {
		font-size: 0.8em;
	}
</style>
