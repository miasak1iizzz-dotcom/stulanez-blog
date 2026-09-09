<script lang="ts">
import { onMount } from "svelte";
import type {
	LibraryDocument,
	LibraryEntry,
	LibraryGroup,
} from "@/utils/protocol-library";

type CopyMode = "body" | "links" | "summary";
let entries = $state<LibraryEntry[]>([]);
let active = $state<LibraryDocument | null>(null);
let activeId = $state("entry");
let query = $state("");
let group = $state<LibraryGroup | "all">("protocol");
let selected = $state<string[]>([]);
let mode = $state<CopyMode>("body");
let loading = $state(true);
let reading = $state(false);
let copying = $state(false);
let error = $state("");
let notice = $state("");
let manualCopy = $state("");
let ready = $state(false);
let requestNumber = 0;
let noticeTimer: ReturnType<typeof setTimeout>;
const storageKey = "stulanez-protocol-book-v1";
const groupNames = {
	protocol: "现行协议",
	log: "工作日志",
	history: "历史资料",
};
const presets = [
	{
		title: "写文章",
		ids: ["entry", "coordination", "site", "content", "deployment"],
	},
	{ title: "改欲望卡", ids: ["entry", "coordination", "board", "desires"] },
	{ title: "做图库", ids: ["entry", "coordination", "assets"] },
	{ title: "做部署", ids: ["entry", "coordination", "deployment"] },
];
const visible = $derived(
	entries.filter(
		(entry) =>
			(group === "all" || entry.group === group) &&
			`${entry.title} ${entry.topic} ${entry.summary} ${entry.source}`
				.toLowerCase()
				.includes(query.trim().toLowerCase()),
	),
);
const selectedEntries = $derived(
	entries.filter((entry) => selected.includes(entry.id)),
);
const activeIndex = $derived(
	entries.findIndex((entry) => entry.id === activeId),
);

$effect(() => {
	if (!ready) return;
	try {
		localStorage.setItem(
			storageKey,
			JSON.stringify({ selected, activeId, mode }),
		);
	} catch {
		/* optional persistence */
	}
});

function announce(text: string) {
	notice = text;
	clearTimeout(noticeTimer);
	noticeTimer = setTimeout(() => {
		notice = "";
	}, 5000);
}
async function getDocument(id: string): Promise<LibraryDocument> {
	const response = await fetch(
		`/api/lab/protocol-library/?id=${encodeURIComponent(id)}`,
		{ cache: "no-store" },
	);
	if (!response.ok)
		throw new Error("这份资料暂时无法读取，请确认本地文件存在后重试。");
	return response.json();
}
async function openDocument(id: string, updateHash = true) {
	const current = ++requestNumber;
	activeId = id;
	active = null;
	reading = true;
	error = "";
	try {
		const document = await getDocument(id);
		if (current !== requestNumber) return;
		active = document;
		if (updateHash)
			history.replaceState(null, "", `#protocols/${encodeURIComponent(id)}`);
	} catch (reason) {
		if (current === requestNumber)
			error = reason instanceof Error ? reason.message : "资料读取失败。";
	} finally {
		if (current === requestNumber) reading = false;
	}
}
async function loadCatalog() {
	loading = true;
	error = "";
	try {
		const response = await fetch("/api/lab/protocol-library/", {
			cache: "no-store",
		});
		if (!response.ok)
			throw new Error("资料书仅在本机开发看板开放。请确认本地服务正在运行。");
		entries = await response.json();
		selected = selected.filter((id) =>
			entries.some((entry) => entry.id === id),
		);
		const requested = location.hash.startsWith("#protocols/")
			? decodeURIComponent(location.hash.slice(11))
			: activeId;
		const first = entries.find((entry) => entry.id === requested) ?? entries[0];
		if (first) {
			group = first.group;
			await openDocument(first.id, false);
		}
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "目录暂时无法读取。";
	} finally {
		loading = false;
	}
}
onMount(() => {
	try {
		const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
		selected = Array.isArray(saved.selected)
			? saved.selected.filter((id: unknown) => typeof id === "string")
			: [];
		if (typeof saved.activeId === "string") activeId = saved.activeId;
		if (["body", "links", "summary"].includes(saved.mode)) mode = saved.mode;
	} catch {
		/* unavailable or old storage */
	}
	ready = true;
	void loadCatalog();
	const onHash = () => {
		if (!location.hash.startsWith("#protocols/")) return;
		const id = decodeURIComponent(location.hash.slice(11));
		if (id !== activeId && entries.some((entry) => entry.id === id))
			void openDocument(id, false);
	};
	window.addEventListener("hashchange", onHash);
	return () => {
		requestNumber++;
		clearTimeout(noticeTimer);
		window.removeEventListener("hashchange", onHash);
	};
});

