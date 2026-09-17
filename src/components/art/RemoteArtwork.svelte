<script lang="ts">
	import { onMount } from "svelte";

	// 只有真正进入视口才发起请求。
	//
	// 为什么不用原生的 loading="lazy"：展厅是纵向多列（CSS columns）布局，
	// 浏览器在这种布局下会把整批图片一次性排进加载队列——实测 60 张全部处于
	// 请求中，而每张跨洋要 2 秒，于是首屏要等 20 秒。自己盯着视口最可靠。
	let { src, ratio = "4 / 3", alt = "" }: { src: string; ratio?: string; alt?: string } = $props();

	let host: HTMLDivElement;
	let visible = $state(false);
	let failed = $state(false);

	onMount(() => {
		if (!("IntersectionObserver" in window)) {
			visible = true;
			return;
		}
		const observer = new IntersectionObserver(
			entries => {
				if (entries.some(entry => entry.isIntersecting)) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin: "240px" },
		);
		observer.observe(host);
		return () => observer.disconnect();
	});
</script>

<div class="shot" bind:this={host} style={`aspect-ratio: ${ratio}`}>
	{#if visible && !failed}
		<img {src} {alt} decoding="async" onerror={() => (failed = true)} />
	{/if}
</div>

<style>
	.shot {
		display: block;
		width: 100%;
		background: #e5e2dc;
		overflow: hidden;
	}
	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s;
	}
	@media (prefers-reduced-motion: reduce) {
		img {
			transition: none;
		}
	}
</style>
