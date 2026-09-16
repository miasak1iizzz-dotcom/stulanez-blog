export type AssetLibraryCategory = {
	id: string;
	name: string;
	blurb: string;
};

export type AssetLibraryConfig = {
	enable: boolean;
	title: string;
	description: string;
	publicRoot: string;
	categories: AssetLibraryCategory[];
};

export type LibraryAsset = {
	id: string;
	category: string;
	title: string;
	src: string;
	thumb?: string;
	source?: string;
	tags?: string[];
};
