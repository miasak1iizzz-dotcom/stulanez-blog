/**
 * 目录句柄持久化 —— File System Access API 的目录句柄可以序列化进 IndexedDB，
 * 下次直接复用，不必每次重选（浏览器安全策略不允许网页直接指定绝对路径，
 * 但允许记住「用户曾经授权过的那个目录」）。
 *
 * 策展台用它记住两个目录：图库来源、展品输出。
 */
const DB_NAME = "stulanez-art-handles";
const DB_VERSION = 1;
const STORE = "handles";

interface StoredHandle {
	handle: FileSystemDirectoryHandle;
	savedAt: number;
}

/** 目录选择器里用到的键名，固定不变，换名字会导致已授权目录丢失。 */
export const HANDLE_KEYS = {
	/** 本地图库来源（读） */
	source: "curate-source",
	/** 展品输出目录，通常指向仓库的 public/art（写） */
	output: "curate-output",
} as const;

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export interface DirectoryHandleMeta {
	handle: FileSystemDirectoryHandle;
	name: string;
	savedAt: number;
}

export async function saveDirectoryHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			const record: StoredHandle = { handle, savedAt: Date.now() };
			tx.objectStore(STORE).put(record, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {
		// 存不进去（隐私模式、容量等）不影响主流程，只是下次要重选
	}
}

export async function loadDirectoryHandle(key: string): Promise<DirectoryHandleMeta | null> {
	try {
		const db = await openDb();
		const stored = await new Promise<StoredHandle | undefined>((resolve, reject) => {
			const tx = db.transaction(STORE, "readonly");
			const request = tx.objectStore(STORE).get(key);
			request.onsuccess = () => resolve(request.result as StoredHandle | undefined);
			request.onerror = () => reject(request.error);
		});
		db.close();
		if (!stored?.handle) return null;
		return { handle: stored.handle, name: stored.handle.name, savedAt: stored.savedAt };
	} catch {
		return null;
	}
}

export async function forgetDirectoryHandle(key: string): Promise<void> {
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, "readwrite");
			tx.objectStore(STORE).delete(key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch {
		// 忽略
	}
}

/**
 * 确保句柄有足够权限。已授权直接放行；需要授权时会弹一次系统提示（必须在用户手势中调用）。
 */
export async function ensurePermission(handle: FileSystemDirectoryHandle, mode: "read" | "readwrite"): Promise<boolean> {
	const target = handle as FileSystemDirectoryHandle & {
		queryPermission?: (descriptor: { mode: string }) => Promise<PermissionState>;
		requestPermission?: (descriptor: { mode: string }) => Promise<PermissionState>;
	};
	if (!target.queryPermission || !target.requestPermission) return false;
	if ((await target.queryPermission({ mode })) === "granted") return true;
	return (await target.requestPermission({ mode })) === "granted";
}
