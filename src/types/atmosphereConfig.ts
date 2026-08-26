export type HitokotoQuote = {
	text: string;
	author?: string;
};

export type TimeProgressMilestone = {
	name: string;
	date: string; // YYYY-MM-DD
};

export type SplashPortrait = {
	id: string;
	name: string;
	image: string;
	badge?: string;
	ultName: string;
	ultLine: string;
};

export type SplashBanner = {
	id: string;
	name?: string;
	image: string;
};

export type AtmosphereConfig = {
	hitokoto: {
		quotes: HitokotoQuote[];
	};
	timeProgress: {
		milestones: TimeProgressMilestone[];
	};
	welcomeToast: {
		enable: boolean;
		aboutUrl: string;
		locationTimeoutMs: number;
	};
	cursor: {
		enable: boolean;
	};
	splash: {
		enable: boolean;
		durationMs: number;
		defaultPortrait: string;
		defaultUpper: string;
		defaultLower: string;
		portraits: SplashPortrait[];
		upperBanners: SplashBanner[];
		lowerBanners: SplashBanner[];
	};
};
