import type { MusicPlayerConfig } from "../types/musicConfig";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "one",

	// 是否显启用歌词
	showLyrics: false,

	// Meting API 配置
	meting: {
		// Meting API 地址
		// 默认使用官方 API，也可以使用自定义 API
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server: "netease",
		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type: "playlist",
		// 歌单/专辑/单曲 ID 或搜索关键词
		id: "10046455237",
		// 认证 token（可选）
		auth: "",
		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	// 本地音乐配置（当 mode 为 'local' 时使用）
	// 1. 支持传入歌词文件的路径
	// lrc: "/assets/music/lrc/使一颗心免于哀伤-哼唱.lrc",
	// 2. 或者直接填入歌词字符串内容
	// lrc: "[00:00.00]歌词内容...",
	local: {
		playlist: [
			{ name: "퀸카 (Queencard)", artist: "(G)I-DLE", url: "/assets/music/kpop/gidle-queencard.mp3", cover: "/assets/music/cover/gidle-queencard.jpg" },
			{ name: "Not Shy", artist: "ITZY", url: "/assets/music/kpop/itzy-not-shy.mp3", cover: "/assets/music/cover/itzy-not-shy.jpg" },
			{ name: "4 Walls (Korean Ver.)", artist: "f(x)", url: "/assets/music/kpop/fx-4walls.mp3", cover: "/assets/music/cover/fx-4walls.jpg" },
			{ name: "Whiplash", artist: "aespa", url: "/assets/music/kpop/aespa-whiplash.mp3", cover: "/assets/music/cover/aespa-whiplash.jpg" },
			{ name: "SUPA DUPA LUV", artist: "BABYMONSTER", url: "/assets/music/kpop/babymonster-supa-dupa-luv.mp3", cover: "/assets/music/cover/babymonster-supa-dupa-luv.jpg" },
			{ name: "하루하루 (一天一天)", artist: "BIGBANG", url: "/assets/music/kpop/bigbang-haru-haru.mp3", cover: "/assets/music/cover/bigbang-haru-haru.jpg" },
			{ name: "BYOB (bring your own best friend)", artist: "Billlie", url: "/assets/music/kpop/billlie-byob.mp3", cover: "/assets/music/cover/billlie-byob.jpg" },
			{ name: "Boom Boom Bass", artist: "RIIZE", url: "/assets/music/kpop/riize-boom-boom-bass.mp3", cover: "/assets/music/cover/riize-boom-boom-bass.jpg" },
			{ name: "One More Night", artist: "BTS", url: "/assets/music/bts-one-more-night.mp3", cover: "/assets/music/cover/bts-one-more-night.jpg" },
			{ name: "Home", artist: "ENHYPEN", url: "/assets/music/kpop/enhypen-home.mp3", cover: "/assets/music/cover/enhypen-home.jpg" },
			{ name: "FAMOUS", artist: "ALLDAY PROJECT", url: "/assets/music/kpop/allday-famous.mp3", cover: "/assets/music/cover/allday-famous.jpg" },
			{ name: "Darling", artist: "Girl's Day", url: "/assets/music/kpop/girlsday-darling.mp3", cover: "/assets/music/cover/girlsday-darling.jpg" },
			{ name: "GO!", artist: "CORTIS", url: "/assets/music/kpop/cortis-go.mp3", cover: "/assets/music/cover/cortis-go.jpg" },
			{ name: "Ice On My Teeth", artist: "ATEEZ", url: "/assets/music/kpop/ateez-ice-on-my-teeth.mp3", cover: "/assets/music/cover/ateez-ice-on-my-teeth.jpg" },
			{ name: "Igloo", artist: "KISS OF LIFE", url: "/assets/music/kpop/kissoflife-igloo.mp3", cover: "/assets/music/cover/kissoflife-igloo.jpg" },
			{ name: "jellyous", artist: "ILLIT", url: "/assets/music/kpop/illit-jellyous.mp3", cover: "/assets/music/cover/illit-jellyous.jpg" },
			{ name: "Off The Record", artist: "IVE", url: "/assets/music/kpop/ive-off-the-record.mp3", cover: "/assets/music/cover/ive-off-the-record.jpg" },
			{ name: "Mr.", artist: "KARA", url: "/assets/music/kpop/kara-mr.mp3", cover: "/assets/music/cover/kara-mr.jpg" },
			{ name: "UNDERDOGS", artist: "KiiiKiii", url: "/assets/music/kpop/kiikiii-underdogs.mp3", cover: "/assets/music/cover/kiikiii-underdogs.jpg" },
			{ name: "SPAGHETTI (feat. j-hope of BTS)", artist: "LE SSERAFIM", url: "/assets/music/kpop/lesserafim-spaghetti.mp3", cover: "/assets/music/cover/lesserafim-spaghetti.jpg" },
			{ name: "LIKE YOU BETTER", artist: "fromis_9", url: "/assets/music/kpop/fromis9-like-you-better.mp3", cover: "/assets/music/cover/fromis9-like-you-better.jpg" },
			{ name: "DDI RO RI", artist: "MEOVV", url: "/assets/music/kpop/meovv-ddi-ro-ri.mp3", cover: "/assets/music/cover/meovv-ddi-ro-ri.jpg" },
			{ name: "PYTHON", artist: "GOT7", url: "/assets/music/kpop/got7-python.mp3", cover: "/assets/music/cover/got7-python.jpg" },
			{ name: "Deja Vu", artist: "RESCENE", url: "/assets/music/kpop/rescene-deja-vu.mp3", cover: "/assets/music/cover/rescene-deja-vu.jpg" },
			{ name: "누난 너무 예뻐 (Replay)", artist: "SHINee", url: "/assets/music/kpop/shinee-replay.mp3", cover: "/assets/music/cover/shinee-replay.jpg" },
			{ name: "ASAP", artist: "STAYC", url: "/assets/music/kpop/stayc-asap.mp3", cover: "/assets/music/cover/stayc-asap.jpg" },
			{ name: "STYLE", artist: "Hearts2Hearts", url: "/assets/music/kpop/hearts2hearts-style.mp3", cover: "/assets/music/cover/hearts2hearts-style.jpg" },
			{ name: "Supernatural", artist: "NewJeans", url: "/assets/music/kpop/newjeans-supernatural.mp3", cover: "/assets/music/cover/newjeans-supernatural.jpg" },
			{ name: "5시 53분의 하늘에서 발견한 너와 나 (Blue Hour)", artist: "TOMORROW X TOGETHER", url: "/assets/music/kpop/txt-blue-hour.mp3", cover: "/assets/music/cover/txt-blue-hour.jpg" },
			{ name: "THIS IS FOR", artist: "TWICE", url: "/assets/music/kpop/twice-this-is-for.mp3", cover: "/assets/music/cover/twice-this-is-for.jpg" },
			{ name: "이루리", artist: "宇宙少女 (WJSN)", url: "/assets/music/kpop/wjsn-iruri.mp3", cover: "/assets/music/cover/wjsn-iruri.jpg" },
			{ name: "고맙다 (THANKS)", artist: "SEVENTEEN", url: "/assets/music/kpop/seventeen-thanks.mp3", cover: "/assets/music/cover/seventeen-thanks.jpg" },
			{ name: "내 안의 모든 시와 소설은", artist: "CLOSE YOUR EYES", url: "/assets/music/kpop/closeyoureyes-poems.mp3", cover: "/assets/music/cover/closeyoureyes-poems.jpg" },
			{ name: "너라고 (It's You)", artist: "SUPER JUNIOR", url: "/assets/music/kpop/superjunior-its-you.mp3", cover: "/assets/music/cover/superjunior-its-you.jpg" },
			{ name: "마지막 축제", artist: "TWS", url: "/assets/music/kpop/tws-last-festival.mp3", cover: "/assets/music/cover/tws-last-festival.jpg" },
			{ name: "살짝 설렜어 (Nonstop)", artist: "OH MY GIRL", url: "/assets/music/kpop/ohmygirl-nonstop.mp3", cover: "/assets/music/cover/ohmygirl-nonstop.jpg" },
			{ name: "우리의 다정한 계절 속에 (Season of Memories)", artist: "GFRIEND", url: "/assets/music/kpop/gfriend-season-of-memories.mp3", cover: "/assets/music/cover/gfriend-season-of-memories.jpg" },
		],
	},
};
