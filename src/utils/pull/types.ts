export type PullChannelId = "instagram" | "douyin" | "xiaohongshu" | "weibo";

export type PullImage = {
	url: string;
	filename: string;
};

export type PullSuccess = {
	ok: true;
	channel: PullChannelId;
	sourceUrl: string;
	title: string;
	author?: string;
	images: PullImage[];
	warning?: string;
};

export type PullFailure = {
	ok: false;
	error: string;
};

export type PullResult = PullSuccess | PullFailure;

export const BROWSER_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const IPHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

export const CRAWLER_UA =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
