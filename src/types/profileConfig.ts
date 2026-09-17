export type ProfileConfig = {
	avatar?: string;
	name: string;
	// 名字旁的身份徽章（如「站长」），不填则不显示
	badge?: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
		showName?: boolean;
	}[];
};
