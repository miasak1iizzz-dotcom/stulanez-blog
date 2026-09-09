<script lang="ts">
	import { onMount } from "svelte";

	// T-030 欲望滋生室：欲望 ≠ 任务。看板不直接输入——复制「开启指令」贴到 AI 对话框细聊，再由 AI 写回 desires.json。
	// 卡片分两种：
	//   kind=raw 青涩卡 —— 原始想法，未剖析；卡上「复制指令」可让 AI 生成成熟卡。
	//   kind=mature 成熟卡 —— 跟协作指挥的任务卡同架构，可编辑；可再复制转正式任务指令。

	type Desire = {
		id: string;
		kind: "raw" | "mature";
		title: string;
		memo: string;
		mood: string;
		createdAt: string;
		plain?: string;
		story?: string[];
		statusLine?: string;
		nextStep?: string;
		priority?: string;
		cat?: string;
		cover?: string;
		deps?: string[];
		taskRef?: string;
	};

	type EditForm = {
		kind: "raw" | "mature";
		title: string;
		memo: string;
		mood: string;
		plain: string;
		storyText: string;
		statusLine: string;
		nextStep: string;
		priority: string;
		cat: string;
		depsText: string;
	};

	const moods = ["想玩", "有趣", "展示", "好奇", "看心情"];
	const cats: Record<string, { label: string; emoji: string }> = {
		assets: { label: "图库资产", emoji: "🖼️" },
		site: { label: "网站功能", emoji: "🛠️" },
		ops: { label: "工具基建", emoji: "🧰" },
	};
	const STORY_HEADS = ["来龙去脉", "思路", "接下来"];

	function defaultEdit(): EditForm {
		return {
			kind: "raw",
			title: "",
			memo: "",
			mood: "想玩",
			plain: "",
			storyText: "",
			statusLine: "",
			nextStep: "",
			priority: "P2",
			cat: "assets",
			depsText: "",
		};
	}

	let desires = $state<Desire[]>([]);
	let loading = $state(true);
	let error = $state("");
	let editingId = $state<string | null>(null);
	let edit = $state<EditForm>(defaultEdit());

	const OPEN_DESIRE_PROMPT = `【指挥室 · 欲望滋生室 · 开启一条新欲望】
我想跟你细聊一个还没落地的欲望（欲望 ≠ 正式任务）。

请先追问我、帮我把话说清楚：到底想要什么、边界在哪、值不值得养、大概归哪一类（图库/网站/工具）。聊透之后，再帮我写进 src/data/agent-board/desires.json：
- 先 node scripts/agent-board-lock.mjs acquire <你的id> "欲望滋生"
- 新增一张欲望卡（可先 kind=raw 青涩卡，或直接 kind=mature 成熟卡）
- 写完 release
- 成熟卡请按任务卡架构填 title / plain / story(来龙去脉·思路·接下来) / statusLine / nextStep / priority / cat / cover / deps

现在先问我：你最近脑子里转的是什么？`;

	async function load() {
		loading = true;
		try {
			const res = await fetch("/api/lab/desires/", { cache: "no-store" });
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			desires = Array.isArray(data.desires) ? data.desires : [];
			error = "";
		} catch (e) {
			error = `加载欲望失败：${e instanceof Error ? e.message : String(e)}`;
		}
		loading = false;
	}

	async function api(body: Record<string, unknown>): Promise<boolean> {
		try {
			const res = await fetch("/api/lab/desires/", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			});
			if (!res.ok) throw new Error(await res.text());
			return true;
		} catch (e) {
			error = `保存失败：${e instanceof Error ? e.message : String(e)}`;
			return false;
		}
	}

	function startEdit(d: Desire) {
		editingId = d.id;
		edit = {
			kind: d.kind,
			title: d.title ?? "",
			memo: d.memo ?? "",
			mood: d.mood ?? "想玩",
			plain: d.plain ?? "",
			storyText: (d.story ?? []).join("\n\n"),
			statusLine: d.statusLine ?? "",
			nextStep: d.nextStep ?? "",
			priority: d.priority ?? "P2",
			cat: d.cat ?? "assets",
			depsText: (d.deps ?? []).join("\n"),
		};
	}

	function cancelEdit() {
		editingId = null;
	}

	async function save() {
		if (!editingId) return;
		const story = edit.storyText.split(/\r?\n\s*\r?\n/).map((s) => s.trim()).filter(Boolean);
		const deps = edit.depsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
		const ok = await api({
			action: "set",
			id: editingId,
			kind: edit.kind,
			title: edit.title,
			memo: edit.memo,
			mood: edit.mood,
			plain: edit.plain,
			story,
			statusLine: edit.statusLine,
			nextStep: edit.nextStep,
			priority: edit.priority,
			cat: edit.cat,
			deps,
		});
		if (ok) {
			editingId = null;
			await load();
			error = "✓ 已保存这张欲望卡。";
		}
	}

	async function remove(d: Desire) {
		const ok = await api({ action: "remove", id: d.id });
		if (ok) {
			if (editingId === d.id) editingId = null;
			await load();
			error = "已删除这张卡。";
		}
	}

	function rawAnalyzeCmd(d: Desire): string {
		return `我在指挥室「欲望滋生室」记了一条青涩欲望卡（还没剖析）：\n【${d.id} · ${d.title}】\n原始想法：${d.memo}\n\n请把我这条青涩欲望剖析成一张【成熟欲望卡】，并直接写回 src/data/agent-board/desires.json：把 ${d.id} 的 kind 改成 "mature"，并按任务卡的架构填好 title / plain / story(来龙去脉·思路·接下来三段) / statusLine / nextStep / priority / cat / cover / deps。写之前先 node scripts/agent-board-lock.mjs acquire，写完 release。完成后回我一句。`;
	}

	function maturePromoteCmd(d: Desire): string {
		return `请把下面这条已经成熟的欲望卡，落实成一张正式任务卡加入协作指挥中心（src/data/agent-board/tasks.json）：\n【${d.id} · ${d.title}】\n${d.plain ?? d.memo}\n\n按任务卡规范写 title / plain / story / priority / deps / cat / cover，owner 先留「待分工」；并把 desires.json 里 ${d.id} 的 taskRef 填上任务号。写完更新 tasks.json 的进度与状态。`;
	}

	async function copyToClipboard(text: string): Promise<boolean> {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
			const ta = document.createElement("textarea");
			ta.value = text;
			ta.style.position = "fixed";
			ta.style.opacity = "0";
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand("copy");
			document.body.removeChild(ta);
			return ok;
		} catch {
			return false;
		}
	}

	async function copyRaw(d: Desire) {
		error = (await copyToClipboard(rawAnalyzeCmd(d)))
			? `✓ 已复制「${d.title}」的剖析指令，粘贴给任一 AI，它会帮你生成成熟卡。`
			: "复制失败，请手动复制。";
	}

	async function copyMature(d: Desire) {
		error = (await copyToClipboard(maturePromoteCmd(d)))
			? `✓ 已复制「${d.title}」的转任务指令，粘贴给任一 AI 即可。`
			: "复制失败，请手动复制。";
	}

	async function copyOpenDesire() {
		error = (await copyToClipboard(OPEN_DESIRE_PROMPT))
			? "✓ 已复制「开启欲望」指令，粘贴到任一 AI 对话框里细聊即可。"
			: "复制失败，请手动复制。";
	}

	onMount(load);
