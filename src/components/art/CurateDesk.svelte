<script lang="ts">
	import type { ArtManifest } from "@/types/artManifest";
	import { type CurateDirectoryHandle, type CurateItem, type CurateProgress, readCurateDirectory, revokeItem, toManifestItem } from "@/utils/art-curate";

	// 站长策展台：选一个本地图库目录 → 浏览器内判图 → 打标 → 写回展品目录。
	// 图片字节始终在本机：判图与缩略图都在浏览器里做，不上传任何东西。
	// 阶段 2 接对象存储后，把「写回目录」换成「直传 R2」，其余流程不变。
	let { onExit }: { onExit?: () => void } = $props();

	let items = $state<CurateItem[]>([]);
	let scanning = $state(false);
	let progress = $state<CurateProgress | null>(null);
	let message = $state("");
	let folder = $state("");
	let controller: AbortController | undefined;
	let exporting = $state(false);
	let exportNote = $state("");

	let selected = $state<Set<string>>(new Set());
	let bulk = $state({ group: "", member: "", style: "", source: "", year: "" });
	let fileInput: HTMLInputElement;

	const selectedCount = $derived(selected.size);
	const publicCount = $derived(items.filter(item => item.public).length);
	const totalBytes = $derived(items.reduce((sum, item) => sum + item.bytes, 0));
	const totalThumbs = $derived(items.reduce((sum, item) => sum + Object.keys(item.thumbs).length, 0));

	function picker() {
		return (window as Window & {
			showDirectoryPicker?: (options: { mode: string; id: string }) => Promise<CurateDirectoryHandle>;
		}).showDirectoryPicker;
	}

	async function chooseDirectory() {
		const pick = picker();
		if (!pick) {
			fileInput?.click();
			return;
		}
		message = "";
		exportNote = "";
		try {
			const directory = await pick.call(window, { mode: "read", id: "stulanez-art-curate" });
			await scan(directory);
		} catch (error) {
			if ((error as Error).name !== "AbortError") message = "这个文件夹打不开，换一个可读取的图片目录试试。";
		}
	}

	async function scan(directory: CurateDirectoryHandle) {
		for (const item of items) revokeItem(item);
		items = [];
		selected = new Set();
		folder = directory.name;
		controller?.abort();
		controller = new AbortController();
		const current = controller;
		scanning = true;
		progress = { done: 0, total: 0, current: "" };
		try {
			const result = await readCurateDirectory(directory, value => (progress = value), current.signal);
			if (!current.signal.aborted) {
				items = result;
				message = result.length ? `判图完成：${result.length} 件（判图与缩略图都在本机完成，没有上传任何东西）。` : "这个目录里没有可用的图片。";
			}
		} catch (error) {
			if ((error as Error).name !== "AbortError") message = "判图中断了，可以重新选一次目录。";
		} finally {
			if (controller === current) scanning = false;
		}
	}

	async function chooseFiles(event: Event) {
		const files = (event.currentTarget as HTMLInputElement).files;
		if (!files?.length) return;
		// 不支持目录选择器时的退路：把选中的文件当成一个虚拟目录
		const handle: CurateDirectoryHandle = {
			kind: "directory",
			name: files[0].webkitRelativePath.split("/")[0] || "我的图库",
			async *values() {
				for (const file of files) {
					yield {
						kind: "file" as const,
						name: file.webkitRelativePath || file.name,
						getFile: async () => file,
					};
				}
			},
		};
		await scan(handle);
		fileInput.value = "";
	}

	function toggle(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function selectAll() {
		selected = new Set(items.map(item => item.id));
	}

	function clearSelection() {
		selected = new Set();
	}

	/** 把批量面板里填了值的字段，应用到选中的展品上。 */
	function applyBulk() {
		const fields = Object.entries(bulk).filter(([, value]) => value.trim());
		if (!fields.length) {
			message = "批量面板还空着，先填一项（比如团体）再应用。";
			return;
		}
		let touched = 0;
		items = items.map(item => {
			if (!selected.has(item.id)) return item;
			touched++;
			const tags = { ...item.tags };
			for (const [key, value] of fields) tags[key as keyof typeof tags] = value.trim() as never;
			return { ...item, tags };
		});
		message = `已把 ${fields.map(([key]) => key).join("、")} 写到 ${touched} 件展品上。`;
	}

	function setPublic(value: boolean) {
		items = items.map(item => (selected.has(item.id) ? { ...item, public: value } : item));
		message = value ? `已标记 ${selectedCount} 件可上站。` : `已把 ${selectedCount} 件移出上站清单。`;
	}

	async function exportTo() {
		if (!items.length) return;
		const pick = (window as Window & {
			showDirectoryPicker?: (options: { mode: string; id: string }) => Promise<FileSystemDirectoryHandle>;
		}).showDirectoryPicker;
		if (!pick) {
			exportNote = "当前浏览器不支持写入目录（需要 Chrome / Edge）。可以下载清单，缩略图请用命令行管线生成。";
			return;
		}
		exporting = true;
		exportNote = "";
		try {
			const root = await pick.call(window, { mode: "readwrite", id: "stulanez-art-out" });
			const thumbRoot = await root.getDirectoryHandle("thumb", { create: true });
			let written = 0;
			for (const item of items) {
				const shard = await thumbRoot.getDirectoryHandle(item.id.slice(0, 2), { create: true });
				for (const [width, blob] of Object.entries(item.thumbs)) {
					const handle = await shard.getFileHandle(`${item.id}-${width}.webp`, { create: true });
					const stream = await handle.createWritable();
					await stream.write(blob);
					await stream.close();
					written++;
					exportNote = `正在写入缩略图 ${written} / ${totalThumbs}…`;
				}
			}
			const onShelf = items.filter(item => item.public);
			const manifest: ArtManifest = {
				version: 1,
				updatedAt: new Date().toISOString(),
				generator: "art-curate/0.1",
				baseUrl: "https://img.stulanez.com",
				items: (onShelf.length ? onShelf : items).map(toManifestItem),
			};
			const manifestHandle = await root.getFileHandle("manifest.json", { create: true });
			const stream = await manifestHandle.createWritable();
			await stream.write(`${JSON.stringify(manifest, null, 2)}\n`);
			await stream.close();
			exportNote = `写完：${written} 张缩略图 + manifest.json（${manifest.items.length} 件）。提交推送后才会出现在展厅。`;
		} catch (error) {
			if ((error as Error).name !== "AbortError") exportNote = `导出失败：${(error as Error).message}`;
		} finally {
			exporting = false;
		}
	}

	function downloadManifest() {
		const onShelf = items.filter(item => item.public);
		const manifest: ArtManifest = {
			version: 1,
			updatedAt: new Date().toISOString(),
			generator: "art-curate/0.1",
			baseUrl: "https://img.stulanez.com",
			items: (onShelf.length ? onShelf : items).map(toManifestItem),
		};
		const blob = new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "manifest.json";
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}
</script>

<section class="curate" aria-label="策展台">
	<header class="masthead">
		<div>
			<span class="eyebrow">STULANEZ / CURATOR DESK</span>
			<h1>策展台<span>选一个本地图库，判图打标后写回展品目录。图不出这台电脑。</span></h1>
		</div>
		<div class="actions">
			{#if onExit}<button class="ghost" onclick={onExit}>← 返回展厅</button>{/if}
			<button class="primary" onclick={chooseDirectory} disabled={scanning}>{items.length ? "换一个图库" : "选择图库文件夹"}</button>
			<input class="file-input" bind:this={fileInput} type="file" multiple webkitdirectory onchange={chooseFiles} aria-label="选择图片文件夹" />
		</div>
	</header>

	{#if scanning && progress}
		<div class="progress" role="status">
			<div class="bar"><i style={`width:${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`}></i></div>
			<p>正在判图 {progress.done} / {progress.total || "…"}　<code>{progress.current}</code></p>
			<button class="ghost" onclick={() => controller?.abort()}>停止</button>
		</div>
	{/if}

	{#if message}<p class="notice" role="status">{message}</p>{/if}

	{#if !items.length && !scanning}
		<div class="empty">
			<h2>还没有候选展品</h2>
			<p>选一个含 JPG / PNG / WebP 的文件夹。判图会算出用途、分辨率等级、主色和重复项，缩略图就地生成——全程在本机，不联网、不上传。</p>
			<button class="primary" onclick={chooseDirectory}>选择图库文件夹</button>
		</div>
	{:else if items.length}
		<div class="ledger">
			<div><b>{items.length}</b><span>候选展品</span></div>
			<div><b>{(totalBytes / 1024 / 1024).toFixed(0)}</b><span>MB 原图</span></div>
			<div><b>{totalThumbs}</b><span>张缩略图</span></div>
			<div><b>{publicCount}</b><span>件已标上站</span></div>
			<div><b>{folder}</b><span>来源目录</span></div>
		</div>

		<div class="toolbar">
			<div class="selects">
				<button class="ghost" onclick={selectAll}>全选</button>
				<button class="ghost" onclick={clearSelection}>清除选择</button>
				<span class="count">已选 {selectedCount} 件</span>
			</div>
			<div class="bulk">
				<label>团体<input bind:value={bulk.group} placeholder="如 IVE" /></label>
				<label>成员<input bind:value={bulk.member} placeholder="如 张元英" /></label>
				<label>画风<input bind:value={bulk.style} placeholder="如 赛璐璐" /></label>
				<label>来源<input bind:value={bulk.source} placeholder="如 Instagram" /></label>
				<label>年份<input bind:value={bulk.year} placeholder="如 2026" /></label>
				<button class="primary" onclick={applyBulk} disabled={!selectedCount}>批量打标</button>
			</div>
			<div class="shelf">
				<button class="ghost" onclick={() => setPublic(true)} disabled={!selectedCount}>标为上站</button>
				<button class="ghost" onclick={() => setPublic(false)} disabled={!selectedCount}>移出上站</button>
			</div>
		</div>

		<div class="grid">
			{#each items as item (item.id)}
				<article class:on={selected.has(item.id)} class:live={item.public}>
					<button class="pick" onclick={() => toggle(item.id)} aria-pressed={selected.has(item.id)} aria-label={`选择 ${item.name}`}>
						<img src={item.previewUrl} alt="" loading="lazy" decoding="async" />
						<span class="check" aria-hidden="true">{selected.has(item.id) ? "✓" : ""}</span>
						{#if item.public}<span class="badge">上站</span>{/if}
						{#if item.duplicates.length}<span class="dupe">重复 +{item.duplicates.length}</span>{/if}
					</button>
					<div class="meta">
						<strong title={item.path}>{item.name}</strong>
						<span>{item.width}×{item.height} · {item.ratio} · {item.auto.grade}</span>
						<div class="tags">
							{#each item.auto.uses as use}<i>{use}</i>{/each}
							{#each item.auto.colors.slice(0, 4) as color}<i class="swatch" style={`background:${color}`}></i>{/each}
						</div>
						{#if item.tags.group || item.tags.member || item.tags.style || item.tags.source}
							<div class="tagged">
								{[item.tags.group, item.tags.member, item.tags.style, item.tags.source, item.tags.year].filter(Boolean).join(" · ")}
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		<footer class="export">
			<div>
				<button class="primary" onclick={exportTo} disabled={exporting}>{exporting ? "正在写入…" : "写回展品目录"}</button>
				<button class="ghost" onclick={downloadManifest}>只下载清单</button>
			</div>
			{#if exportNote}<p class="notice" role="status">{exportNote}</p>{/if}
			<p class="hint">写回时选仓库的 <code>public/art</code> 目录：缩略图进 <code>thumb/</code>，清单覆盖 <code>manifest.json</code>。标的「上站」决定清单里收哪些；没标任何上站时按全部导出。</p>
		</footer>
	{/if}
</section>

<style>
	.curate {
		--ink: #25302b;
		--muted: #737970;
		--paper: #f8f7f3;
		background: var(--paper);
		color: var(--ink);
		border-radius: 18px;
		padding: clamp(20px, 4vw, 46px);
		min-width: 0;
	}
	:global(.dark) .curate {
		--ink: #e7e8df;
		--muted: #a1a89e;
		--paper: #202620;
	}
	button,
	input {
		font: inherit;
	}
	button {
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid #bc7639;
		outline-offset: 3px;
	}
	.masthead {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		align-items: center;
		justify-content: space-between;
	}
	.eyebrow {
		letter-spacing: 0.16em;
		font-size: 10px;
		color: var(--muted);
	}
	h1 {
		font-family: Georgia, "Noto Serif SC", serif;
		font-size: clamp(28px, 4vw, 42px);
		font-weight: 500;
		margin: 9px 0 0;
	}
	h1 span {
		display: block;
		font: 13px/1.5 system-ui, sans-serif;
		font-weight: normal;
		color: var(--muted);
		margin-top: 9px;
	}
	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.primary {
		background: #324b3d;
		color: #fff;
		border: 0;
		border-radius: 7px;
		padding: 12px 16px;
		font-size: 13px;
	}
	.ghost {
		background: none;
		border: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
		color: var(--ink);
		border-radius: 7px;
		padding: 11px 15px;
		font-size: 12px;
	}
	.file-input {
		display: none;
	}
	.progress {
		margin-top: 22px;
	}
	.progress .bar {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		overflow: hidden;
	}
	.progress .bar i {
		display: block;
		height: 100%;
		background: #76966d;
		transition: width 0.2s;
	}
	.progress p {
		font-size: 12px;
		color: var(--muted);
		margin: 8px 0;
	}
	.progress code {
		font-size: 11px;
		overflow-wrap: anywhere;
	}
	.notice {
		padding: 12px;
		font-size: 12px;
		background: color-mix(in srgb, #76966d 13%, transparent);
		border-radius: 6px;
		margin: 14px 0 0;
	}
	.empty {
		padding: 60px 10px;
		text-align: center;
	}
	.empty h2 {
		font-size: 22px;
		font-weight: 500;
		margin: 0 0 10px;
	}
	.empty p {
		font-size: 13px;
		color: var(--muted);
		max-width: 560px;
		margin: 0 auto 20px;
		line-height: 1.7;
	}
	.ledger {
		display: flex;
		flex-wrap: wrap;
		gap: 26px;
		margin: 26px 0 18px;
		padding-bottom: 18px;
		border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.ledger b {
		display: block;
		font-size: 20px;
		font-weight: 500;
	}
	.ledger span {
		font-size: 10px;
		color: var(--muted);
	}
	.toolbar {
		display: grid;
		gap: 12px;
		margin-bottom: 22px;
	}
	.selects {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	.count {
		font-size: 12px;
		color: var(--muted);
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: end;
	}
	.bulk label {
		display: grid;
		gap: 5px;
		font-size: 10px;
		color: var(--muted);
	}
	.bulk input {
		padding: 8px 10px;
		border: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
		background: var(--paper);
		color: var(--ink);
		border-radius: 5px;
		font-size: 12px;
		width: 110px;
	}
	.shelf {
		display: flex;
		gap: 10px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 16px 14px;
	}
	article {
		min-width: 0;
	}
	.pick {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 8px;
		overflow: hidden;
		background: #e5e2dc;
	}
	article.on .pick {
		border-color: #324b3d;
	}
	.pick img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
	}
	.check {
		position: absolute;
		left: 8px;
		top: 8px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #ffffffd8;
		color: #25302b;
		display: grid;
		place-items: center;
		font-size: 13px;
	}
	article.on .check {
		background: #324b3d;
		color: #fff;
	}
	.badge,
	.dupe {
		position: absolute;
		right: 8px;
		font-size: 10px;
		padding: 2px 7px;
		border-radius: 999px;
	}
	.badge {
		top: 8px;
		background: #324b3d;
		color: #fff;
	}
	.dupe {
		bottom: 8px;
		background: #f6e0d0;
		color: #8a4b1e;
	}
	.meta {
		margin-top: 8px;
		font-size: 10px;
		color: var(--muted);
	}
	.meta strong {
		display: block;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tags {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin-top: 6px;
	}
	.tags i {
		font-style: normal;
		font-size: 9px;
		padding: 1px 7px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
	}
	.tags i.swatch {
		width: 12px;
		height: 12px;
		padding: 0;
		border-radius: 3px;
		border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
	}
	.tagged {
		margin-top: 6px;
		font-size: 10px;
		color: #324b3d;
	}
	:global(.dark) .tagged {
		color: #a8c4a8;
	}
	.export {
		margin-top: 30px;
		padding-top: 20px;
		border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
		display: grid;
		gap: 12px;
	}
	.export > div {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.hint {
		font-size: 11px;
		color: var(--muted);
		margin: 0;
		line-height: 1.7;
	}
	.hint code {
		font-size: 10px;
	}
	@media (max-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		}
		.bulk input {
			width: 90px;
		}
	}
</style>
