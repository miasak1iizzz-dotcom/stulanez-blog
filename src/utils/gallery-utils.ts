import fs from "node:fs";
import path from "node:path";
import type { GalleryAlbum } from "@/types/config";
import { url } from "@/utils/url-utils";

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
export function scanAlbumPhotos(albumId: string): string[] {
	const dir = path.join(process.cwd(), "public", "gallery", albumId);
	if (!fs.existsSync(dir)) return [];
	const files = fs
		.readdirSync(dir)
		.filter(
			(f) =>
				f !== "thumbs" &&
				!f.startsWith(".") &&
				!/^cover\./i.test(f) &&
				/\.(jpe?g|png|webp|avif|gif)$/i.test(f),
		)
		.sort();
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
	if (fs.existsSync(dir)) {
		const coverName = fs
			.readdirSync(dir)
			.find((f) => /^cover\.(jpe?g|png|webp|avif|gif)$/i.test(f));
		if (coverName) return withBase(`/gallery/${album.id}/${coverName}`);
	}
	const coverFile = photos.find((p) => /\/cover\./i.test(p));
	return coverFile || photos[0] || "";
}

/**
 * 瀑布流用缩略图（构建期 generate-gallery-thumbs 产出）。
 * 没有缩略图时退回原图，lightbox 仍走原图。
 */
export function getGalleryGridSrc(src: string): string {
	if (/^(https?:)?\/\//i.test(src) || /^(data|blob):/i.test(src)) {
		return src;
	}
	const match = src.match(/^(.*\/gallery\/[^/]+)\/([^/?#]+)\.([a-z0-9]+)$/i);
	if (!match) return src;
	const [, dir, stem] = match;
	const thumbRel = `${dir}/thumbs/${stem}.webp`;
	const publicRel = thumbRel.replace(/^\//, "");
	const fsPath = path.join(process.cwd(), "public", publicRel);
	return fs.existsSync(fsPath) ? thumbRel : src;
}
