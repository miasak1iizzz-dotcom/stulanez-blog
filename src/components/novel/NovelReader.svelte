<script lang="ts">
import { onMount } from "svelte";

interface NovelChapter {
	id: string;
	index: number;
	volume: string;
	label: string;
	title: string;
	fullTitle: string;
	charCount: number;
	paragraphs: string[];
}

interface NovelData {
	title: string;
	author: string;
	volumeCount: number;
	chapterCount: number;
	paragraphCount: number;
	totalCharCount: number;
	readingMinutes: number;
	volumes: string[];
	chapters: NovelChapter[];
}

interface SearchResult {
	chapterIndex: number;
	chapter: NovelChapter;
	snippet: string;
	matchCount: number;
}

interface Props {
	novel: NovelData;
	novelId?: string;
}

const { novel, novelId = "novel" }: Props = $props();

let readerElement: HTMLElement;
let currentIndex = $state(0);
let drawerOpen = $state(false);
let fontScale = $state(1);
let lineHeight = $state(1.95);
let searchQuery = $state("");
let savedProgressIndex = $state<number | null>(null);
let showResumePrompt = $state(false);

const currentChapter = $derived(novel.chapters[currentIndex]);
const progress = $derived(((currentIndex + 1) / novel.chapterCount) * 100);
const currentVolumeIndex = $derived(
	Math.max(0, novel.volumes.indexOf(currentChapter.volume)) + 1,
);
const normalizedSearchQuery = $derived(
	searchQuery.trim().toLocaleLowerCase("zh-CN"),
);
const searchResults = $derived.by((): SearchResult[] => {
	if (!normalizedSearchQuery) return [];

	return novel.chapters.flatMap((chapter, chapterIndex) => {
		const heading = `${chapter.fullTitle} ${chapter.volume}`;
		const headingMatches = countMatches(heading, normalizedSearchQuery);
		let firstMatchingParagraph = "";
		let paragraphMatches = 0;

		for (const paragraph of chapter.paragraphs) {
			const matches = countMatches(paragraph, normalizedSearchQuery);
			if (matches > 0 && !firstMatchingParagraph) {
				firstMatchingParagraph = paragraph;
			}
			paragraphMatches += matches;
		}

		const matchCount = headingMatches + paragraphMatches;
		if (matchCount === 0) return [];

		return [
			{
				chapterIndex,
				chapter,
				snippet: firstMatchingParagraph
					? createSnippet(firstMatchingParagraph, normalizedSearchQuery)
					: `章节标题：${chapter.fullTitle}`,
				matchCount,
			},
		];
	});
});
const totalSearchMatches = $derived(
	searchResults.reduce((total, result) => total + result.matchCount, 0),
);
const resumeChapter = $derived(
	savedProgressIndex === null ? null : novel.chapters[savedProgressIndex],
);
const progressKey = `novel-progress:${novelId}`;
const displayKey = `novel-display:${novelId}`;

function countMatches(text: string, query: string) {
	if (!query) return 0;
	const normalizedText = text.toLocaleLowerCase("zh-CN");
	let count = 0;
	let offset = 0;

	while (offset < normalizedText.length) {
		const index = normalizedText.indexOf(query, offset);
		if (index < 0) break;
		count += 1;
		offset = index + query.length;
	}

	return count;
}

