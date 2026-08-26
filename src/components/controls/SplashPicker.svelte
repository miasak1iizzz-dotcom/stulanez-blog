<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@/components/common/Icon.svelte";
import {
	getSplashLowerBanners,
	getSplashPortraits,
	getSplashUpperBanners,
} from "@/utils/splash-catalog-utils";

type Props = {
	enabled: boolean;
	portrait: string;
	upper: string;
	lower: string;
	onEnabledChange: (enabled: boolean) => void;
	onPortraitChange: (id: string) => void;
	onUpperChange: (id: string) => void;
	onLowerChange: (id: string) => void;
};

let {
	enabled,
	portrait,
	upper,
	lower,
	onEnabledChange,
	onPortraitChange,
	onUpperChange,
	onLowerChange,
}: Props = $props();

const portraits = getSplashPortraits();
const upperBanners = getSplashUpperBanners();
const lowerBanners = getSplashLowerBanners();
</script>

<button
	type="button"
	class="settings-row"
	class:is-on={enabled}
	onclick={() => onEnabledChange(!enabled)}
>
	<Icon icon="material-symbols:play-arrow-rounded" class="text-[1.25rem] shrink-0"></Icon>
	<span class="text-sm flex-1 text-left">{i18n(I18nKey.splashPlayOnHome)}</span>
	<div
		class="settings-switch"
		class:is-on={enabled}
	>
		<span class="settings-switch-knob"></span>
	</div>
</button>
<p class="settings-hint">{i18n(I18nKey.splashPreviewHint)}</p>

<p class="splash-subhead">{i18n(I18nKey.splashSelectCharacter)}</p>
<div class="splash-portrait-grid" role="listbox" aria-label={i18n(I18nKey.splashSelectCharacter)}>
	{#each portraits as item (item.id)}
		<button
			type="button"
			role="option"
			aria-selected={portrait === item.id}
			class="splash-portrait"
			class:is-selected={portrait === item.id}
			onclick={() => onPortraitChange(item.id)}
		>
			<span class="splash-portrait-frame">
				<img src={item.image} alt="" width="72" height="72" loading="lazy" decoding="async" />
			</span>
			<span class="splash-portrait-name">
				{item.name}{item.badge ? ` (${item.badge})` : ""}
			</span>
		</button>
	{/each}
</div>

<p class="splash-subhead">{i18n(I18nKey.splashUpperBanner)}</p>
<div class="splash-banner-grid" role="listbox" aria-label={i18n(I18nKey.splashUpperBanner)}>
	{#each upperBanners as item (item.id)}
		<button
			type="button"
			role="option"
			aria-selected={upper === item.id}
			class="splash-banner-wrap"
			onclick={() => onUpperChange(item.id)}
		>
			<span class="splash-banner" class:is-selected={upper === item.id}>
				<img src={item.image} alt="" width="160" height="54" loading="lazy" decoding="async" />
			</span>
			{#if item.name}
				<span class="splash-banner-name">{item.name}</span>
			{/if}
		</button>
	{/each}
</div>

<p class="splash-subhead">{i18n(I18nKey.splashLowerBanner)}</p>
<div class="splash-banner-grid" role="listbox" aria-label={i18n(I18nKey.splashLowerBanner)}>
	{#each lowerBanners as item (item.id)}
		<button
			type="button"
			role="option"
			aria-selected={lower === item.id}
			class="splash-banner-wrap"
			onclick={() => onLowerChange(item.id)}
		>
			<span class="splash-banner" class:is-selected={lower === item.id}>
				<img src={item.image} alt="" width="160" height="54" loading="lazy" decoding="async" />
			</span>
			{#if item.name}
				<span class="splash-banner-name">{item.name}</span>
			{/if}
		</button>
	{/each}
</div>
