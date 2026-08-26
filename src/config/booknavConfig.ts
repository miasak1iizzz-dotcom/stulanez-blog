import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "工具",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "建设和维护永恒欲望时真正会用到的工具与文档。",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "site-stack",
		name: "建站技术",
		icon: "material-symbols:code-rounded",
		desc: "永恒欲望正在使用的核心技术",
		weight: 100,
		items: [
			{
				title: "GitHub",
				url: "https://github.com",
				desc: "保存源码、协作记录和站点评论",
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "Astro",
				url: "https://astro.build",
				desc: "站点的静态内容框架",
				weight: 9,
			},
			{
				title: "Svelte",
				url: "https://svelte.dev",
				desc: "搜索、设置和分页等交互组件",
				weight: 8,
			},
			{
				title: "TypeScript",
				url: "https://www.typescriptlang.org",
				desc: "配置、组件与构建脚本的类型基础",
				weight: 7,
			},
			{
				title: "Tailwind CSS",
				url: "https://tailwindcss.com",
				desc: "页面布局与界面样式",
				weight: 6,
			},
		],
	},
	{
		id: "workflow",
		name: "开发流程",
		icon: "material-symbols:build-outline-rounded",
		desc: "安装、检查、部署和站内搜索",
		weight: 90,
		items: [
			{
				title: "pnpm",
				url: "https://pnpm.io",
				desc: "项目唯一使用的包管理器",
				weight: 10,
			},
			{
				title: "Biome",
				url: "https://biomejs.dev",
				desc: "统一代码格式并检查常见问题",
				weight: 9,
			},
			{
				title: "Vercel",
				url: "https://vercel.com",
				desc: "stulanez.com 的构建与部署平台",
				weight: 8,
			},
			{
				title: "Pagefind",
				url: "https://pagefind.app",
				desc: "为静态页面生成站内搜索索引",
				weight: 7,
			},
		],
	},
	{
		id: "design-assets",
		name: "视觉资源",
		icon: "material-symbols:palette-outline-rounded",
		desc: "图标、壁纸压缩与格式转换",
		weight: 80,
		items: [
			{
				title: "Iconify",
				url: "https://icon-sets.iconify.design",
				desc: "检索站点使用的开源图标集合",
				weight: 10,
			},
			{
				title: "Squoosh",
				url: "https://squoosh.app",
				desc: "在浏览器里压缩图片并转换 WebP",
				weight: 9,
			},
			{
				title: "TinyPNG",
				url: "https://tinypng.com",
				desc: "快速压缩 PNG、JPEG 和 WebP 图片",
				weight: 8,
			},
		],
	},
	{
		id: "theme-source",
		name: "主题来源",
		icon: "material-symbols:auto-stories-outline-rounded",
		desc: "保留开源主题的文档与上游出处",
		weight: 70,
		items: [
			{
				title: "Firefly",
				url: "https://github.com/CuteLeaf/Firefly",
				desc: "永恒欲望当前使用的 Astro 博客主题",
				icon: "/favicon/firefly-32.png",
				weight: 10,
			},
			{
				title: "Firefly Docs",
				url: "https://docs-firefly.cuteleaf.cn",
				desc: "配置与功能的官方使用文档",
				icon: "https://docs-firefly.cuteleaf.cn/logo.png",
				weight: 9,
			},
			{
				title: "Fuwari",
				url: "https://github.com/saicaca/fuwari",
				desc: "Firefly 所基于的原始开源主题",
				icon: "fa7-brands:github",
				weight: 8,
			},
		],
	},
	{
		id: "ai-collaboration",
		name: "AI 协作",
		icon: "material-symbols:smart-toy-outline-rounded",
		desc: "共同维护本站的两个开发助手",
		weight: 60,
		items: [
			{
				title: "Cursor",
				url: "https://cursor.com",
				desc: "负责编辑、实现与并行任务协作",
				weight: 10,
			},
			{
				title: "Codex",
				url: "https://openai.com/codex/",
				desc: "负责实现、检查与独立任务交付",
				weight: 9,
			},
		],
	},
];
