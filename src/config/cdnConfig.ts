/**
 * 相册、音乐、壁纸在私有桶里。页面不拼永久公开地址，
 * 这些路径会改走 /api/media/，由服务器签发短时读取链接。
 */
export function getPublicCdnBase(): string {
	const raw = import.meta.env.PUBLIC_CDN_BASE;
	if (!raw) return "";
	return String(raw).replace(/\/+$/, "");
}

export function isOssPublicAsset(pathname: string): boolean {
	if (pathname.startsWith("/assets/music/")) return true;
	if (pathname.startsWith("/assets/images/wallpaper/")) return true;
	return /^\/gallery\/[^/]+\/.+\.(jpe?g|png|webp|avif|gif)$/i.test(pathname);
}
