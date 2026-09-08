<script lang="ts">
	import { onMount } from "svelte";
	import { artworkFile, type Artwork } from "@/utils/art-library";
	let { item, large = false }: { item: Artwork; large?: boolean } = $props();
	let host: HTMLDivElement;
	let src = $state("");
	let failed = $state(false);
	onMount(() => {
		let generation = 0;
		let owned = "";
		function clear() { generation++; if (owned) URL.revokeObjectURL(owned); owned = ""; src = ""; }
		async function show() {
			const ticket = ++generation;
			try {
				if (item.preview) { src = item.preview; return; }
				const file = await artworkFile(item);
				if (ticket !== generation) return;
				owned = URL.createObjectURL(file); src = owned;
			} catch { if (ticket === generation) failed = true; }
		}
		const observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) { if (!src) void show(); }
			else clear();
		}, { rootMargin: "240px" });
		observer.observe(host);
		return () => { observer.disconnect(); clear(); };
	});
</script>

<div class:large bind:this={host}>
	{#if failed}<span class="unavailable">图片无法读取</span>
	{:else if src}<img {src} alt={item.name} loading={large ? "eager" : "lazy"} decoding="async" onerror={() => failed = true} />
	{:else}<span class="waiting" aria-label="正在读取图片"></span>{/if}
</div>

<style>
	div { width: 100%; aspect-ratio: 4 / 5; background: #e5e2dc; overflow: hidden; display: grid; place-items: center; }
	img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
	.large { aspect-ratio: auto; height: min(72vh, 900px); background: #171819; }
	.large img { object-fit: contain; }
	.unavailable { font-size: 13px; color: #666; }
	.waiting { width: 24px; height: 24px; border: 2px solid #aaa; border-top-color: transparent; border-radius: 50%; }
</style>
