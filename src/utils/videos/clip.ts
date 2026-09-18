export function youtubeId(input: string): string | null {
	const raw = input.trim();
	const hit =
		/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(
			raw,
		);
	return hit?.[1] ?? null;
}

export function biliId(input: string): string | null {
	return /BV[0-9A-Za-z]+/.exec(input)?.[0] ?? null;
}

export function clipKey(input: string): string {
	const bv = biliId(input);
	if (bv) return bv;
	const yt = youtubeId(input);
	return yt ? `yt_${yt}` : "";
}

export function youtubeIdFromKey(key: string): string {
	return key.startsWith("yt_") ? key.slice(3) : "";
}

export function isYoutubeMeta(bvid: string, platform?: string): boolean {
	return platform === "youtube" || bvid.startsWith("yt_");
}