function createSnippet(text: string, query: string) {
	const normalizedText = text.toLocaleLowerCase("zh-CN");
	const matchIndex = normalizedText.indexOf(query);
	if (matchIndex < 0) return text.slice(0, 78);

	const start = Math.max(0, matchIndex - 28);
	const end = Math.min(text.length, matchIndex + query.length + 46);
	return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function highlightSegments(text: string) {
	if (!normalizedSearchQuery) return [{ text, match: false }];
	const normalizedText = text.toLocaleLowerCase("zh-CN");
	const segments: { text: string; match: boolean }[] = [];
	let offset = 0;

	while (offset < text.length) {
		const index = normalizedText.indexOf(normalizedSearchQuery, offset);
		if (index < 0) {
			segments.push({ text: text.slice(offset), match: false });
			break;
		}
		if (index > offset) {
			segments.push({ text: text.slice(offset, index), match: false });
		}
		segments.push({
			text: text.slice(index, index + normalizedSearchQuery.length),
			match: true,
		});
		offset = index + normalizedSearchQuery.length;
	}

	return segments;
}

function portal(node: HTMLElement) {
	const previousOverflow = document.body.style.overflow;
	document.body.appendChild(node);
	document.body.style.overflow = "hidden";

	return {
		destroy() {
			document.body.style.overflow = previousOverflow;
			node.remove();
		},
	};
}

function persistDisplay() {
	localStorage.setItem(displayKey, JSON.stringify({ fontScale, lineHeight }));
}

function changeFont(delta: number) {
	fontScale = Math.min(1.2, Math.max(0.9, fontScale + delta));
	persistDisplay();
}

function toggleLineHeight() {
	lineHeight = lineHeight === 1.95 ? 2.2 : 1.95;
	persistDisplay();
}

function goToChapter(index: number, shouldScroll = true) {
	const nextIndex = Math.min(novel.chapterCount - 1, Math.max(0, index));
	currentIndex = nextIndex;
	drawerOpen = false;

	const chapter = novel.chapters[nextIndex];
	localStorage.setItem(progressKey, String(nextIndex));
	savedProgressIndex = nextIndex;
	showResumePrompt = false;
	history.replaceState(
		null,
		"",
		`${location.pathname}${location.search}#${chapter.id}`,
	);

	if (shouldScroll) {
		requestAnimationFrame(() => {
			readerElement?.scrollIntoView({
				behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
					? "auto"
					: "smooth",
				block: "start",
			});
		});
	}
}

function resumeReading() {
	if (savedProgressIndex === null) return;
	goToChapter(savedProgressIndex);
}

function resetProgress() {
	localStorage.setItem(progressKey, "0");
	savedProgressIndex = 0;
	showResumePrompt = false;
	goToChapter(0);
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && drawerOpen) {
		drawerOpen = false;
		return;
	}

	const target = event.target as HTMLElement | null;
	if (target?.matches("input, textarea, select, button, a")) return;

	if (event.key === "ArrowLeft" && currentIndex > 0) {
		goToChapter(currentIndex - 1);
	}
	if (event.key === "ArrowRight" && currentIndex < novel.chapterCount - 1) {
		goToChapter(currentIndex + 1);
	}
}

onMount(() => {
	const hash = location.hash.slice(1);
	const hashIndex = novel.chapters.findIndex((chapter) => chapter.id === hash);
	const savedIndex = Number.parseInt(
		localStorage.getItem(progressKey) || "",
		10,
	);
	const hasSavedIndex =
		Number.isInteger(savedIndex) &&
		savedIndex >= 0 &&
		savedIndex < novel.chapterCount;
	const initialIndex = hashIndex >= 0 ? hashIndex : 0;

	const savedDisplay = localStorage.getItem(displayKey);
	if (savedDisplay) {
		try {
			const parsed = JSON.parse(savedDisplay) as {
				fontScale?: number;
				lineHeight?: number;
			};
			if (
				parsed.fontScale &&
				parsed.fontScale >= 0.9 &&
				parsed.fontScale <= 1.2
			) {
				fontScale = parsed.fontScale;
			}
			if (parsed.lineHeight === 1.95 || parsed.lineHeight === 2.2) {
				lineHeight = parsed.lineHeight;
			}
		} catch {
			localStorage.removeItem(displayKey);
		}
	}

	currentIndex = initialIndex;
	savedProgressIndex = hasSavedIndex ? savedIndex : null;
	showResumePrompt = hashIndex < 0 && hasSavedIndex && savedIndex > 0;
	window.addEventListener("keydown", handleKeydown);
	return () => window.removeEventListener("keydown", handleKeydown);
});
</script>

<article
	class="novel-reader"
	bind:this={readerElement}
	style={`--reader-font-scale:${fontScale};--reader-line-height:${lineHeight}`}
