const CHANNEL_HOST =
	/(?:^|\.)(?:instagram\.com|instagr\.am|ddinstagram\.com|douyin\.com|iesdouyin\.com|xiaohongshu\.com|xhslink\.com|weibo\.com|weibo\.cn|sina\.cn)$/i;

function tidyUrl(raw: string): string {
	let url = raw
		.trim()
		.replace(/&amp;/g, "&")
		.replace(/[),，。；;!！、]+$/g, "")
		.replace(/\/+$/, "/");
	if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, "")}`;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
		return parsed.href;
	} catch {
		return "";
	}
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return "";
	}
}

function isChannelHost(host: string): boolean {
	if (host === "t.cn") return true;
	return CHANNEL_HOST.test(host);
}

function scoreUrl(url: string): number {
	let score = 1;
	if (/v\.douyin\.com\/[A-Za-z0-9]+/i.test(url) || /jx\.douyin\.com\/[A-Za-z0-9]+/i.test(url)) {
		score += 80;
	}
	if (/\/(?:video|note|slides)\//i.test(url)) score += 50;
	if (/[?&](?:modal_id|aweme_id|item_ids)=/i.test(url)) score += 50;
	if (/xhslink\.com/i.test(url)) score += 80;
	if (/xiaohongshu\.com\/(?:explore|discovery\/item|board\/)/i.test(url)) score += 50;
	if (/xsec_token=/i.test(url)) score += 20;
	if (/instagram\.com\/(?:p|reel|reels|tv|share)\//i.test(url)) score += 80;
	if (/l\.instagram\.com/i.test(url)) score += 40;
	if (/weibo\.(?:com|cn)\/(?:detail|status|\d+)/i.test(url)) score += 60;
	if (/t\.cn\/[A-Za-z0-9]+/i.test(url)) score += 70;
	if (/sinaurl/i.test(url)) score += 40;
	return score;
}

function collectUrls(input: string): string[] {
	const text = input.replace(/\u200b|\u2060/g, " ");
	const found: string[] = [];
	const httpRe = /https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/gi;
	for (const match of text.matchAll(httpRe)) {
		const url = tidyUrl(match[0]);
		if (url) found.push(url);
	}
	const bareRe =
		/(?:^|[\s"'<>（）【】])((?:(?:v|www|m|jx)\.douyin\.com|www\.iesdouyin\.com|www\.xiaohongshu\.com|xhslink\.com|www\.instagram\.com|instagram\.com|instagr\.am|l\.instagram\.com|weibo\.com|m\.weibo\.cn|t\.cn)\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*)/gi;
	for (const match of text.matchAll(bareRe)) {
		const url = tidyUrl(match[1] || "");
		if (url) found.push(url);
	}
	return found;
}

export function peelUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return "";

	const candidates = collectUrls(trimmed)
		.filter((url) => isChannelHost(hostOf(url)))
		.sort((a, b) => scoreUrl(b) - scoreUrl(a));
	if (candidates[0]) return candidates[0];

	const first = collectUrls(trimmed)[0];
	if (first) return first;

	if (/^https?:\/\//i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}\//i.test(trimmed)) {
		return tidyUrl(trimmed);
	}
	return "";
}
