<script lang="ts">
import { onMount } from "svelte";
import { isOwnerDevice } from "@/utils/owner";
import { harvestBiliBag } from "@/utils/videos/bili-fetch";
import { clipKey, isYoutubeMeta, youtubeIdFromKey } from "@/utils/videos/clip";
import { isCompleteNote, polishNote } from "@/utils/videos/cover";
import { ankiCsv, layoutMind, mermaidOf } from "@/utils/videos/derive";
import type { VideoDigestResult, VideoJob } from "@/utils/videos/types";

const NOTES_KEY = "stulanez:videos:notes";
const LAST_KEY = "stulanez:videos:last";

type Tab = "brief" | "outline" | "map" | "note" | "cues" | "ask";
type ChatTurn = { q: string; a: string };
type StampPart = { kind: "text" | "time"; value: string };

let url = $state("");
let busy = $state(false);
let writing = $state(false);
let message = $state("");
let error = $state("");
let result = $state<VideoDigestResult | null>(null);
let copied = $state("");
let seek = $state(0);
let tab = $state<Tab>("brief");
let question = $state("");
let asking = $state(false);
let chat = $state<ChatTurn[]>([]);
let library = $state<VideoDigestResult[]>([]);
let flipped = $state<Record<number, boolean>>({});
let slideAt = $state(0);
let presenting = $state(false);
let menu = $state(false);
let extra = $state<"cards" | "slides" | "article" | "">("");
let step = $state(0);
let percent = $state(8);

const STEPS = ["取片", "听写", "写笔记"] as const;
const mapLayout = $derived(result?.mindmap ? layoutMind(result.mindmap) : null);

