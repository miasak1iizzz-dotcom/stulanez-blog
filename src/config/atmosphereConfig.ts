import type { AtmosphereConfig } from "../types/atmosphereConfig";
import {
	splashLowerMaps,
	splashPortraits,
	splashUpperMaps,
} from "./splashCatalog";

export const atmosphereConfig: AtmosphereConfig = {
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
		enable: false,
	},
	splash: {
		enable: true,
		durationMs: 4200,
		defaultPortrait: "jett",
		defaultUpper: "ascent",
		defaultLower: "split",
		portraits: splashPortraits,
		upperBanners: splashUpperMaps,
		lowerBanners: splashLowerMaps,
	},
};
