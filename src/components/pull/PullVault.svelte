<script lang="ts">
import PullGallery from "@/components/pull/PullGallery.svelte";
import {
	getPullChannel,
	PULL_CHANNELS,
	type PullChannel,
} from "@/config/pullConfig";
import { peelUrl } from "@/utils/pull/peel";
import {
	clearPullSession,
	loadPullSession,
	savePullSession,
} from "@/utils/pull/session";
import type { PullChannelId, PullSuccess } from "@/utils/pull/types";

type Props = {
	channelId?: PullChannelId | null;
};

let { channelId = null }: Props = $props();

const current: PullChannel | null = channelId
	? (getPullChannel(channelId) ?? null)
	: null;

let url = $state("");
let loading = $state(false);
let error = $state("");
let result = $state<PullSuccess | null>(null);

async function extract(): Promise<void> {
	error = "";
	const pasted = url;
	const target = peelUrl(pasted);
	if (!target) {
		error = "请先贴一条链接，或 App 里复制出来的整段分享口令。";
		return;
	}
	url = target;
	loading = true;
	try {
		const res = await fetch("/api/pull/extract/", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				url: pasted,
				channel: channelId ?? undefined,
			}),
		});
		const data = (await res.json()) as
			| PullSuccess
			| { ok: false; error?: string };
		if (!data.ok) {
			error = data.error || "提取失败。";
			return;
		}
		result = data;
		savePullSession({ url: target, result: data });
	} catch {
		error = "网络断了一下。再试一次。";
	} finally {
		loading = false;
	}
}

function onSubmit(event: Event): void {
	event.preventDefault();
	void extract();
}

function clearBrowse(): void {
	clearPullSession();
	result = null;
	url = "";
	error = "";
	window.location.assign("/pull/");
}

let booted = $state(false);

$effect(() => {
	if (booted || typeof window === "undefined") return;
	booted = true;
	const passed = new URLSearchParams(window.location.search).get("u");
	if (passed && !url) {
		url = passed;
		void extract();
		return;
	}
	const stored = loadPullSession();
	if (stored) {
		url = stored.url;
		result = stored.result;
	}
});
</script>

