import type { AtmosphereConfig } from "../types/atmosphereConfig";

export const atmosphereConfig: AtmosphereConfig = {
	hitokoto: {
		quotes: [
			{ text: "慢慢写，也算在往前走。" },
			{ text: "先把今天过完，明天再谈远方。" },
			{ text: "空一点没关系，空着才写得进去。" },
			{ text: "留下的比发出去的更重要。" },
			{ text: "有些路要自己走一遍才知道。" },
			{ text: "想清楚再按下，也是一种速度。" },
			{ text: "把喜欢的事做得干净一点。" },
			{ text: "不急着像谁，先像自己。" },
			{ text: "路漫漫其修远兮，吾将上下而求索。", author: "屈原" },
			{ text: "山不在高，有仙则名。", author: "刘禹锡" },
		],
	},
	timeProgress: {
		milestones: [
			{ name: "中秋", date: "2026-09-25" },
			{ name: "国庆", date: "2026-10-01" },
			{ name: "元旦", date: "2027-01-01" },
			{ name: "春节", date: "2027-02-06" },
			{ name: "清明", date: "2027-04-05" },
			{ name: "劳动节", date: "2027-05-01" },
			{ name: "端午", date: "2027-06-09" },
			{ name: "站点周年", date: "2027-08-26" },
			{ name: "中秋", date: "2027-09-15" },
			{ name: "国庆", date: "2027-10-01" },
		],
	},
	welcomeToast: {
		enable: true,
		aboutUrl: "/about/",
		locationTimeoutMs: 2000,
	},
	cursor: {
		enable: true,
	},
	splash: {
		enable: true,
		durationMs: 4200,
		defaultPortrait: "jett",
		defaultUpper: "upper-a",
		defaultLower: "lower-a",
		portraits: [
			{
				id: "jett",
				name: "捷风",
				badge: "默认",
				image: "/assets/images/splash/portraits/jett.webp",
			},
			{
				id: "sage",
				name: "贤者",
				image: "/assets/images/splash/portraits/sage.webp",
			},
			{
				id: "reyna",
				name: "芮娜",
				image: "/assets/images/splash/portraits/reyna.webp",
			},
			{
				id: "killjoy",
				name: "奇乐",
				image: "/assets/images/splash/portraits/killjoy.webp",
			},
			{
				id: "neon",
				name: "霓虹",
				image: "/assets/images/splash/portraits/neon.webp",
			},
			{
				id: "clove",
				name: "暮蝶",
				image: "/assets/images/splash/portraits/clove.webp",
			},
		],
		upperBanners: [
			{
				id: "upper-a",
				name: "亚海悬城",
				image: "/assets/images/splash/banners/upper-a.webp",
			},
			{
				id: "upper-b",
				name: "微风岛屿",
				image: "/assets/images/splash/banners/upper-b.webp",
			},
			{
				id: "upper-c",
				name: "日落之城",
				image: "/assets/images/splash/banners/upper-c.webp",
			},
			{
				id: "upper-d",
				name: "莲华古城",
				image: "/assets/images/splash/banners/upper-d.webp",
			},
		],
		lowerBanners: [
			{
				id: "lower-a",
				name: "霓虹町",
				image: "/assets/images/splash/banners/lower-a.webp",
			},
			{
				id: "lower-b",
				name: "深海明珠",
				image: "/assets/images/splash/banners/lower-b.webp",
			},
			{
				id: "lower-c",
				name: "盐海矿镇",
				image: "/assets/images/splash/banners/lower-c.webp",
			},
			{
				id: "lower-d",
				name: "幽邃地窟",
				image: "/assets/images/splash/banners/lower-d.webp",
			},
		],
	},
};
