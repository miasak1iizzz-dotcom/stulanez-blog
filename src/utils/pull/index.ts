import { extractDouyin } from "./douyin";
import { extractInstagram } from "./instagram";
import { detectChannel, needUrl } from "./parse";
import type { PullChannelId, PullResult } from "./types";
import { extractWeibo } from "./weibo";
import { extractXiaohongshu } from "./xiaohongshu";

export { detectChannel } from "./parse";
export { peelUrl } from "./peel";
export type { PullChannelId, PullImage, PullResult } from "./types";

const EXTRACTORS: Record<PullChannelId, (url: string) => Promise<PullResult>> = {
	instagram: extractInstagram,
	douyin: extractDouyin,
	xiaohongshu: extractXiaohongshu,
	weibo: extractWeibo,
};

export async function extractPull(
	input: string,
	expected?: PullChannelId,
): Promise<PullResult> {
	let url: string;
	try {
		url = needUrl(input);
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : "请先贴一条链接。" };
	}

	const detected = detectChannel(url);
	if (!detected) {
		return {
			ok: false,
			error: "还不认这条。请贴 Instagram、抖音、小红书或微博的网页链接，也可以直接贴 App 分享口令。",
		};
	}
	if (expected && detected !== expected) {
		const names: Record<PullChannelId, string> = {
			instagram: "Instagram",
			douyin: "抖音",
			xiaohongshu: "小红书",
			weibo: "微博",
		};
		return {
			ok: false,
			error: `这条是${names[detected]}的链接。请到${names[detected]}页去抽，或回总览再贴。`,
		};
	}

	try {
		return await EXTRACTORS[detected](url);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const cause =
			error instanceof Error && "cause" in error
				? String((error as { cause?: { code?: string; message?: string } }).cause?.code ?? "")
				: "";
		if (/abort/i.test(message)) {
			return { ok: false, error: "渠道响应太慢，过一会儿再试。" };
		}
		if (/timeout|fetch failed|ECONN|ENOTFOUND|UND_ERR|Connect Timeout|socket|proxy/i.test(`${message} ${cause}`)) {
			if (detected === "instagram") {
				return {
					ok: false,
					error:
						"本机连不上 Instagram（通常要外网）。请先打开本机代理（常见端口 7897 / 7890 / 10809），或设置环境变量 PULL_PROXY / HTTPS_PROXY 后再抽。",
				};
			}
			return {
				ok: false,
				error: "连不上这个渠道。检查本机网络；国外站点往往要开代理。",
			};
		}
		return { ok: false, error: "提取失败。链接失效、要登录，或渠道改了页面。" };
	}
}
