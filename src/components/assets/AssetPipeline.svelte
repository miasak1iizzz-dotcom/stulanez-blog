<script lang="ts">
	import data from "@/data/assets/pipeline-data.json";

	type Channel = (typeof data.channels)[number];
	type Pitfall = (typeof data.pitfalls)[number];
	type Lesson = (typeof data.lessons)[number];

	let activeTab = $state<"overview" | "channels" | "pipeline" | "pitfalls" | "lessons">(
		"overview",
	);

	function tabCls(active: boolean): string {
		return (
			"px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer " +
			(active
				? "bg-(--primary) text-white dark:text-black/70"
				: "text-neutral-500 dark:text-neutral-400 hover:bg-(--primary)/10")
		);
	}

	function statusCls(status: string): string {
		if (status === "主力") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
		if (status === "GLM 线") return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
		if (status === "需 key") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
		if (status === "有实物·有风控") return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
		return "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400";
	}

	function scoreDots(score: number): string {
		let out = "";
		for (let i = 0; i < 5; i++) {
			out += `<span class="h-1.5 w-1.5 rounded-full inline-block ${
				i < score ? "bg-(--primary)" : "bg-neutral-300 dark:bg-neutral-700"
			}"></span>`;
		}
		return out;
	}
</script>

<div class="card-base rounded-(--radius-large) overflow-hidden">
	<!-- 头部 -->
	<div class="px-6 pt-6 pb-2">
		<div class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
			{data.title}
		</div>
		<div class="text-sm text-neutral-500 dark:text-neutral-400">{data.subtitle}</div>
	</div>

	<!-- Tab 切换 -->
	<div class="flex flex-wrap gap-2 px-6 pb-4">
		<button class={tabCls(activeTab === "overview")} onclick={() => (activeTab = "overview")}>总览</button>
		<button class={tabCls(activeTab === "channels")} onclick={() => (activeTab = "channels")}>渠道</button>
		<button class={tabCls(activeTab === "pipeline")} onclick={() => (activeTab = "pipeline")}>管线</button>
		<button class={tabCls(activeTab === "pitfalls")} onclick={() => (activeTab = "pitfalls")}>踩坑</button>
		<button class={tabCls(activeTab === "lessons")} onclick={() => (activeTab = "lessons")}>经验</button>
	</div>

	<!-- 总览 -->
	{#if activeTab === "overview"}
		<div class="px-6 pb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{data.overview.totalAssets}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">入库素材（张）</div>
			</div>
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{data.overview.totalSize}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">总体量</div>
			</div>
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{data.overview.channels}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">调研渠道数</div>
			</div>
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{data.overview.mainChannels}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">可批量主力</div>
			</div>
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-snug">{data.overview.classifier}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">分类方式</div>
			</div>
			<div class="rounded-xl bg-(--primary)/8 p-4">
				<div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-snug">{data.overview.goal}</div>
				<div class="text-xs text-neutral-500 dark:text-neutral-400">初心</div>
			</div>
		</div>
	{/if}

	<!-- 渠道 -->
	{#if activeTab === "channels"}
		<div class="px-6 pb-6 space-y-2.5">
			{#each data.channels as c (c.name)}
				<div class="flex items-center gap-3 rounded-xl border border-(--line-divider) px-4 py-3">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-medium text-neutral-900 dark:text-neutral-100 truncate">{c.name}</span>
							<span class={`text-xs px-2 py-0.5 rounded-full ${statusCls(c.status)}`}>{c.status}</span>
							{#if c.owner}
								<span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-500/10 text-neutral-500 dark:text-neutral-400">{c.owner}</span>
							{/if}
						</div>
						<div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{c.note}</div>
						<div class="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">{c.type}</div>
					</div>
					<div class="flex gap-1 shrink-0" aria-label="评分">
						{#each [0,1,2,3,4] as i}
							<span
								class={`h-1.5 w-1.5 rounded-full inline-block ${
									i < c.score ? "bg-(--primary)" : "bg-neutral-300 dark:bg-neutral-700"
								}`}
							></span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- 管线 -->
	{#if activeTab === "pipeline"}
		<div class="px-6 pb-6">
			<div class="space-y-0 relative">
				{#each data.pipeline as step, i}
					<div class="flex gap-3">
						<div class="flex flex-col items-center">
							<div class="h-7 w-7 rounded-full bg-(--primary) text-white dark:text-black/70 flex items-center justify-center text-xs font-bold shrink-0">
								{i + 1}
							</div>
							{#if i < data.pipeline.length - 1}<div class="w-px flex-1 bg-(--line-divider)"></div>{/if}
						</div>
						<div class="pb-5 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{step}</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 踩坑 -->
	{#if activeTab === "pitfalls"}
		<div class="px-6 pb-6 space-y-2.5">
			{#each data.pitfalls as p (p.title)}
				<div class="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
					<div class="flex items-center gap-2">
						<span class="text-red-500">{p.title}</span>
					</div>
					<div class="text-sm text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{p.how}</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- 经验 -->
	{#if activeTab === "lessons"}
		<div class="px-6 pb-6 space-y-2.5">
			{#each data.lessons as l (l.title)}
				<div class="rounded-xl border border-(--line-divider) px-4 py-3">
					<div class="gap-2">
						<span class="font-semibold text-neutral-900 dark:text-neutral-100">{l.title}</span>
					</div>
					<div class="text-sm text-neutral-600 dark:text-neutral-400 mt-1 leading-relaxed">{l.text}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
