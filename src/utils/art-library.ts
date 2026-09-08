/** Local-only catalogue. Images are opened lazily; no file is uploaded. */
export interface LocalFileHandle {
	kind: "file";
	name: string;
	getFile(): Promise<File>;
}
export interface LocalDirectoryHandle {
	kind: "directory";
	name: string;
	values(): AsyncIterable<LocalDirectoryHandle | LocalFileHandle>;
}
export interface Artwork {
	id: string;
	name: string;
	path: string;
	category: string;
	group: string;
	member: string;
	style: string;
	source: string;
	preview?: string;
	file?: File;
	handle?: LocalFileHandle;
}
export interface ArtFilters {
	query: string;
	category: string;
	group: string;
	member: string;
	style: string;
	source: string;
}
const imagePattern = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;
const categories = new Set(["kpop", "二次元", "AI画作", "LOL", "二创"]);
const sourcePattern = /instagram|official-ig|(?:^|-)ig$|kpopping|饭拍|B站|bilibili|pixiv|danbooru|wallhaven|抖音|微博|civitai|safebooru/i;
const stylePattern = /画风|油画|水彩|素描|赛璐璐|平涂|写实|厚涂|胶片|CG|像素|线稿|扁平|国风/i;

export function isArtworkPath(path: string): boolean {
	return imagePattern.test(path) && !path.split(/[\\/]/).some(part => /^(?:\.|_代|_隔离)|隔离|待删/.test(part));
}
export function describeArtwork(path: string): Artwork {
	const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
	const name = parts.pop() || path;
	const categoryIndex = parts.findIndex(part => categories.has(part));
	const category = categoryIndex >= 0 ? parts[categoryIndex] : "未分类";
	const folders = categoryIndex >= 0 ? parts.slice(categoryIndex + 1) : parts;
	const group = category === "kpop" && folders[0] && !sourcePattern.test(folders[0]) ? folders[0] : "";
	const memberFolder = group ? folders[1] || "" : "";
	const member = memberFolder && !sourcePattern.test(memberFolder)
		? memberFolder.split("_")[0].replace(/\d+$/, "") : "";
	const source = [...folders].reverse().find(part => sourcePattern.test(part)) ||
		(memberFolder.includes("_") ? "Instagram" : "未标注");
	return { id: path, path, name, category, group, member,
		style: folders.find(part => stylePattern.test(part)) || "未标注", source };
}
export function filterArtworks(items: Artwork[], filters: ArtFilters): Artwork[] {
	const words = filters.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
	return items.filter(item =>
		(["category", "group", "member", "style", "source"] as const).every(key => !filters[key] || item[key] === filters[key]) &&
		words.every(word => `${item.path} ${item.member} ${item.style} ${item.source}`.toLocaleLowerCase().includes(word)));
}
export function artOptions(items: Artwork[], key: keyof ArtFilters): string[] {
	if (key === "query") return [];
	return [...new Set(items.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
}
export async function readArtDirectory(
	root: LocalDirectoryHandle,
	signal: AbortSignal,
	onProgress: (count: number) => void,
): Promise<Artwork[]> {
	const result: Artwork[] = [];
	const stack = [{ handle: root, path: root.name }];
	let visited = 0;
	while (stack.length) {
		signal.throwIfAborted();
		const current = stack.pop()!;
		for await (const handle of current.handle.values()) {
			signal.throwIfAborted();
			const path = `${current.path}/${handle.name}`;
			if (handle.kind === "directory") {
				if (!/^(?:\.|_)|隔离|待删/.test(handle.name)) stack.push({ handle, path });
			} else if (isArtworkPath(path)) result.push({ ...describeArtwork(path), handle });
			if (++visited % 200 === 0) {
				onProgress(result.length);
				await new Promise<void>(resolve => setTimeout(resolve, 0));
			}
		}
	}
	onProgress(result.length);
	return result.sort((a, b) => a.path.localeCompare(b.path, "zh-CN", { numeric: true }));
}
export async function artworkFile(item: Artwork): Promise<File> {
	if (item.file) return item.file;
	if (item.handle) return item.handle.getFile();
	throw new Error("没有可读取的本地原图");
}
