import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { BROWSER_UA, IPHONE_UA } from "./types";

export type FetchTextResult = {
	url: string;
	text: string;
	status: number;
};

export type FetchBinaryResult = {
	url: string;
	status: number;
	body: Buffer;
	contentType: string;
};

type PullFetchInit = RequestInit & { timeoutMs?: number; mobile?: boolean };

const COMMON_PROXIES = [
	"http://127.0.0.1:7897",
	"http://127.0.0.1:7890",
	"http://127.0.0.1:10809",
];

let cachedProxy: string | null | undefined;

function envProxy(): string | null {
	const raw =
		process.env.PULL_PROXY ||
		process.env.HTTPS_PROXY ||
		process.env.HTTP_PROXY ||
		process.env.https_proxy ||
		process.env.http_proxy ||
		"";
	const value = raw.trim();
	return value || null;
}

function probePort(port: number, host = "127.0.0.1"): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({ host, port });
		const done = (ok: boolean) => {
			socket.removeAllListeners();
			socket.destroy();
			resolve(ok);
		};
		socket.setTimeout(250, () => done(false));
		socket.once("connect", () => done(true));
		socket.once("error", () => done(false));
	});
}

async function resolveProxy(): Promise<string | null> {
	if (cachedProxy !== undefined) return cachedProxy;
	const fromEnv = envProxy();
	if (fromEnv) {
		cachedProxy = fromEnv;
		return cachedProxy;
	}
	for (const candidate of COMMON_PROXIES) {
		try {
			const port = Number(new URL(candidate).port);
			if (await probePort(port)) {
				cachedProxy = candidate;
				return cachedProxy;
			}
		} catch {
			/* next */
		}
	}
	cachedProxy = null;
	return null;
}

function headerRecord(init?: HeadersInit): Record<string, string> {
	const out: Record<string, string> = {};
	if (!init) return out;
	const headers = new Headers(init);
	headers.forEach((value, key) => {
		out[key] = value;
	});
	return out;
}

function withDefaultHeaders(
	init: PullFetchInit,
	fallbackAccept: string,
): Record<string, string> {
	const headers = headerRecord(init.headers);
	const has = (name: string) =>
		Object.keys(headers).some((k) => k.toLowerCase() === name);
	if (!has("user-agent")) {
		headers["User-Agent"] = init.mobile ? IPHONE_UA : BROWSER_UA;
	}
	if (!has("accept")) headers.Accept = fallbackAccept;
	if (!has("accept-language")) {
		headers["Accept-Language"] = "zh-CN,zh;q=0.9,en;q=0.8";
	}
	return headers;
}

async function fetchDirectBinary(
	url: string,
	init: PullFetchInit,
	fallbackAccept: string,
): Promise<FetchBinaryResult> {
	const { timeoutMs = 18000, mobile: _mobile, ...rest } = init;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const headers = new Headers(withDefaultHeaders(init, fallbackAccept));
		const res = await fetch(url, {
			...rest,
			redirect: "follow",
			signal: ctrl.signal,
			headers,
		});
		const body = Buffer.from(await res.arrayBuffer());
		return {
			url: res.url,
			status: res.status,
			body,
			contentType: res.headers.get("content-type") || "",
		};
	} finally {
		clearTimeout(timer);
	}
}

