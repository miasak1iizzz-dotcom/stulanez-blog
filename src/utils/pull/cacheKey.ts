/**
 * 抽取结果的缓存键：同一个帖子，不管你是贴网页链接、短链还是 App 口令，
 * 都应该落到同一个键上——不然缓存永远命中不了。
 * 取 URL 里最长的那串数字（各家平台的帖子 id 都是长数字），
 * 实在没有就按路径做个小哈希。
 */
export function pullCacheKey(input: string): string {
	const text = (input || "").trim();
	if (!text) return "";
	const digits = text.match(/\d{10,}/g);
	if (digits?.length) return `id:${digits[digits.length - 1]}`;
	let hash = 5381;
	const path = text.replace(/^[a-z]+:\/\//i, "").split(/[?#]/)[0] ?? text;
	for (let i = 0; i < path.length; i++) {
		hash = ((hash << 5) + hash + path.charCodeAt(i)) | 0;
	}
	return `p:${(hash >>> 0).toString(36)}`;
}
