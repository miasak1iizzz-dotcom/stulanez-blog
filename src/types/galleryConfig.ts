// 相册元信息（用户在配置文件中填写）
export type GalleryAlbum = {
	id: string; // URL slug + 目录名，如 "japan-2025"
	name: string; // 相册名称
	description?: string; // 相册描述
	date?: string; // 日期
	location?: string; // 拍摄地点
	tags?: string[]; // 标签（用于首页筛选）
	cover?: string; // 点进去的横幅封面（建议 3:1）
	cardCover?: string; // 相册列表卡片封面（建议 4:3，不要拿 3:1 横幅去裁）
	password?: string; // 加密密码（非空时启用加密）
	passwordHint?: string; // 密码提示
};

// 相册配置
export type GalleryConfig = {
	albums: GalleryAlbum[];
	columnWidth?: number; // 瀑布流最小列宽(px)，默认 240，浏览器根据容器宽度自动计算列数
};
