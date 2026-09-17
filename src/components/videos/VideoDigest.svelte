<script lang="ts">
import { onMount } from "svelte";
import { isOwnerDevice } from "@/utils/owner";
import type { VideoDigestResult, VideoJob } from "@/utils/videos/types";

const SAMPLE = "https://www.bilibili.com/video/BV14Utf6QEnB/";

let url = $state("");
let busy = $state(false);
let message = $state("");
let error = $state("");
let result = $state<VideoDigestResult | null>(null);
let copied = $state(false);

onMount(() => {
	const q = new URLSearchParams(location.search).get("u");
	if (q) url = q;
});

function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function run(pasted: string) {
	error = "";
	result = null;
	copied = false;
	if (!pasted.trim()) {
		error = "请先贴一条 B 站链接。";
		return;
	}
	url = pasted;
	busy = true;
	message = "正在拆…";
	try {
		const created = (await (
			await fetch("/api/videos/summarize/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url: pasted, owner: isOwnerDevice() }),
			})
		).json()) as VideoJob;
		if (!created.ok) {
			error = created.error || "没做成。";
			busy = false;
			message = "";
			return;
		}
		if (created.result) {
			result = created.result;
			message = created.message || "做好了";
			busy = false;
			return;
		}
		if (!created.id) {
			error = "引擎没回任务号。";
			busy = false;
			return;
		}
		await poll(created.id, created.bvid || "");
	} catch (err) {
		error = err instanceof Error ? err.message : "请求失败。";
		busy = false;
		message = "";
	}
}

function submit(event: Event) {
	event.preventDefault();
	void run(url);
}

