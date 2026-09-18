<script lang="ts">
import { onMount } from "svelte";
import { isOwnerDevice } from "@/utils/owner";
import type { VideoDigestResult, VideoJob } from "@/utils/videos/types";

const SAMPLE = "https://www.bilibili.com/video/BV14Utf6QEnB/";
const EXAMPLE = "https://www.bilibili.com/video/BV1fFtc6uEHL/";
const NOTES_KEY = "stulanez:videos:notes";
const LAST_KEY = "stulanez:videos:last";

type Tab = "note" | "cues" | "ask";
type ChatTurn = { q: string; a: string };
type StampPart = { kind: "text" | "time"; value: string };

let url = $state("");
let busy = $state(false);
let message = $state("");
let error = $state("");
let result = $state<VideoDigestResult | null>(null);
let copied = $state(false);
let seek = $state(0);
let tab = $state<Tab>("note");
let question = $state("");
let asking = $state(false);
let chat = $state<ChatTurn[]>([]);

onMount(() => {
	const q = new URLSearchParams(location.search).get("u");
	if (q) {
		url = q;
		return;
	}
	try {
		const last = localStorage.getItem(LAST_KEY) || "";
		const note = last ? readNotes()[last] : null;
		if (note?.meta?.bvid) {
			result = note;
			url = note.meta.url;
		}
	} catch {
		/* ignore broken cache */
	}
});

function readNotes(): Record<string, VideoDigestResult> {
	try {
		return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as Record<
			string,
			VideoDigestResult
		>;
	} catch {
		return {};
	}
}

function remember(note: VideoDigestResult) {
	try {
		const all = readNotes();
		all[note.meta.bvid] = note;
		localStorage.setItem(NOTES_KEY, JSON.stringify(all));
		localStorage.setItem(LAST_KEY, note.meta.bvid);
	} catch {
		/* quota */
	}
}

function bvidFrom(input: string): string {
	return /BV[0-9A-Za-z]+/.exec(input)?.[0] || "";
}

function stampParts(text: string): StampPart[] {
	const parts: StampPart[] = [];
	const re = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
	let last = 0;
	let hit = re.exec(text);
	while (hit) {
		if (hit.index > last) {
			parts.push({ kind: "text", value: text.slice(last, hit.index) });
		}
		parts.push({ kind: "time", value: hit[1] });
		last = hit.index + hit[1].length;
		hit = re.exec(text);
	}
	if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
	return parts.length ? parts : [{ kind: "text", value: text }];
}

function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function secondsOf(time: string): number {
	const parts = time.split(":").map((part) => Number(part) || 0);
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	return 0;
}

function jump(videoUrl: string, time: string): string {
	const base = videoUrl.replace(/\?.*$/, "").replace(/\/?$/, "/");
	return `${base}?t=${secondsOf(time)}`;
}