async function fetchViaHttpProxyBinary(
	url: string,
	proxy: string,
	init: PullFetchInit,
	fallbackAccept: string,
): Promise<FetchBinaryResult> {
	const { timeoutMs = 18000, method = "GET" } = init;
	const target = new URL(url);
	const proxyUrl = new URL(proxy);
	if (target.protocol !== "https:") {
		throw new Error("proxy fetch only supports https");
	}

	const headers = withDefaultHeaders(init, fallbackAccept);
	headers.Host = target.host;

	return await new Promise<FetchBinaryResult>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("abort"));
		}, timeoutMs);

		const connectReq = http.request({
			host: proxyUrl.hostname,
			port: Number(proxyUrl.port || 80),
			method: "CONNECT",
			path: `${target.hostname}:${target.port || 443}`,
			timeout: timeoutMs,
		});

		const fail = (error: unknown) => {
			clearTimeout(timer);
			reject(error);
		};

		connectReq.once("connect", (res, socket) => {
			if ((res.statusCode ?? 0) !== 200) {
				socket.destroy();
				fail(new Error(`proxy CONNECT ${res.statusCode ?? 0}`));
				return;
			}

			const req = https.request(
				{
					host: target.hostname,
					servername: target.hostname,
					path: `${target.pathname}${target.search}`,
					method,
					headers,
					createConnection: () =>
						tls.connect({
							socket,
							servername: target.hostname,
						}),
				},
				(pres) => {
					const chunks: Buffer[] = [];
					pres.on("data", (chunk) => chunks.push(chunk as Buffer));
					pres.on("end", () => {
						clearTimeout(timer);
						const status = pres.statusCode ?? 0;
						const location = pres.headers.location;
						const body = Buffer.concat(chunks);
						if (status >= 300 && status < 400 && location) {
							const next = new URL(location, target).href;
							void fetchViaHttpProxyBinary(next, proxy, init, fallbackAccept).then(
								resolve,
								fail,
							);
							return;
						}
						const rawType = pres.headers["content-type"];
						resolve({
							url: target.href,
							status,
							body,
							contentType: Array.isArray(rawType) ? rawType[0] || "" : rawType || "",
						});
					});
					pres.on("error", fail);
				},
			);
			req.on("error", fail);
			req.end();
		});

		connectReq.on("timeout", () => {
			connectReq.destroy();
			fail(new Error("abort"));
		});
		connectReq.on("error", fail);
		connectReq.end();
	});
}

const HTML_ACCEPT =
	"text/html,application/json;q=0.9,application/xhtml+xml;q=0.8,*/*;q=0.7";
const BIN_ACCEPT = "image/avif,image/webp,image/*,*/*;q=0.8";

async function loadBinary(
	url: string,
	init: PullFetchInit,
	fallbackAccept: string,
): Promise<FetchBinaryResult> {
	const proxy = await resolveProxy();
	if (proxy) {
		try {
			return await fetchViaHttpProxyBinary(url, proxy, init, fallbackAccept);
		} catch (error) {
			if (!isNetworkError(error)) throw error;
		}
	}

	try {
		return await fetchDirectBinary(url, init, fallbackAccept);
	} catch (error) {
		if (!proxy && isNetworkError(error)) {
			for (const candidate of COMMON_PROXIES) {
				try {
					const port = Number(new URL(candidate).port);
					if (!(await probePort(port))) continue;
					cachedProxy = candidate;
					return await fetchViaHttpProxyBinary(
						url,
						candidate,
						init,
						fallbackAccept,
					);
				} catch {
					/* try next */
				}
			}
		}
		throw error;
	}
}

function isNetworkError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	const cause =
		error instanceof Error && "cause" in error
			? String((error as { cause?: { code?: string } }).cause?.code ?? "")
			: "";
	return /abort|timeout|fetch failed|ECONN|ENOTFOUND|UND_ERR|Connect Timeout|socket/i.test(
		`${message} ${cause}`,
	);
}

export async function getPullProxy(): Promise<string | null> {
	return resolveProxy();
}

export function isPullNetworkError(error: unknown): boolean {
	return isNetworkError(error);
}

export async function fetchBinary(
	url: string,
	init: PullFetchInit = {},
): Promise<FetchBinaryResult> {
	return loadBinary(url, init, BIN_ACCEPT);
}

export async function fetchText(
	url: string,
	init: PullFetchInit = {},
): Promise<FetchTextResult> {
	const got = await loadBinary(url, init, HTML_ACCEPT);
	return { url: got.url, text: got.body.toString("utf8"), status: got.status };
}

export async function fetchJson<T>(
	url: string,
	init: RequestInit & { timeoutMs?: number; mobile?: boolean } = {},
): Promise<{ url: string; data: T | null; status: number; raw: string }> {
	const got = await fetchText(url, init);
	try {
		return { url: got.url, data: JSON.parse(got.text) as T, status: got.status, raw: got.text };
	} catch {
		return { url: got.url, data: null, status: got.status, raw: got.text };
	}
}
