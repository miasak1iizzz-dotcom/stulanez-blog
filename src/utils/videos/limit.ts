const hits = new Map<string, number[]>();

function prune(times: number[], now: number): number[] {
	return times.filter((t) => now - t < 86_400_000);
}

export function rateLimit(ip: string, owner: boolean): string | null {
	if (owner) return null;
	const now = Date.now();
	const recent = prune(hits.get(ip) || [], now);
	if (recent.some((t) => now - t < 60_000)) {
		return "同一地址一分钟只拆一条，稍后再试。";
	}
	if (recent.length >= 24) {
		return "今天这条线路用得太多了，明天再来。";
	}
	recent.push(now);
	hits.set(ip, recent);
	return null;
}

const asks = new Map<string, number[]>();

export function askLimit(ip: string, owner: boolean): string | null {
	if (owner) return null;
	const now = Date.now();
	const recent = prune(asks.get(ip) || [], now);
	if (recent.some((t) => now - t < 8_000)) {
		return "问得太密了，停两秒。";
	}
	if (recent.length >= 80) {
		return "今天追问次数用完了。";
	}
	recent.push(now);
	asks.set(ip, recent);
	return null;
}

export function clientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for") || "";
	return (
		forwarded.split(",")[0]?.trim() ||
		request.headers.get("x-real-ip") ||
		"unknown"
	);
}
