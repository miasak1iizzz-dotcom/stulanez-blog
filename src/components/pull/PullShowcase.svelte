<script lang="ts">
	// 取图 · 文章内可点的迷你书桌演示（不调真实 API）
	type Channel = "all" | "instagram" | "douyin" | "xiaohongshu" | "weibo";

	const channels: { id: Channel; label: string; tip: string }[] = [
		{ id: "all", label: "全部", tip: "不选渠道也能直接识别" },
		{ id: "instagram", label: "INS", tip: "帖子 / Reels / 分享口令" },
		{ id: "douyin", label: "抖音", tip: "图文笔记与分享链接" },
		{ id: "xiaohongshu", label: "小红书", tip: "笔记网页或 xhslink" },
		{ id: "weibo", label: "微博", tip: "正文页或 t.cn 短链" },
	];

	const demos: Record<
		Exclude<Channel, "all">,
		{ title: string; count: number; tiles: string[] }
	> = {
		instagram: {
			title: "INS · 一组贴图",
			count: 6,
			tiles: ["#f7d6de", "#e8b4c4", "#c97b8f", "#f3e0d8", "#d9c2b0", "#b0899a"],
		},
		douyin: {
			title: "抖音 · 图文笔记",
			count: 4,
			tiles: ["#d7f7f5", "#9ee9e4", "#5ec9c4", "#2a9d98"],
		},
		xiaohongshu: {
			title: "小红书 · 笔记九图",
			count: 9,
			tiles: [
				"#ffd0d8",
				"#ffb3c0",
				"#ff8fa3",
				"#ff6b85",
				"#f9415a",
				"#e01e37",
				"#c1121f",
				"#9b0c18",
				"#6a040f",
			],
		},
		weibo: {
			title: "微博 · 原图铺开",
			count: 5,
			tiles: ["#ffd6d6", "#ffb0b0", "#ff8585", "#e63946", "#b51728"],
		},
	};

	let channel = $state<Channel>("instagram");
	let pasted = $state(false);
	let extracted = $state(false);

	const active = $derived(channel === "all" ? "instagram" : channel);
	const demo = $derived(demos[active]);

	function pick(id: Channel) {
		channel = id;
		extracted = false;
		pasted = false;
	}

	function pretendPaste() {
		pasted = true;
		extracted = false;
	}

	function pretendExtract() {
		if (!pasted) pretendPaste();
		extracted = true;
	}

	function reset() {
		pasted = false;
		extracted = false;
	}
</script>

