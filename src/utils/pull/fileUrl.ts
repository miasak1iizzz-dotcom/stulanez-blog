import type { PullImage } from "@/utils/pull/types";

export function pullFileUrl(image: PullImage, download = false): string {
	const params = new URLSearchParams({
		url: image.url,
		filename: image.filename,
	});
	if (download) params.set("download", "1");
	return `/api/pull/file/?${params.toString()}`;
}

export function safePullName(name: string, index: number): string {
	const base =
		name
			.replace(/[\\/:*?"<>|]+/g, "_")
			.replace(/\s+/g, " ")
			.trim() || "image";
	return `${String(index + 1).padStart(3, "0")}-${base}`;
}
