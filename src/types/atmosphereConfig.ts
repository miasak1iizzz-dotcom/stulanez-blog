export type HitokotoQuote = {
	text: string;
	author?: string;
};

export type TimeProgressMilestone = {
	name: string;
	date: string; // YYYY-MM-DD
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
};
