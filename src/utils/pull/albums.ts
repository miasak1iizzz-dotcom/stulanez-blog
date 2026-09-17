import type { PullChannelId } from "@/utils/pull/types";

/** 本机图集书签。禁止 clear / removeItem 此键；删图集只能走 removePullAlbum。 */
const KEY = "pull-albums-v1";
const IDB_NAME = "stulanez-pull";
const IDB_STORE = "kv";
const IDB_ALBUMS = "albums-v1";
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

/** 从本机 Chrome LevelDB 找回的图集（UI 曾藏列表导致以为丢失） */
const RECOVERED_ALBUMS: Omit<PullAlbum, "createdAt" | "updatedAt">[] = [
	{
		id: "recover-ig-eunchae-dqp1",
		name: "HONG EUNCHAE",
		url: "https://www.instagram.com/p/DQp1jmakv0T/",
		channel: "instagram",
		hintTitle: "用户 HONG EUNCHAE",
	},
	{
		id: "recover-dy-sakura-100",
		name: "宫脇咲良100张自拍",
		url: "https://www.douyin.com/note/7614427905598500209",
		channel: "douyin",
		hintTitle: "宫脇咲良100张自拍",
		hintCount: 99,
	},
];

function albumFingerprint(url: string): string {
	const raw = url.trim().toLowerCase();
	const ig = /instagram\.com\/(?:p|reel|reels)\/([a-z0-9_-]+)/i.exec(raw);
	if (ig?.[1]) return `ig:${ig[1]}`;
	const dyNote = /douyin\.com\/note\/(\d+)/i.exec(raw);
	if (dyNote?.[1]) return `dy:${dyNote[1]}`;
	const dyShort = /v\.douyin\.com\/([a-z0-9_-]+)/i.exec(raw);
	if (dyShort?.[1]) return `dys:${dyShort[1].toLowerCase()}`;
	if (/7izos?tu1y3g/i.test(raw)) return "dys:7izos";
	if (/dqp1jmakv0t/i.test(raw)) return "ig:dqp1jmakv0t";
	if (/7614427905598500209/.test(raw)) return "dy:7614427905598500209";
	return `url:${raw.replace(/[?#].*$/, "")}`;
}

function normalizeAlbum(raw: unknown): PullAlbum | null {
	if (!raw || typeof raw !== "object") return null;
	const item = raw as Partial<PullAlbum>;
	if (
		typeof item.id !== "string" ||
		typeof item.name !== "string" ||
		typeof item.url !== "string" ||
		typeof item.channel !== "string"
	) {
		return null;
	}
	const now = new Date().toISOString();
	return {
		id: item.id,
		name: item.name.trim() || "未命名图集",
		url: item.url.trim(),
		channel: item.channel as PullChannelId,
		hintTitle: typeof item.hintTitle === "string" ? item.hintTitle : undefined,
		hintCount: typeof item.hintCount === "number" ? item.hintCount : undefined,
		createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
		updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
	};
}

function readLocal(): PullAlbum[] {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const data = JSON.parse(raw) as PullAlbum[];
		if (!Array.isArray(data)) return [];
		return data
			.map(normalizeAlbum)
			.filter((item): item is PullAlbum => Boolean(item));
	} catch {
		return [];
	}
}

function openIdb(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") return Promise.resolve(null);
	return new Promise((resolve) => {
		try {
			const req = indexedDB.open(IDB_NAME, 1);
			req.onupgradeneeded = () => {
				const db = req.result;
				if (!db.objectStoreNames.contains(IDB_STORE)) {
					db.createObjectStore(IDB_STORE);
				}
			};
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

async function readIdb(): Promise<PullAlbum[]> {
	const db = await openIdb();
	if (!db) return [];
	return new Promise((resolve) => {
		try {
			const tx = db.transaction(IDB_STORE, "readonly");
			const store = tx.objectStore(IDB_STORE);
			const req = store.get(IDB_ALBUMS);
			req.onsuccess = () => {
				const data = req.result;
				if (!Array.isArray(data)) {
					resolve([]);
					return;
				}
				resolve(
					data
						.map(normalizeAlbum)
						.filter((item): item is PullAlbum => Boolean(item)),
				);
			};
			req.onerror = () => resolve([]);
		} catch {
			resolve([]);
		}
	});
}

async function writeIdb(albums: PullAlbum[]): Promise<void> {
	const db = await openIdb();
	if (!db) return;
	await new Promise<void>((resolve) => {
		try {
			const tx = db.transaction(IDB_STORE, "readwrite");
			tx.objectStore(IDB_STORE).put(albums.slice(0, MAX_ALBUMS), IDB_ALBUMS);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		} catch {
			resolve();
		}
	});
}

function mergeByFingerprint(lists: PullAlbum[][]): PullAlbum[] {
	const byFp = new Map<string, PullAlbum>();
	for (const list of lists) {
		for (const album of list) {
			const fp = albumFingerprint(album.url);
			const prev = byFp.get(fp);
			if (!prev || album.updatedAt > prev.updatedAt) {
				byFp.set(fp, album);
			}
		}
	}
	return [...byFp.values()].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	);
}

function writeAll(albums: PullAlbum[]): void {
	const next = albums.slice(0, MAX_ALBUMS);
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		/* ignore quota */
	}
	void writeIdb(next);
}

function readAll(): PullAlbum[] {
	return readLocal();
}

function uid(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `alb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 启动时：localStorage + IndexedDB 合并，并写回找回的两本图集。
 * 返回本机最终列表。
 */
export async function hydratePullAlbums(): Promise<PullAlbum[]> {
	const local = readLocal();
	const idb = await readIdb();
	const recovered = RECOVERED_ALBUMS.map((item) => {
		const now = new Date().toISOString();
		return {
			...item,
			createdAt: now,
			updatedAt: now,
		} satisfies PullAlbum;
	});
	const merged = mergeByFingerprint([local, idb, recovered]);
	writeAll(merged);
	return merged;
}

export function listPullAlbums(channel?: PullChannelId | null): PullAlbum[] {
	const all = readAll();
	const filtered = channel ? all.filter((a) => a.channel === channel) : all;
	return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findAlbumByUrl(url: string): PullAlbum | undefined {
	const needle = url.trim();
	const fp = albumFingerprint(needle);
	return readAll().find(
		(a) => a.url === needle || albumFingerprint(a.url) === fp,
	);
}

export function findAlbumById(id: string): PullAlbum | undefined {
	return readAll().find((a) => a.id === id);
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
	const fp = albumFingerprint(url);
	const all = readAll();
	const existing =
		(input.id && all.find((a) => a.id === input.id)) ||
		all.find((a) => a.url === url || albumFingerprint(a.url) === fp);

	if (existing) {
		existing.name = name;
		existing.url = url;
		existing.channel = input.channel;
		if (input.hintTitle) existing.hintTitle = input.hintTitle;
		if (typeof input.hintCount === "number")
			existing.hintCount = input.hintCount;
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

export function countPullAlbums(): number {
	return readAll().length;
}