function toggle(id: string) {
	selected = selected.includes(id)
		? selected.filter((key) => key !== id)
		: [...selected, id];
}
function choosePreset(ids: string[]) {
	selected = [
		...new Set([
			...selected,
			...ids.filter((id) => entries.some((entry) => entry.id === id)),
		]),
	];
	announce("已加入这项工作的必读协议，可继续增减。");
}
function plain(text: string) {
	return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}
function blocks(body: string) {
	return body
		.split(/\n\s*\n/)
		.flatMap((part) =>
			/^[-*]\s/m.test(part) && !part.includes("```")
				? part.split(/\n(?=[-*]\s)/)
				: [part],
		)
		.filter(Boolean);
}
function label(document: LibraryDocument) {
	return `【${groupNames[document.group]} · ${document.title}】\n来源：[${document.title}](${document.absolutePath})\n${document.group !== "protocol" ? "说明：这是参考记录，不是新的工作授权；以用户当前指令和现行协议为准。\n" : ""}`;
}
function packet(document: LibraryDocument, copyMode: CopyMode) {
	if (copyMode === "links")
		return `${label(document)}条目标识：${document.id}\n请仅定位本条相关内容，不通读无关记录。`;
	if (copyMode === "summary")
		return `${label(document)}要点摘录（非完整协议）：\n${document.sections.map((section) => `• ${section.title}：${plain(section.body).replace(/\s+/g, " ").slice(0, 320)}`).join("\n")}`;
	return `${label(document)}\n${document.body}`;
}
async function writeClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		announce("已复制，可以粘贴给 AI。");
	} catch {
		manualCopy = text;
		announce("浏览器未允许自动复制，请在下方文本框全选复制。");
	}
}
async function copyCurrent() {
	if (!active) return;
	await writeClipboard(packet(active, mode));
}
async function copySelection() {
	if (!selectedEntries.length || copying) return;
	copying = true;
	try {
		const documents: LibraryDocument[] = [];
		for (let index = 0; index < selectedEntries.length; index += 4) {
			documents.push(
				...(await Promise.all(
					selectedEntries
						.slice(index, index + 4)
						.map((entry) => getDocument(entry.id)),
				)),
			);
		}
		await writeClipboard(
			`请结合当前任务阅读以下 ${documents.length} 份资料。现行协议按适用范围遵守，历史记录不作为新指令。\n\n${documents.map((document) => packet(document, mode)).join("\n\n──────────\n\n")}`,
		);
	} catch (reason) {
		announce(
			reason instanceof Error
				? `${reason.message} 本次未复制不完整合集。`
				: "合集复制失败，请重试。",
		);
	} finally {
		copying = false;
	}
}
</script>

