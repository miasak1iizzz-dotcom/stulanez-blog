/** 艺术馆清单（manifest.json）结构，定义见 docs/ai/art-museum-spec.md §4。 */
export interface ArtManifestAuto {
	/** 管线自动判定的用途，如 ["桌面壁纸"] */
	uses: string[];
	/** 分辨率等级：8K / 4K / 2K / 1080P / HD / 低清 */
	grade: string;
	/** 主色，最多 5 个 */
	colors: string[];
	/** 感知哈希 */
	dhash: string;
	brightness: number;
	saturation: number;
	hasExif: boolean;
	faces: number | null;
	nsfw: number | null;
}

export interface ArtManifestTags {
	category: string;
	group: string;
	member: string;
	style: string;
	source: string;
	year: string;
	theme: string[];
}

export interface ArtManifestOrigin {
	/** 本机相对路径，只作溯源 */
	path: string;
	/** 同内容的其他文件名 */
	duplicates?: string[];
}

export interface ArtManifestItem {
	id: string;
	/** 上站原图在仓库里的 key */
	key: string;
	/** 缩略图 key，按宽度分档：{ "480": "art/thumb/…", "1280": "…" } */
	thumbs: Record<string, string>;
	width: number;
	height: number;
	bytes: number;
	format: string;
	ratio: string;
	auto: ArtManifestAuto;
	tags: ArtManifestTags;
	/** 是否上站。默认 false，站长勾选才 true */
	public: boolean;
	addedAt: string;
	origin: ArtManifestOrigin;
}

export interface ArtManifest {
	version: number;
	updatedAt: string;
	generator: string;
	/** 阶段 2 接对象存储后的图片基址，如 https://img.stulanez.com */
	baseUrl: string;
	items: ArtManifestItem[];
}