onMount(() => {
	refreshLibrary();
	const q = new URLSearchParams(location.search).get("u");
	if (q) {
		url = q;
		void run(q);
		return;
	}
	const onKey = (event: KeyboardEvent) => {
		if (!presenting || !result?.slides?.length) return;
		if (event.key === "Escape") presenting = false;
		if (event.key === "ArrowRight") nextSlide(1);
		if (event.key === "ArrowLeft") nextSlide(-1);
	};
	window.addEventListener("keydown", onKey);
	return () => window.removeEventListener("keydown", onKey);
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

function refreshLibrary() {
	library = Object.values(readNotes())
		.filter((note) => isCompleteNote(note))
		.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function remember(note: VideoDigestResult) {
	try {
		const all = readNotes();
		all[note.meta.bvid] = { ...note, savedAt: Date.now() };
		localStorage.setItem(NOTES_KEY, JSON.stringify(all));
		localStorage.setItem(LAST_KEY, note.meta.bvid);
		refreshLibrary();
	} catch {
		/* quota */
	}
}

function forget(bvid: string, event: MouseEvent) {
	event.preventDefault();
	event.stopPropagation();
	try {
		const all = readNotes();
		delete all[bvid];
		localStorage.setItem(NOTES_KEY, JSON.stringify(all));
		if (localStorage.getItem(LAST_KEY) === bvid) {
			localStorage.removeItem(LAST_KEY);
		}
	} catch {
		/* ignore */
	}
	if (result?.meta.bvid === bvid) {
		result = null;
		url = "";
		message = "";
		chat = [];
	}
	refreshLibrary();
}

function showTab(next: Tab) {
	tab = next;
	extra = "";
	menu = false;
}

function showExtra(kind: "cards" | "slides" | "article") {
	extra = kind;
	menu = false;
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

function jump(note: VideoDigestResult, time: string): string {
	const sec = secondsOf(time);
	if (isYoutubeMeta(note.meta.bvid, note.meta.platform)) {
		const id = note.meta.youtube || youtubeIdFromKey(note.meta.bvid);
		return `https://www.youtube.com/watch?v=${id}&t=${sec}`;
	}
	const base = note.meta.url.replace(/\?.*$/, "").replace(/\/?$/, "/");
	return `${base}?t=${sec}`;
}

function embedSrc(note: VideoDigestResult, time: number): string {
	if (isYoutubeMeta(note.meta.bvid, note.meta.platform)) {
		const id = note.meta.youtube || youtubeIdFromKey(note.meta.bvid);
		const start = time > 0 ? `&start=${time}` : "";
		return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0${start}`;
	}
	const t = time > 0 ? `&t=${time}` : "";
	return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(note.meta.bvid)}&high_quality=1&danmaku=0${t}`;
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

function splitPoint(point: string): { time: string; text: string } {
	const hit = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/.exec(point.trim());
	return hit ? { time: hit[1], text: hit[2] } : { time: "", text: point };
}

function askContext(note: VideoDigestResult): string {
	return [note.markdown, note.transcript || ""].filter(Boolean).join("\n\n");
}

function openNote(note: VideoDigestResult, hint: string) {
	const packed = polishNote(note, note.transcript || "");
	result = packed;
	url = packed.meta.url;
	seek = 0;
	chat = [];
	tab = "brief";
	extra = "";
	copied = "";
	error = "";
	busy = false;
	flipped = {};
	slideAt = 0;
	presenting = false;
	message = hint;
	remember(packed);
}

function nextSlide(step: number) {
	if (!result?.slides?.length) return;
	slideAt = Math.min(result.slides.length - 1, Math.max(0, slideAt + step));
	const row = result.slides[slideAt];
	if (row?.time) seekTo(row.time);
}

async function run(pasted: string, refresh = false) {
	error = "";
	copied = "";
	chat = [];
	tab = "brief";
	menu = false;
	extra = "";
	if (!pasted.trim()) {
		error = "请先贴一条 B 站或 YouTube 链接。";
		return;
	}
	url = pasted;
	const key = clipKey(pasted);
	if (!refresh && key) {
		const local = readNotes()[key];
		if (local && isCompleteNote(local)) {
			openNote(local, "用的是这台设备上次写的笔记");
			return;
		}
	}
	result = null;
	busy = true;
	step = 0;
	percent = 10;
	message = "正在取片…";
	const tick = window.setInterval(() => {
		percent = Math.min(92, percent + 3);
		if (percent > 28) step = Math.max(step, 1);
		if (percent > 58) step = Math.max(step, 2);
	}, 420);
	try {
		let harvest: Record<string, unknown> = {};
		if (key && !key.startsWith("yt_")) {
			message = "正在取片…";
			harvest = await harvestBiliBag(key);
			if (typeof harvest.__gone === "string" && harvest.__gone) {
				error = harvest.__gone;
				busy = false;
				message = "";
				return;
			}
			step = 1;
			percent = Math.max(percent, 36);
			message = "正在听写、写笔记…";
		}
		const created = (await (
			await fetch("/api/videos/summarize/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					url: pasted,
					owner: isOwnerDevice(),
					harvest,
				}),
			})
		).json()) as VideoJob;
		if (!created.ok) {
			const fallback = key ? readNotes()[key] : null;
			if (fallback && isCompleteNote(fallback)) {
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
		error = "没有任务号。";
		busy = false;
	} catch (err) {
		error = err instanceof Error ? err.message : "请求失败。";
		busy = false;
		message = "";
	} finally {
		window.clearInterval(tick);
		if (!busy) percent = 8;
	}
}

async function pasteUrl() {
	try {
		const text = (await navigator.clipboard.readText()).trim();
		if (text) url = text;
	} catch {
		error = "浏览器不让读剪贴板，把链接直接贴进框里。";
	}
}

function submit(event: Event) {
	event.preventDefault();
	void run(url);
}

function download(
	name: string,
	text: string,
	mime = "text/plain;charset=utf-8",
) {
	const blob = new Blob([text], { type: mime });
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = name;
	link.click();
	URL.revokeObjectURL(href);
}

async function copyText(label: string, text: string) {
	await navigator.clipboard.writeText(text);
	copied = label;
	setTimeout(() => {
		if (copied === label) copied = "";
	}, 1600);
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
		chat = [...chat, { q, a: payload.answer || payload.error || "没答上来。" }];
	} catch (err) {
		chat = [
			...chat,
			{ q, a: err instanceof Error ? err.message : "追问失败。" },
		];
	} finally {
		asking = false;
	}
}

async function polishArticle() {
	if (!result || writing) return;
	writing = true;
	try {
		const payload = (await (
			await fetch("/api/videos/expand/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					markdown: result.markdown,
					transcript: result.transcript || "",
					owner: isOwnerDevice(),
				}),
			})
		).json()) as { ok?: boolean; article?: string; error?: string };
		if (!payload.ok || !payload.article) {
			error = payload.error || "长文没写成。";
			return;
		}
		result = { ...result, article: payload.article };
		remember(result);
	} catch (err) {
		error = err instanceof Error ? err.message : "长文失败。";
	} finally {
		writing = false;
	}
}

function fileStem(note: VideoDigestResult): string {
	return (note.meta.title || note.meta.bvid)
		.replace(/[\\/:*?"<>|]/g, "")
		.slice(0, 40);
}
</script>

{#snippet stamped(text: string)}
	{#each stampParts(text) as part}
		{#if part.kind === "time"}
			<button type="button" class="vd-stamp" onclick={() => seekTo(part.value)}>{part.value}</button>
		{:else}{part.value}{/if}
	{/each}
{/snippet}

<div class="vd-app" class:work={Boolean(result)}>
	{#if result}
		<form class="vd-cmd" onsubmit={submit}>
			<div class="vd-brand">
				<strong>视频总结</strong>
				<span>速览 · 大纲 · 导图 · 笔记</span>
			</div>
			<input
				id="vd-url"
				bind:value={url}
				placeholder="再贴一条 B 站或 YouTube 链接"
				disabled={busy}
			/>
			<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void pasteUrl()}>粘贴</button>
			<button class="vd-btn-main" type="submit" disabled={busy}>
				{busy ? "正在写…" : "总结"}
			</button>
		</form>
		{#if error}
			<p class="vd-error">{error}</p>
		{/if}
	{:else if busy}
		<section class="vd-progress">
			<p class="vd-eyebrow">正在处理这条片子</p>
			<h1>{url || "贴进来的链接"}</h1>
			<div class="vd-bar" aria-hidden="true">
				<i style={`width:${percent}%`}></i>
			</div>
			<ol>
				{#each STEPS as label, i}
					<li class:on={step === i} class:done={step > i}>{label}</li>
				{/each}
			</ol>
			<p class="vd-lead">{message || "正在听写、按时间轴写笔记。长一点的片子要多等一会儿。"}</p>
		</section>
	{:else}
		<section class="vd-hero">
			<p class="vd-eyebrow">视频总结</p>
			<h1>贴一条片子<br /><em>变成能跳的笔记</em></h1>
			<p class="vd-lead">
				精华速览先判断值不值得看，大纲和导图点一下跳播放器，原文对着核对，还能追问这期。B 站没字幕会语音识别。
			</p>
			<form class="vd-hero-form" onsubmit={submit}>
				<input
					id="vd-url"
					bind:value={url}
					placeholder="粘贴 B 站 / YouTube 链接"
					disabled={busy}
				/>
				<button class="vd-btn-ghost" type="button" onclick={() => void pasteUrl()}>粘贴</button>
				<button class="vd-btn-main" type="submit" disabled={busy}>开始总结</button>
			</form>
			<div class="vd-plats">
				<span>B 站</span>
				<span>YouTube</span>
			</div>
			{#if error}
				<p class="vd-error">{error}</p>
			{/if}
			<ul class="vd-pills">
				<li>精华速览</li>
				<li>章节大纲</li>
				<li>思维导图</li>
				<li>图文笔记</li>
				<li>原文逐字稿</li>
				<li>AI 追问</li>
			</ul>
			<div class="vd-preview" aria-hidden="true">
				<div class="vd-preview-player">
					<span>播放器</span>
					<small>点时间戳直接跳回来</small>
				</div>
				<div class="vd-preview-notes">
					<nav>
						<b>速览</b>
						<span>大纲</span>
						<span>导图</span>
						<span>笔记</span>
						<span>原文</span>
						<span>问</span>
					</nav>
					<p>先看值不值得点开，再按章节把机制、数字、步骤写清。点节点、点时间，播放器跟着走。</p>
				</div>
			</div>
			{#if library.length}
				<div class="vd-recent">
					<div class="vd-lib-h">这台设备上的最近笔记</div>
					<div class="vd-recent-list">
						{#each library as item}
							<div class="vd-lib-row">
								<button type="button" class="vd-lib-open" onclick={() => openNote(item, "")}>
									{#if item.meta.cover}
										<img src={item.meta.cover} alt="" />
									{/if}
									<span>
										<b>{item.meta.title}</b>
										<em>{item.meta.up || item.meta.bvid} · {clock(item.meta.duration)}</em>
									</span>
								</button>
								<button
									class="vd-lib-del"
									type="button"
									title="从这台设备删掉"
									onclick={(event) => forget(item.meta.bvid, event)}
								>
									删除
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	{#if result}
	<div class="vd-body">
		<aside class="vd-lib">
			<div class="vd-lib-h">历史</div>
			{#if library.length}
				{#each library as item}
					<div class="vd-lib-row" class:on={result?.meta.bvid === item.meta.bvid}>
						<button type="button" class="vd-lib-open" onclick={() => openNote(item, "")}>
							{#if item.meta.cover}
								<img src={item.meta.cover} alt="" />
							{/if}
							<span>
								<b>{item.meta.title}</b>
								<em>{item.meta.up || item.meta.bvid} · {clock(item.meta.duration)}</em>
							</span>
						</button>
						<button
							class="vd-lib-del"
							type="button"
							title="从这台设备删掉"
							onclick={(event) => forget(item.meta.bvid, event)}
						>
							删除
						</button>
					</div>
				{/each}
			{:else}
				<p class="vd-empty">总结过的片子会留在这台设备上，可随时删。</p>
			{/if}
		</aside>
			<section class="vd-stage">
				<div class="vd-player">
					<iframe
						title={result.meta.title}
						src={embedSrc(result, seek)}
						allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				</div>
				<div class="vd-clip">
					<h2>{result.meta.title}</h2>
					<div class="vd-meta">
						{#if result.meta.up}<span>{result.meta.up}</span>{/if}
						<span>{result.meta.platform === "youtube" ? "YouTube" : result.meta.bvid}</span>
						<span>{clock(result.meta.duration)}</span>
					</div>
				</div>
				{#if result.chapters.length}
					<nav class="vd-toc">
						{#each result.chapters as chapter, i}
							<button
								class="vd-toc-row"
								class:on={seek === secondsOf(chapter.time)}
								type="button"
								onclick={() => seekTo(chapter.time)}
							>
								<i>{String(i + 1).padStart(2, "0")}</i>
								<span>{chapter.title}</span>
								<time>{chapter.time}</time>
							</button>
						{/each}
					</nav>
				{/if}
			</section>

			<section class="vd-board">
				<div class="vd-tabs">
					<button class:on={!extra && tab === "brief"} type="button" onclick={() => showTab("brief")}>速览</button>
					<button class:on={!extra && tab === "outline"} type="button" onclick={() => showTab("outline")}>大纲</button>
					<button class:on={!extra && tab === "map"} type="button" onclick={() => showTab("map")}>导图</button>
					<button class:on={!extra && tab === "note"} type="button" onclick={() => showTab("note")}>笔记</button>
					<button class:on={!extra && tab === "cues"} type="button" onclick={() => showTab("cues")}>
						原文{#if result.transcript}<i>{cueLines(result.transcript).length}</i>{/if}
					</button>
					<button class:on={!extra && tab === "ask"} type="button" onclick={() => showTab("ask")}>问</button>
				</div>
				<div class="vd-pane">
					{#if extra === "cards"}
						<div class="vd-flash">
							{#each result.flashcards || [] as card, i}
								<button
									class="vd-flip"
									class:back={flipped[i]}
									type="button"
									onclick={() => {
										flipped = { ...flipped, [i]: !flipped[i] };
										if (card.time) seekTo(card.time);
									}}
								>
									<span class="vd-flip-k">{flipped[i] ? "答案" : "问题"}{card.time ? ` · ${card.time}` : ""}</span>
									<p>{flipped[i] ? card.a : card.q}</p>
								</button>
							{/each}
						</div>
					{:else if extra === "slides"}
						{#if result.slides?.length}
						{@const slide = result.slides[slideAt]}
						<div class="vd-slide">
							<div class="vd-slide-card">
								<time>{slide.time}</time>
								<h3>{slide.title}</h3>
								<p>{@render stamped(slide.body)}</p>
								{#if slide.bullets.length}
									<ul>
										{#each slide.bullets as bullet}
											<li>{@render stamped(bullet)}</li>
										{/each}
									</ul>
								{/if}
							</div>
							<div class="vd-slide-nav">
								<button class="vd-btn-ghost" type="button" onclick={() => nextSlide(-1)}>上一页</button>
								<span>{slideAt + 1} / {result.slides.length}</span>
								<button class="vd-btn-ghost" type="button" onclick={() => nextSlide(1)}>下一页</button>
								<button class="vd-btn-main" type="button" onclick={() => (presenting = true)}>全屏演示</button>
							</div>
						</div>
						{:else}
							<p class="vd-empty">这条还没有幻灯。</p>
						{/if}
					{:else if extra === "article"}
						<div class="vd-article">
							<div class="vd-article-bar">
								<button class="vd-btn-ghost" type="button" disabled={writing} onclick={() => void polishArticle()}>
									{writing ? "正在润色…" : "用模型润色成文"}
								</button>
							</div>
							<div class="vd-article-body">{@render stamped(result.article || result.markdown)}</div>
						</div>
					{:else if tab === "brief"}
						<section class="vd-tldr">
							<span class="vd-kicker">精华速览</span>
							<p>{@render stamped(result.tldr)}</p>
						</section>
						{#if result.cards?.length}
							<div class="vd-kicker vd-kicker-row">知识卡片</div>
							<div class="vd-know">
								{#each result.cards as card}
									<article>
										<h3>{card.title}</h3>
										<p>{@render stamped(card.body)}</p>
									</article>
								{/each}
							</div>
						{/if}
						{#if result.points.length}
							<div class="vd-kicker vd-kicker-row">关键要点</div>
							<div class="vd-list">
								{#each result.points as point}
									{@const row = splitPoint(point)}
									<button type="button" onclick={() => row.time && seekTo(row.time)}>
										{#if row.time}<time>{row.time}</time>{/if}
										<p>{@render stamped(row.text)}</p>
									</button>
								{/each}
							</div>
						{/if}
					{:else if tab === "outline"}
						<div class="vd-chapters">
							{#each result.chapters as chapter, i}
								<article class:on={seek === secondsOf(chapter.time)}>
									<button type="button" onclick={() => seekTo(chapter.time)}>
										<time>{chapter.time}</time>
										<strong>{String(i + 1).padStart(2, "0")} {chapter.title}</strong>
									</button>
								</article>
							{/each}
						</div>
					{:else if tab === "map"}
						{#if mapLayout}
						<div class="vd-map">
							<svg viewBox={`0 0 ${mapLayout.width} ${mapLayout.height}`} role="img" aria-label="思维导图">
								{#each mapLayout.edges as edge}
									<path
										d={`M${edge.x1} ${edge.y1} C${(edge.x1 + edge.x2) / 2} ${edge.y1}, ${(edge.x1 + edge.x2) / 2} ${edge.y2}, ${edge.x2} ${edge.y2}`}
									/>
								{/each}
								{#each mapLayout.nodes as node}
									<g
										class="vd-map-node"
										transform="translate({node.x} {node.y})"
										onclick={() => node.time && seekTo(node.time)}
									>
										<rect width={node.w} height={node.h} rx="10" class:root={node.depth === 0} />
										<text x="12" y="26">{node.title}</text>
									</g>
								{/each}
							</svg>
						</div>
						{:else}
							<p class="vd-empty">这条还没有导图。</p>
						{/if}
					{:else if tab === "note"}
						<div class="vd-chapters">
							{#each result.chapters as chapter, i}
								<article class:on={seek === secondsOf(chapter.time)}>
									<button type="button" onclick={() => seekTo(chapter.time)}>
										<time>{chapter.time}</time>
										<strong>{String(i + 1).padStart(2, "0")} {chapter.title}</strong>
									</button>
									<p>{@render stamped(chapter.summary)}</p>
								</article>
							{/each}
						</div>
					{:else if tab === "cues"}
						{#if result.transcript}
							<div class="vd-list">
								{#each cueLines(result.transcript) as cue}
									<button
										class:on={Boolean(cue.time) && seek === secondsOf(cue.time)}
										type="button"
										onclick={() => seekTo(cue.time)}
									>
										{#if cue.time}<time>{cue.time}</time>{/if}
										<p>{cue.text}</p>
									</button>
								{/each}
							</div>
						{:else}
							<p class="vd-empty">这条还没有逐字稿。</p>
						{/if}
					{:else}
						<div class="vd-chat">
							{#if !chat.length}
								<p class="vd-empty">问这期里的机制、数字、步骤。答案只根据笔记和字幕。</p>
							{/if}
							{#each chat as turn}
								<article class="me"><p>{turn.q}</p></article>
								<article class="ai"><p>{@render stamped(turn.a)}</p></article>
							{/each}
						</div>
						<form class="vd-ask" onsubmit={ask}>
							<input bind:value={question} placeholder="接着问这期…" disabled={asking} />
							<button class="vd-btn-main" type="submit" disabled={asking || !question.trim()}>
								{asking ? "在想…" : "问"}
							</button>
						</form>
					{/if}
				</div>
				<div class="vd-foot">
					<div class="vd-menu">
						<button class="vd-btn-ghost" type="button" onclick={() => (menu = !menu)}>导出</button>
						{#if menu}
							<div class="vd-menu-list">
								<button type="button" onclick={() => { void copyText("md", result.markdown); menu = false; }}>
									{copied === "md" ? "已复制 Markdown" : "复制 Markdown"}
								</button>
								<button type="button" onclick={() => { download(`${fileStem(result)}.md`, result.article || result.markdown); menu = false; }}>
									下载文章
								</button>
								<button type="button" onclick={() => { download(`${fileStem(result)}.csv`, ankiCsv(result), "text/csv"); menu = false; }}>
									闪记卡 CSV
								</button>
								<button type="button" onclick={() => { download(`${fileStem(result)}.mmd`, mermaidOf(result)); menu = false; }}>
									导图 Mermaid
								</button>
								<button type="button" onclick={() => showExtra("cards")}>看闪记卡</button>
								<button type="button" onclick={() => showExtra("slides")}>看幻灯</button>
								<button type="button" onclick={() => showExtra("article")}>看长文</button>
							</div>
						{/if}
					</div>
					<button class="vd-btn-ghost" type="button" disabled={busy} onclick={() => void run(result.meta.url, true)}>
						重新写
					</button>
					<a class="vd-btn-ghost" href={jump(result, clock(seek))} target="_blank" rel="noopener">原片</a>
				</div>
			</section>
	</div>
	{/if}
</div>

{#if presenting && result?.slides?.length}
	{@const slide = result.slides[slideAt]}
	<div class="vd-present">
		<button class="vd-present-x" type="button" onclick={() => (presenting = false)}>退出</button>
		<div class="vd-present-card">
			<time>{slide.time}</time>
			<h3>{slide.title}</h3>
			<p>{@render stamped(slide.body)}</p>
			{#if slide.bullets.length}
				<ul>
					{#each slide.bullets as bullet}
						<li>{@render stamped(bullet)}</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="vd-slide-nav">
			<button class="vd-btn-ghost" type="button" onclick={() => nextSlide(-1)}>上一页</button>
			<span>{slideAt + 1} / {result.slides.length}</span>
			<button class="vd-btn-ghost" type="button" onclick={() => nextSlide(1)}>下一页</button>
		</div>
	</div>
{/if}

<style>
	.vd-app {
		--vd-ink: #140c14;
		--vd-panel: color-mix(in oklch, var(--primary) 8%, #161018);
		--vd-line: color-mix(in oklch, var(--primary) 22%, #322430);
		--vd-text: #eceaf2;
		--vd-mute: #b39aaa;
		--vd-accent: var(--primary);
		--vd-glow: color-mix(in oklch, var(--primary) 18%, transparent);
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.2rem 1rem 0;
		color: var(--vd-text);
	}
	.vd-app.work { max-width: 1480px; padding-top: 0.4rem; }
	.vd-eyebrow {
		margin: 0 0 10px;
		font-size: 12px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--primary) 62%, white);
		font-weight: 700;
	}
	.vd-hero, .vd-progress {
		text-align: center;
		padding: 2.4rem 0 1.2rem;
	}
	.vd-hero h1, .vd-progress h1 {
		margin: 0 0 12px;
		font-size: clamp(2rem, 4.6vw, 3.4rem);
		letter-spacing: -0.045em;
		line-height: 1.12;
		font-weight: 750;
	}
	.vd-hero h1 em {
		font-style: normal;
		background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 70%, white), var(--primary));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
	.vd-lead {
		margin: 0 auto 22px;
		max-width: 38rem;
		color: var(--vd-mute);
		line-height: 1.75;
		font-size: 15px;
	}
	.vd-progress h1 {
		font-size: 18px;
		letter-spacing: -0.02em;
		word-break: break-all;
		max-width: 52rem;
		margin: 0 auto 22px;
		color: var(--vd-mute);
		font-weight: 500;
	}
	.vd-hero-form, .vd-cmd {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.vd-hero-form {
		max-width: 720px;
		margin: 0 auto;
		padding: 8px 8px 8px 16px;
		background: color-mix(in oklch, var(--primary) 10%, #161018);
		border: 1px solid var(--vd-line);
		border-radius: 999px;
		box-shadow: 0 18px 50px color-mix(in oklch, var(--primary) 16%, transparent);
	}
	.vd-cmd {
		padding: 10px 12px;
		margin-bottom: 12px;
		background: var(--vd-panel);
		border: 1px solid var(--vd-line);
		border-radius: 14px;
	}
	.vd-brand {
		display: grid;
		min-width: 132px;
		padding-right: 8px;
	}
	.vd-brand strong { font-size: 14px; letter-spacing: -0.02em; }
	.vd-brand span { font-size: 11px; color: var(--vd-mute); }
	.vd-hero-form input, .vd-cmd input {
		flex: 1;
		min-width: 180px;
		height: 44px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--vd-text);
		padding: 0 8px;
		font-size: 15px;
		outline: none;
	}
	.vd-cmd input {
		height: 40px;
		border: 1px solid var(--vd-line);
		background: var(--vd-ink);
		padding: 0 12px;
		font-size: 13.5px;
	}
	.vd-plats, .vd-pills {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin: 18px 0 0;
		padding: 0;
		list-style: none;
	}
	.vd-plats span, .vd-pills li {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--vd-line);
		background: color-mix(in oklch, var(--primary) 8%, #120c12);
		font-size: 12.5px;
		color: var(--vd-mute);
	}
	.vd-pills { margin-top: 22px; gap: 8px; }
	.vd-pills li { color: var(--vd-text); }
	.vd-preview {
		display: grid;
		grid-template-columns: 0.9fr 1.1fr;
		gap: 0;
		margin: 28px auto 0;
		max-width: 880px;
		min-height: 280px;
		border: 1px solid var(--vd-line);
		border-radius: 22px;
		overflow: hidden;
		background: var(--vd-panel);
		text-align: left;
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
	}
	.vd-preview-player {
		display: grid;
		place-content: center;
		gap: 6px;
		background:
			radial-gradient(420px 180px at 50% 40%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 70%),
			#0a070c;
		color: var(--vd-mute);
		font-size: 14px;
		text-align: center;
	}
	.vd-preview-player span { font-size: 18px; color: #fff; font-weight: 650; }
	.vd-preview-notes { padding: 16px 18px 20px; }
	.vd-preview-notes nav {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
		font-size: 12.5px;
		color: var(--vd-mute);
	}
	.vd-preview-notes nav b {
		color: #fff;
		background: color-mix(in oklch, var(--primary) 28%, transparent);
		padding: 4px 8px;
		border-radius: 8px;
		font-weight: 650;
	}
	.vd-preview-notes p { margin: 0; color: #d5c6d2; line-height: 1.75; font-size: 14px; }
	.vd-bar {
		height: 8px;
		max-width: 520px;
		margin: 0 auto 18px;
		border-radius: 999px;
		background: #1a1218;
		border: 1px solid var(--vd-line);
		overflow: hidden;
	}
	.vd-bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, color-mix(in oklch, var(--primary) 70%, white), var(--primary));
		transition: width 0.35s ease;
	}
	.vd-progress ol {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
	}
	.vd-progress li {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--vd-line);
		color: var(--vd-mute);
		font-size: 13px;
	}
	.vd-progress li.on, .vd-progress li.done {
		color: #fff;
		border-color: color-mix(in oklch, var(--primary) 45%, transparent);
		background: color-mix(in oklch, var(--primary) 22%, transparent);
	}
	.vd-recent {
		margin: 28px auto 0;
		max-width: 880px;
		text-align: left;
		padding: 12px;
		border: 1px solid var(--vd-line);
		border-radius: 16px;
		background: var(--vd-panel);
	}
	.vd-recent-list { display: grid; gap: 4px; }
	.vd-error {
		color: #f0a8b8;
		background: rgba(240, 168, 184, 0.08);
		border: 1px solid rgba(240, 168, 184, 0.28);
		border-radius: 12px;
		padding: 10px 14px;
		font-size: 14px;
		max-width: 720px;
		margin: 16px auto 0;
		text-align: left;
	}
	.vd-app.work .vd-error { margin: 0 0 12px; max-width: none; }
	.vd-body {
		display: grid;
		grid-template-columns: 220px minmax(280px, 0.92fr) minmax(0, 1.28fr);
		gap: 12px;
		align-items: start;
	}
	.vd-lib, .vd-stage, .vd-board {
		background: var(--vd-panel);
		border: 1px solid var(--vd-line);
		border-radius: 16px;
		overflow: hidden;
	}
	.vd-lib { padding: 8px; position: sticky; top: 5.6rem; max-height: calc(100vh - 7.2rem); overflow: auto; }
	.vd-lib-h { font-size: 11px; letter-spacing: 0.14em; color: var(--vd-mute); font-weight: 700; padding: 6px 8px 8px; }
	.vd-lib-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px;
		align-items: start;
		padding: 4px;
		border-radius: 12px;
	}
	.vd-lib-row:hover, .vd-lib-row.on { background: var(--vd-glow); }
	.vd-lib-open {
		display: grid;
		grid-template-columns: 42px 1fr;
		gap: 8px;
		align-items: center;
		width: 100%;
		text-align: left;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
		padding: 4px;
		border-radius: 10px;
	}
	.vd-lib-open img { width: 42px; height: 42px; object-fit: cover; border-radius: 8px; }
	.vd-lib-open span { display: grid; gap: 2px; min-width: 0; }
	.vd-lib-open b { font-size: 12.5px; line-height: 1.4; font-weight: 650; }
	.vd-lib-open em { font-style: normal; font-size: 11px; color: var(--vd-mute); }
	.vd-lib-del {
		border: 0;
		background: transparent;
		color: var(--vd-mute);
		cursor: pointer;
		font-size: 11px;
		padding: 6px 8px;
		border-radius: 8px;
	}
	.vd-lib-del:hover { color: #fff; background: color-mix(in oklch, var(--primary) 22%, transparent); }
	.vd-stage { position: sticky; top: 5.6rem; }
	.vd-player { aspect-ratio: 16 / 9; background: #0a070c; }
	.vd-player iframe { width: 100%; height: 100%; border: 0; display: block; }
	.vd-clip { padding: 12px 14px 10px; }
	.vd-clip h2 { margin: 0 0 6px; font-size: 15px; line-height: 1.45; }
	.vd-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 12px; color: var(--vd-mute); }
	.vd-toc { padding: 6px; max-height: min(34vh, 320px); overflow: auto; border-top: 1px solid var(--vd-line); }
	.vd-toc-row {
		width: 100%; display: grid; grid-template-columns: 28px 1fr auto;
		gap: 8px; align-items: center; text-align: left;
		background: transparent; border: 0; color: inherit;
		padding: 7px 8px; border-radius: 9px; cursor: pointer;
	}
	.vd-toc-row:hover, .vd-toc-row.on { background: var(--vd-glow); }
	.vd-toc-row.on { box-shadow: inset 2px 0 0 var(--vd-accent); }
	.vd-toc-row i { font-style: normal; font-size: 11px; color: var(--vd-mute); font-family: ui-monospace, Consolas, monospace; }
	.vd-toc-row span { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: color-mix(in oklch, var(--primary) 70%, white); }
	.vd-board { display: flex; flex-direction: column; min-height: 720px; }
	.vd-tabs {
		display: flex; flex-wrap: wrap; gap: 2px; padding: 8px;
		border-bottom: 1px solid var(--vd-line);
		background: color-mix(in oklch, var(--primary) 6%, #120c12);
	}
	.vd-tabs button {
		border: 0; background: transparent; color: var(--vd-mute);
		padding: 7px 11px; border-radius: 8px; cursor: pointer;
		font-size: 13px; font-weight: 600;
	}
	.vd-tabs button.on { color: #fff; background: color-mix(in oklch, var(--primary) 28%, transparent); }
	.vd-tabs button i { font-style: normal; margin-left: 5px; font-size: 11px; color: color-mix(in oklch, var(--primary) 70%, white); }
	.vd-pane { flex: 1; padding: 16px; overflow: auto; }
	.vd-kicker { font-size: 11px; letter-spacing: 0.14em; color: var(--vd-mute); font-weight: 700; }
	.vd-kicker-row { margin: 18px 0 8px; }
	.vd-tldr {
		background: var(--vd-glow);
		border: 1px solid color-mix(in oklch, var(--primary) 32%, transparent);
		border-radius: 12px; padding: 12px 14px;
	}
	.vd-tldr p { margin: 6px 0 0; font-size: 14.5px; line-height: 1.7; }
	.vd-know { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.vd-know article {
		background: var(--vd-ink);
		border: 1px solid var(--vd-line);
		border-radius: 12px;
		padding: 12px;
		border-top: 2px solid var(--vd-accent);
	}
	.vd-know h3 { margin: 0 0 6px; font-size: 13.5px; }
	.vd-know p { margin: 0; font-size: 12.5px; line-height: 1.65; color: #d5c6d2; }
	.vd-list, .vd-chapters { display: grid; gap: 6px; }
	.vd-list button, .vd-chapters article {
		width: 100%; text-align: left; cursor: pointer;
		background: var(--vd-ink); color: inherit;
		border: 1px solid var(--vd-line);
		border-radius: 10px; padding: 8px 10px;
	}
	.vd-list button { display: grid; grid-template-columns: 48px 1fr; gap: 10px; }
	.vd-list button.on, .vd-chapters article.on, .vd-list button:hover, .vd-chapters article:hover {
		background: var(--vd-glow);
	}
	.vd-list p { margin: 0; font-size: 13.5px; line-height: 1.6; }
	.vd-chapters article > button {
		display: flex; gap: 10px; align-items: baseline;
		width: 100%; border: 0; background: transparent; color: inherit;
		cursor: pointer; padding: 0 0 6px; text-align: left;
	}
	.vd-chapters strong { font-size: 14.5px; }
	.vd-chapters p { margin: 0; font-size: 13.5px; line-height: 1.7; color: #d5c6d2; }
	.vd-stamp {
		display: inline; padding: 0 5px; margin: 0 1px; border: 0; border-radius: 6px;
		cursor: pointer; font: inherit; font-family: ui-monospace, Consolas, monospace;
		font-size: 0.92em; color: color-mix(in oklch, var(--primary) 55%, white);
		background: color-mix(in oklch, var(--primary) 22%, transparent);
	}
	.vd-map { overflow: auto; background: var(--vd-ink); border-radius: 12px; border: 1px solid var(--vd-line); }
	.vd-map svg { min-width: 100%; height: auto; display: block; }
	.vd-map path { fill: none; stroke: color-mix(in oklch, var(--primary) 38%, #4a3044); stroke-width: 1.4; }
	.vd-map-node { cursor: pointer; }
	.vd-map-node rect { fill: #1a1218; stroke: #4a3040; }
	.vd-map-node rect.root { fill: color-mix(in oklch, var(--primary) 42%, #1a1016); stroke: var(--vd-accent); }
	.vd-map-node text { fill: #eceaf2; font-size: 12px; }
	.vd-flash { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.vd-flip {
		min-height: 140px; text-align: left; cursor: pointer;
		border-radius: 14px; padding: 14px;
		background: var(--vd-ink); color: inherit;
		border: 1px solid var(--vd-line);
	}
	.vd-flip.back { background: var(--vd-glow); border-color: color-mix(in oklch, var(--primary) 42%, transparent); }
	.vd-flip-k { font-size: 11px; color: var(--vd-mute); letter-spacing: 0.08em; }
	.vd-flip p { margin: 10px 0 0; font-size: 14.5px; line-height: 1.65; }
	.vd-slide-card {
		min-height: 280px; padding: 22px 24px;
		background: var(--vd-ink); border: 1px solid var(--vd-line); border-radius: 16px;
	}
	.vd-slide-card h3 { margin: 8px 0 10px; font-size: 22px; letter-spacing: -0.03em; }
	.vd-slide-card p { margin: 0 0 12px; font-size: 15px; line-height: 1.7; color: #d5c6d2; }
	.vd-slide-card ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
	.vd-slide-nav { display: flex; gap: 8px; align-items: center; margin-top: 12px; color: var(--vd-mute); font-size: 13px; }
	.vd-article-bar { margin-bottom: 12px; }
	.vd-article-body { white-space: pre-wrap; font-size: 14.5px; line-height: 1.8; color: #d5d8e4; }
	.vd-empty { margin: 8px; color: var(--vd-mute); font-size: 13.5px; line-height: 1.65; }
	.vd-chat { display: grid; gap: 10px; margin-bottom: 14px; }
	.vd-chat article { padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.65; }
	.vd-chat p { margin: 0; white-space: pre-wrap; }
	.vd-chat .me { background: color-mix(in oklch, var(--primary) 22%, transparent); justify-self: end; max-width: 92%; }
	.vd-chat .ai { background: var(--vd-ink); border: 1px solid var(--vd-line); }
	.vd-ask { display: flex; gap: 8px; }
	.vd-ask input {
		flex: 1; min-width: 0; height: 40px; border-radius: 10px;
		border: 1px solid var(--vd-line); background: var(--vd-ink); color: var(--vd-text);
		padding: 0 12px; font-size: 14px;
	}
	.vd-foot {
		display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
		padding: 10px 12px 12px; border-top: 1px solid var(--vd-line);
	}
	.vd-menu { position: relative; }
	.vd-menu-list {
		position: absolute; bottom: 46px; left: 0; min-width: 160px;
		background: #1a1218; border: 1px solid var(--vd-line); border-radius: 12px;
		padding: 6px; display: grid; z-index: 5;
	}
	.vd-menu-list button {
		text-align: left; border: 0; background: transparent; color: inherit;
		padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px;
	}
	.vd-menu-list button:hover { background: var(--vd-glow); }
	.vd-btn-main, .vd-btn-ghost {
		display: inline-flex; align-items: center; height: 40px;
		padding: 0 14px; border-radius: 10px; cursor: pointer; font-size: 13.5px; font-weight: 650;
	}
	.vd-btn-main {
		border: 0; color: #fff;
		background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 86%, white), var(--primary));
	}
	.vd-btn-main:disabled { opacity: 0.6; cursor: wait; }
	.vd-btn-ghost {
		color: #d3c4ce; background: transparent;
		border: 1px solid var(--vd-line);
	}
	.vd-present {
		position: fixed; inset: 0; z-index: 80;
		background: #0a070c;
		display: grid; place-items: center;
		padding: 48px 24px 32px;
		grid-template-rows: 1fr auto;
	}
	.vd-present-card {
		max-width: 920px; width: 100%;
		padding: 36px 40px;
		border-radius: 20px;
		border: 1px solid var(--vd-line);
		background: #161018;
	}
	.vd-present-card h3 { margin: 10px 0 14px; font-size: 32px; }
	.vd-present-card p, .vd-present-card li { font-size: 18px; line-height: 1.7; color: #d5d8e4; }
	.vd-present-x { position: absolute; top: 16px; right: 16px; }
	@media (max-width: 1100px) {
		.vd-body { grid-template-columns: 1fr; }
		.vd-lib, .vd-stage { position: static; max-height: none; }
		.vd-flash, .vd-know { grid-template-columns: 1fr 1fr; }
		.vd-preview { grid-template-columns: 1fr; min-height: 0; }
		.vd-preview-player { min-height: 160px; }
	}
	@media (max-width: 720px) {
		.vd-flash, .vd-know { grid-template-columns: 1fr; }
		.vd-board { min-height: 0; }
		.vd-app { padding: 0.6rem 0.7rem 0; }
		.vd-hero { padding-top: 1.2rem; }
		.vd-hero-form { border-radius: 18px; }
	}
</style>