</script>

<div class="desire">
	<!-- 开启欲望：复制指令去 AI 对话框细聊，不在看板里输入 -->
	<section class="card composer">
		<header>
			<h2>开启一条新欲望</h2>
			<p class="hint">
				不在这里打字。点下面按钮复制指令，贴到任一 AI 对话框里细聊；聊透后由 AI 写回欲望卡。
			</p>
		</header>
		<div class="row open-row">
			<button type="button" class="btn primary open-btn" onclick={copyOpenDesire}>
				📋 复制欲望开启指令
			</button>
		</div>
	</section>

	{#if error}
		<p class="msg">{error}</p>
	{/if}

	<!-- 可编辑卡片 -->
	<section class="cards">
		<div class="sec-head">
			<h3>欲望卡 <span class="count">{desires.length}</span></h3>
			<p class="sec-sub">青涩 = 原始想法 · 成熟 = 已剖析成任务卡架构（都可编辑）</p>
		</div>

		{#if loading}
			<p class="empty">正在读取欲望…</p>
		{:else if desires.length === 0}
			<p class="empty">还没有欲望。点上面「复制欲望开启指令」，贴到 AI 对话框里聊出第一条。</p>
		{:else}
			{#each desires as d (d.id)}
				{#if editingId === d.id}
					<!-- 编辑态 -->
					<article class="card edit">
						<div class="top">
							<span class="id">{d.id}</span>
							<label class="kindpick">
								卡片类型
								<select bind:value={edit.kind}>
									<option value="raw">青涩（原始想法）</option>
									<option value="mature">成熟（任务卡架构）</option>
								</select>
							</label>
						</div>
						<label class="f">
							标题
							<input type="text" bind:value={edit.title} placeholder="给这条欲望起个名" />
						</label>
						<label class="f">
							你的想法
							<textarea bind:value={edit.memo} rows={3}></textarea>
						</label>
						<label class="mood f">
							什么味道
							<select bind:value={edit.mood}>
								{#each moods as m}
									<option value={m}>{m}</option>
								{/each}
							</select>
						</label>

						{#if edit.kind === "mature"}
							<label class="f">
								大白话（一句话说清）
								<textarea bind:value={edit.plain} rows={2} placeholder="给不懂技术的老板看的一句话"></textarea>
							</label>
							<label class="f">
								卷宗三段（来龙去脉 / 思路 / 接下来），每段空一行
								<textarea bind:value={edit.storyText} rows={6}></textarea>
							</label>
							<div class="row">
								<label class="mood f">
									状态一句
									<input type="text" bind:value={edit.statusLine} placeholder="做到哪了 / 现状" />
								</label>
								<label class="mood f">
									下一步
									<input type="text" bind:value={edit.nextStep} placeholder="下一步做什么" />
								</label>
							</div>
							<div class="row">
								<label class="mood f">
									优先级
									<select bind:value={edit.priority}>
										<option value="P1">P1</option>
										<option value="P2">P2</option>
										<option value="P3">P3</option>
									</select>
								</label>
								<label class="mood f">
									分类
									<select bind:value={edit.cat}>
										<option value="assets">图库资产</option>
										<option value="site">网站功能</option>
										<option value="ops">工具基建</option>
									</select>
								</label>
							</div>
							<label class="f">
								依赖（可选，每行一个）
								<textarea bind:value={edit.depsText} rows={2} placeholder="例如：图库馆先上线"></textarea>
							</label>
						{/if}

						<div class="actions">
							<button type="button" class="btn gold" onclick={save}>✓ 保存</button>
							<button type="button" class="btn ghost" onclick={cancelEdit}>取消</button>
						</div>
					</article>
				{:else if d.kind === "mature"}
					<!-- 成熟卡 -->
					<article class="card item mature">
						{#if d.cover}
							<div class="mcover">
								<img src={d.cover} alt="" loading="lazy" />
								<div class="mcover-shade"></div>
								<div class="mbadges">
									<span class="id">{d.id}</span>
									<span class="chip pri">{d.priority ?? "P2"}</span>
									<span class="chip cat">{cats[d.cat ?? "assets"]?.emoji} {cats[d.cat ?? "assets"]?.label}</span>
									<span class="chip mature">成熟</span>
								</div>
							</div>
						{/if}
						<div class="mbody">
							<h4>{d.title}</h4>
							<p class="plain">{d.plain || d.memo}</p>
							{#if d.story && d.story.length > 0}
								<div class="story">
									{#each d.story as seg, i}
										<div class="storyp">
											<span class="sh">{STORY_HEADS[Math.min(i, STORY_HEADS.length - 1)]}</span>
											<p>{seg}</p>
										</div>
									{/each}
								</div>
							{/if}
							{#if d.statusLine}
								<p class="sl">{d.statusLine}</p>
							{/if}
							{#if d.nextStep}
								<p class="ns"><b>下一步：</b>{d.nextStep}</p>
							{/if}
							{#if d.taskRef}
								<p class="taskref">已转正式任务：<b>{d.taskRef}</b></p>
							{/if}
							<div class="meta-line">{d.createdAt} · {d.mood}</div>
						</div>
						<div class="actions">
							<button type="button" class="btn gold" onclick={() => copyMature(d)}>📋 复制指令 · 转正式任务</button>
							<button type="button" class="btn" onclick={() => startEdit(d)}>✎ 编辑</button>
							<button type="button" class="btn ghost" onclick={() => remove(d)}>🗑 删除</button>
						</div>
					</article>
				{:else}
					<!-- 青涩卡 -->
					<article class="card item raw">
						<div class="top">
							<div class="left">
								<span class="id">{d.id}</span>
								<span class="chip raw">青涩</span>
							</div>
							<div class="right">
								<span class="meta">{d.createdAt} · {d.mood}</span>
							</div>
						</div>
						<h4>{d.title}</h4>
						<p class="memo">{d.memo}</p>
						<div class="actions">
							<button type="button" class="btn gold" onclick={() => copyRaw(d)}>📋 复制指令 · 让 AI 生成成熟卡</button>
							<button type="button" class="btn" onclick={() => startEdit(d)}>✎ 编辑</button>
							<button type="button" class="btn ghost" onclick={() => remove(d)}>🗑 删除</button>
						</div>
					</article>
				{/if}
			{/each}
		{/if}
	</section>
</div>

<style>
	.desire {
		--card: rgba(20, 20, 23, 0.82);
		--line: rgba(230, 194, 110, 0.16);
		--gold: #e6c26e;
		--text: #f4f4f5;
		--muted: #a1a1aa;
		color: var(--text);
		max-width: 960px;
		margin: 0 auto;
		padding: 0.25rem 0 2.5rem;
		font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 1rem 1.1rem;
		margin-top: 0.85rem;
		backdrop-filter: blur(8px);
	}
	.composer header h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 750;
	}
	.hint {
		color: var(--muted);
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0.3rem 0 0;
	}
	.row {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.open-row {
		margin-top: 1rem;
	}
	.open-btn {
		font-size: 0.95rem;
		padding: 0.7rem 1.15rem;
		font-weight: 650;
	}
	.mood,
	.kindpick {
		display: inline-flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.mood select,
	.kindpick select,
	.f select {
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		color: var(--text);
		padding: 0.4rem 0.5rem;
	}
	.f {
		display: block;
		margin-top: 0.7rem;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.f input,
	.f textarea {
		width: 100%;
		margin-top: 0.3rem;
		background: #09090b;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		color: var(--text);
		padding: 0.55rem 0.7rem;
		font-size: 0.92rem;
		line-height: 1.55;
	}
	.btn {
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
		border-radius: 10px;
		padding: 0.5rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.btn:hover {
		border-color: rgba(230, 194, 110, 0.5);
	}
	.btn.primary {
		background: linear-gradient(135deg, #f7e3ae, #d9a441);
		border-color: transparent;
		color: #1a1408;
		font-weight: 700;
	}
	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.btn.gold {
		background: rgba(230, 194, 110, 0.1);
		border-color: rgba(230, 194, 110, 0.4);
		color: var(--gold);
		font-weight: 650;
	}
	.btn.ghost {
		opacity: 0.9;
	}
	.msg {
		margin: 0.85rem 0 0;
		color: #86efac;
		font-size: 0.9rem;
	}
	.sec-head {
		margin-top: 1.4rem;
	}
	.sec-head h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 750;
	}
	.count {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: var(--gold);
		color: #1a1408;
		font-size: 0.72rem;
		font-weight: 800;
		vertical-align: middle;
	}
	.sec-sub {
		position: relative;
		top: -1.15rem;
		margin: 0;
		text-align: right;
		color: var(--muted);
		font-size: 0.78rem;
	}
	.empty {
		margin-top: 1rem;
		padding: 1.4rem;
		border-radius: 14px;
		border: 1px dashed rgba(255, 255, 255, 0.14);
		color: var(--muted);
		font-size: 0.9rem;
		text-align: center;
	}
	.item .top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.left {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.id {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		color: var(--muted);
	}
	.right .meta,
	.meta-line {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.chip {
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
		font-size: 0.72rem;
		font-weight: 700;
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.chip.raw {
		background: rgba(56, 189, 248, 0.1);
		color: #7dd3fc;
	}
	.chip.mature {
		background: rgba(230, 194, 110, 0.1);
		color: var(--gold);
	}
	.chip.pri {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text);
	}
	.chip.cat {
		background: rgba(255, 255, 255, 0.05);
		color: var(--muted);
	}
	.item h4 {
		margin: 0.5rem 0 0.3rem;
		font-size: 1.05rem;
		font-weight: 750;
	}
	.memo {
		margin: 0;
		color: rgba(244, 244, 245, 0.82);
		font-size: 0.9rem;
		line-height: 1.6;
		white-space: pre-wrap;
	}
	/* 成熟卡 */
	.item.mature {
		padding: 0;
		overflow: hidden;
	}
	.mcover {
		position: relative;
		height: 150px;
		overflow: hidden;
	}
	.mcover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.mcover-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, #0b0b0f, rgba(11, 11, 15, 0.25), transparent);
	}
	.mbadges {
		position: absolute;
		bottom: 0.65rem;
		left: 0.9rem;
		right: 0.9rem;
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.mbody {
		padding: 1rem 1.1rem;
	}
	.mbody .plain {
		margin: 0;
		color: rgba(244, 244, 245, 0.86);
		font-size: 0.92rem;
		line-height: 1.6;
	}
	.story {
		margin-top: 0.8rem;
		display: grid;
		gap: 0.5rem;
	}
	.storyp {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
	}
	.storyp .sh {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--gold);
		letter-spacing: 0.04em;
	}
	.storyp p {
		margin: 0.25rem 0 0;
		font-size: 0.88rem;
		line-height: 1.55;
		color: rgba(244, 244, 245, 0.86);
	}
	.sl {
		margin: 0.8rem 0 0;
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		background: rgba(230, 194, 110, 0.07);
		border: 1px solid rgba(230, 194, 110, 0.15);
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--gold);
	}
	.ns {
		margin: 0.55rem 0 0;
		font-size: 0.86rem;
		color: rgba(244, 244, 245, 0.9);
	}
	.taskref {
		margin-top: 0.6rem;
		font-size: 0.85rem;
		color: #86efac;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.85rem;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding-top: 0.75rem;
	}
	.item.mature .actions {
		padding: 0.85rem 1.1rem;
		margin-top: 0;
	}
	.edit .top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
</style>
