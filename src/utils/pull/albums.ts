import type { PullChannelId } from "@/utils/pull/types";

const KEY = "pull-albums-v1";
const MAX_ALBUMS = 80;

export type PullAlbum = {
	id: string;
	name: string;
	url: string;
	channel: PullChannelId;
	/** 上次提取时的帖子标题，仅作展示，不存图 */
	hintTitle?: string;
	/** 上次提取时的张数提示，不保证仍准确 */
	hintCount?: number;
	createdAt: string;
	updatedAt: string;
};

function readAll(): PullAlbum[] {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const data = JSON.parse(raw) as PullAlbum[];
		if (!Array.isArray(data)) return [];
		return data.filter(
			(item) =>
				item &&
				typeof item.id === "string" &&
				typeof item.name === "string" &&
				typeof item.url === "string" &&
				typeof item.channel === "string",
		);
	} catch {
		return [];
	}
}

function writeAll(albums: PullAlbum[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(albums.slice(0, MAX_ALBUMS)));
	} catch {
		/* ignore quota */
	}
}

function uid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `alb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listPullAlbums(channel?: PullChannelId | null): PullAlbum[] {
	const all = readAll();
	const filtered = channel ? all.filter((a) => a.channel === channel) : all;
	return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findAlbumByUrl(url: string): PullAlbum | undefined {
	const needle = url.trim();
	return readAll().find((a) => a.url === needle);
}

export function upsertPullAlbum(input: {
	name: string;
	url: string;
	channel: PullChannelId;
	hintTitle?: string;
	hintCount?: number;
	id?: string;
}): PullAlbum {
	const now = new Date().toISOString();
	const name = input.name.trim() || "未命名图集";
	const url = input.url.trim();
	const all = readAll();
	const existing =
		(input.id && all.find((a) => a.id === input.id)) ||
		all.find((a) => a.url === url);

	if (existing) {
		existing.name = name;
		existing.url = url;
		existing.channel = input.channel;
		if (input.hintTitle) existing.hintTitle = input.hintTitle;
		if (typeof input.hintCount === "number") existing.hintCount = input.hintCount;
		existing.updatedAt = now;
		writeAll([existing, ...all.filter((a) => a.id !== existing.id)]);
		return existing;
	}

	const album: PullAlbum = {
		id: uid(),
		name,
		url,
		channel: input.channel,
		hintTitle: input.hintTitle,
		hintCount: input.hintCount,
		createdAt: now,
		updatedAt: now,
	};
	writeAll([album, ...all]);
	return album;
}

export function renamePullAlbum(id: string, name: string): PullAlbum | null {
	const all = readAll();
	const item = all.find((a) => a.id === id);
	if (!item) return null;
	item.name = name.trim() || "未命名图集";
	item.updatedAt = new Date().toISOString();
	writeAll(all);
	return item;
}

export function removePullAlbum(id: string): void {
	writeAll(readAll().filter((a) => a.id !== id));
}

export function touchPullAlbum(id: string): void {
	const all = readAll();
	const item = all.find((a) => a.id === id);
	if (!item) return;
	item.updatedAt = new Date().toISOString();
	writeAll([item, ...all.filter((a) => a.id !== id)]);
}

export function defaultAlbumName(opts: {
	title?: string;
	channelName?: string;
}): string {
	const title = opts.title?.trim();
	if (title && title.length <= 40) return title;
	if (title) return `${title.slice(0, 36)}…`;
	const stamp = new Date().toLocaleString("zh-CN", {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
	return `${opts.channelName ?? "图集"} · ${stamp}`;
}
