<script lang="ts">
	import { onMount } from "svelte";

	type Member = {
		id: string;
		idol: string;
		stageName: string;
		realName: string;
		ig: string | null;
		enabled: boolean;
		qty: number;
		avatar: string | null;
		hasLibraryFolder: boolean;
	};

	type Group = {
		id: string;
		group: string;
		slug: string;
		enabled: boolean;
		qty: number;
		avatar: string | null;
		members: Member[];
	};

	type Roster = {
		updated: string;
		defaults: { memberQty: number; groupQty: number };
		stats: { groups: number; members: number; defaultTotalImages: number };
		groups: Group[];
	};

	type Prefs = {
		updated: string;
		defaultMemberQty: number;
		defaultGroupQty: number;
		groups: Array<{
			id: string;
			enabled: boolean;
			qty: number;
			members: Array<{ id: string; enabled: boolean; qty: number }>;
		}>;
	};

	let {
		roster,
	}: {
		roster: Roster;
	} = $props();

	const STORAGE_KEY = "douyin-roster-prefs-v1";

	let groups = $state<Group[]>(structuredClone(roster.groups));
	let query = $state("");
	let onlyEnabled = $state(false);
	let missingName = $state(false);
	let saveMsg = $state("");
	let bulkMemberQty = $state(roster.defaults.memberQty);
	let bulkGroupQty = $state(roster.defaults.groupQty);

	function applyPrefs(prefs: Prefs) {
		const map = new Map(prefs.groups.map((g) => [g.id, g]));
		groups = groups.map((g) => {
			const pg = map.get(g.id);
			if (!pg) return g;
			const mm = new Map(pg.members.map((m) => [m.id, m]));
			return {
				...g,
				enabled: pg.enabled,
				qty: pg.qty,
				members: g.members.map((m) => {
					const pm = mm.get(m.id);
					return pm ? { ...m, enabled: pm.enabled, qty: pm.qty } : m;
				}),
			};
		});
	}

	function toPrefs(): Prefs {
		return {
			updated: new Date().toISOString(),
			defaultMemberQty: bulkMemberQty,
			defaultGroupQty: bulkGroupQty,
			groups: groups.map((g) => ({
				id: g.id,
				enabled: g.enabled,
				qty: g.qty,
				members: g.members.map((m) => ({
					id: m.id,
					enabled: m.enabled,
					qty: m.qty,
				})),
			})),
		};
	}

	function persistLocal() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toPrefs()));
	}

	onMount(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) applyPrefs(JSON.parse(raw) as Prefs);
		} catch {
			/* ignore */
		}
	});

	function clampQty(n: number) {
		return Math.max(0, Math.min(99, Math.round(n) || 0));
	}

	function setGroupEnabled(g: Group, on: boolean) {
		g.enabled = on;
		if (!on) g.members = g.members.map((m) => ({ ...m, enabled: false }));
		groups = [...groups];
		persistLocal();
	}

	function setMemberEnabled(g: Group, m: Member, on: boolean) {
		m.enabled = on;
		if (on && !g.enabled) g.enabled = true;
		groups = [...groups];
		persistLocal();
	}

	function setGroupQty(g: Group, qty: number) {
		g.qty = clampQty(qty);
		groups = [...groups];
		persistLocal();
	}

	function setMemberQty(m: Member, qty: number) {
		m.qty = clampQty(qty);
		groups = [...groups];
		persistLocal();
	}

	function applyBulkQty() {
		const mq = clampQty(bulkMemberQty);
		const gq = clampQty(bulkGroupQty);
		groups = groups.map((g) => ({
			...g,
			qty: g.enabled ? gq : g.qty,
			members: g.members.map((m) => ({
				...m,
				qty: m.enabled ? mq : m.qty,
			})),
		}));
		persistLocal();
		saveMsg = `已把启用中的团改成各 ${gq} 张、成员各 ${mq} 张`;
	}

	function enableAll() {
		groups = groups.map((g) => ({
			...g,
			enabled: true,
			members: g.members.map((m) => ({ ...m, enabled: true })),
		}));
		persistLocal();
	}

	function disableAll() {
		groups = groups.map((g) => ({
			...g,
			enabled: false,
			members: g.members.map((m) => ({ ...m, enabled: false })),
		}));
		persistLocal();
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return groups
			.map((g) => {
				const members = g.members.filter((m) => {
					if (onlyEnabled && !m.enabled) return false;
					if (missingName && m.realName) return false;
					if (!q) return true;
					const hay = `${g.group} ${m.stageName} ${m.idol} ${m.realName} ${m.ig ?? ""}`.toLowerCase();
					return hay.includes(q);
				});
				const groupHit = !q || g.group.toLowerCase().includes(q);
				if (onlyEnabled && !g.enabled && members.length === 0) return null;
				if (!groupHit && members.length === 0) return null;
				return { ...g, members };
			})
			.filter(Boolean) as Group[];
	});

	const totals = $derived.by(() => {
		let groupsOn = 0;
		let membersOn = 0;
		let images = 0;
		let noName = 0;
		let noAvatar = 0;
		for (const g of groups) {
			if (g.enabled) {
				groupsOn++;
				images += g.qty;
			}
			for (const m of g.members) {
				if (m.enabled) {
					membersOn++;
					images += m.qty;
				}
				if (!m.realName) noName++;
				if (!m.avatar) noAvatar++;
			}
		}
		return { groupsOn, membersOn, images, noName, noAvatar };
	});

	async function saveToDisk() {
		saveMsg = "保存中…";
		try {
			const res = await fetch("/api/lab/douyin-roster-prefs", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(toPrefs()),
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			persistLocal();
			saveMsg = `已写入本机 ${data.path} · 启用 ${totals.groupsOn} 团 / ${totals.membersOn} 人 · 合计约 ${totals.images} 张`;
		} catch (e) {
			persistLocal();
			saveMsg = `本机接口失败，已先存浏览器：${e instanceof Error ? e.message : String(e)}`;
		}
	}

	function downloadPrefs() {
		const blob = new Blob([JSON.stringify(toPrefs(), null, "\t")], {
			type: "application/json",
		});
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "douyin-roster-prefs.json";
		a.click();
		URL.revokeObjectURL(a.href);
		saveMsg = "已下载配置文件，也可点「保存到本机」留给 AI 读取";
	}

	function placeholder(label: string) {
		const letter = (label || "?").slice(0, 1).toUpperCase();
		return `data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect fill="#27272a" width="128" height="128"/><text x="50%" y="54%" fill="#a1a1aa" font-size="42" text-anchor="middle" font-family="system-ui">${letter}</text></svg>`,
		)}`;
	}
</script>

<div class="roster">
	<header class="hero">
		<p class="eyebrow">T-014 · 抖音实战前 · 本地过目</p>
		<h1>下载名单调参台</h1>
		<p class="lead">
			先勾谁要下、各下几张。默认：每个团 10 张 + 每位成员 10 张手机壁纸。你改完保存，我再去抖音找图。
		</p>
		<div class="stats">
			<div><b>{totals.groupsOn}</b><span>启用的团</span></div>
			<div><b>{totals.membersOn}</b><span>启用的人</span></div>
			<div><b>{totals.images}</b><span>预计张数</span></div>
			<div><b>{totals.noName}</b><span>缺本名</span></div>
			<div><b>{totals.noAvatar}</b><span>缺头像</span></div>
		</div>
	</header>

	<section class="toolbar card">
		<div class="row">
			<input
				class="search"
				type="search"
				placeholder="搜团名 / 艺名 / 本名 / IG"
				bind:value={query}
			/>
			<label class="chk"><input type="checkbox" bind:checked={onlyEnabled} /> 只看启用</label>
			<label class="chk"><input type="checkbox" bind:checked={missingName} /> 只看缺本名</label>
		</div>
		<div class="row wrap">
			<label class="qty-lab"
				>成员默认
				<input type="number" min="0" max="99" bind:value={bulkMemberQty} />
			</label>
			<label class="qty-lab"
				>团体默认
				<input type="number" min="0" max="99" bind:value={bulkGroupQty} />
			</label>
			<button type="button" class="btn" onclick={applyBulkQty}>套用到启用项</button>
			<button type="button" class="btn ghost" onclick={enableAll}>全开</button>
			<button type="button" class="btn ghost" onclick={disableAll}>全关</button>
			<button type="button" class="btn primary" onclick={saveToDisk}>保存到本机</button>
			<button type="button" class="btn" onclick={downloadPrefs}>导出 JSON</button>
		</div>
		{#if saveMsg}
			<p class="msg">{saveMsg}</p>
		{/if}
	</section>

	{#each filtered as g (g.id)}
		<section class="group card" class:off={!g.enabled}>
			<div class="group-head">
				<img
					class="avatar lg"
					src={g.avatar || placeholder(g.group)}
					alt=""
					loading="lazy"
					width="56"
					height="56"
				/>
				<div class="meta">
					<h2>{g.group}</h2>
					<p class="sub">{g.members.length} 人 · 团体壁纸名额</p>
				</div>
				<label class="chk big">
					<input
						type="checkbox"
						checked={g.enabled}
						onchange={(e) => setGroupEnabled(g, (e.currentTarget as HTMLInputElement).checked)}
					/>
					启用团
				</label>
				<label class="qty-lab">
					张数
					<input
						type="number"
						min="0"
						max="99"
						value={g.qty}
						disabled={!g.enabled}
						onchange={(e) =>
							setGroupQty(g, Number((e.currentTarget as HTMLInputElement).value))}
					/>
				</label>
			</div>

			<div class="members">
				{#each g.members as m (m.id)}
					<article class="member" class:off={!m.enabled}>
						<img
							class="avatar"
							src={m.avatar || placeholder(m.stageName)}
							alt=""
							loading="lazy"
							width="44"
							height="44"
						/>
						<div class="meta">
							<div class="name">{m.stageName}</div>
							<div class="sub">
								{#if m.realName}
									本名 {m.realName}
								{:else}
									<span class="warn">本名待补</span>
								{/if}
								{#if m.ig}
									· IG @{m.ig}
								{/if}
								{#if !m.hasLibraryFolder}
									· <span class="warn">库无专夹</span>
								{/if}
							</div>
						</div>
						<label class="chk">
							<input
								type="checkbox"
								checked={m.enabled}
								onchange={(e) =>
									setMemberEnabled(g, m, (e.currentTarget as HTMLInputElement).checked)}
							/>
						</label>
						<label class="qty-lab slim">
							<input
								type="number"
								min="0"
								max="99"
								value={m.qty}
								disabled={!m.enabled}
								onchange={(e) =>
									setMemberQty(m, Number((e.currentTarget as HTMLInputElement).value))}
							/>
						</label>
					</article>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.roster {
		--card: rgba(24, 24, 27, 0.88);
		--line: rgba(228, 198, 120, 0.18);
		--gold: #e6c26e;
		--text: #f4f4f5;
		--muted: #a1a1aa;
		color: var(--text);
		max-width: 980px;
		margin: 0 auto;
		padding: 1.25rem 1rem 3rem;
		font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
	}
	.hero h1 {
		font-size: clamp(1.6rem, 3vw, 2.1rem);
		font-weight: 750;
		margin: 0.2rem 0 0.5rem;
		letter-spacing: 0.02em;
	}
	.eyebrow {
		color: var(--gold);
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin: 0;
	}
	.lead {
		color: var(--muted);
		line-height: 1.55;
		margin: 0 0 1rem;
		max-width: 42rem;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.stats div {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 0.7rem 0.55rem;
		text-align: center;
	}
	.stats b {
		display: block;
		font-size: 1.25rem;
		color: var(--gold);
	}
	.stats span {
		font-size: 0.72rem;
		color: var(--muted);
	}
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 0.9rem;
		margin-top: 0.85rem;
		backdrop-filter: blur(8px);
	}
	.toolbar .row {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.toolbar .row + .row {
		margin-top: 0.65rem;
	}
	.search {
		flex: 1;
		min-width: 180px;
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		color: var(--text);
		padding: 0.55rem 0.75rem;
	}
	.chk {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		font-size: 0.85rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.chk.big {
		color: var(--text);
	}
	.qty-lab {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.qty-lab input {
		width: 3.4rem;
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: var(--text);
		padding: 0.35rem 0.4rem;
	}
	.qty-lab.slim input {
		width: 3rem;
	}
	.btn {
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
		border-radius: 10px;
		padding: 0.45rem 0.75rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.btn:hover {
		border-color: rgba(230, 194, 110, 0.45);
	}
	.btn.primary {
		background: linear-gradient(135deg, #c9a227, #8a6d1d);
		border-color: transparent;
		color: #111;
		font-weight: 650;
	}
	.btn.ghost {
		opacity: 0.85;
	}
	.msg {
		margin: 0.65rem 0 0;
		color: #86efac;
		font-size: 0.85rem;
	}
	.group.off {
		opacity: 0.45;
	}
	.group-head {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.75rem;
		align-items: center;
	}
	.avatar {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		object-fit: cover;
		background: #18181b;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.avatar.lg {
		width: 56px;
		height: 56px;
		border-radius: 14px;
	}
	.meta h2 {
		margin: 0;
		font-size: 1.05rem;
	}
	.name {
		font-weight: 650;
	}
	.sub {
		color: var(--muted);
		font-size: 0.78rem;
		margin: 0.15rem 0 0;
	}
	.warn {
		color: #fbbf24;
	}
	.members {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.75rem;
	}
	.member {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.45rem 0.35rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.02);
	}
	.member.off {
		opacity: 0.4;
	}
	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.group-head {
			grid-template-columns: auto 1fr;
		}
	}
</style>
