<script lang="ts">
	// 指挥室 · 一个可交互的迷你版 AI 协作看板（文章演示用）
	// 样式与交互自包含，不复用看板页面；数据为演示样本，便于公开阅读。
	let active = $state<"doing" | "review" | "queue" | "crew">("doing");

	const tabs = [
		{ id: "doing" as const, label: "正在进行", icon: "▶" },
		{ id: "review" as const, label: "等你过目", icon: "⚡" },
		{ id: "queue" as const, label: "排队中", icon: "☰" },
		{ id: "crew" as const, label: "AI 团队", icon: "👥" },
	];

	const chips: Record<string, { label: string; cls: string }> = {
		review: { label: "◉ 等你验收", cls: "bc-chip bc-chip-gold" },
		doing: { label: "● 进行中", cls: "bc-chip bc-chip-sky" },
		blocked: { label: "⛔ 卡住", cls: "bc-chip bc-chip-rose" },
		backlog: { label: "○ 排队中", cls: "bc-chip bc-chip-dim" },
	};

	const doingTasks = [
		{
			id: "T-101",
			title: "重做首页版式",
			cat: "网站",
			state: "review",
			emoji: "🎨",
			tone: "from-violet-500/40 to-fuchsia-500/20",
			plain: "把首页文章改成三列网格加封面，看起来更整齐、更好翻。",
			status: "已做完，等你过目",
			owner: "GLM",
			ok: true,
		},
		{
			id: "T-102",
			title: "图库质检",
			cat: "图库",
			state: "doing",
			emoji: "🖼️",
			tone: "from-sky-500/40 to-indigo-500/20",
			plain: "一张张看库里 4.8 万张图，好图留下，糊图挪进隔离区。",
			status: "SEVENTEEN 判完 · 下团接力",
			owner: "GLM",
		},
		{
			id: "T-103",
			title: "站点体检",
			cat: "网站",
			state: "doing",
			emoji: "🧭",
			tone: "from-emerald-500/40 to-teal-500/20",
			plain: "从首页到内页把功能逐项过一遍，别让访客看到坏页面。",
			status: "1/10 项通过 · 等额度恢复",
			owner: "Codex",
		},
	];

	const reviewTasks = [
		{
			id: "T-104",
			title: "全站回归",
			cat: "网站",
			state: "review",
			emoji: "✅",
			tone: "from-amber-500/40 to-orange-500/20",
			plain: "亮暗主题、手机端、搜索分页全部核验一遍。",
			status: "已通过 · 无需改代码",
			owner: "Codex",
			ok: true,
		},
	];

	const queued = [
		{ id: "T-105", title: "移动端断点与触控", cat: "网站", plain: "用手机尺寸把每个页面过一遍。" },
		{ id: "T-106", title: "暗色/主题切换一致性", cat: "网站", plain: "夜间模式切了之后颜色是否协调。" },
		{ id: "T-107", title: "性能与资产瘦身", cat: "网站", plain: "图片懒加载、字体瘦身，首屏不变慢。" },
	];

	const crew = [
		{ name: "GLM", role: "资产管线 · 分类整理", color: "#a78bfa", busy: true },
		{ name: "DeepSeek", role: "二次元 / 生图 · 资产线", color: "#3b82f6", busy: true },
		{ name: "Codex", role: "站点回归 · 前端", color: "#10b981", busy: true },
		{ name: "Cursor", role: "外观 UX · 显示设置", color: "#f59e0b", busy: false },
		{ name: "Saki", role: "老板 · 拍板验收", color: "#fbbf24", busy: true },
	];

	const dossier = {
		id: "N-201",
		kind: "拍板",
		taskRef: "T-013",
		title: "要不要把图库每号从 600 加深到 1500？",
		hook: "锦上添花的加餐，不急，你定节奏",
		pages: [
			{
				h: "这是件什么事",
				p: [
					"当初从 Instagram 抓图时，每位艺人设了 600 张上限。其实很多艺人的主页远不止 600 张好图，早年神图往往藏在时间线深处。",
					"这单是问你要不要『深挖』：把每人补到最多 1500 张，只补没存过的老图（有防重档案，不会下重）。",
				],
			},
			{
				h: "我替你先验了一遍",
				p: [
					"好处：图库更完整，特别是早年精华图。顾虑：多占几个 G，而且这属于『锦上添花』，不是急活。",
					"跑起来以后全程后台，不占你的时间。",
				],
			},
			{
				h: "我的建议",
				p: [
					"我倾向做，但不急着今天定——等图库质检收尾、索引建好之后再动手更顺手。",
					"你只需要回一句『做』或『先不做』，也可以提条件，比如『只给我常看的几个团加深』。",
				],
			},
		],
	};

	let page = $state(0);
	let copied = $state(false);

	function flip(delta: number) {
		const n = dossier.pages.length;
		page = (page + delta + n) % n;
	}

	function copyInstruction() {
		const msg =
			`【指挥室 · ${dossier.id} ${dossier.title}】\n老板回复：……\n\n` +
			`——来自 Agent 看板（/lab/agent-board/）的老板回复，请你处理（关联任务 ${dossier.taskRef}）：完成后把 inbox.json 里这一条标为 resolved，并同步 tasks.json。`;
		navigator.clipboard?.writeText(msg).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2200);
		});
	}
