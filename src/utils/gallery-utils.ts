import fs from "node:fs";
import path from "node:path";
import mediaManifest from "@/data/media-manifest.json";
import type { GalleryAlbum } from "@/types/config";
import { ossObjectKey, url } from "@/utils/url-utils";

const manifestKeys = new Set(mediaManifest as string[]);

function withBase(assetPath: string): string {
	if (!assetPath) return "";
	if (/^(https?:)?\/\//i.test(assetPath) || /^(data|blob):/i.test(assetPath)) {
		return assetPath;
	}
	const normalizedPath = assetPath.startsWith("/")
		? assetPath
		: `/${assetPath}`;
	const base = import.meta.env.BASE_URL || "/";
	if (base !== "/" && normalizedPath.startsWith(base)) {
		return normalizedPath;
	}
	return url(normalizedPath);
}

/**
 * 扫描相册目录中的所有图片文件
 */
function isPhotoName(name: string): boolean {
	return (
		!name.startsWith(".") &&
		!/^cover/i.test(name) &&
		!/^card\./i.test(name) &&
		/\.(jpe?g|png|webp|avif|gif)$/i.test(name)
	);
}

function albumFileNames(albumId: string): string[] {
	const dir = path.join(process.cwd(), "public", "gallery", albumId);
	if (fs.existsSync(dir)) {
		return fs
			.readdirSync(dir)
			.filter((f) => f !== "thumbs" && isPhotoName(f))
			.sort();
	}
	const prefix = `gallery/${albumId}/`;
	return [...manifestKeys]
		.filter((key) => {
			if (!key.startsWith(prefix) || key.includes("/thumbs/")) return false;
			return isPhotoName(key.slice(prefix.length));
		})
		.map((key) => key.slice(prefix.length))
		.sort();
}

export function scanAlbumPhotos(albumId: string): string[] {
	const dir = path.join(process.cwd(), "public", "gallery", albumId);
	const files = albumFileNames(albumId);
	// 将 cover.* 排到第一位
	const coverIdx = files.findIndex((f) => /^cover\./i.test(f));
	if (coverIdx > 0) {
		const [coverFile] = files.splice(coverIdx, 1);
		files.unshift(coverFile);
	}
	const localPhotos = files.map((f) => withBase(`/gallery/${albumId}/${f}`));

	// 读取 urls.txt 中的远程图片 URL
	const urlsFile = path.join(dir, "urls.txt");
	let remotePhotos: string[] = [];
	if (fs.existsSync(urlsFile)) {
		remotePhotos = fs
			.readFileSync(urlsFile, "utf-8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
	}

	return [...localPhotos, ...remotePhotos];
}

/**
 * 获取相册封面图
 * 优先级：手动指定 > cover.* 文件 > 第一张图片
 */
export function getAlbumCover(album: GalleryAlbum, photos: string[]): string {
	if (album.cover) return withBase(album.cover);
	const dir = path.join(process.cwd(), "public", "gallery", album.id);
	const coverName = fs.existsSync(dir)
		? fs.readdirSync(dir).find((f) => /^cover\.(jpe?g|png|webp|avif|gif)$/i.test(f))
		: [...manifestKeys]
				.find((key) =>
					new RegExp(`^gallery/${album.id}/cover\\.(jpe?g|png|webp|avif|gif)$`, "i").test(key),
				)
				?.split("/")
				.pop();
	if (coverName) return withBase(`/gallery/${album.id}/${coverName}`);
	const coverFile = photos.find((p) => /\/cover\./i.test(p));
	return coverFile || photos[0] || "";
}

/**
 * 列表卡片封面。3:1 横幅塞进 4:3 卡片会被裁成一张大脸，所以单独给。
 */
export function getAlbumCardCover(
	album: GalleryAlbum,
	photos: string[],
): string {
	if (album.cardCover) return withBase(album.cardCover);
	return getAlbumCover(album, photos);
}

/**
 * 瀑布流用缩略图（构建期 generate-gallery-thumbs 产出）。
 * 没有缩略图时退回原图，lightbox 仍走原图。
 */
export function getGalleryGridSrc(src: string): string {
	if (/^(data|blob):/i.test(src)) {
		return src;
	}
	const key = ossObjectKey(src);
	const match = key.match(/^(gallery\/[^/]+)\/([^/]+)\.([a-z0-9]+)$/i);
	if (!match || key.includes("/thumbs/")) return src;
	const [, dir, stem] = match;
	const thumbKey = `${dir}/thumbs/${stem}.webp`;
	const fsPath = path.join(process.cwd(), "public", thumbKey);
	if (fs.existsSync(fsPath) || manifestKeys.has(thumbKey)) {
		return withBase(`/${thumbKey}`);
	}
	return src;
}