<div class="desk" class:is-live={Boolean(result)} style={current ? `--pull-accent:${current.accent}` : ""}>
	<section class="intro">
		<div class="intro-copy">
			<p class="eyebrow">
				<span class="dot"></span>
				永恒欲望 / 渠道取图
			</p>
			<p class="lead">一个入口，四条渠道</p>
			<h1>
				{#if current}
					从{current.name}，抽出原图。
				{:else}
					把帖子里的图，放到一张桌上。
				{/if}
			</h1>
			<p class="sub">
				{current
					? current.blurb
					: "把 Instagram、抖音、小红书、微博的网页链接或 App 分享口令贴进来。公开帖最稳。"}
			</p>
			<nav class="chips" aria-label="渠道">
				<a class={!current ? "is-on" : ""} href="/pull/">全部</a>
				{#each PULL_CHANNELS as ch (ch.id)}
					<a class={channelId === ch.id ? "is-on" : ""} href={`/pull/${ch.id}/`}>{ch.short}</a>
				{/each}
			</nav>
		</div>
		<aside class="hint-card">
			<p class="hint-kicker">用法</p>
			<p class="hint-title">{current ? current.name : "先选渠道，或直接贴链接"}</p>
			<p class="hint-body">
				{current
					? current.hint
					: "四个渠道都认网页地址和 App「复制链接」的整段口令。公开帖最稳。"}
			</p>
			<ul class="hint-meta">
				<li><strong>4</strong> 渠道</li>
				<li><strong>贴链</strong> 即抽</li>
				<li><strong>原图</strong> 优先</li>
			</ul>
		</aside>
	</section>

	<div class="bench">
		<section class="work">
			<div class="work-head">
				<p class="eyebrow dark-eye">{current ? current.kicker : "贴链接 · 抽图"}</p>
				<h2>{current ? "把链接放到这里" : "也可以不选渠道，直接识别"}</h2>
			</div>
			<form class="paste" onsubmit={onSubmit}>
				<label class="sr-only" for="pull-url">{current ? "帖子链接" : "任意渠道链接"}</label>
				<input
					id="pull-url"
					type="text"
					inputmode="url"
					bind:value={url}
					placeholder={current
						? current.placeholder
						: "网页链接、短链，或直接粘贴 App 分享口令"}
					autocomplete="off"
					spellcheck="false"
					enterkeyhint="go"
				/>
				<button type="submit" disabled={loading}>
					{loading ? "正在抽" : current ? "提取图片" : "识别并提取"}
				</button>
			</form>
			{#if error}
				<div class="fail" role="alert">
					<p class="fail-kicker">抽不到</p>
					<h3>网页这边拿不到图</h3>
					<p>{error}</p>
				</div>
			{/if}

			{#if result}
				<PullGallery {result} onClear={clearBrowse} />
			{:else if loading}
				<div class="empty">
					<h3>正在抽图</h3>
					<p>渠道打开得慢时要等十几秒。公开帖最稳。</p>
				</div>
			{:else if current && !error}
				<div class="empty">
					<h3>桌上还没有图</h3>
					<p>把 {current.name} 的帖子链接贴上来，提取后会铺在这里。</p>
				</div>
			{/if}
		</section>

		{#if !current && !result}
			<section class="tiles" aria-label="渠道入口">
				<p class="split-kicker">四个入口</p>
				<h2>选一条渠道，或把链接丢到左边。</h2>
				<div class="tile-grid">
					{#each PULL_CHANNELS as ch (ch.id)}
						<a class="tile" href={`/pull/${ch.id}/`} style={`--tile:${ch.accent}`}>
							<p class="tile-kicker">{ch.kicker}</p>
							<h3>{ch.name}</h3>
							<p>{ch.blurb}</p>
							<span>进入取图</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.desk {
		width: min(1320px, calc(100% - 0.4rem));
		max-width: 100%;
		min-width: 0;
		margin: 0 auto;
		color: #201a19;
	}

	.desk.is-live {
		width: min(1920px, calc(100% - 0.15rem));
	}

	.desk.is-live .intro {
		display: none;
	}

	.desk.is-live .work {
		overflow: hidden;
		max-width: 100%;
		min-width: 0;
	}

	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.85fr);
		gap: 1.1rem;
		padding: 1.7rem 1.7rem 1.5rem;
		border: 1px solid rgba(200, 185, 170, 0.52);
		border-radius: 14px;
		background: #fef1ee;
		box-shadow: 0 10px 28px rgba(107, 55, 67, 0.05);
	}

	.eyebrow {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0 0 0.7rem;
		font-size: 0.78rem;
		color: #836c70;
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #e9859a;
	}

	.lead {
		margin: 0 0 0.35rem;
		font-size: 0.82rem;
		color: #8d777b;
	}

	h1 {
		margin: 0 0 0.7rem;
		font-family: "Songti SC", STSong, "Noto Serif SC", "Noto Serif CJK SC", ui-serif, Georgia, serif;
		font-size: clamp(2rem, 4.4vw, 2.85rem);
		font-weight: 600;
		line-height: 1.18;
		color: #6b3743;
	}

	.sub,
	.hint-body,
	.empty p,
	.tile p {
		margin: 0;
		line-height: 1.7;
		color: #5c4a4e;
		font-size: 0.95rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 1.15rem;
	}

	.chips a {
		padding: 0.28rem 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(200, 185, 170, 0.7);
		background: #fff;
		color: #201a19;
		font-size: 0.78rem;
		text-decoration: none;
	}

	.chips a.is-on {
		background: #201a19;
		border-color: #201a19;
		color: #fff;
	}

	.hint-card {
		padding: 1.05rem 1.1rem;
		border-radius: 14px;
		border: 1px solid rgba(200, 185, 170, 0.55);
		background: #fff;
	}

	.hint-kicker,
	.tile-kicker {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: #836c70;
	}

	.hint-title {
		margin: 0 0 0.4rem;
		font-weight: 650;
		font-size: 1.02rem;
	}

	.hint-meta {
		display: flex;
		gap: 0.85rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
		color: #8d777b;
		font-size: 0.78rem;
	}

	.hint-meta strong {
		color: #201a19;
		margin-right: 0.2rem;
	}

	.bench {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
		gap: 1.1rem;
		margin-top: 1.35rem;
		align-items: start;
	}

	.desk.is-live .bench {
		grid-template-columns: 1fr;
		margin-top: 0.35rem;
		min-width: 0;
		max-width: 100%;
	}

	.bench:has(.tiles:only-of-type),
	.work:only-child {
		grid-column: 1 / -1;
	}

	.work {
		position: relative;
		padding: 1.35rem 1.35rem 1.2rem;
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 28%),
			#241b1a;
		color: #f6ecea;
		box-shadow:
			0 22px 48px rgba(36, 27, 26, 0.18),
			inset 0 1px 0 rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.desk.is-live .work {
		padding: 1rem 0 0.4rem;
	}

	.desk.is-live .work-head,
	.desk.is-live .paste {
		margin-left: 1.2rem;
		margin-right: 1.2rem;
	}

	.work::before {
		content: "";
		position: absolute;
		top: 0;
		left: 1.2rem;
		right: 1.2rem;
		height: 2px;
		border-radius: 999px;
		background: linear-gradient(90deg, transparent, #c67b55, transparent);
		opacity: 0.85;
	}

	.work:only-child,
	.desk:not(:has(.tiles)) .work {
		grid-column: 1 / -1;
	}

	.dark-eye {
		color: #cbb7b4;
	}

	.work-head h2,
	.tiles h2 {
		margin: 0 0 1rem;
		font-family: "Songti SC", STSong, "Noto Serif SC", "Noto Serif CJK SC", ui-serif, Georgia, serif;
		font-size: 1.45rem;
		font-weight: 600;
		color: inherit;
	}

	.paste {
		display: flex;
		gap: 0.55rem;
		padding: 0.4rem;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.paste input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: #fff;
		padding: 0.7rem 0.8rem;
		font-size: 0.92rem;
		outline: none;
	}

	.paste input::placeholder {
		color: rgba(255, 255, 255, 0.38);
	}

	.paste button {
		border: 0;
		border-radius: 999px;
		padding: 0.68rem 1.05rem;
		background: #c67b55;
		color: #fff;
		font-weight: 650;
		cursor: pointer;
		white-space: nowrap;
	}

	.paste button:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.fail {
		margin: 1.1rem 0 0;
		padding: 1.15rem 1.1rem 1.2rem;
		border-radius: 12px;
		border: 1px dashed rgba(232, 196, 160, 0.38);
		background: rgba(198, 123, 85, 0.12);
	}

	.fail-kicker {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		color: #e8c4a0;
	}

	.fail h3 {
		margin: 0 0 0.45rem;
		font-size: 1.05rem;
		color: #fff;
	}

	.fail p {
		margin: 0;
		line-height: 1.7;
		color: #e8d4c8;
		font-size: 0.92rem;
	}

	.empty {
		margin-top: 1.1rem;
		padding: 1.6rem 1rem;
		text-align: center;
		border-radius: 12px;
		border: 1px dashed rgba(255, 255, 255, 0.16);
	}

	.empty h3 {
		margin: 0 0 0.35rem;
		font-size: 1.05rem;
		color: #fff;
	}

	.empty p {
		color: #cbb7b4;
	}

	.tiles {
		padding: 0.15rem 0.1rem 0;
	}

	.split-kicker {
		margin: 0 0 0.3rem;
		font-size: 0.78rem;
		color: #836c70;
	}

	.tiles h2 {
		color: #6b3743;
		margin-bottom: 0.9rem;
	}

	.tile-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}

	.tile {
		display: block;
		padding: 0.95rem 1rem 1rem;
		border-radius: 10px;
		background: #fff;
		border: 1px solid rgba(200, 185, 170, 0.48);
		border-top: 3px solid var(--tile, #c36379);
		text-decoration: none;
		color: inherit;
	}

	.tile h3 {
		margin: 0 0 0.3rem;
		font-size: 1.05rem;
	}

	.tile span {
		display: inline-block;
		margin-top: 0.7rem;
		font-size: 0.78rem;
		color: #6b3743;
	}

	@media (max-width: 900px) {
		.intro,
		.bench,
		.tile-grid {
			grid-template-columns: 1fr;
		}

		.work,
		.desk:not(:has(.tiles)) .work {
			grid-column: auto;
		}

		.paste {
			flex-direction: column;
		}
	}

	@media (max-width: 560px) {
		.hint-meta {
			flex-direction: column;
			gap: 0.35rem;
		}
	}
</style>
