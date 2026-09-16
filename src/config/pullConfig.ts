export type PullChannelId = "instagram" | "douyin" | "xiaohongshu" | "weibo";

export type PullChannel = {
	id: PullChannelId;
	name: string;
	short: string;
	kicker: string;
	blurb: string;
	placeholder: string;
	hint: string;
	icon: string;
	accent: string;
	glow: string;
};

export const PULL_CHANNELS: PullChannel[] = [
	{
		id: "instagram",
		name: "Instagram",
		short: "INS",
		kicker: "Instagram · 贴图",
		blurb: "网页帖、Reels、App 分享链接都可以贴。",
		placeholder: "帖子链接，或直接粘贴 Instagram 分享口令",
		hint: "公开帖最稳。App 里点 Share → Copy link，整段丢进来就行。",
		icon: "fa7-brands:instagram",
		accent: "#e1306c",
		glow: "rgba(225, 48, 108, 0.35)",
	},
	{
		id: "douyin",
		name: "抖音",
		short: "抖音",
		kicker: "抖音 · 图文",
		blurb: "网页长链、短链、App「复制链接」的整段口令都可以。",
		placeholder: "粘贴抖音分享口令，或 v.douyin.com / 网页链接",
		hint: "App 点「复制链接」后整段贴进来。网页则贴地址栏。图文笔记能抽一组图。",
		icon: "material-symbols:videocam-rounded",
		accent: "#25f4ee",
		glow: "rgba(37, 244, 238, 0.28)",
	},
	{
		id: "xiaohongshu",
		name: "小红书",
		short: "小红书",
		kicker: "小红书 · 笔记",
		blurb: "笔记网页、xhslink 短链、App 分享口令都可以。",
		placeholder: "粘贴小红书分享口令，或 xhslink / 笔记链接",
		hint: "App 复制分享口令整段丢进来。网页链接尽量带 xsec_token。",
		icon: "material-symbols:favorite-rounded",
		accent: "#ff2442",
		glow: "rgba(255, 36, 66, 0.32)",
	},
	{
		id: "weibo",
		name: "微博",
		short: "微博",
		kicker: "微博 · 原图",
		blurb: "正文页、t.cn 短链、App 分享出来的链接都可以。",
		placeholder: "粘贴微博分享链接，或 weibo.com / t.cn",
		hint: "公开微博可直接抽。多图会全部列出。",
		icon: "fa7-brands:weibo",
		accent: "#e6162d",
		glow: "rgba(230, 22, 45, 0.3)",
	},
];

export function getPullChannel(id: string): PullChannel | undefined {
	return PULL_CHANNELS.find((item) => item.id === id);
}
