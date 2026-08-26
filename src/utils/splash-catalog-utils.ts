import { atmosphereConfig } from "@/config";
import type { SplashBanner, SplashPortrait } from "@/types/atmosphereConfig";

export function getSplashPortraits(): SplashPortrait[] {
	return atmosphereConfig.splash.portraits;
}

export function getSplashUpperBanners(): SplashBanner[] {
	return atmosphereConfig.splash.upperBanners;
}

export function getSplashLowerBanners(): SplashBanner[] {
	return atmosphereConfig.splash.lowerBanners;
}

function pickFrom<T extends { id: string }>(
	items: T[],
	id: string | null,
	fallbackId: string,
): T {
	return (
		items.find((item) => item.id === id) ??
		items.find((item) => item.id === fallbackId) ??
		items[0]
	);
}

export function resolveSplashPortrait(id: string | null): SplashPortrait {
	return pickFrom(
		atmosphereConfig.splash.portraits,
		id,
		atmosphereConfig.splash.defaultPortrait,
	);
}

export function resolveSplashUpper(id: string | null): SplashBanner {
	return pickFrom(
		atmosphereConfig.splash.upperBanners,
		id,
		atmosphereConfig.splash.defaultUpper,
	);
}

export function resolveSplashLower(id: string | null): SplashBanner {
	return pickFrom(
		atmosphereConfig.splash.lowerBanners,
		id,
		atmosphereConfig.splash.defaultLower,
	);
}

export function isSplashPortraitId(id: string | null): id is string {
	return (
		id !== null &&
		atmosphereConfig.splash.portraits.some((item) => item.id === id)
	);
}

export function isSplashUpperId(id: string | null): id is string {
	return (
		id !== null &&
		atmosphereConfig.splash.upperBanners.some((item) => item.id === id)
	);
}

export function isSplashLowerId(id: string | null): id is string {
	return (
		id !== null &&
		atmosphereConfig.splash.lowerBanners.some((item) => item.id === id)
	);
}

function pickRandomItem<T>(items: T[]): T {
	return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

export function pickRandomSplashSelection(): {
	portrait: string;
	upper: string;
	lower: string;
} {
	const portraits = atmosphereConfig.splash.portraits;
	const upperMaps = atmosphereConfig.splash.upperBanners;
	const lowerMaps = atmosphereConfig.splash.lowerBanners;
	const portrait = pickRandomItem(portraits);
	const upper = pickRandomItem(upperMaps);
	const lower = pickRandomItem(lowerMaps);
	return {
		portrait: portrait.id,
		upper: upper.id,
		lower: lower.id,
	};
}
