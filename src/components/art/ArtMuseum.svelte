<script lang="ts">
	import { onMount } from "svelte";
	import ArtGallery from "./ArtGallery.svelte";
	import CurateDesk from "./CurateDesk.svelte";
	import LocalLibrary from "./LocalLibrary.svelte";
	import { isOwnerDevice, OWNER_CHANGE_EVENT } from "@/utils/owner";

	// 艺术馆分三层：
	//   展厅（ArtGallery）—— 所有访客都能看，读站上的展品清单；
	//   策展台（CurateDesk）—— 站长专属，选本地图库、判图打标、写回展品目录；
	//   本机图库（LocalLibrary）—— 站长专属，浏览原始全库，原图不出本机。
	// 协议「站长与游客」：维护入口只对站长设备出现，游客界面不出现。
	let owner = $state(false);
	let view = $state<"gallery" | "curate" | "local">("gallery");

	onMount(() => {
		const sync = () => {
			owner = isOwnerDevice();
			if (!owner) view = "gallery";
		};
		sync();
		window.addEventListener(OWNER_CHANGE_EVENT, sync);
		return () => window.removeEventListener(OWNER_CHANGE_EVENT, sync);
	});
</script>

{#if owner && view === "curate"}
	<CurateDesk onExit={() => (view = "gallery")} />
{:else if owner && view === "local"}
	<LocalLibrary onExit={() => (view = "gallery")} />
{:else}
	<ArtGallery
		{owner}
		onCurate={owner ? () => (view = "curate") : undefined}
		onLocal={owner ? () => (view = "local") : undefined}
	/>
{/if}
