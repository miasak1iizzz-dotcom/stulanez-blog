import { backgroundWallpaper } from "@/config";

export type WallpaperPickerItem = {
	index: number;
	src: string;
	thumb: string;
};

function desktopWallpaperSrcs(): string[] {
	const src = backgroundWallpaper.src;
	if (typeof src === "string") return [src];
	if (Array.isArray(src)) return src;
	const desktop = src.desktop;
	if (!desktop) return [];
	return Array.isArray(desktop) ? desktop : [desktop];
}

function toThumbPath(src: string): string {
	const file = src.split("/").pop() ?? "";
	return `/assets/images/wallpaper/thumbs/${file}`;
}

export function getWallpaperPickerItems(): WallpaperPickerItem[] {
	return desktopWallpaperSrcs().map((src, index) => ({
		index,
		src,
		thumb: toThumbPath(src),
	}));
}