</script>

<div class="bcd">
	<div class="bcd-head">
		<p class="bcd-eyebrow">STULANEZ · COMMAND DECK</p>
		<h3 class="bcd-title">指挥室</h3>
		<p class="bcd-sub">
			几位 AI 员工 + 你，在这里推进网站和 5 万张图的图库。他们在干什么、
			干到哪一步、哪件事在等你——看这一屏就够了。
		</p>
		<div class="bcd-stats">
			<span class="bc-stat bc-stat-hot">⚡ 等你过目 <b>1</b></span>
			<span class="bc-stat">▶ 进行中 <b>3</b></span>
			<span class="bc-stat">👥 空闲 <b>1</b>/4</span>
			<span class="bc-stat">✔ 累计完成 <b>12</b></span>
		</div>
	</div>

	<nav class="bcd-tabs">
		{#each tabs as t (t.id)}
			<button class:active={active === t.id} onclick={() => (active = t.id)}>
				{t.icon} {t.label}
			</button>
		{/each}
	</nav>

	{#if active === "doing"}
		<div class="bcd-grid">
			{#each doingTasks as t (t.id)}
				<article class="bc-card">
					<div class="bc-cover {t.tone}"><span>{t.emoji}</span></div>
					<div class="bc-body">
						<div class="bc-row">
							<span class="bc-id">{t.id}</span>
							<span class="bc-chip {chips[t.state]?.cls}">{chips[t.state]?.label ?? t.state}</span>
						</div>
						<h4 class="bc-title">{t.title}</h4>
						<p class="bc-plain">{t.plain}</p>
						<p class="bc-status">{t.status}</p>
						<div class="bc-foot">
							<span class="bc-owner"><i style={`background:${crew.find((c) => c.name === t.owner)?.color ?? "#a1a1aa"}`}></i>{t.owner}</span>
							<span class="bc-more">详情 →</span>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{:else if active === "review"}
		<div class="bcd-grid">
			{#each reviewTasks as t (t.id)}
				<article class="bc-card">
					<div class="bc-cover {t.tone}"><span>{t.emoji}</span></div>
					<div class="bc-body">
						<div class="bc-row">
							<span class="bc-id">{t.id}</span>
							<span class="bc-chip {chips[t.state]?.cls}">{chips[t.state]?.label ?? t.state}</span>
						</div>
						<h4 class="bc-title">{t.title}</h4>
						<p class="bc-plain">{t.plain}</p>
						<p class="bc-status">{t.status}</p>
						<div class="bc-foot">
							<span class="bc-owner"><i style={`background:${crew.find((c) => c.name === t.owner)?.color ?? "#a1a1aa"}`}></i>{t.owner}</span>
							<span class="bc-more">详情 →</span>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{:else if active === "queue"}
		<div class="bcd-list">
			{#each queued as t (t.id)}
				<div class="bc-li">
					<span class="bc-chip bc-chip-dim">○ 排队中</span>
					<div class="bc-li-main">
						<p class="bc-li-title">{t.title}</p>
						<p class="bc-li-plain">{t.plain}</p>
					</div>
					<span class="bc-id">{t.id}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="bcd-crew">
			{#each crew as c (c.name)}
				<div class="bc-agent">
					<span class="bc-avatar" style={`background:${c.color}`}>{c.name.charAt(0)}</span>
					<div class="bc-agent-info">
						<p class="bc-agent-name">{c.name}</p>
						<p class="bc-agent-role">{c.role}</p>
					</div>
					<span class:bc-dot-busy={c.busy} class="bc-dot"></span>
				</div>
			{/each}
		</div>
	{/if}

	{#if active === "review"}
		<div class="bcd-dossier">
			<div class="bc-dossier-head">
				<span class="bc-chip bc-chip-gold">⚖️ {dossier.kind}</span>
				<span class="bc-id">关联 {dossier.taskRef} · GLM 提出</span>
			</div>
			<h4 class="bc-dossier-title">{dossier.title}</h4>
			<p class="bc-dossier-hook">{dossier.hook}</p>
			<div class="bc-page">
				<p class="bc-page-h">{dossier.pages[page].h}</p>
				{#each dossier.pages[page].p as para (para)}
					<p class="bc-page-p">{para}</p>
				{/each}
			</div>
			<div class="bc-dossier-foot">
				<div class="bc-dots">
					{#each dossier.pages as _, i (i)}
						<button class:on={page === i} onclick={() => (page = i)} class="bc-dot2" aria-label="第 {i + 1} 页" />
					{/each}
				</div>
				<div class="bc-nav">
					<button class="bc-navbtn" onclick={() => flip(-1)}>‹ 上一页</button>
					<button class="bc-navbtn" onclick={() => flip(1)}>下一页 ›</button>
					<button class="bc-copy" onclick={copyInstruction}>
						{copied ? "✓ 已复制" : "复制成指令 →"}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<p class="bcd-note">
		↑ 这是真实看板的可交互缩影。完整版在站内 <code>/lab/agent-board/</code>（内部面板）。
	</p>
</div>

<style>
	.bcd {
		border: 1px solid rgba(230, 194, 110, 0.18);
		border-radius: 20px;
		overflow: hidden;
		background: #0b0b0f;
		color: #e7e7ea;
		font-family: inherit;
		margin: 1.2rem 0;
		box-shadow: 0 20px 60px -24px rgba(0, 0, 0, 0.7);
	}
	.bcd-head {
		padding: 1.4rem 1.5rem 1.2rem;
		background:
			radial-gradient(120% 120% at 0% 0%, rgba(230, 194, 110, 0.08), transparent 55%),
			#0b0b0f;
	}
	.bcd-eyebrow {
		margin: 0 0 0.4rem;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.42em;
		color: #e6c26e;
	}
	.bcd-title {
		margin: 0;
		font-size: 30px;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: #fff;
	}
	.bcd-sub {
		margin: 0.6rem 0 0;
		max-width: 40rem;
		font-size: 13px;
		line-height: 1.75;
		color: #a1a1aa;
	}
	.bcd-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.bc-stat {
		font-size: 11px;
		font-weight: 700;
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		color: #d4d4d8;
	}
	.bc-stat b {
		color: #e6c26e;
		margin-left: 0.25rem;
	}
	.bc-stat-hot {
		background: rgba(230, 194, 110, 0.12);
		color: #e6c26e;
	}
	.bcd-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.5rem 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
	}
	.bcd-tabs button {
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
		color: #a1a1aa;
		font-size: 12px;
		font-weight: 700;
		padding: 0.4rem 0.85rem;
		border-radius: 999px;
		cursor: pointer;
		transition: 0.18s;
	}
	.bcd-tabs button.active {
		background: rgba(230, 194, 110, 0.12);
		border-color: rgba(230, 194, 110, 0.35);
		color: #e6c26e;
	}
	.bcd-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
		gap: 1rem;
		padding: 1.2rem 1px 0;
		padding: 1.2rem 0 0;
	}
	.bc-card {
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 16px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.02);
	}
	.bc-cover {
		height: 78px;
		display: grid;
		place-items: center;
		font-size: 30px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), transparent);
	}
	.bc-body {
		padding: 0.85rem;
	}
	.bc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.bc-id {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.6);
		background: rgba(0, 0, 0, 0.4);
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
	}
	.bc-chip {
		font-size: 10px;
		font-weight: 700;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		white-space: nowrap;
	}
	.bc-chip-gold { background: rgba(230, 194, 110, 0.12); color: #e6c26e; box-shadow: inset 0 0 0 1px rgba(230, 194, 110, 0.25); }
	.bc-chip-sky { background: rgba(56, 189, 248, 0.12); color: #7dd3fc; box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.25); }
	.bc-chip-rose { background: rgba(251, 113, 133, 0.12); color: #fda4af; box-shadow: inset 0 0 0 1px rgba(251, 113, 133, 0.25); }
	.bc-chip-dim { background: rgba(255, 255, 255, 0.05); color: #a1a1aa; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
	.bc-title {
		margin: 0.6rem 0 0.35rem;
		font-size: 15px;
		font-weight: 800;
		color: #fff;
	}
	.bc-plain {
		margin: 0;
		font-size: 12px;
		line-height: 1.65;
		color: #a1a1aa;
	}
	.bc-status {
		margin: 0.6rem 0 0;
		font-size: 11px;
		font-weight: 700;
		color: #e6c26e;
		background: rgba(230, 194, 110, 0.07);
		border-radius: 10px;
		padding: 0.4rem 0.6rem;
	}
	.bc-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.7rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.bc-owner {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 11px;
		color: #a1a1aa;
	}
	.bc-owner i {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		display: inline-block;
	}
	.bc-more {
		font-size: 11px;
		font-weight: 700;
		color: #e6c26e;
	}
	.bcd-list {
		padding: 1rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.bc-li {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 0.7rem 0.9rem;
		background: rgba(255, 255, 255, 0.02);
	}
	.bc-li-main { flex: 1; min-width: 0; }
	.bc-li-title { margin: 0; font-size: 13px; font-weight: 700; color: #e7e7ea; }
	.bc-li-plain { margin: 0.15rem 0 0; font-size: 11px; color: #a1a1aa; }
	.bcd-crew {
		padding: 1rem 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.7rem;
	}
	.bc-agent {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 0.7rem 0.8rem;
		background: rgba(255, 255, 255, 0.02);
	}
	.bc-avatar {
		width: 34px;
		height: 34px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 800;
		font-size: 15px;
		flex: none;
	}
	.bc-agent-info { min-width: 0; flex: 1; }
	.bc-agent-name { margin: 0; font-size: 13px; font-weight: 800; color: #fff; }
	.bc-agent-role { margin: 0.1rem 0 0; font-size: 10px; color: #a1a1aa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.bc-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #52525b;
	}
	.bc-dot-busy { background: #34d399; box-shadow: 0 0 10px rgba(52, 211, 153, 0.6); }
	.bcd-dossier {
		margin-top: 1.2rem;
		border: 1px solid rgba(230, 194, 110, 0.2);
		border-radius: 16px;
		padding: 1.1rem 1.2rem;
		background: rgba(230, 194, 110, 0.03);
	}
	.bc-dossier-head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
	.bc-dossier-title { margin: 0.7rem 0 0; font-size: 18px; font-weight: 900; color: #fff; }
	.bc-dossier-hook { margin: 0.35rem 0 0; font-size: 12px; color: #a1a1aa; }
	.bc-page {
		margin-top: 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 12px;
		padding: 0.9rem 1rem;
		background: rgba(0, 0, 0, 0.25);
		min-height: 96px;
	}
	.bc-page-h { margin: 0 0 0.5rem; font-size: 12px; font-weight: 800; color: #e6c26e; }
	.bc-page-p { margin: 0 0 0.5rem; font-size: 12.5px; line-height: 1.7; color: #d4d4d8; }
	.bc-page-p:last-child { margin-bottom: 0; }
	.bc-dossier-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
	}
	.bc-dots { display: flex; gap: 0.35rem; }
	.bc-dot2 {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 0;
		padding: 0;
		background: rgba(255, 255, 255, 0.18);
		cursor: pointer;
	}
	.bc-dot2.on { background: #e6c26e; }
	.bc-nav { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.bc-navbtn {
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		color: #d4d4d8;
		font-size: 11px;
		font-weight: 700;
		border-radius: 8px;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
	}
	.bc-copy {
		border: 0;
		background: #e6c26e;
		color: #16120a;
		font-size: 11px;
		font-weight: 800;
		border-radius: 8px;
		padding: 0.45rem 0.8rem;
		cursor: pointer;
	}
	.bcd-note {
		margin: 1rem 1rem 1.1rem;
		font-size: 11px;
		color: #71717a;
	}
	.bcd-note code {
		color: #a1a1aa;
		font-size: 10.5px;
		background: rgba(255, 255, 255, 0.06);
		padding: 0.1rem 0.3rem;
		border-radius: 4px;
	}
</style>