async function poll(id: string, bvid: string) {
	for (let i = 0; i < 180; i++) {
		const query = new URLSearchParams({ id });
		if (bvid) query.set("bvid", bvid);
		const job = (await (
			await fetch(`/api/videos/summarize/?${query}`)
		).json()) as VideoJob;
		if (!job.ok && job.status !== "running" && job.status !== "queued") {
			error = job.error || "引擎没做成。";
			busy = false;
			message = "";
			return;
		}
		message = job.message || (job.status === "queued" ? "排队中" : "正在拆…");
		if (job.result) {
			result = job.result;
			busy = false;
			message = "做好了";
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	error = "等得太久了。引擎可能还在转写，过一会儿再贴一次。";
	busy = false;
}

async function copyMarkdown() {
	if (!result) return;
	await navigator.clipboard.writeText(result.markdown);
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 1800);
}
</script>

<div class="vd-shell">
	<header class="vd-mast">
		<span class="vd-eyebrow">STULANEZ / VIDEO DIGEST</span>
		<div class="vd-mast-row">
			<h1>视频总结</h1>
		</div>
		<p>贴一条 B 站链接，当场拆成带时间轴的图文笔记。跟取图一样，用完即走。</p>
	</header>

	<form class="vd-card vd-form" onsubmit={submit}>
		<label for="vd-url">B 站链接</label>
		<textarea
			id="vd-url"
			bind:value={url}
			rows="3"
			placeholder="把分享口令整段贴进来，或只贴 https://www.bilibili.com/video/BV…"
			disabled={busy}
		></textarea>
		<div class="vd-form-row">
			<button class="vd-btn-main" type="submit" disabled={busy}>
				{busy ? "正在拆…" : "开始总结"}
			</button>
			<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void run(SAMPLE)}>
				填入试看
			</button>
			{#if busy}
				<span class="vd-actions-hint">{message}</span>
			{/if}
		</div>
	</form>

	{#if error}
		<p class="vd-error">{error}</p>
	{/if}

	{#if result}
		<section class="vd-card vd-hero">
			<div class="vd-cover" style={result.meta.cover ? `background-image:url('${result.meta.cover}')` : ""}>
				<span class="vd-len">{clock(result.meta.duration)}</span>
			</div>
			<div class="vd-hero-body">
				<h2 class="vd-vtitle">{result.meta.title}</h2>
				<div class="vd-meta">
					{#if result.meta.up}<span>UP · {result.meta.up}</span>{/if}
					<span class="vd-bvid">{result.meta.bvid}</span>
				</div>
			</div>
		</section>

		<section class="vd-card vd-tldr">
			<span class="vd-kicker">一句话总结</span>
			<p>{result.tldr}</p>
		</section>

		{#if result.points.length}
			<div class="vd-sect"><h2>要点</h2><span>KEY POINTS</span></div>
			<ul class="vd-points">
				{#each result.points as point}
					<li>{point}</li>
				{/each}
			</ul>
		{/if}

		{#if result.chapters.length}
			<div class="vd-sect"><h2>时间轴</h2><span>TIMELINE</span></div>
			<section class="vd-terms">
				{#each result.chapters as chapter, i}
					<article class="vd-term">
						<div class="vd-term-head">
							<span class="vd-num">{String(i + 1).padStart(2, "0")}</span>
							<h3>{chapter.title}</h3>
							<span class="vd-time">{chapter.time}</span>
						</div>
						<p class="vd-demo">{chapter.summary}</p>
					</article>
				{/each}
			</section>
		{/if}

		<div class="vd-actions">
			<button class="vd-btn-main" type="button" onclick={copyMarkdown}>
				{copied ? "已复制" : "复制 Markdown"}
			</button>
			<a class="vd-btn-ghost" href={result.meta.url} target="_blank" rel="noopener">到 B 站看原片</a>
		</div>
	{/if}
</div>

<style>
	.vd-shell { max-width: 1080px; margin: 0 auto; padding: 2.4rem 1.4rem 0; }
	.vd-mast { margin-bottom: 1.8rem; }
	.vd-eyebrow { font-size: 11px; letter-spacing: 0.22em; color: #6d6a7c; }
	.vd-mast-row { display: flex; align-items: baseline; gap: 14px; margin: 6px 0 4px; }
	.vd-mast h1 {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: clamp(28px, 4vw, 40px); font-weight: 600; margin: 0;
		background: linear-gradient(100deg, #eceaf2 35%, var(--primary));
		-webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
	}
	.vd-mast > p { margin: 0; font-size: 14px; color: #9b97a9; }
	.vd-card {
		background: rgba(255, 255, 255, 0.028);
		border: 1px solid rgba(255, 255, 255, 0.075);
		border-radius: 18px;
		margin-bottom: 16px;
	}
	.vd-form { padding: 20px 22px 18px; display: grid; gap: 10px; }
	.vd-form label { font-size: 12px; letter-spacing: 0.12em; color: #6d6a7c; }
	.vd-form textarea {
		width: 100%; resize: vertical; min-height: 84px;
		background: rgba(0, 0, 0, 0.25); color: #eceaf2;
		border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
		padding: 12px 14px; font-size: 14px; line-height: 1.55;
	}
	.vd-form-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
	.vd-error {
		color: #f0a8c4; background: rgba(225, 138, 210, 0.08);
		border: 1px solid rgba(225, 138, 210, 0.28);
		border-radius: 12px; padding: 12px 16px; font-size: 14px;
	}
	.vd-kicker { font-size: 11px; letter-spacing: 0.2em; color: #6d6a7c; text-transform: uppercase; }
	.vd-hero { overflow: hidden; }
	.vd-cover {
		height: 220px; position: relative;
		background:
			radial-gradient(420px 190px at 72% 30%, rgba(225, 138, 210, 0.3), transparent 65%),
			linear-gradient(140deg, #1c1626, #141019 55%, #191225);
		background-size: cover;
		background-position: center;
	}
	.vd-len {
		position: absolute; right: 14px; bottom: 12px;
		font-family: ui-monospace, Consolas, monospace; font-size: 11.5px;
		color: rgba(255, 255, 255, 0.85); background: rgba(0, 0, 0, 0.45);
		padding: 3px 9px; border-radius: 7px;
	}
	.vd-hero-body { padding: 22px 26px 24px; }
	.vd-vtitle {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: 23px; font-weight: 600; line-height: 1.5; margin: 0 0 12px; color: #eceaf2;
	}
	.vd-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: #9b97a9; }
	.vd-bvid { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
	.vd-tldr { border-left: 3px solid var(--primary); padding: 20px 26px; }
	.vd-tldr .vd-kicker { display: block; margin-bottom: 7px; }
	.vd-tldr p { margin: 0; font-size: 16px; color: #e4e1ec; }
	.vd-sect { display: flex; align-items: baseline; gap: 14px; margin: 38px 0 16px; }
	.vd-sect h2 {
		font-family: Georgia, "Noto Serif SC", serif; font-size: 21px; font-weight: 600; margin: 0;
		background: linear-gradient(100deg, #eceaf2 30%, var(--primary));
		-webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
	}
	.vd-sect span { font-size: 11px; letter-spacing: 0.2em; color: #6d6a7c; }
	.vd-points { margin: 0 0 12px; padding-left: 1.2em; color: #ddd9e6; line-height: 1.7; }
	.vd-terms { display: grid; grid-template-columns: repeat(3, 1fr); gap: 13px; }
	@media (max-width: 980px) { .vd-terms { grid-template-columns: repeat(2, 1fr); } }
	@media (max-width: 640px) { .vd-terms { grid-template-columns: 1fr; } }
	.vd-term {
		background: rgba(255, 255, 255, 0.028); border: 1px solid rgba(255, 255, 255, 0.075);
		border-radius: 15px; padding: 17px 18px 15px;
	}
	.vd-term-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
	.vd-num {
		flex: none; width: 30px; height: 30px; border-radius: 10px;
		display: grid; place-items: center;
		font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; color: #fff;
		background: linear-gradient(135deg, var(--primary), #a78bfa);
	}
	.vd-term-head h3 { margin: 0; font-size: 15px; font-weight: 600; color: #eceaf2; }
	.vd-time { margin-left: auto; font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #6d6a7c; }
	.vd-demo { margin: 0; font-size: 13px; color: #9b97a9; }
	.vd-actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 36px; }
	.vd-btn-main {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 11px 22px; border-radius: 12px; border: 0; cursor: pointer;
		font-size: 14px; font-weight: 600; color: #fff;
		background: linear-gradient(120deg, var(--primary), #a78bfa);
	}
	.vd-btn-main:disabled { opacity: 0.6; cursor: wait; }
	.vd-btn-ghost {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 11px 22px; border-radius: 12px; cursor: pointer;
		font-size: 14px; color: #9b97a9; background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}
	.vd-actions-hint { font-size: 12.5px; color: #6d6a7c; }
	@media (max-width: 640px) {
		.vd-shell { padding: 1.6rem 0.9rem 0; }
		.vd-hero-body { padding: 18px 18px 20px; }
	}
</style>
