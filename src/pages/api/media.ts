import type { APIRoute } from "astro";
import { isAllowedOssKey, signExpiresSeconds, signOssKey } from "@/server/oss-sign";

export const prerender = false;

/** 私有桶的临时读取入口。页面里只放这个地址，钥匙不下发到浏览器。 */
export const GET: APIRoute = ({ url }) => {
	const key = url.searchParams.get("key") ?? "";
	if (!isAllowedOssKey(key)) {
		return new Response(null, { status: 404 });
	}
	const signed = signOssKey(key);
	if (!signed) {
		return new Response(null, { status: 404 });
	}
	const maxAge = Math.max(60, signExpiresSeconds() - 60);
	return new Response(null, {
		status: 307,
		headers: {
			Location: signed,
			"Cache-Control": `public, max-age=${maxAge}`,
		},
	});
};
