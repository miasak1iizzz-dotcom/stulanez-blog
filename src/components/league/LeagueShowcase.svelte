<script lang="ts">
	import league from "@/data/league/league-data.json";
	import players from "@/data/league/players.json";

	type Stage = (typeof league.stages)[number];
	type Format = (typeof league.formats)[number];

	let activeTab = $state<"timeline" | "formats" | "roster" | "economy" | "hex">(
		"timeline",
	);
	let activeStage = $state<number>(0);
	let activeFormat = $state<number>(0);
	let activeHex = $state<number>(0);
	let query = $state("");
	let groupFilter = $state<"all" | "M" | "F">("all");

	const stages: Stage[] = league.stages as Stage[];
	const formats: Format[] = league.formats as Format[];
	const roster = players.roster as Array<{
		id: string;
		name: string;
		group: "M" | "F";
		goat: boolean;
	}>;

	const filteredRoster = $derived.by(() => {
		let list = roster;
		if (groupFilter === "M") list = list.filter((p) => p.group === "M");
		if (groupFilter === "F") list = list.filter((p) => p.group === "F");
		const q = query.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(p) => p.name.toLowerCase().includes(q) || p.id.includes(q),
			);
		}
		return list;
	});

	const currentStage = $derived(stages[activeStage]);

	const stageSubEntries = $derived.by(() => {
		if (!currentStage.sub) return [];
		return Object.keys(currentStage.sub).map((k) => ({
			key: k,
			value: currentStage.sub[k],
		}));
	});

	// Tab / chip 选中态样式
	function tabCls(active: boolean): string {
		return (
			"px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer " +
			(active
				? "bg-(--primary) text-white"
				: "text-neutral-500 dark:text-neutral-400 hover:bg-(--primary)/10")
		);
	}

	function chipCls(active: boolean): string {
		return (
			"px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer " +
			(active
				? "bg-(--primary) text-white"
				: "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-(--primary)/10")
		);
	}

	function filterCls(active: boolean): string {
		return (
			"px-3 py-2 rounded-lg text-sm transition-all cursor-pointer " +
			(active ? "bg-(--primary) text-white" : "text-neutral-500 dark:text-neutral-400")
		);
	}
</script>