function embedSrc(bvid: string, time: number): string {
	const t = time > 0 ? `&t=${time}` : "";
	return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&high_quality=1&danmaku=0${t}`;
}

function seekTo(time: string) {
	if (!time) return;
	seek = secondsOf(time);
}

function cueLines(text: string): Array<{ time: string; text: string }> {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const hit = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/.exec(line);
			return hit ? { time: hit[1], text: hit[2] } : { time: "", text: line };
		});
}

function askContext(note: VideoDigestResult): string {
	return [note.markdown, note.transcript || ""].filter(Boolean).join("\n\n");
}

function openNote(note: VideoDigestResult, hint: string) {
	result = note;
	url = note.meta.url;
	seek = 0;
	chat = [];
	tab = "note";
	copied = false;
	error = "";
	busy = false;
	message = hint;
	remember(note);
}

async function run(pasted: string, refresh = false) {
	error = "";
	copied = false;
	chat = [];
	tab = "note";
	if (!pasted.trim()) {
		error = "请先贴一条 B 站链接。";
		return;
	}
	url = pasted;
	const bvid = bvidFrom(pasted);
	if (!refresh && bvid) {
		const local = readNotes()[bvid];
		if (local?.tldr && (local.transcript || "").trim()) {
			openNote(local, "用的是这台设备上次写的笔记");
			return;
		}
	}
	result = null;
	busy = true;
	message = "正在听片子、写笔记…";
	try {
		const created = (await (
			await fetch("/api/videos/summarize/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url: pasted, owner: isOwnerDevice() }),
			})
		).json()) as VideoJob;
		if (!created.ok) {
			const fallback = bvid ? readNotes()[bvid] : null;
			if (fallback?.tldr) {
				openNote(fallback, created.error || "这次没写成，先看上次的笔记。");
				return;
			}
			error = created.error || "没做成。";
			busy = false;
			message = "";
			return;
		}
		if (created.result) {
			openNote(created.result, created.message || "做好了");
			return;
		}
		if (!created.id) {
			error = "没有任务号。";
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
			error = job.error || "没做成。";
			busy = false;
			message = "";
			return;
		}
		message = job.message || (job.status === "queued" ? "排队中" : "正在听…");
		if (job.result) {
			openNote(job.result, "做好了");
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	error = "等得太久了。还在听的话，过一会儿再贴一次。";
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

async function ask(event: Event) {
	event.preventDefault();
	if (!result || !question.trim() || asking) return;
	const q = question.trim();
	question = "";
	asking = true;
	try {
		const payload = (await (
			await fetch("/api/videos/ask/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					question: q,
					context: askContext(result),
					owner: isOwnerDevice(),
				}),
			})
		).json()) as { ok?: boolean; answer?: string; error?: string };
		if (!payload.ok) {
			chat = [...chat, { q, a: payload.error || "没答上来。" }];
		} else {
			chat = [...chat, { q, a: payload.answer || "没答上来。" }];
		}
	} catch (err) {
		chat = [
			...chat,
			{ q, a: err instanceof Error ? err.message : "追问失败。" },
		];
	} finally {
		asking = false;
	}
}
</script>

{#snippet stamped(text: string)}
	{#each stampParts(text) as part}
		{#if part.kind === "time"}
			<button type="button" class="vd-stamp" onclick={() => seekTo(part.value)}>{part.value}</button>
		{:else}{part.value}{/if}
	{/each}
{/snippet}

<div class="vd-shell">
	<header class="vd-mast">
		<span class="vd-eyebrow">STULANEZ / VIDEO DIGEST</span>
		<div class="vd-mast-row">
			<h1>视频总结</h1>
		</div>
		<p>左边看片，右边看笔记。点时间跳过去，还能对着这期追问。</p>
	</header>

	<form class="vd-card vd-form" onsubmit={submit}>
		<label for="vd-url">B 站链接</label>
		<textarea
			id="vd-url"
			bind:value={url}
			rows="2"
			placeholder="把分享口令整段贴进来，或只贴 https://www.bilibili.com/video/BV…"
			disabled={busy}
		></textarea>
		<div class="vd-form-row">
			<button class="vd-btn-main" type="submit" disabled={busy}>
				{busy ? "正在写…" : "开始总结"}
			</button>
			<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void run(SAMPLE)}>
				填入试看
			</button>
			<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void run(EXAMPLE)}>
				填入例片
			</button>
			{#if busy}
				<span class="vd-actions-hint">{message}</span>
			{:else if message}
				<span class="vd-actions-hint">{message}</span>
			{/if}
		</div>
	</form>

	{#if error}
		<p class="vd-error">{error}</p>
	{/if}

	{#if result}
		<div class="vd-work">
			<section class="vd-left">
				<div class="vd-card vd-hero">
					<div class="vd-player">
						<iframe
							title={result.meta.title}
							src={embedSrc(result.meta.bvid, seek)}
							allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
						></iframe>
						<span class="vd-len">{clock(result.meta.duration)}</span>
					</div>
					<div class="vd-hero-body">
						<h2 class="vd-vtitle">{result.meta.title}</h2>
						<div class="vd-meta">
							{#if result.meta.up}<span>UP · {result.meta.up}</span>{/if}
							<span class="vd-bvid">{result.meta.bvid}</span>
						</div>
					</div>
				</div>
				{#if result.chapters.length}
					<section class="vd-card vd-chapters">
						<div class="vd-chapters-head">时间轴</div>
						{#each result.chapters as chapter, i}
							<button
								class="vd-chapter"
								class:on={seek === secondsOf(chapter.time)}
								type="button"
								onclick={() => seekTo(chapter.time)}
							>
								<span class="vd-num">{String(i + 1).padStart(2, "0")}</span>
								<span class="vd-chapter-body">
									<strong>{chapter.title}</strong>
									<em>{chapter.summary}</em>
								</span>
								<span class="vd-time">{chapter.time}</span>
							</button>
						{/each}
					</section>
				{/if}
			</section>

			<section class="vd-right vd-card">
				<div class="vd-tabs">
					<button class:on={tab === "note"} type="button" onclick={() => (tab = "note")}>笔记</button>
					<button class:on={tab === "cues"} type="button" onclick={() => (tab = "cues")}>
						字幕{#if result.transcript}<i>{cueLines(result.transcript).length}</i>{/if}
					</button>
					<button class:on={tab === "ask"} type="button" onclick={() => (tab = "ask")}>追问</button>
				</div>
				<div class="vd-pane">
					{#if tab === "note"}
						<section class="vd-tldr">
							<span class="vd-kicker">一句话总结</span>
							<p>{@render stamped(result.tldr)}</p>
						</section>
						{#if result.cards?.length}
							<div class="vd-sect"><h2>知识卡片</h2></div>
							<div class="vd-cards">
								{#each result.cards as card}
									<article class="vd-knowledge">
										<h3>{card.title}</h3>
										<p>{@render stamped(card.body)}</p>
									</article>
								{/each}
							</div>
						{/if}
						{#if result.points.length}
							<div class="vd-sect"><h2>要点</h2></div>
							<ul class="vd-points">
								{#each result.points as point}
									<li>{@render stamped(point)}</li>
								{/each}
							</ul>
						{/if}
					{:else if tab === "cues"}
						{#if result.transcript}
							<div class="vd-cues">
								{#each cueLines(result.transcript) as cue}
									<button
										class="vd-cue"
										class:on={Boolean(cue.time) && seek === secondsOf(cue.time)}
										type="button"
										onclick={() => seekTo(cue.time)}
									>
										{#if cue.time}<span>{cue.time}</span>{/if}
										<p>{cue.text}</p>
									</button>
								{/each}
							</div>
						{:else}
							<p class="vd-empty">这条还没有逐字稿，先看笔记或追问。</p>
						{/if}
					{:else}
						<div class="vd-chat">
							{#if !chat.length}
								<p class="vd-empty">问这期里出现过的概念、步骤、配置。答案只根据笔记和字幕。</p>
							{/if}
							{#each chat as turn}
								<article class="vd-bubble me"><p>{turn.q}</p></article>
								<article class="vd-bubble ai"><p>{@render stamped(turn.a)}</p></article>
							{/each}
						</div>
						<form class="vd-ask" onsubmit={ask}>
							<input
								bind:value={question}
								placeholder="接着问这期…"
								disabled={asking}
							/>
							<button class="vd-btn-main" type="submit" disabled={asking || !question.trim()}>
								{asking ? "在想…" : "问"}
							</button>
						</form>
					{/if}
				</div>
				<div class="vd-actions">
					<button class="vd-btn-main" type="button" onclick={copyMarkdown}>
						{copied ? "已复制" : "复制 Markdown"}
					</button>
					<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void run(result.meta.url, true)}>
						重新写
					</button>
					<a class="vd-btn-ghost" href={jump(result.meta.url, clock(seek))} target="_blank" rel="noopener">到 B 站看原片</a>
				</div>
			</section>
		</div>
	{/if}
</div>

<style>
	.vd-shell { max-width: 1280px; margin: 0 auto; padding: 1.6rem 1.1rem 0; }
	.vd-mast { margin-bottom: 1.2rem; }
	.vd-eyebrow { font-size: 11px; letter-spacing: 0.22em; color: #6d6a7c; }
	.vd-mast-row { display: flex; align-items: baseline; gap: 14px; margin: 6px 0 4px; }
	.vd-mast h1 {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: clamp(26px, 3.6vw, 38px); font-weight: 600; margin: 0;
		background: linear-gradient(100deg, #eceaf2 35%, var(--primary));
		-webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
	}
	.vd-mast > p { margin: 0; font-size: 14px; color: #9b97a9; }
	.vd-card {
		background: rgba(255, 255, 255, 0.028);
		border: 1px solid rgba(255, 255, 255, 0.075);
		border-radius: 18px;
	}
	.vd-form { padding: 16px 18px 14px; display: grid; gap: 10px; margin-bottom: 16px; }
	.vd-form label { font-size: 12px; letter-spacing: 0.12em; color: #6d6a7c; }
	.vd-form textarea {
		width: 100%; resize: vertical; min-height: 64px;
		background: rgba(0, 0, 0, 0.25); color: #eceaf2;
		border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
		padding: 10px 12px; font-size: 14px; line-height: 1.55;
	}
	.vd-form-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
	.vd-error {
		color: #f0a8c4; background: rgba(225, 138, 210, 0.08);
		border: 1px solid rgba(225, 138, 210, 0.28);
		border-radius: 12px; padding: 12px 16px; font-size: 14px;
	}
	.vd-work {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
		gap: 16px;
		align-items: start;
	}
	.vd-left { display: grid; gap: 14px; position: sticky; top: 5.8rem; }
	.vd-hero { overflow: hidden; }
	.vd-player {
		position: relative;
		aspect-ratio: 16 / 9;
		background: #09070e;
	}
	.vd-player iframe { width: 100%; height: 100%; border: 0; display: block; }
	.vd-len {
		position: absolute; right: 14px; bottom: 12px;
		font-family: ui-monospace, Consolas, monospace; font-size: 11.5px;
		color: rgba(255, 255, 255, 0.85); background: rgba(0, 0, 0, 0.45);
		padding: 3px 9px; border-radius: 7px;
	}
	.vd-hero-body { padding: 16px 18px 18px; }
	.vd-vtitle {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: 18px; font-weight: 600; line-height: 1.5; margin: 0 0 8px; color: #eceaf2;
	}
	.vd-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: #9b97a9; }
	.vd-bvid { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
	.vd-chapters { padding: 8px; max-height: 42vh; overflow: auto; }
	.vd-chapters-head {
		font-size: 11px; letter-spacing: 0.18em; color: #6d6a7c;
		padding: 8px 10px 6px;
	}
	.vd-chapter {
		width: 100%; display: flex; gap: 10px; align-items: flex-start;
		text-align: left; background: transparent; border: 0; color: inherit;
		padding: 9px 10px; border-radius: 12px; cursor: pointer;
	}
	.vd-chapter:hover, .vd-chapter.on { background: rgba(255, 255, 255, 0.04); }
	.vd-chapter.on { outline: 1px solid rgba(225, 138, 210, 0.28); }
	.vd-chapter-body { min-width: 0; flex: 1; display: grid; gap: 3px; }
	.vd-chapter-body strong { font-size: 13.5px; color: #eceaf2; }
	.vd-chapter-body em { font-style: normal; font-size: 12px; color: #9b97a9; line-height: 1.5; }
	.vd-num {
		flex: none; width: 28px; height: 28px; border-radius: 9px;
		display: grid; place-items: center; margin-top: 1px;
		font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; color: #fff;
		background: linear-gradient(135deg, var(--primary), #a78bfa);
	}
	.vd-time {
		flex: none; font-family: ui-monospace, Consolas, monospace; font-size: 11px;
		color: #c4a6e0; margin-top: 4px;
	}
	.vd-right { display: flex; flex-direction: column; min-height: 640px; }
	.vd-tabs {
		display: flex; gap: 4px; padding: 10px 12px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}
	.vd-tabs button {
		border: 0; background: transparent; color: #9b97a9;
		padding: 8px 14px; border-radius: 10px 10px 0 0; cursor: pointer; font-size: 14px;
	}
	.vd-tabs button i { font-style: normal; margin-left: 6px; font-size: 11px; color: #c4a6e0; }
	.vd-pane { flex: 1; padding: 18px 18px 8px; overflow: auto; }
	.vd-kicker { font-size: 11px; letter-spacing: 0.2em; color: #6d6a7c; text-transform: uppercase; }
	.vd-tldr { border-left: 3px solid var(--primary); padding: 4px 0 4px 14px; margin-bottom: 18px; }
	.vd-tldr .vd-kicker { display: block; margin-bottom: 7px; }
	.vd-tldr p { margin: 0; font-size: 15.5px; color: #e4e1ec; line-height: 1.7; }
	.vd-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.vd-knowledge {
		background: linear-gradient(180deg, rgba(225, 138, 210, 0.08), rgba(255, 255, 255, 0.02));
		border: 1px solid rgba(225, 138, 210, 0.18);
		border-radius: 14px; padding: 14px 15px 13px;
	}
	.vd-knowledge h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: #eceaf2; }
	.vd-knowledge p { margin: 0; font-size: 12.5px; line-height: 1.65; color: #c4bfd0; }
	.vd-sect { margin: 22px 0 10px; }
	.vd-sect h2 {
		font-family: Georgia, "Noto Serif SC", serif; font-size: 18px; font-weight: 600; margin: 0;
		background: linear-gradient(100deg, #eceaf2 30%, var(--primary));
		-webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
	}
	.vd-points { margin: 0; padding-left: 1.15em; color: #ddd9e6; line-height: 1.7; font-size: 14px; }
	.vd-cues { display: grid; gap: 2px; }
	.vd-cue {
		display: grid; grid-template-columns: 52px 1fr; gap: 10px;
		width: 100%; text-align: left; border: 0; background: transparent;
		color: inherit; padding: 7px 8px; border-radius: 10px; cursor: pointer;
	}
	.vd-cue:hover, .vd-cue.on { background: rgba(255, 255, 255, 0.04); }
	.vd-stamp {
		display: inline; padding: 0 5px; margin: 0 1px; border: 0; border-radius: 6px;
		cursor: pointer; font: inherit; font-family: ui-monospace, Consolas, monospace;
		font-size: 0.92em; color: #e8c4f0; background: rgba(225, 138, 210, 0.16);
	}
	.vd-cue span { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: #c4a6e0; }
	.vd-cue p { margin: 0; font-size: 13px; line-height: 1.55; color: #d8d4e2; }
	.vd-empty { margin: 12px 0; color: #9b97a9; font-size: 14px; line-height: 1.65; }
	.vd-chat { display: grid; gap: 10px; margin-bottom: 14px; }
	.vd-bubble { padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.65; }
	.vd-bubble p { margin: 0; white-space: pre-wrap; }
	.vd-bubble.me { background: rgba(225, 138, 210, 0.12); color: #eceaf2; justify-self: end; max-width: 92%; }
	.vd-bubble.ai { background: rgba(255, 255, 255, 0.04); color: #d8d4e2; }
	.vd-ask { display: flex; gap: 8px; }
	.vd-ask input {
		flex: 1; min-width: 0; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(0, 0, 0, 0.25); color: #eceaf2; padding: 10px 12px; font-size: 14px;
	}
	.vd-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 16px 16px; }
	.vd-btn-main {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 18px; border-radius: 12px; border: 0; cursor: pointer;
		font-size: 14px; font-weight: 600; color: #fff;
		background: linear-gradient(120deg, var(--primary), #a78bfa);
	}
	.vd-btn-main:disabled { opacity: 0.6; cursor: wait; }
	.vd-btn-ghost {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 10px 18px; border-radius: 12px; cursor: pointer;
		font-size: 14px; color: #9b97a9; background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}
	.vd-actions-hint { font-size: 12.5px; color: #6d6a7c; }
	@media (max-width: 980px) {
		.vd-work { grid-template-columns: 1fr; }
		.vd-left { position: static; }
		.vd-cards { grid-template-columns: 1fr; }
		.vd-right { min-height: 0; }
	}
	@media (max-width: 640px) {
		.vd-shell { padding: 1.2rem 0.8rem 0; }
		.vd-hero-body { padding: 14px 14px 16px; }
	}
</style>
