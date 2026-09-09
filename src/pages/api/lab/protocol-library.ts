import type { APIRoute } from "astro";
import { loadProtocolLibrary } from "@/utils/protocol-library";

export const prerender = false;

export const GET: APIRoute = ({ url, request }) => {
	// Local-only even if another production route accidentally exposes /api/lab.
	if (
		!import.meta.env.DEV ||
		!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
	) {
		return new Response(null, { status: 404 });
	}
	const origin = request.headers.get("origin");
	if (origin && origin !== url.origin)
		return new Response(null, { status: 403 });
	const id = url.searchParams.get("id") ?? undefined;
	if (id && !/^[a-z0-9-]{1,100}$/i.test(id))
		return new Response(null, { status: 400 });
	try {
		const result = loadProtocolLibrary(id);
		if (!result) return new Response(null, { status: 404 });
		return new Response(JSON.stringify(result), {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"X-Robots-Tag": "noindex, nofollow, noarchive",
			},
		});
	} catch {
		return new Response(
			JSON.stringify({ error: "资料暂时无法读取，请稍后重试。" }),
			{
				status: 503,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-store",
				},
			},
		);
	}
};
