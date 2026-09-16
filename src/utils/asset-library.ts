/**
 * 扫描 public/assets/library 下的分类目录，生成可展示清单。
 * 约定：public/assets/library/<categoryId>/*.{jpg,jpeg,png,webp}
 */
import fs from "node:fs";
import path from "node:path";
import { assetLibraryConfig } from "@/config/assetLibraryConfig";
import type { LibraryAsset } from "@/types/assetLibraryConfig";

const EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export function listLibraryAssets(
	rootDir = path.join(process.cwd(), "public", "assets", "library"),
): LibraryAsset[] {
	const assets: LibraryAsset[] = [];
	if (!fs.existsSync(rootDir)) return assets;

	for (const category of assetLibraryConfig.categories) {
		const dir = path.join(rootDir, category.id);
		if (!fs.existsSync(dir)) continue;
		const files = fs
			.readdirSync(dir)
			.filter((name) => EXT.has(path.extname(name).toLowerCase()))
			.sort((a, b) => a.localeCompare(b, "en"));
		for (const file of files) {
			const id = `${category.id}/${file}`;
			assets.push({
				id,
				category: category.id,
				title: path.parse(file).name.replace(/[-_]+/g, " "),
				src: `${assetLibraryConfig.publicRoot}/${category.id}/${file}`,
				source: category.name,
				tags: [category.name],
			});
		}
	}
	return assets;
}
