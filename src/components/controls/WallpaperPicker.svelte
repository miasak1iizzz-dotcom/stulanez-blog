<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { WallpaperPickerItem } from "@/utils/wallpaper-picker-utils";

type Props = {
	items: WallpaperPickerItem[];
	selectedIndex: number | null;
	onSelect: (index: number) => void;
};

let { items, selectedIndex, onSelect }: Props = $props();

function handleThumbError(event: Event) {
	const img = event.currentTarget as HTMLImageElement;
	const fallback = img.dataset.src;
	if (fallback && img.src !== fallback) {
		img.src = fallback;
	}
}
</script>

<div class="wallpaper-thumb-grid" role="listbox" aria-label={i18n(I18nKey.wallpaperBuiltin)}>
	{#each items as item (item.index)}
		<button
			type="button"
			role="option"
			aria-selected={selectedIndex === item.index}
			aria-label={`${i18n(I18nKey.wallpaperBuiltin)} ${item.index + 1}`}
			class="wallpaper-thumb"
			class:is-selected={selectedIndex === item.index}
			onclick={() => onSelect(item.index)}
		>
			<img
				src={item.thumb}
				data-src={item.src}
				alt=""
				width="160"
				height="90"
				loading="lazy"
				decoding="async"
				onerror={handleThumbError}
			/>
		</button>
	{/each}
</div>
