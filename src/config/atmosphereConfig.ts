import type { AtmosphereConfig } from "../types/atmosphereConfig";
import { splashMaps, splashPortraits } from "./splashCatalog";

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
		defaultUpper: "ascent",
		defaultLower: "split",
		portraits: splashPortraits,
		upperBanners: splashMaps,
		lowerBanners: splashMaps,
	},
};
