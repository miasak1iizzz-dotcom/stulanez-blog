import type { PullSuccess } from "@/utils/pull/types";

const KEY = "pull-browse-session";

export type PullSession = {
	url: string;
	result: PullSuccess;
};

export function savePullSession(session: PullSession): void {
	try {
		sessionStorage.setItem(KEY, JSON.stringify(session));
	} catch {
		/* ignore */
	}
}

export function loadPullSession(): PullSession | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as PullSession;
		if (!data?.result?.ok || !data.result.images?.length) return null;
		return data;
	} catch {
		return null;
	}
}

export function clearPullSession(): void {
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		/* ignore */
	}
}