<section class="pull-show" aria-label="取图演示">
	<header>
		<span class="eyebrow">LIVE DEMO · 不会真的请求外站</span>
		<h3>把链接丢上来，图会铺到一张桌上。</h3>
	</header>

	<div class="chips" role="tablist" aria-label="渠道">
		{#each channels as ch}
			<button
				type="button"
				role="tab"
				class:on={channel === ch.id}
				aria-selected={channel === ch.id}
				onclick={() => pick(ch.id)}>{ch.label}</button
			>
		{/each}
	</div>

	<p class="hint">{channels.find((c) => c.id === channel)?.tip}</p>

	<div class="desk">
		<div class="paste">
			{#if pasted}
				<code>https://example.com/{active}/post/…</code>
			{:else}
				<span>网页链接、短链，或 App 分享口令</span>
			{/if}
			<div class="actions">
				<button type="button" class="ghost" onclick={pretendPaste}>粘贴示例</button>
				<button type="button" class="go" onclick={pretendExtract}>识别并提取</button>
			</div>
		</div>

		{#if extracted}
			<div class="result">
				<div class="result-head">
					<strong>{demo.title}</strong>
					<span>{demo.count} 张 · 可多选下载</span>
				</div>
				<div class="tiles" style={`--n:${demo.tiles.length}`}>
					{#each demo.tiles as color, i}
						<div class="tile" style={`--c:${color}`} aria-hidden="true">
							<span>{i + 1}</span>
						</div>
					{/each}
				</div>
				<button type="button" class="ghost" onclick={reset}>再试一次</button>
			</div>
		{:else}
			<div class="empty">
				<p>点「粘贴示例」→「识别并提取」，看图是怎么摊开的。</p>
				<a href="/pull/">打开真正的取图页 ↗</a>
			</div>
		{/if}
	</div>
</section>

<style>
	.pull-show {
		--ink: #2a1f1c;
		--muted: #8a6f68;
		--paper: #fff7f4;
		--desk: #1f1715;
		margin: 1.4rem 0 1.8rem;
		padding: 1.15rem 1.15rem 1.25rem;
		border-radius: 18px;
		background:
			radial-gradient(#e8d4d0 0.8px, transparent 0.8px) 0 0 / 16px 16px,
			var(--paper);
		color: var(--ink);
		border: 1px solid color-mix(in srgb, #c4a39a 35%, transparent);
	}
	:global(.dark) .pull-show {
		--ink: #f3e7e3;
		--muted: #c2a59d;
		--paper: #2a2220;
		--desk: #120e0d;
	}
	header {
		margin-bottom: 0.85rem;
	}
	.eyebrow {
		display: block;
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		color: var(--muted);
		margin-bottom: 0.35rem;
	}
	h3 {
		margin: 0;
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: 1.25rem;
		font-weight: 500;
		line-height: 1.35;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.55rem;
	}
	.chips button,
	.ghost,
	.go {
		font: inherit;
		cursor: pointer;
	}
	.chips button {
		border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
		background: color-mix(in srgb, #fff 55%, transparent);
		color: var(--muted);
		border-radius: 999px;
		padding: 0.35rem 0.75rem;
		font-size: 0.78rem;
	}
	.chips button.on {
		background: var(--ink);
		color: var(--paper);
		border-color: transparent;
	}
	.hint {
		margin: 0 0 0.85rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
	.desk {
		background: var(--desk);
		color: #f6ebe7;
		border-radius: 14px;
		padding: 0.95rem;
	}
	.paste {
		display: grid;
		gap: 0.7rem;
	}
	.paste span,
	.paste code {
		display: block;
		padding: 0.7rem 0.8rem;
		border-radius: 10px;
		background: #2c2220;
		font-size: 0.82rem;
		color: #d7c4bd;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.paste code {
		color: #ffe2d6;
		font-family: ui-monospace, Consolas, monospace;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.ghost {
		border: 1px solid color-mix(in srgb, #fff 18%, transparent);
		background: transparent;
		color: #f0ddd6;
		border-radius: 999px;
		padding: 0.45rem 0.85rem;
		font-size: 0.78rem;
	}
	.go {
		border: 0;
		background: #ff7a45;
		color: #1a0f0c;
		border-radius: 999px;
		padding: 0.45rem 0.95rem;
		font-size: 0.78rem;
		font-weight: 600;
	}
	.result {
		margin-top: 0.95rem;
		display: grid;
		gap: 0.75rem;
	}
	.result-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.8rem;
	}
	.result-head span {
		color: #c9b1a8;
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
		gap: 0.45rem;
	}
	.tile {
		aspect-ratio: 1;
		border-radius: 10px;
		background:
			linear-gradient(145deg, color-mix(in srgb, #fff 22%, transparent), transparent),
			var(--c);
		display: grid;
		place-items: end start;
		padding: 0.35rem 0.45rem;
		font-size: 0.7rem;
		color: #fff9;
	}
	.empty {
		margin-top: 0.9rem;
		padding: 0.85rem 0.2rem 0.2rem;
		font-size: 0.82rem;
		color: #cbb5ad;
	}
	.empty p {
		margin: 0 0 0.55rem;
	}
	.empty a {
		color: #ffb08a;
		text-decoration: none;
	}
	.empty a:hover {
		text-decoration: underline;
	}
</style>