>
	<header class="novel-hero">
		<div class="hero-orbit" aria-hidden="true"></div>
		<div class="hero-content">
			<p class="hero-kicker">原创科幻小说</p>
			<h2>{novel.title}</h2>
			<p class="hero-author">{novel.author} 著</p>
			<div class="hero-stats" aria-label="作品统计">
				<span>{novel.volumeCount} 卷</span>
				<span>{novel.chapterCount} 章</span>
				<span>{novel.totalCharCount.toLocaleString("zh-CN")} 字</span>
				<span>约 {novel.readingMinutes} 分钟</span>
			</div>
		</div>
	</header>

	{#if showResumePrompt && resumeChapter}
		<section class="resume-card" aria-label="继续上次阅读">
			<div class="resume-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24">
					<path d="M6 4.5A2.5 2.5 0 0 1 8.5 2H19v16H8.5A2.5 2.5 0 0 0 6 20.5z" />
					<path d="M6 4.5v16A2.5 2.5 0 0 1 8.5 18H19" />
				</svg>
			</div>
			<div class="resume-copy">
				<p>上次读到第 {savedProgressIndex === null ? 1 : savedProgressIndex + 1} 章</p>
				<strong>{resumeChapter.fullTitle}</strong>
				<span>全书进度 {Math.round(((resumeChapter.index + 1) / novel.chapterCount) * 100)}%</span>
			</div>
			<div class="resume-actions">
				<button type="button" class="secondary" onclick={resetProgress}>从头开始</button>
				<button type="button" class="primary" onclick={resumeReading}>继续阅读</button>
			</div>
		</section>
	{/if}

	<div class="reader-toolbar" aria-label="阅读工具">
		<button class="toolbar-button primary" type="button" onclick={() => (drawerOpen = true)}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 6h16M4 12h16M4 18h10" />
			</svg>
			目录
		</button>

		<label class="chapter-select">
			<span class="sr-only">选择章节</span>
			<select
				value={currentIndex}
				onchange={(event) =>
					goToChapter(Number.parseInt(event.currentTarget.value, 10))}
			>
				{#each novel.chapters as chapter, index}
					<option value={index}>{chapter.fullTitle}</option>
				{/each}
			</select>
		</label>

		<div class="display-tools" aria-label="排版设置">
			<button type="button" onclick={() => changeFont(-0.1)} disabled={fontScale <= 0.9} aria-label="减小字号">
				A−
			</button>
			<button type="button" onclick={() => changeFont(0.1)} disabled={fontScale >= 1.2} aria-label="增大字号">
				A+
			</button>
			<button type="button" onclick={toggleLineHeight} aria-label="切换行距" aria-pressed={lineHeight === 2.2}>
				行距
			</button>
		</div>
	</div>

	<div class="reading-progress" aria-label={`阅读进度 ${Math.round(progress)}%`}>
		<div class="progress-copy">
			<span>第 {currentIndex + 1} / {novel.chapterCount} 章</span>
			<span>{Math.round(progress)}%</span>
		</div>
		<div class="progress-track">
			<div class="progress-value" style={`width:${progress}%`}></div>
		</div>
	</div>

	<section class="chapter-view" id={currentChapter.id} aria-labelledby="chapter-title">
		<div class="chapter-heading">
			<p class="volume-label">第 {currentVolumeIndex} 卷 · {currentChapter.volume.replace(/^第.+?卷[：:]/, "")}</p>
			<h3 id="chapter-title">{currentChapter.fullTitle}</h3>
			<p class="chapter-meta">{currentChapter.charCount.toLocaleString("zh-CN")} 字</p>
		</div>

		<div class="chapter-prose">
			{#each currentChapter.paragraphs as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	</section>

	<nav class="chapter-navigation" aria-label="章节翻页">
		<button
			type="button"
			onclick={() => goToChapter(currentIndex - 1)}
			disabled={currentIndex === 0}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
			<span><small>上一章</small>{currentIndex > 0 ? novel.chapters[currentIndex - 1].title : "已经是开篇"}</span>
		</button>

		<button
			type="button"
			onclick={() => goToChapter(currentIndex + 1)}
			disabled={currentIndex === novel.chapterCount - 1}
		>
			<span><small>下一章</small>{currentIndex < novel.chapterCount - 1 ? novel.chapters[currentIndex + 1].title : "全书已读完"}</span>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
		</button>
	</nav>

	<nav class="page-strip" aria-label="章节页码">
		{#each novel.chapters as chapter, index}
			<button
				type="button"
				class:active={index === currentIndex}
				onclick={() => goToChapter(index)}
				aria-label={`第 ${index + 1} 页：${chapter.fullTitle}`}
				aria-current={index === currentIndex ? "page" : undefined}
				title={chapter.fullTitle}
			>
				{index + 1}
			</button>
		{/each}
	</nav>

	<p class="keyboard-hint">桌面端可使用键盘 ← → 切换章节，阅读位置会保存在当前浏览器。</p>
</article>

{#if drawerOpen}
	<div use:portal class="drawer-backdrop" role="presentation" onclick={() => (drawerOpen = false)}>
		<aside
			class="chapter-drawer"
			role="dialog"
			aria-modal="true"
			aria-label={`${novel.title}章节目录`}
			onclick={(event) => event.stopPropagation()}
		>
			<header>
				<div>
					<p>章节目录</p>
					<strong>{novel.title}</strong>
				</div>
				<button type="button" onclick={() => (drawerOpen = false)} aria-label="关闭目录">
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
				</button>
			</header>

			<div class="drawer-search" role="search">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="11" cy="11" r="7" />
					<path d="m16 16 4 4" />
				</svg>
				<input
					type="search"
					aria-label="搜索全书"
					placeholder="搜索章节标题或正文"
					bind:value={searchQuery}
					autocomplete="off"
				/>
				{#if searchQuery}
					<button type="button" onclick={() => (searchQuery = "")} aria-label="清空搜索">
						清空
					</button>
				{/if}
			</div>

			<div class="drawer-content">
				{#if normalizedSearchQuery}
					<section class="search-results" aria-live="polite">
						<div class="search-summary">
							<strong>{searchResults.length} 个章节</strong>
							<span>共 {totalSearchMatches} 处命中</span>
						</div>
						{#if searchResults.length > 0}
							<div class="search-result-list">
								{#each searchResults as result}
									<button type="button" onclick={() => goToChapter(result.chapterIndex)}>
										<span class="search-result-meta">
											第 {result.chapterIndex + 1} 章 · {result.matchCount} 处
										</span>
										<strong>{result.chapter.fullTitle}</strong>
										<small>
											{#each highlightSegments(result.snippet) as segment}
												{#if segment.match}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
											{/each}
										</small>
									</button>
								{/each}
							</div>
						{:else}
							<div class="empty-search">
								<strong>没有找到“{searchQuery.trim()}”</strong>
								<span>可以试试人物名、地点或更短的关键词。</span>
							</div>
						{/if}
					</section>
				{:else}
					{#each novel.volumes as volume, volumeIndex}
						<section>
							<h3><span>{String(volumeIndex + 1).padStart(2, "0")}</span>{volume}</h3>
							<div class="drawer-chapters">
								{#each novel.chapters as chapter, index}
									{#if chapter.volume === volume}
										<button
											type="button"
											class:active={index === currentIndex}
											onclick={() => goToChapter(index)}
											aria-current={index === currentIndex ? "page" : undefined}
										>
											<span>{String(index + 1).padStart(2, "0")}</span>
											{chapter.fullTitle}
										</button>
									{/if}
								{/each}
							</div>
						</section>
					{/each}
				{/if}
			</div>

			<footer class="drawer-progress">
				<div>
					<span>本机阅读记录</span>
					<strong>{resumeChapter ? `第 ${resumeChapter.index + 1} 章 · ${resumeChapter.title}` : "尚未开始"}</strong>
				</div>
				<button
					type="button"
					onclick={resetProgress}
					disabled={savedProgressIndex === null || savedProgressIndex === 0}
				>
					从头阅读
				</button>
			</footer>
		</aside>
	</div>
{/if}

<style>
	.novel-reader {
		--reader-border: color-mix(in srgb, var(--primary) 18%, var(--line-divider));
		position: relative;
		display: block;
		width: 100%;
		scroll-margin-top: 5.5rem;
		color: inherit;
	}

	.novel-hero {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		min-height: 18rem;
		margin: 0 0 1rem;
		padding: clamp(2rem, 7vw, 4.5rem);
		border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
		border-radius: 1.5rem;
		background:
			radial-gradient(circle at 82% 18%, color-mix(in srgb, var(--primary) 45%, transparent) 0 1px, transparent 2px),
			radial-gradient(circle at 72% 72%, rgb(255 255 255 / 60%) 0 1px, transparent 2px),
			linear-gradient(135deg, color-mix(in srgb, var(--primary) 38%, #17152b), #11131f 68%);
		background-size: 74px 74px, 96px 96px, auto;
		color: white;
	}

	.hero-content {
		position: relative;
		z-index: 2;
		max-width: 42rem;
	}

	.hero-orbit {
		position: absolute;
		z-index: 1;
		top: 50%;
		right: clamp(-7rem, -4vw, -2rem);
		width: clamp(15rem, 36vw, 25rem);
		aspect-ratio: 1;
		border: 1px solid rgb(255 255 255 / 24%);
		border-radius: 50%;
		transform: translateY(-50%) rotate(-18deg);
	}

	.hero-orbit::before,
	.hero-orbit::after {
		content: "";
		position: absolute;
		inset: 16%;
		border: 1px solid rgb(255 255 255 / 16%);
		border-radius: 50%;
	}

	.hero-orbit::after {
		inset: 42%;
		border: 0;
		background: color-mix(in srgb, var(--primary) 75%, white);
	}

	.hero-kicker,
	.hero-author,
	.hero-stats,
	.volume-label,
	.chapter-meta,
	.keyboard-hint {
		margin: 0;
	}

	.hero-kicker {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.24em;
		opacity: 0.72;
	}

	.novel-hero h2 {
		margin: 0.5rem 0 0.35rem;
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: clamp(2.5rem, 8vw, 5rem);
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: 0.12em;
		color: white;
	}

	.hero-author {
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: 1rem;
		letter-spacing: 0.16em;
		opacity: 0.8;
	}

	.hero-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 2.4rem;
	}

	.hero-stats span {
		padding: 0.35rem 0.7rem;
		border: 1px solid rgb(255 255 255 / 18%);
		border-radius: 999px;
		background: rgb(0 0 0 / 14%);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
	}

	.resume-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.9rem;
		align-items: center;
		margin: 0 0 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--line-divider));
		border-radius: 1rem;
		background: color-mix(in srgb, var(--primary) 7%, var(--card-bg));
	}

	.resume-icon {
		display: grid;
		width: 2.7rem;
		height: 2.7rem;
		place-items: center;
		border-radius: 0.8rem;
		background: var(--primary);
		color: white;
	}

	.resume-icon svg {
		width: 1.35rem;
		height: 1.35rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.7;
	}

	.resume-copy {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
	}

	.resume-copy p,
	.resume-copy strong,
	.resume-copy span {
		margin: 0;
	}

	.resume-copy p,
	.resume-copy span {
		color: var(--content-meta);
		font-size: 0.68rem;
	}

	.resume-copy strong {
		overflow: hidden;
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: 0.92rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.resume-actions {
		display: flex;
		gap: 0.45rem;
	}

	.resume-actions button {
		min-height: 2.45rem;
		padding: 0 0.85rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.72rem;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}

	.resume-actions button.primary {
		border-color: transparent;
		background: var(--primary);
		color: white;
	}

	.reader-toolbar {
		position: sticky;
		z-index: 20;
		top: 4.75rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.65rem;
		border: 1px solid var(--reader-border);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--card-bg) 90%, transparent);
		backdrop-filter: blur(16px);
	}

	.reader-toolbar button,
	.reader-toolbar select,
	.chapter-navigation button,
	.page-strip button,
	.chapter-drawer button {
		font: inherit;
	}

	.toolbar-button,
	.display-tools button {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		cursor: pointer;
	}

	.toolbar-button {
		gap: 0.35rem;
		padding: 0 0.85rem;
		font-weight: 700;
	}

	.toolbar-button.primary {
		border-color: transparent;
		background: var(--primary);
		color: white;
	}

	.toolbar-button svg,
	.chapter-navigation svg,
	.chapter-drawer header button svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}

	.chapter-select {
		min-width: 0;
	}

	.chapter-select select {
		width: 100%;
		min-height: 2.5rem;
		padding: 0 2.1rem 0 0.75rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: var(--card-bg);
		color: inherit;
		font-size: 0.85rem;
		text-overflow: ellipsis;
		cursor: pointer;
	}

	.display-tools {
		display: flex;
		gap: 0.35rem;
	}

	.display-tools button {
		min-width: 2.5rem;
		padding: 0 0.65rem;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.display-tools button:disabled,
	.chapter-navigation button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.reading-progress {
		margin: 1.2rem 0 0;
	}

	.progress-copy {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.35rem;
		color: var(--content-meta);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	.progress-track {
		height: 0.22rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--primary) 12%, var(--line-divider));
	}

	.progress-value {
		height: 100%;
		border-radius: inherit;
		background: var(--primary);
		transition: width 300ms ease;
	}

	.chapter-view {
		max-width: 47rem;
		min-height: 42rem;
		margin: 0 auto;
		padding: clamp(3rem, 8vw, 5.5rem) clamp(0.4rem, 4vw, 2.8rem);
	}

	.chapter-heading {
		margin-bottom: 3rem;
		text-align: center;
	}

	.volume-label {
		color: var(--primary);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.13em;
	}

	.chapter-heading h3 {
		margin: 0.7rem 0 0.45rem;
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: clamp(1.75rem, 5vw, 2.5rem);
		line-height: 1.3;
		color: inherit;
	}

	.chapter-meta {
		color: var(--content-meta);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
	}

	.chapter-prose {
		font-family: "Noto Serif SC", "Songti SC", "STSong", serif;
		font-size: calc(1.08rem * var(--reader-font-scale));
		line-height: var(--reader-line-height);
		letter-spacing: 0.035em;
		color: inherit;
	}

	.chapter-prose p {
		margin: 0 0 1.45em;
		text-align: justify;
		text-indent: 2em;
		text-wrap: pretty;
	}

	.chapter-prose p:first-child::first-letter {
		color: var(--primary);
		font-size: 1.35em;
		font-weight: 700;
	}

	.chapter-navigation {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0 0 1.2rem;
	}

	.chapter-navigation button {
		display: flex;
		min-height: 4.6rem;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--reader-border);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--primary) 4%, var(--card-bg));
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: border-color 160ms ease, transform 160ms ease;
	}

	.chapter-navigation button:last-child {
		justify-content: flex-end;
		text-align: right;
	}

	.chapter-navigation button:not(:disabled):hover {
		border-color: color-mix(in srgb, var(--primary) 50%, var(--line-divider));
		transform: translateY(-1px);
	}

	.chapter-navigation span {
		display: grid;
		gap: 0.18rem;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.chapter-navigation small {
		color: var(--content-meta);
		font-size: 0.66rem;
		font-weight: 500;
	}

	.page-strip {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}

	.page-strip button {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.55rem;
		background: var(--btn-regular-bg);
		color: var(--content-meta);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.page-strip button.active {
		border-color: var(--primary);
		background: var(--primary);
		color: white;
		font-weight: 800;
	}

	.keyboard-hint {
		margin-top: 1rem;
		color: var(--content-meta);
		font-size: 0.68rem;
		text-align: center;
	}

	.drawer-backdrop {
		position: fixed;
		z-index: 1200;
		inset: 0;
		display: flex;
		justify-content: flex-start;
		background: rgb(0 0 0 / 52%);
		backdrop-filter: blur(4px);
	}

	.chapter-drawer {
		display: flex;
		width: min(92vw, 28rem);
		height: 100%;
		flex-direction: column;
		border-right: 1px solid var(--line-divider);
		background: var(--card-bg);
		color: inherit;
		animation: drawer-in 180ms ease-out;
	}

	.chapter-drawer > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.2rem 1.25rem;
		border-bottom: 1px solid var(--line-divider);
	}

	.chapter-drawer header p,
	.chapter-drawer header strong {
		display: block;
		margin: 0;
	}

	.chapter-drawer header p {
		color: var(--content-meta);
		font-size: 0.68rem;
	}

	.chapter-drawer header strong {
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: 1.25rem;
	}

	.chapter-drawer header button {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		cursor: pointer;
	}

	.drawer-search {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: center;
		margin: 0.85rem 1rem 0;
		padding: 0 0.7rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.78rem;
		background: color-mix(in srgb, var(--primary) 4%, var(--btn-regular-bg));
	}

	.drawer-search > svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: var(--content-meta);
		stroke-linecap: round;
		stroke-width: 1.8;
	}

	.drawer-search input {
		min-width: 0;
		height: 2.65rem;
		border: 0;
		outline: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.8rem;
	}

	.drawer-search input::placeholder {
		color: var(--content-meta);
	}

	.chapter-drawer .drawer-search button {
		padding: 0.25rem;
		border: 0;
		background: transparent;
		color: var(--primary);
		font-size: 0.68rem;
		cursor: pointer;
	}

	.drawer-content {
		overflow-y: auto;
		padding: 1.1rem 1rem 3rem;
	}

	.drawer-content section + section {
		margin-top: 1.5rem;
	}

	.drawer-content h3 {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0 0 0.55rem;
		font-size: 0.82rem;
		color: inherit;
	}

	.drawer-content h3 span {
		color: var(--primary);
		font-size: 0.65rem;
		font-variant-numeric: tabular-nums;
	}

	.search-summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.65rem;
	}

	.search-summary strong {
		font-size: 0.82rem;
	}

	.search-summary span {
		color: var(--content-meta);
		font-size: 0.66rem;
	}

	.search-result-list {
		display: grid;
		gap: 0.45rem;
	}

	.search-result-list button {
		display: grid;
		gap: 0.26rem;
		width: 100%;
		padding: 0.75rem 0.8rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.78rem;
		background: color-mix(in srgb, var(--primary) 3%, var(--card-bg));
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.search-result-list button:hover {
		border-color: color-mix(in srgb, var(--primary) 48%, var(--line-divider));
	}

	.search-result-list strong {
		font-family: "Noto Serif SC", "Songti SC", serif;
		font-size: 0.82rem;
	}

	.search-result-list small {
		display: -webkit-box;
		overflow: hidden;
		color: var(--content-meta);
		font-size: 0.7rem;
		line-height: 1.55;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.search-result-list mark {
		border-radius: 0.18rem;
		background: color-mix(in srgb, var(--primary) 24%, transparent);
		color: var(--primary);
	}

	.search-result-meta {
		color: var(--primary);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
	}

	.empty-search {
		display: grid;
		gap: 0.35rem;
		padding: 2rem 0.8rem;
		color: var(--content-meta);
		text-align: center;
	}

	.empty-search strong {
		color: inherit;
		font-size: 0.82rem;
	}

	.empty-search span {
		font-size: 0.7rem;
	}

	.drawer-chapters {
		display: grid;
		gap: 0.25rem;
	}

	.drawer-chapters button {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: var(--content-meta);
		font-size: 0.78rem;
		text-align: left;
		cursor: pointer;
	}

	.drawer-chapters button:hover,
	.drawer-chapters button.active {
		background: color-mix(in srgb, var(--primary) 10%, transparent);
		color: var(--primary);
	}

	.drawer-chapters button span {
		width: 1.7rem;
		color: var(--content-meta);
		font-size: 0.62rem;
		font-variant-numeric: tabular-nums;
	}

	.drawer-progress {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--line-divider);
		background: color-mix(in srgb, var(--primary) 4%, var(--card-bg));
	}

	.drawer-progress div {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
	}

	.drawer-progress span {
		color: var(--content-meta);
		font-size: 0.62rem;
	}

	.drawer-progress strong {
		overflow: hidden;
		font-size: 0.72rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.drawer-progress button {
		flex: 0 0 auto;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.62rem;
		background: var(--btn-regular-bg);
		color: var(--btn-content);
		font-size: 0.68rem;
		cursor: pointer;
	}

	.drawer-progress button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes drawer-in {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@media (max-width: 720px) {
		.novel-hero {
			min-height: 15rem;
			padding: 2rem 1.35rem;
		}

		.reader-toolbar {
			top: 4.3rem;
			grid-template-columns: auto minmax(0, 1fr);
		}

		.resume-card {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.resume-actions {
			grid-column: 1 / -1;
			justify-content: flex-end;
		}

		.display-tools {
			grid-column: 1 / -1;
			justify-content: flex-end;
		}

		.display-tools button {
			min-height: 2.25rem;
		}

		.chapter-view {
			min-height: 36rem;
			padding: 3.2rem 0.25rem;
		}

		.chapter-prose {
			font-size: calc(1rem * var(--reader-font-scale));
			letter-spacing: 0.02em;
		}

		.chapter-navigation {
			grid-template-columns: 1fr;
		}

		.chapter-navigation button:last-child {
			justify-content: space-between;
			text-align: left;
		}

		.page-strip {
			gap: 0.3rem;
		}

		.page-strip button {
			width: 2.15rem;
			height: 2.15rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-value,
		.chapter-navigation button,
		.chapter-drawer {
			transition: none;
			animation: none;
		}
	}
</style>
