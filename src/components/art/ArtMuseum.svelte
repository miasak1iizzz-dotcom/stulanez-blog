<script lang="ts">
	import { onMount, tick } from "svelte";
	import LocalArtwork from "./LocalArtwork.svelte";
	import { artOptions, artworkFile, describeArtwork, filterArtworks, isArtworkPath, readArtDirectory, type Artwork, type LocalDirectoryHandle } from "@/utils/art-library";
	const samples: Artwork[] = [
		["kpop-arch.jpg", "光影之间", "kpop"], ["anime-fairy.jpg", "幻想切片", "二次元"],
		["lol-zoe.jpg", "星光漫游", "LOL"], ["kpop-flowers.jpg", "花与日常", "kpop"],
		["lol-seraphine.jpg", "声色流动", "LOL"], ["kpop-totoro.jpg", "偶遇片刻", "kpop"],
	].map(([file, name, category]) => ({ ...describeArtwork(file), name, category, source: "站内示例", preview: `/assets/images/agent-board/${file}` }));
	let entries = $state<Artwork[]>(samples);
	let connected = $state(false);
	let folder = $state("");
	let scanning = $state(false);
	let scanned = $state(0);
	let message = $state("");
	let query = $state("");
	let category = $state("");
	let group = $state("");
	let member = $state("");
	let style = $state("");
	let source = $state("");
	let page = $state(0);
	const batchSize = 60;
	let selected = $state<Artwork | null>(null);
	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;
	let controller: AbortController | undefined;
	let downloadBusy = $state(false);
	let returnFocus: HTMLElement | null = null;
	const filtered = $derived(filterArtworks(entries, { query, category, group, member, style, source }));
	const visible = $derived(filtered.slice(page * batchSize, (page + 1) * batchSize));
	const categories = $derived(artOptions(entries, "category"));
	const groups = $derived(artOptions(entries.filter(item => !category || item.category === category), "group"));
	const members = $derived(artOptions(entries.filter(item => (!group || item.group === group) && (!category || item.category === category)), "member"));
	const styles = $derived(artOptions(entries, "style"));
	const sources = $derived(artOptions(entries, "source"));
	const title = $derived(member ? `${member} · 专属图墙` : group ? `${group} · 专属图墙` : category ? `${category} 展厅` : "所有展品");
	$effect(() => { query; category; group; member; style; source; page = 0; });
	onMount(() => () => controller?.abort());
	function reset() { query = ""; category = ""; group = ""; member = ""; style = ""; source = ""; page = 0; }
	function install(items: Artwork[], name: string) {
		entries = items; folder = name; connected = true; reset();
		message = items.length ? `已打开 ${items.length.toLocaleString()} 张图片，原图仍在你的电脑里。` : "这个目录没有可浏览的图片，试试另一个文件夹。";
	}
	async function chooseDirectory() {
		const picker = (window as Window & { showDirectoryPicker?: (options: { mode: string; id: string }) => Promise<LocalDirectoryHandle> }).showDirectoryPicker;
		if (!picker) { input.click(); return; }
		message = "";
		try {
			const directory = await picker.call(window, { mode: "read", id: "stulanez-art" });
			controller?.abort(); controller = new AbortController();
			const current = controller;
			scanning = true; scanned = 0;
			try {
				const items = await readArtDirectory(directory, current.signal, count => scanned = count);
				if (!current.signal.aborted) install(items, directory.name);
			} finally { if (controller === current) scanning = false; }
		} catch (error) {
			if ((error as Error).name !== "AbortError") message = "这个文件夹暂时打不开，请重新选择一个可读取的图片目录。";
		}
	}
	async function chooseFiles(event: Event) {
		const files = (event.currentTarget as HTMLInputElement).files;
		if (!files?.length) return;
		scanning = true; scanned = 0; message = "";
		controller?.abort(); controller = new AbortController();
		const current = controller;
		const items: Artwork[] = [];
		try {
			for (const file of files) {
				current.signal.throwIfAborted();
				const path = file.webkitRelativePath || file.name;
				if (isArtworkPath(path)) items.push({ ...describeArtwork(path), file });
				if (items.length % 200 === 0) { scanned = items.length; await new Promise(resolve => setTimeout(resolve, 0)); }
			}
			install(items, files[0].webkitRelativePath.split("/")[0] || "我的图库");
		} catch (error) { if ((error as Error).name !== "AbortError") message = "读取遇到问题，请重试。"; }
		finally { scanning = false; input.value = ""; }
	}
	async function open(item: Artwork) {
		returnFocus = document.activeElement as HTMLElement;
		selected = item; await tick(); dialog.showModal();
	}
	function close() { dialog.close(); selected = null; returnFocus?.focus(); }
	function move(direction: number) {
		if (!selected) return;
		const next = filtered[filtered.findIndex(item => item.id === selected?.id) + direction];
		if (next) selected = next;
	}
	function wall(item: Artwork) { reset(); category = item.category; group = item.group; member = item.member; close(); }
	async function download(item: Artwork) {
		downloadBusy = true;
		try {
			const owned = !item.preview;
			const href = item.preview || URL.createObjectURL(await artworkFile(item));
			const link = document.createElement("a"); link.href = href; link.download = item.path.split("/").at(-1) || item.name;
			document.body.append(link); link.click(); link.remove();
			if (owned) setTimeout(() => URL.revokeObjectURL(href), 10000);
		} catch { message = "原图目前无法读取，请重新连接图库后再试。"; }
		finally { downloadBusy = false; }
	}
	function changePage(direction: number) { page += direction; document.getElementById("art-results")?.scrollIntoView({ block: "start", behavior: "smooth" }); }
