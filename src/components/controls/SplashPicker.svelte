<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { SplashStyleId } from "@/types/atmosphereConfig";

type SplashOption = {
	id: SplashStyleId;
	label: string;
};

type Props = {
	enabled: boolean;
	style: SplashStyleId;
	onEnabledChange: (enabled: boolean) => void;
	onStyleChange: (style: SplashStyleId) => void;
};

let { enabled, style, onEnabledChange, onStyleChange }: Props = $props();

const options: SplashOption[] = [
	{ id: "logo", label: i18n(I18nKey.splashStyleLogo) },
	{ id: "petal", label: i18n(I18nKey.splashStylePetal) },
	{ id: "wash", label: i18n(I18nKey.splashStyleWash) },
];
</script>

<button
	type="button"
	class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all"
	class:bg-(--btn-regular-bg-hover)={enabled}
	onclick={() => onEnabledChange(!enabled)}
>
	<span class="text-sm flex-1">{i18n(I18nKey.splashPlayOnHome)}</span>
	<div
		class="w-10 h-5 rounded-full transition-all duration-200 relative"
		class:bg-(--primary)={enabled}
		class:bg-(--btn-regular-bg-active)={!enabled}
	>
		<div
			class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200"
			class:left-0.5={!enabled}
			class:left-5={enabled}
		></div>
	</div>
</button>
<p class="mt-1 mb-2 px-1 text-[0.7rem] leading-relaxed text-black/45 dark:text-white/45">
	{i18n(I18nKey.splashPreviewHint)}
</p>
<div class="splash-style-grid" role="listbox" aria-label={i18n(I18nKey.splashAnimation)}>
	{#each options as option (option.id)}
		<button
			type="button"
			role="option"
			aria-selected={style === option.id}
			class="splash-style-card"
			class:is-selected={style === option.id}
			onclick={() => onStyleChange(option.id)}
		>
			<span class="splash-style-preview" data-style={option.id} aria-hidden="true"></span>
			<span class="splash-style-label">{option.label}</span>
		</button>
	{/each}
</div>