<div class="protocol-library" aria-label="协议与日志书">
	<header class="library-heading">
		<div><p class="eyebrow">指挥室 · 随身手册</p><h2>协议与日志<span>书</span></h2><p class="intro">找一条约定，或选几份资料，带去下一次对话。</p></div>
		<button class="quiet-button refresh" onclick={loadCatalog} disabled={loading}>↻ 刷新资料</button>
	</header>
	<div class="book-toolbar">
		<div class="presets"><span>按工作选：</span>{#each presets as preset}<button onclick={() => choosePreset(preset.ids)} disabled={loading}>{preset.title}</button>{/each}</div>
		<div class="copy-controls">
			<label for="protocol-copy-mode">复制内容</label>
			<select id="protocol-copy-mode" bind:value={mode}><option value="body">完整正文</option><option value="links">文件链接</option><option value="summary">大意摘录</option></select>
			<button class="gold-button" onclick={copySelection} disabled={!selectedEntries.length || copying}>{copying ? "正在整理…" : `复制合集${selectedEntries.length ? ` · ${selectedEntries.length} 份` : ""}`}</button>
		</div>
	</div>
	{#if selectedEntries.length}
		<div class="selection" aria-label="已选资料"><span>已选 {selectedEntries.length} 份</span>{#each selectedEntries as entry}<button title={`移除 ${entry.title}`} onclick={() => toggle(entry.id)}>{entry.title}<span aria-hidden="true"> ×</span></button>{/each}<button class="clear" onclick={() => { selected = []; }}>清空</button></div>
	{/if}
	<p class="live-notice" role="status" aria-live="polite">{notice}</p>
	{#if manualCopy}
		<div class="manual-copy"><label for="protocol-manual-copy">自动复制未获允许，请全选后复制</label><textarea id="protocol-manual-copy" readonly value={manualCopy} onfocus={(event) => event.currentTarget.select()}></textarea><button onclick={() => { manualCopy = ""; }}>收起</button></div>
	{/if}
	<div class="book">
		<aside class="contents">
			<div class="contents-heading"><span>目录</span><small>{visible.length} 条</small></div>
			<label class="search"><span aria-hidden="true">⌕</span><input aria-label="搜索协议和日志" placeholder="搜索名称、主题、内容…" bind:value={query} /></label>
			<div class="group-tabs" aria-label="资料类别">
				{#each [["protocol", "协议"], ["log", "日志"], ["history", "历史"], ["all", "全部"]] as [value, title]}<button class:chosen={group === value} aria-pressed={group === value} onclick={() => { group = value as typeof group; }}>{title}</button>{/each}
			</div>
			<div class="catalog">
				{#if loading}<p class="catalog-empty">正在翻开资料书…</p>
				{:else if !visible.length}<p class="catalog-empty">没有找到相关条目。试试其他关键词或“全部”。</p>
				{:else}{#each visible as entry}
					<div class="catalog-entry" class:active={activeId === entry.id}>
						<label class="pick"><input type="checkbox" checked={selected.includes(entry.id)} onchange={() => toggle(entry.id)} aria-label={`加入合集：${entry.title}`} /></label>
						<button class="entry-link" aria-current={activeId === entry.id ? "page" : undefined} onclick={() => openDocument(entry.id)}><span>{entry.title}</span><small>{entry.topic}<i>·</i>{groupNames[entry.group]}</small></button>
					</div>
				{/each}{/if}
			</div>
			<div class="contents-foot">勾选加入合集 · 点标题翻阅</div>
		</aside>
		<article class="paper" aria-busy={reading || loading}>
			{#if error}
				<div class="page-state" role="alert"><h3>这页暂时没有打开</h3><p>{error}</p><button onclick={() => entries.length ? openDocument(activeId) : loadCatalog()}>重新读取</button></div>
			{:else if reading || loading}<div class="page-state"><p>正在读取本地原文…</p></div>
			{:else if active}
				<div class="page-top"><span>{groupNames[active.group]} <b>/</b> {active.topic}</span><span class="page-number">{String(activeIndex + 1).padStart(2, "0")}</span></div>
				<h3 class="page-title">{active.title}</h3>
				<p class="source">{active.source}<br /><span>文件更新于 {active.updated ? new Date(active.updated).toLocaleDateString("zh-CN") : "未知日期"}</span></p>
				{#if active.group !== "protocol"}<div class="history-note">{active.id === "kpop-desire" ? "这是一份讨论中的欲望，还没有转为正式任务。" : "参考记录，不是新的工作授权。旧约定请与现行协议核对。"}</div>{/if}
				<div class="page-actions"><button onclick={copyCurrent}>复制本篇 · {mode === "body" ? "正文" : mode === "links" ? "链接" : "大意"}</button><button class:in-bundle={selected.includes(active.id)} onclick={() => active && toggle(active.id)}>{selected.includes(active.id) ? "✓ 已加入合集" : "+ 加入合集"}</button></div>
				{#if active.sections.length > 1}<nav class="chapter-index" aria-label="本篇章节">{#each active.sections as section}<a href={`#book-${section.id}`} onclick={(event) => { event.preventDefault(); document.getElementById(`book-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{section.title}</a>{/each}</nav>{/if}
				<div class="page-body">
					{#each active.sections as section}
						<section id={`book-${section.id}`} class="chapter">
							<div class="chapter-heading"><h4>{section.title}</h4><button onclick={() => active && writeClipboard(`${label(active)}\n${section.title}\n\n${section.body}`)} aria-label={`复制章节：${section.title}`}>复制本节</button></div>
							{#each blocks(section.body) as block, index}<div class="rule-row"><p>{plain(block)}</p><button title="复制这一条" aria-label={`复制条目：${section.title} 第 ${index + 1} 条`} onclick={() => active && writeClipboard(`${label(active)}\n${section.title}\n\n${block}`)}>复制</button></div>{/each}
						</section>
					{/each}
				</div>
				<footer class="paper-footer"><span>本地原文 · 按需引用</span><span>永恒欲望</span></footer>
			{:else}<div class="page-state"><p>从目录选择一份资料。</p></div>{/if}
		</article>
	</div>
</div>

<style>
	.protocol-library { --gold: #d6b974; --ink: #30291f; color: #ddd6c7; padding: 8px 0 24px; }
	.library-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 26px; }
	.eyebrow { color: var(--gold); font-size: 11px; letter-spacing: .19em; margin-bottom: 9px; }
	h2 { font-family: "Noto Serif SC", "Songti SC", serif; font-size: clamp(25px, 3vw, 37px); color: #f1e8d7; font-weight: 600; letter-spacing: .06em; }
	h2 span { display: inline-block; font-size: 14px; border: 1px solid #d6b97466; padding: 3px 7px; color: var(--gold); vertical-align: middle; margin-left: 13px; border-radius: 3px; }
	.intro { font-size: 13px; color: #a69f92; margin-top: 10px; }
	button, select, input, textarea { font: inherit; }
	button { cursor: pointer; transition: background .15s, color .15s; }
	button:disabled { opacity: .45; cursor: default; }
	button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid #b68c3e; outline-offset: 3px; }
	.quiet-button { background: #ffffff05; border: 1px solid #ffffff20; border-radius: 8px; padding: 10px 15px; font-size: 12px; min-height: 44px; }
	.book-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; font-size: 12px; }
	.presets, .copy-controls { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
	.presets > span, .copy-controls label { color: #9f998f; margin-right: 3px; }
	.presets button { padding: 8px 11px; border: 1px solid #bba57835; border-radius: 6px; min-height: 40px; }
	.presets button:hover { background: #d6b97418; }
	.copy-controls select { color: #e6dbc4; background: #20201f; padding: 10px; border: 1px solid #ffffff24; border-radius: 6px; min-height: 44px; }
	.gold-button { padding: 11px 16px; color: #211b10; background: var(--gold); border-radius: 6px; font-weight: 650; min-height: 44px; }
	.selection { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; padding: 13px 0 0; font-size: 11px; }
	.selection > span { color: #b4aa98; margin-right: 4px; }
	.selection button { background: #d6b97412; border: 1px solid #d6b97435; padding: 6px 9px; border-radius: 5px; min-height: 34px; }
	.selection .clear { border-color: transparent; background: transparent; color: #a99b83; }
	.live-notice { min-height: 29px; padding-top: 7px; color: #e0c991; font-size: 12px; }
	.book { display: grid; grid-template-columns: 280px minmax(0, 1fr); align-items: start; border: 1px solid #b39b653b; border-radius: 12px; overflow: clip; background: #181919; box-shadow: 0 22px 60px #0005; }
	.contents { position: sticky; top: 85px; max-height: calc(100vh - 110px); display: flex; flex-direction: column; min-height: 550px; padding: 23px 14px 0; }
	.contents-heading { display: flex; align-items: center; justify-content: space-between; padding: 0 9px 19px; font-family: serif; font-size: 20px; }
	.contents-heading small { font: 11px sans-serif; color: #8d897f; }
	.search { display: flex; align-items: center; gap: 8px; background: #ffffff05; border: 1px solid #ffffff15; border-radius: 6px; padding: 0 10px; }
	.search span { color: #b59c65; font-size: 22px; }
	.search input { background: transparent; border: 0; width: 100%; min-width: 0; height: 42px; font-size: 12px; color: #e6dece; outline-offset: 0; }
	.group-tabs { display: flex; padding: 12px 0; gap: 4px; }
	.group-tabs button { flex: 1; padding: 8px 3px; font-size: 11px; color: #a39c90; border-radius: 5px; min-height: 36px; }
	.group-tabs .chosen { background: #d6b9741c; color: #e2c992; }
	.catalog { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: #4c473c transparent; padding: 0 0 12px; }
	.catalog-entry { display: flex; align-items: stretch; border: 1px solid transparent; border-radius: 7px; margin: 3px 0; }
	.catalog-entry.active { background: #d6b97412; border-color: #d6b97442; }
	.pick { display: flex; align-items: center; justify-content: center; width: 34px; flex-shrink: 0; cursor: pointer; }
	.pick input { width: 14px; height: 14px; accent-color: var(--gold); cursor: pointer; }
	.entry-link { text-align: left; min-width: 0; width: 100%; padding: 11px 8px 11px 0; }
	.entry-link > span { display: block; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
	.entry-link small { display: block; font-size: 10px; color: #929086; margin-top: 3px; }
	.entry-link i { padding: 0 6px; font-style: normal; }
	.contents-foot { color: #7f7e75; font-size: 10px; padding: 15px 7px; border-top: 1px solid #ffffff10; }
	.catalog-empty { font-size: 12px; color: #a9a093; padding: 25px 9px; line-height: 1.9; }
	.paper { color: var(--ink); background: linear-gradient(90deg, #d8cdb7 0, #eee5d4 12px, #f4eee2 35px, #f7f2e9 100%); padding: 30px clamp(22px, 4vw, 55px) 24px; min-height: 720px; border-left: 1px solid #171715; }
	.page-top { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #81735b; letter-spacing: .08em; }
	.page-top b { font-weight: 400; padding: 0 8px; color: #b9aa8d; }
	.page-number { font-family: Georgia, serif; font-size: 28px; color: #b9a785; }
	.page-title { font-family: "Noto Serif SC", "Songti SC", serif; font-weight: 650; font-size: clamp(23px, 2.5vw, 32px); line-height: 1.5; margin: 20px 0 13px; overflow-wrap: anywhere; }
	.source { font-family: monospace; font-size: 10px; color: #82745d; line-height: 1.9; overflow-wrap: anywhere; }
	.source span { font-family: sans-serif; }
	.history-note { padding: 12px 14px; margin-top: 17px; border-left: 3px solid #ad8844; background: #b8965012; font-size: 12px; line-height: 1.8; }
	.page-actions { display: flex; flex-wrap: wrap; gap: 9px; padding: 21px 0; border-bottom: 1px solid #9c866434; }
	.page-actions button, .page-state button { border: 1px solid #a38b6150; background: #ffffff40; border-radius: 5px; font-size: 11px; padding: 9px 13px; min-height: 40px; }
	.page-actions .in-bundle { background: #7d683219; color: #7e5e25; }
	.chapter-index { display: flex; flex-wrap: wrap; gap: 7px 17px; margin: 19px 0 6px; font-size: 11px; color: #896b36; }
	.chapter-index a { text-decoration: underline; text-underline-offset: 4px; padding: 5px 0; }
	.chapter { margin: 26px 0; scroll-margin-top: 110px; }
	.chapter-heading { display: flex; gap: 12px; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
	.chapter h4 { font-family: serif; font-size: 18px; font-weight: 650; line-height: 1.6; }
	.chapter-heading button { font-size: 10px; color: #856a40; white-space: nowrap; min-height: 36px; }
	.rule-row { display: flex; gap: 12px; align-items: flex-start; border-bottom: 1px solid #ac947315; padding: 10px 0; }
	.rule-row p { flex: 1; min-width: 0; font-size: 13px; line-height: 2.05; white-space: pre-wrap; overflow-wrap: anywhere; }
	.rule-row button { font-size: 10px; color: #8b7553; min-width: 36px; min-height: 36px; border-radius: 4px; }
	.rule-row button:hover, .chapter-heading button:hover { background: #ae8e4c18; color: #5b4521; }
	.paper-footer { display: flex; justify-content: space-between; color: #9a8a6d; font-size: 10px; border-top: 1px solid #a68d5d3b; padding-top: 19px; margin-top: 30px; }
	.page-state { padding: 80px 15px; text-align: center; color: #7d6c50; line-height: 2; font-size: 13px; }
	.page-state h3 { font: 24px serif; color: #514431; margin-bottom: 15px; }
	.page-state button { margin-top: 15px; }
	.manual-copy { padding: 18px; margin-bottom: 18px; background: #25241e; border: 1px solid #d6b97455; border-radius: 8px; font-size: 12px; }
	.manual-copy textarea { display: block; width: 100%; height: 180px; margin: 12px 0; padding: 12px; background: #161616; color: #eee; border: 1px solid #ffffff22; }
	@media (max-width: 900px) { .book { grid-template-columns: 235px minmax(0, 1fr); } .paper { padding: 25px; } }
	@media (max-width: 640px) {
		.library-heading { align-items: flex-start; gap: 10px; margin-bottom: 18px; }
		.refresh { padding: 8px; white-space: nowrap; }
		.intro { font-size: 12px; line-height: 1.8; }
		.book { display: block; }
		.contents { position: static; min-height: 0; max-height: 310px; padding: 16px 12px 0; }
		.contents-heading { padding-bottom: 12px; }
		.catalog { max-height: 150px; min-height: 65px; }
		.contents-foot { display: none; }
		.pick { width: 40px; }.pick input { width: 17px; height: 17px; }
		.group-tabs button, .presets button, .selection button, .page-actions button, .rule-row button, .chapter-heading button { min-height: 44px; }
		.paper { padding: 22px 20px; border-left: 0; min-height: 500px; background: #f5efe3; }
		.page-title { font-size: 25px; }
		.rule-row { gap: 6px; }.rule-row p { font-size: 13px; }.rule-row button { min-width: 40px; }
		.copy-controls { width: 100%; }.gold-button { flex: 1; }
	}
	@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
