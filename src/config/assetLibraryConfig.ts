import type { AssetLibraryConfig } from "@/types/assetLibraryConfig";

/** 数字资源库 · 站点展示配置（本地开干，文章暂不发） */
export const assetLibraryConfig: AssetLibraryConfig = {
	enable: true,
	title: "数字资源库",
	description: "慢慢攒起来的图：分类、可追溯、能直接给网站用。",
	/** 相对 public 的根路径 */
	publicRoot: "/assets/library",
	categories: [
		{ id: "anime", name: "二次元", blurb: "插画与壁纸" },
		{ id: "ai-art", name: "AI 画作", blurb: "精选生图" },
		{ id: "lol", name: "LOL", blurb: "英雄原画与皮肤" },
		{ id: "wallpaper", name: "壁纸", blurb: "横图与氛围" },
	],
};
