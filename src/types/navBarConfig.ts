export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
	/** 整页跳转，不走 Swup（独立工具页如取图） */
	noSwup?: boolean;
	icon?: string; // 菜单项图标
	children?: NavBarLink[]; // 支持子菜单
	pageKey?: string;
};

export enum NavBarSearchMethod {
	PageFind = 0,
}

export type NavBarSearchConfig = {
	method: NavBarSearchMethod;
};

export type NavBarConfig = {
	links: NavBarLink[];
};
