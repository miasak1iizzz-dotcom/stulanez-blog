const CDN_HOSTS = [
	"sinaimg.cn",
	"weibo.cn",
	"xiaohongshu.com",
	"xhscdn.com",
	"xhscdn.net",
	"ci.xiaohongshu.com",
	"douyinpic.com",
	"byteimg.com",
	"ibyteimg.com",
	"douyincdn.com",
	"bytescm.com",
	"cdninstagram.com",
	"fbcdn.net",
	"instagram.com",
];

export function hostnameOf(raw: string): string | null {
	try {
		return new URL(raw).hostname.toLowerCase();
	} catch {
		return null;
	}
}

export function hostAllowed(hostname: string, extra: string[] = []): boolean {
	const host = hostname.toLowerCase().replace(/^www\./, "");
	const all = [...CDN_HOSTS, ...extra];
	return all.some((d) => host === d || host.endsWith(`.${d}`));
}

export function isPrivateHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
		return true;
	}
	if (host === "::1" || host.startsWith("[")) return true;
	return /^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

export function isSafeHttpsUrl(raw: string): boolean {
	try {
		const u = new URL(raw);
		return u.protocol === "https:" && !isPrivateHost(u.hostname);
	} catch {
		return false;
	}
}

export function isCdnImageUrl(raw: string): boolean {
	if (!isSafeHttpsUrl(raw)) return false;
	const host = hostnameOf(raw);
	if (!host || !hostAllowed(host)) return false;
	if (/avatar|aweme-avatar|emoji|sticker|badge|logo|icon|cover\/default/i.test(raw)) {
		return false;
	}
	return true;
}
