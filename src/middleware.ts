import { defineMiddleware } from "astro:middleware";

/**
 * 生产环境把内部 /lab/* 一律 404：AI 协作看板、抖音下载名单、图库清理监控等属于本地内部工具，
 * 老板明确「成熟前留在线下」。本地 dev(import.meta.env.PROD === false)不受影响。
 * 说明：lab 页分两种——SSR(agent-board/douyin-roster)由服务函数跑，middleware 能拦住；
 * 纯静态页(cleanup-monitor)由构建后 hide-lab-pages.mjs 删掉 dist/lab 兜底。两条一起保证公网 404。
 */
export const onRequest = defineMiddleware((context, next) => {
	if (import.meta.env.PROD && context.url.pathname.startsWith("/lab/")) {
		return new Response(null, { status: 404 });
	}
	return next();
});