</script>

<section class="art-museum" aria-label="艺术馆">
	<header class="masthead">
		<div><span class="eyebrow">STULANEZ / ART MUSEUM</span><h1>艺术馆<span>让喜欢的画面，重新被看见。</span></h1></div>
		<button class="connect" onclick={chooseDirectory} disabled={scanning}>{connected ? "更换图库" : "打开我的图库"}<span aria-hidden="true"> ↗</span></button>
		<input class="file-input" bind:this={input} type="file" multiple webkitdirectory onchange={chooseFiles} aria-label="选择图片文件夹" />
	</header>
	<div class="intro">
		<p>{connected ? `${folder} · 本机浏览` : "从一个画面，走进一个世界。"}</p>
		<span>{connected ? "分类来自原有文件夹" : "选择电脑中的图片文件夹，原图留在本机。当前展示站内示例。"}</span>
	</div>
	<div class="searchbox"><span aria-hidden="true">⌕</span><input type="search" bind:value={query} placeholder="搜索成员、画风、文件名…" aria-label="搜索图库" /><kbd>探索</kbd></div>
	<nav class="categories" aria-label="艺术馆展厅">
		<button class:active={!category} onclick={() => { category = ""; group = ""; member = ""; }}>全部展厅</button>
		{#each categories as item}<button class:active={category === item} onclick={() => { category = item; group = ""; member = ""; }}>{item === "kpop" ? "K-pop" : item}</button>{/each}
	</nav>
	{#if scanning}<div class="notice" role="status">正在整理目录，已找到 {scanned.toLocaleString()} 张图片… <button onclick={() => { controller?.abort(); message = "已停止读取，原来的图墙仍保留。"; }}>停止</button></div>{/if}
	{#if message}<p class="notice" role="status">{message}</p>{/if}
	<div class="filters">
		<label>团体<select bind:value={group} onchange={() => member = ""}><option value="">全部团体</option>{#each groups as value}<option {value}>{value}</option>{/each}</select></label>
		<label>成员<select bind:value={member}><option value="">全部成员</option>{#each members as value}<option {value}>{value}</option>{/each}</select></label>
		<label>画风<select bind:value={style}><option value="">全部画风</option>{#each styles as value}<option {value}>{value}</option>{/each}</select></label>
		<label>来源<select bind:value={source}><option value="">全部来源</option>{#each sources as value}<option {value}>{value}</option>{/each}</select></label>
		<button class="reset" onclick={reset}>重置筛选</button>
	</div>
	<div id="art-results" class="results-heading"><div><span class="eyebrow">{connected ? "YOUR COLLECTION" : "PREVIEW EXHIBITION"}</span><h2>{title}</h2></div><span>{filtered.length.toLocaleString()} 张{!connected ? " · 示例" : ""}</span></div>
	{#if visible.length}
		<div class="art-grid">
			{#each visible as item, index (item.id)}
				<article class:tall={index % 5 === 1}>
					<button class="art-open" onclick={() => open(item)} aria-label={`查看大图：${item.name}`}><LocalArtwork {item} /><span class="open-mark" aria-hidden="true">↗</span></button>
					<div class="caption"><div><strong title={item.name}>{connected ? (item.member || item.name) : item.name}</strong><span>{item.group || item.category}{item.style !== "未标注" ? ` / ${item.style}` : ""}</span></div><button aria-label={`下载 ${item.name}`} disabled={downloadBusy} onclick={() => download(item)}>↓</button></div>
				</article>
			{/each}
		</div>
		{#if filtered.length > batchSize}<nav class="pagination" aria-label="图墙翻页"><button disabled={page === 0} onclick={() => changePage(-1)}>← 前一批</button><span>{page + 1} / {Math.ceil(filtered.length / batchSize)}</span><button disabled={(page + 1) * batchSize >= filtered.length} onclick={() => changePage(1)}>继续逛 →</button></nav>{/if}
	{:else}<div class="empty"><h3>{entries.length ? "这次还没有找到" : "这里还没有展品"}</h3><p>{entries.length ? "换个关键词，或放宽筛选条件。" : "选一个含 JPG、PNG、WebP 等图片的文件夹。"}</p><button onclick={entries.length ? reset : chooseDirectory}>{entries.length ? "查看全部图片" : "选择图库"}</button></div>{/if}
	<footer>艺术馆 · 私藏的另一种打开方式 <span>{connected ? "仅在当前浏览器读取；刷新后需重新选择目录。" : "相册与私人收藏，留给另一段故事。"}</span></footer>
</section>

<dialog bind:this={dialog} oncancel={(event) => { event.preventDefault(); close(); }} onkeydown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }} aria-label="图片大图">
	{#if selected}
		<div class="dialog-bar"><span>{selected.member || selected.name}</span><button onclick={close} aria-label="关闭大图">✕</button></div>
		{#key selected.id}<LocalArtwork item={selected} large />{/key}
		<div class="details"><div><strong>{selected.name}</strong><p>{selected.group || selected.category} · {selected.style} · {selected.source}</p></div><button disabled={downloadBusy} onclick={() => selected && download(selected)}>下载原图 ↓</button></div>
		<div class="dialog-bottom"><button disabled={filtered[0]?.id === selected.id} onclick={() => move(-1)}>← 上一张</button>{#if selected.group}<button onclick={() => selected && wall(selected)}>逛逛{selected.member || selected.group}的图墙 ↗</button>{/if}<button disabled={filtered.at(-1)?.id === selected.id} onclick={() => move(1)}>下一张 →</button></div>
	{/if}
</dialog>

<style>
	.art-museum { --ink: #25302b; --muted: #737970; --paper: #f8f7f3; background: var(--paper); color: var(--ink); border-radius: 18px; padding: clamp(20px, 4vw, 46px); min-width: 0; }
	:global(.dark) .art-museum { --ink: #e7e8df; --muted: #a1a89e; --paper: #202620; }
	button, input, select { font: inherit; } button { cursor: pointer; } button:disabled { opacity: .45; cursor: default; }
	button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #bc7639; outline-offset: 4px; }
	.masthead { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
	.eyebrow { letter-spacing: .16em; font-size: 10px; color: var(--muted); }
	h1 { font-family: Georgia, "Noto Serif SC", serif; font-size: clamp(30px, 4vw, 48px); font-weight: 500; margin: 9px 0 0; }
	h1 span { display: block; font-family: inherit; font-size: 13px; font-weight: normal; color: var(--muted); margin-top: 9px; }
	.connect { background: #324b3d; color: #fff; border: 0; border-radius: 7px; padding: 13px 18px; font-size: 13px; white-space: nowrap; }
	.file-input { display: none; }
	.intro { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 26px 0 16px; font-size: 12px; color: var(--muted); }
	.intro p { margin: 0; }
	.searchbox { display: flex; gap: 14px; align-items: center; padding: 13px 18px; background: color-mix(in srgb, var(--ink) 5%, transparent); border: 1px solid color-mix(in srgb, var(--ink) 9%, transparent); border-radius: 8px; }
	.searchbox > span { font-size: 27px; line-height: 1; }.searchbox input { width: 100%; border: 0; background: transparent; outline: none; color: var(--ink); font-size: 14px; min-width: 0; }.searchbox kbd { font-size: 11px; color: var(--muted); white-space: nowrap; }
	.categories { display: flex; gap: 20px; border-bottom: 1px solid color-mix(in srgb, var(--ink) 14%, transparent); margin-top: 18px; overflow-x: auto; }
	.categories button { padding: 14px 0; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); white-space: nowrap; font-size: 13px; }.categories button.active { color: var(--ink); border-bottom-color: var(--ink); }
	.filters { display: flex; flex-wrap: wrap; gap: 12px; padding: 22px 0; align-items: end; }.filters label { display: grid; gap: 6px; font-size: 10px; color: var(--muted); flex: 1; min-width: 100px; }
	.filters select { width: 100%; max-width: 200px; padding: 8px 24px 8px 10px; border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent); background: var(--paper); color: var(--ink); border-radius: 5px; font-size: 12px; }
	.reset { padding: 10px 0; font-size: 11px; background: none; border: 0; color: var(--muted); }
	.notice { padding: 12px; font-size: 12px; background: color-mix(in srgb, #76966d 13%, transparent); border-radius: 6px; margin: 12px 0 0; }.notice button { text-decoration: underline; margin-left: 12px; }
	.results-heading { display: flex; justify-content: space-between; align-items: end; padding: 14px 0 20px; scroll-margin-top: 90px; }.results-heading h2 { font-size: 23px; font-weight: 500; margin: 6px 0 0; }.results-heading > span { font-size: 11px; color: var(--muted); }
	.art-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; align-items: start; }.art-grid article { min-width: 0; }
	.art-open { display: block; width: 100%; padding: 0; border: 0; background: none; overflow: hidden; border-radius: 7px; position: relative; }.art-open :global(img) { transition: transform .3s; }.art-open:hover :global(img) { transform: scale(1.03); }.tall .art-open :global(div) { aspect-ratio: 3 / 4; }
	.open-mark { position: absolute; right: 10px; top: 10px; border-radius: 50%; background: #ffffffdc; color: #25302b; width: 28px; height: 28px; display: grid; place-items: center; }
	.caption { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: 10px; }.caption > div { min-width: 0; }.caption strong { font-size: 12px; display: block; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }.caption span { display: block; color: var(--muted); font-size: 10px; margin-top: 4px; }.caption button { background: none; border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent); border-radius: 50%; min-width: 30px; height: 30px; color: var(--ink); }
	.pagination { display: flex; justify-content: center; align-items: center; gap: 25px; padding: 30px 0 5px; font-size: 12px; }.pagination button, .empty button { border: 1px solid #859285; padding: 10px 15px; border-radius: 5px; color: var(--ink); }
	.empty { padding: 65px 10px; text-align: center; }.empty p { font-size: 13px; color: var(--muted); margin: 10px 0 20px; }
	footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-top: 38px; padding-top: 20px; border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); font-size: 10px; color: var(--muted); }
	dialog { width: min(1000px, 94vw); max-height: 94vh; padding: 0; border: 0; border-radius: 10px; background: #f8f7f3; color: #25302b; } dialog::backdrop { background: #080b0cd9; }
	.dialog-bar, .details, .dialog-bottom { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 20px; font-size: 12px; }.dialog-bar span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.dialog-bar button { min-width: 32px; min-height: 32px; }.details strong { display: block; overflow-wrap: anywhere; }.details p { margin-top: 5px; color: #687269; }.details button { flex-shrink: 0; background: #324b3d; color: #fff; padding: 10px 15px; border-radius: 5px; }.dialog-bottom { border-top: 1px solid #ddd; }.dialog-bottom button { padding: 8px 0; }
	@media(max-width: 650px) { .art-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }.masthead { align-items: start; }.connect { padding: 11px; font-size: 11px; }h1 span { font-size: 11px; }.filters { gap: 10px; }.filters label { min-width: calc(50% - 10px); }.filters select { max-width: none; }.categories { gap: 17px; }.details { flex-wrap: wrap; }.dialog-bottom { font-size: 10px; }.searchbox { padding: 12px; } }
	@media(prefers-reduced-motion: reduce) { .art-open :global(img) { transition: none; } }
</style>
