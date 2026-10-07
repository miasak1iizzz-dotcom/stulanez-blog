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
	if (
		host === "localhost" ||
		host.endsWith(".local") ||
		host.endsWith(".internal")
	) {
		return true;
	}
	if (host === "::1" || host.startsWith("[")) return true;
	return /^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
		host,
	);
}

export function isSafeHttpsUrl(raw: string): boolean {
	try {
		const u = new URL(raw);
		return u.protocol === "https:" && !isPrivateHost(u.hostname);
	} catch {
		return false;
	}
}

/**
 * Avatar / emoji / PWA-ish asset URLs. Match against the host and whole path
 * segments only — scanning the raw URL false-kills CDN object ids that happen
 * to contain a keyword (e.g. a Douyin id "…B8PwA5…" tripping /pwa/i).
 */
const ASSET_KEYWORD = /avatar|emoji|sticker|badge|logo|icon|forum|pwa/i;

export function assetKeywordHit(raw: string): boolean {
	const head = raw.split(/[?#]/)[0] ?? raw;
	const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/?#]*)(?:\/(.*))?$/i.exec(head);
	if (!m) return false;
	const [, host = "", path = ""] = m;
	if (ASSET_KEYWORD.test(host)) return true;
	const segs = path.split("/").filter(Boolean);
	for (const [i, seg] of segs.entries()) {
		if (seg.includes("~")) continue;
		if (ASSET_KEYWORD.test(seg)) return true;
		if (seg === "cover" && segs[i + 1] === "default") return true;
	}
	return false;
}

export function isCdnImageUrl(raw: string): boolean {
	if (!isSafeHttpsUrl(raw)) return false;
	const host = hostnameOf(raw);
	if (!host || !hostAllowed(host)) return false;
	if (assetKeywordHit(raw)) return false;
	return true;
}