<div class="league-selector w-full rounded-2xl overflow-hidden border border-(--line-divider) bg-(--card-bg) text-neutral-800 dark:text-neutral-100">
	<!-- Header -->
	<div class="px-5 py-4 border-b border-(--line-divider) bg-gradient-to-r from-(--primary)/10 to-transparent">
		<div class="flex items-center gap-2 text-(--primary)">
			<span class="text-lg">🏆</span>
			<h3 class="font-bold text-lg">{league.title}</h3>
		</div>
		<p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
			{league.subtitle} · 共 {league.overview.totalGames} 卷 · {league.overview.totalPlayers} 人参赛
		</p>
	</div>

	<!-- Tabs -->
	<div class="flex flex-wrap gap-1 px-4 pt-3">
		<button class={tabCls(activeTab === "timeline")} onclick={() => (activeTab = "timeline")}>
			赛程总览
		</button>
		<button class={tabCls(activeTab === "formats")} onclick={() => (activeTab = "formats")}>
			五种赛制
		</button>
		<button class={tabCls(activeTab === "roster")} onclick={() => (activeTab = "roster")}>
			选手名单
		</button>
		<button class={tabCls(activeTab === "economy")} onclick={() => (activeTab = "economy")}>
			代币经济
		</button>
		<button class={tabCls(activeTab === "hex")} onclick={() => (activeTab = "hex")}>
			海克斯技能
		</button>
	</div>

	<div class="p-4">
		<!-- TIMELINE -->
		{#if activeTab === "timeline"}
			<div class="space-y-3">
				<div class="flex flex-wrap gap-2">
					{#each stages as s, i (s.id)}
						<button class={chipCls(activeStage === i)} onclick={() => (activeStage = i)}>
							{s.name}
						</button>
					{/each}
				</div>

				<div class="rounded-xl border border-(--line-divider) bg-neutral-50 dark:bg-neutral-800/50 p-4">
					<div class="flex items-center justify-between flex-wrap gap-2 mb-2">
						<div>
							<div class="font-bold text-base">{currentStage.name} · {currentStage.title}</div>
							<div class="text-xs text-neutral-500 dark:text-neutral-400">{currentStage.league} · {currentStage.games}</div>
						</div>
						<span class="text-xs font-medium px-2 py-1 rounded-full bg-(--primary)/10 text-(--primary)">{currentStage.count} 卷</span>
					</div>
					<p class="text-sm leading-relaxed">{currentStage.desc}</p>

					{#if currentStage.sub}
						<div class="mt-3 space-y-2">
							{#each stageSubEntries as entry}
								{@const sub = entry.value}
								<div class="rounded-lg bg-white dark:bg-neutral-800 p-3 border border-(--line-divider)">
									<div class="text-sm font-semibold text-(--primary)">{sub.name}</div>
									{#if sub.format}<div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">赛制：{sub.format}</div>{/if}
									{#if sub.participants}<div class="text-xs mt-1">参赛：{sub.participants}</div>{/if}
									{#if sub.advance}<div class="text-xs mt-1 text-neutral-500 dark:text-neutral-400">去向：{sub.advance}</div>{/if}
									{#if sub.punish}<div class="text-xs mt-1 text-red-500">惩罚：{sub.punish}</div>{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- FORMATS -->
		{#if activeTab === "formats"}
			<div class="space-y-3">
				<div class="flex flex-wrap gap-2">
					{#each formats as f, i (f.name)}
						<button class={chipCls(activeFormat === i)} onclick={() => (activeFormat = i)}>
							{f.name}
						</button>
					{/each}
				</div>
				<div class="rounded-xl border border-(--line-divider) bg-neutral-50 dark:bg-neutral-800/50 p-4">
					<div class="font-bold text-base mb-1">{formats[activeFormat].name}</div>
					<p class="text-sm leading-relaxed">{formats[activeFormat].desc}</p>
				</div>
			</div>
		{/if}

		<!-- ROSTER -->
		{#if activeTab === "roster"}
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<input
						bind:value={query}
						placeholder="搜索学号或姓名…"
						class="flex-1 min-w-40 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-(--line-divider) text-sm outline-none focus:border-(--primary)"
					/>
					<button class={filterCls(groupFilter === "all")} onclick={() => (groupFilter = "all")}>全部</button>
					<button class={filterCls(groupFilter === "M")} onclick={() => (groupFilter = "M")}>男生</button>
					<button class={filterCls(groupFilter === "F")} onclick={() => (groupFilter = "F")}>女生</button>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto pr-1">
					{#each filteredRoster as p (p.id)}
						<div class="flex items-center gap-2 rounded-lg border border-(--line-divider) bg-neutral-50 dark:bg-neutral-800/50 px-2.5 py-2">
							<span class="text-xs font-mono text-neutral-400">{p.id}</span>
							<span class="text-sm font-medium truncate">
								{p.name}
								{#if p.goat}<span class="ml-1 text-[10px] text-(--primary) font-bold">GOAT</span>{/if}
							</span>
						</div>
					{/each}
					{#if filteredRoster.length === 0}
						<div class="col-span-full text-center text-sm text-neutral-400 py-6">未找到匹配选手</div>
					{/if}
				</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">共 {filteredRoster.length} / {roster.length} 人</div>
			</div>
		{/if}

		<!-- ECONOMY -->
		{#if activeTab === "economy"}
			<div class="space-y-2.5">
				{#each league.economy as e}
					<div class="rounded-xl border border-(--line-divider) bg-neutral-50 dark:bg-neutral-800/50 p-3.5">
						<div class="text-sm font-semibold text-(--primary)">{e.stage}</div>
						<div class="text-xs leading-relaxed mt-1">{e.detail}</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- HEX -->
		{#if activeTab === "hex"}
			<div class="space-y-3">
				<div class="flex flex-wrap gap-3">
					<div class="flex gap-2">
						<button class={chipCls(activeHex === 0)} onclick={() => (activeHex = 0)}>第一赛段</button>
						<button class={chipCls(activeHex === 1)} onclick={() => (activeHex = 1)}>第三赛段</button>
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					{#each (activeHex === 0 ? league.hexStage1 : league.hexStage3) as h, i (h.name)}
						<div class="rounded-xl border border-(--line-divider) bg-neutral-50 dark:bg-neutral-800/50 p-3.5">
							<div class="text-sm font-bold text-(--primary)">⚡ {h.name}</div>
							<div class="text-xs leading-relaxed mt-1">{h.desc}</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- INCENTIVES -->
		<div class="mt-4 rounded-xl border border-(--line-divider) bg-(--primary)/5 p-3.5">
			<div class="text-sm font-semibold mb-2 text-(--primary)">机制设计</div>
			<div class="space-y-1.5">
				{#each league.incentives as inc}
					<div class="text-xs leading-relaxed">
						<span class="font-semibold">{inc.type}：</span>
						<span class="text-neutral-600 dark:text-neutral-400">{inc.desc}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
