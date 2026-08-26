export type HitokotoQuote = {
	text: string;
	author?: string;
};

export type TimeProgressMilestone = {
	name: string;
	date: string; // YYYY-MM-DD
};

export type SplashStyleId = "logo" | "petal" | "wash";

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
		defaultStyle: SplashStyleId;
		durationMs: number;
	};
};
