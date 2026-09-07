<script lang="ts">
	import { onDestroy, onMount } from "svelte";

	type MemberProg = {
		key: string;
		group: string;
		idol: string;
		stageName: string;
		avatar: string | null;
		wanted: number;
		got: number;
		status: "done" | "running" | "partial" | "failed" | "pending";
		at: string | null;
		reason: string | null;
	};

	type GroupProg = {
		group: string;
		avatar: string | null;
		members: number;
		finished: number;
		got: number;
		wanted: number;
		pct: number;
	};

	type Payload = {
		running: boolean;
		currentKey: string | null;
		lastLine: string;
		totals: {
			members: number;
			done: number;
			partial: number;
			failed: number;
			pending: number;
			imagesGot: number;
			imagesWanted: number;
			pct: number;
		};
		byGroup: GroupProg[];
		members: MemberProg[];
	};

	let data = $state<Payload | null>(null);
	let err = $state("");
	let query = $state("");
	let filter = $state<"all" | "running" | "done" | "partial" | "pending" | "failed">("all");
	let groupFilter = $state("全部");
	let tick = $state(0);

	let timer: ReturnType<typeof setInterval> | null = null;

	async function refresh() {
		try {
			const res = await fetch("/api/lab/douyin-dl-progress/", { cache: "no-store" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			data = (await res.json()) as Payload;
			err = "";
			tick++;
		} catch (e) {
			err = e instanceof Error ? e.message : String(e);
		}
	}

	onMount(() => {
		refresh();
		timer = setInterval(refresh, 4000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	const groups = $derived(["全部", ...new Set((data?.byGroup ?? []).map((g) => g.group))]);

	const filteredMembers = $derived.by(() => {
		if (!data) return [] as MemberProg[];
		const q = query.trim().toLowerCase();
		return data.members.filter((m) => {
			if (filter !== "all" && m.status !== filter) return false;
			if (groupFilter !== "全部" && m.group !== groupFilter) return false;
			if (!q) return true;
			return `${m.group} ${m.stageName} ${m.idol}`.toLowerCase().includes(q);
		});
	});

	function placeholder(label: string) {
		const letter = (label || "?").slice(0, 1).toUpperCase();
		return `data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="#27272a" width="128" height="128"/><text x="50%" y="54%" fill="#a1a1aa" font-size="42" text-anchor="middle" font-family="system-ui">${letter}</text></svg>`,
		)}`;
	}

	function statusLabel(s: MemberProg["status"]) {
		switch (s) {
			case "done":
				return "满员";
			case "running":
				return "正在下";
			case "partial":
				return "未满";
			case "failed":
				return "失败";
			default:
				return "排队";
		}
	}
</script>

<div class="prog">
	<header class="hero">
		<p class="eyebrow">T-014 · 壁纸下载监督</p>
		<h1>下载进度看板</h1>
		<p class="lead">
			每人目标 10 张手机竖屏壁纸。页面每 4 秒自动刷新，你不用问 AI，自己盯这里就行。
		</p>
		{#if data}
			<div class="overall">
				<div class="overall-top">
					<div>
						<span class:pulse={data.running} class="badge">{data.running ? "● 后台下载中" : "○ 当前空闲"}</span>
						{#if data.currentKey}
							<span class="now">正在：{data.currentKey.replace("|", " / ")}</span>
						{/if}
					</div>
					<strong>{data.totals.pct}%</strong>
				</div>
				<div class="bar"><i style={`width:${data.totals.pct}%`}></i></div>
				<div class="stats">
					<div><b>{data.totals.done}</b><span>人满员</span></div>
					<div><b>{data.totals.partial}</b><span>进行中/未满</span></div>
					<div><b>{data.totals.pending}</b><span>还没开始</span></div>
					<div><b>{data.totals.failed}</b><span>失败</span></div>
					<div><b>{data.totals.imagesGot}/{data.totals.imagesWanted}</b><span>已下张数</span></div>
				</div>
			</div>
		{:else if err}
			<p class="err">读进度失败：{err}（确认本机 dev 服务开着）</p>
		{:else}
			<p class="muted">加载进度中…</p>
		{/if}
	</header>

	{#if data}
		<section class="toolbar card">
			<input class="search" type="search" placeholder="搜团名 / 艺名" bind:value={query} />
			<select bind:value={groupFilter}>
				{#each groups as g}
					<option value={g}>{g}</option>
				{/each}
			</select>
			<div class="chips">
				{#each ["all", "running", "done", "partial", "pending", "failed"] as f}
					<button
						type="button"
						class="chip"
						class:on={filter === f}
						onclick={() => (filter = f as typeof filter)}
					>
						{f === "all"
							? "全部"
							: f === "running"
								? "正在下"
								: f === "done"
									? "满员"
									: f === "partial"
										? "未满"
										: f === "pending"
											? "排队"
											: "失败"}
					</button>
				{/each}
			</div>
			<button type="button" class="btn" onclick={refresh}>立即刷新</button>
		</section>

		<section class="groups">
			{#each data.byGroup as g}
				<article class="gcard card">
					<img class="avatar" src={g.avatar || placeholder(g.group)} alt="" width="40" height="40" />
					<div class="meta">
						<strong>{g.group}</strong>
						<span>{g.finished}/{g.members} 人满员 · {g.got}/{g.wanted} 张</span>
					</div>
					<div class="mini"><i style={`width:${g.pct}%`}></i></div>
					<em>{g.pct}%</em>
				</article>
			{/each}
		</section>

		<section class="members">
			{#each filteredMembers as m (m.key)}
				<article class="mcard" class:done={m.status === "done"} class:run={m.status === "running"}>
					<img
						class="avatar"
						src={m.avatar || placeholder(m.stageName)}
						alt=""
						width="42"
						height="42"
						loading="lazy"
					/>
					<div class="meta">
						<div class="name">{m.stageName} <small>{m.group}</small></div>
						<div class="sub">{m.got} / {m.wanted} 张 · {statusLabel(m.status)}</div>
					</div>
					<span class="pill {m.status}">{statusLabel(m.status)}</span>
					<div class="mini"><i style={`width:${Math.min(100, Math.round((m.got / m.wanted) * 100))}%`}></i></div>
				</article>
			{/each}
			{#if filteredMembers.length === 0}
				<p class="muted">这一筛选项下暂时没有人。</p>
			{/if}
		</section>

		{#if data.lastLine}
			<p class="logline">最新日志：{data.lastLine}</p>
		{/if}
		<p class="muted tiny">自动刷新 #{tick}</p>
	{/if}
</div>

<style>
	.prog {
		--gold: #e6c26e;
		--muted: #a1a1aa;
		--card: rgba(24, 24, 27, 0.88);
		--line: rgba(228, 198, 120, 0.18);
		color: #f4f4f5;
		max-width: 1100px;
		margin: 0 auto;
		padding: 0.5rem 0 2rem;
		font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
	}
	.hero h1 {
		margin: 0.2rem 0 0.45rem;
		font-size: clamp(1.45rem, 2.6vw, 1.9rem);
		font-weight: 750;
	}
	.eyebrow {
		margin: 0;
		color: var(--gold);
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.lead {
		margin: 0 0 1rem;
		color: var(--muted);
		line-height: 1.55;
		max-width: 40rem;
	}
	.overall {
		border: 1px solid var(--line);
		border-radius: 16px;
		background: var(--card);
		padding: 0.9rem 1rem;
	}
	.overall-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.55rem;
	}
	.overall-top strong {
		color: var(--gold);
		font-size: 1.4rem;
	}
	.badge {
		font-size: 0.82rem;
		color: #86efac;
		margin-right: 0.6rem;
	}
	.badge.pulse {
		animation: blink 1.4s ease-in-out infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.55;
		}
	}
	.now {
		color: var(--muted);
		font-size: 0.8rem;
	}
	.bar,
	.mini {
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.bar i,
	.mini i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #c9a227, #f7e3ae);
		border-radius: inherit;
	}
	.mini {
		width: 72px;
		height: 6px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.45rem;
		margin-top: 0.75rem;
	}
	.stats div {
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		padding: 0.45rem 0.25rem;
		background: rgba(255, 255, 255, 0.03);
	}
	.stats b {
		display: block;
		color: var(--gold);
		font-size: 0.95rem;
	}
	.stats span {
		font-size: 0.68rem;
		color: var(--muted);
	}
	.card {
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--card);
		padding: 0.75rem;
		margin-top: 0.75rem;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.search,
	select {
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: #f4f4f5;
		padding: 0.45rem 0.65rem;
	}
	.search {
		flex: 1;
		min-width: 160px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.chip,
	.btn {
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
		color: #f4f4f5;
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.chip.on {
		border-color: rgba(230, 194, 110, 0.5);
		background: rgba(230, 194, 110, 0.12);
		color: var(--gold);
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.55rem;
		margin-top: 0.75rem;
	}
	.gcard {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.45rem 0.55rem;
		align-items: center;
		margin: 0;
	}
	.gcard .mini {
		grid-column: 2 / 3;
		width: 100%;
	}
	.gcard em {
		font-style: normal;
		color: var(--gold);
		font-size: 0.85rem;
	}
	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		object-fit: cover;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: #18181b;
	}
	.meta strong,
	.name {
		display: block;
		font-weight: 650;
	}
	.meta span,
	.sub,
	.muted {
		color: var(--muted);
		font-size: 0.75rem;
	}
	.name small {
		color: var(--muted);
		font-weight: 500;
		margin-left: 0.35rem;
	}
	.members {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.85rem;
	}
	.mcard {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.55rem;
		align-items: center;
		padding: 0.45rem 0.5rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.mcard.run {
		border-color: rgba(56, 189, 248, 0.45);
		background: rgba(56, 189, 248, 0.08);
	}
	.mcard.done {
		opacity: 0.85;
	}
	.pill {
		font-size: 0.7rem;
		border-radius: 999px;
		padding: 0.2rem 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: var(--muted);
	}
	.pill.done {
		color: #86efac;
		border-color: rgba(134, 239, 172, 0.35);
	}
	.pill.running {
		color: #7dd3fc;
		border-color: rgba(125, 211, 252, 0.4);
	}
	.pill.partial {
		color: #fde68a;
		border-color: rgba(253, 230, 138, 0.35);
	}
	.pill.failed {
		color: #fda4af;
		border-color: rgba(253, 164, 175, 0.35);
	}
	.logline {
		margin-top: 0.9rem;
		font-size: 0.72rem;
		color: #71717a;
		word-break: break-all;
	}
	.err {
		color: #fda4af;
	}
	.tiny {
		margin-top: 0.35rem;
	}
	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.mcard {
			grid-template-columns: auto 1fr auto;
		}
		.mcard .mini {
			display: none;
		}
	}
</style>
