<script lang="ts">
import type { Component } from "svelte";
import { onMount } from "svelte";

/**
 * 看板大 Tab 懒挂载：只有首次点开（或 URL hash 命中）才动态 import 重组件，
 * 避免一进指挥室就把清理/欲望/协议书/壁纸岛屿全部水合。
 */
type DeckKey =
	| "cleanup"
	| "desire"
	| "protocols"
	| "wallpaper-progress"
	| "wallpaper-roster";

let {
	deck,
	hashPrefixes = [],
	compact = false,
}: {
	deck: DeckKey;
	hashPrefixes?: string[];
	compact?: boolean;
} = $props();

let Comp = $state<Component<Record<string, unknown>> | null>(null);
let loading = $state(false);
let error = $state("");
let activated = $state(false);

const loaders: Record<
	DeckKey,
	() => Promise<Component<Record<string, unknown>>>
> = {
	cleanup: () => import("./CleanupMonitor.svelte").then((m) => m.default),
	desire: () => import("./DesireIncubator.svelte").then((m) => m.default),
	protocols: () => import("./ProtocolLibrary.svelte").then((m) => m.default),
	"wallpaper-progress": () =>
		import("./DouyinDownloadProgress.svelte").then((m) => m.default),
	"wallpaper-roster": () =>
		import("./DouyinRoster.svelte").then((m) => m.default),
};

async function activate() {
	if (activated && Comp) return;
	activated = true;
	if (Comp) return;
	loading = true;
	error = "";
	try {
		Comp = await loaders[deck]();
	} catch (e) {
		error = e instanceof Error ? e.message : "面板加载失败";
	} finally {
		loading = false;
	}
}

function hashMatches(): boolean {
	const hash = location.hash || "";
	if (hashPrefixes.some((p) => hash.startsWith(p))) return true;
	if (deck === "protocols" && hash.startsWith("#protocols")) return true;
	if (deck === "desire" && hash.startsWith("#desire")) return true;
	if (deck === "cleanup" && hash.startsWith("#cleanup")) return true;
	if (
		deck === "wallpaper-progress" &&
		hash.startsWith("#wallpaper") &&
		!hash.includes("roster")
	)
		return true;
	if (deck === "wallpaper-roster" && hash.includes("roster")) return true;
	return false;
}

onMount(() => {
	if (hashMatches()) void activate();
	const onShow = (event: Event) => {
		const detail = (event as CustomEvent<string>).detail;
		if (detail === deck) void activate();
	};
	window.addEventListener("ab-deck-show", onShow);
	return () => window.removeEventListener("ab-deck-show", onShow);
});
</script>

{#if error}
	<p class="lazy-err">{error}</p>
{:else if loading}
	<p class="lazy-wait">面板加载中…</p>
{:else if Comp}
	{#if deck === "wallpaper-roster"}
		<Comp compact={compact} />
	{:else}
		<Comp />
	{/if}
{:else}
	<p class="lazy-hint">点开此分区后加载，避免拖慢指挥室首页。</p>
{/if}

<style>
	.lazy-err {
		color: #fb7185;
		font-size: 0.9rem;
		padding: 1rem 0;
	}
	.lazy-wait,
	.lazy-hint {
		color: #a1a1aa;
		font-size: 0.85rem;
		padding: 1.25rem 0;
	}
</style>
