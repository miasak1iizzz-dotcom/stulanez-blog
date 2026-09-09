<script lang="ts">
import { onDestroy, onMount } from "svelte";

type Current = {
	m: string;
	listN: number;
	judged: number;
	eliminated: number;
	prescreen: string;
};
type MemberRow = {
	m: string;
	onDisk?: number;
	noface?: number;
	withface?: number;
	vlm?: string;
	secs?: number;
};
type Payload = {
	ok: boolean;
	now: string;
	membersTotal: number;
	scanTotal: number;
	estTotalWithface: number;
	prescreenDone: number;
	vlmDone: number;
	sumOnDisk: number;
	sumNoface: number;
	sumWithface: number;
	judged: number;
	eliminated: number;
	current: Current | null;
	gpu: boolean;
	driverAlive: boolean;
	stateAgeMin: number;
	elapsedH: number;
	rate: number;
	etaH: number | null;
	perMember: MemberRow[];
};

let data: Payload | null = null;
let err = "";
let timer: ReturnType<typeof setInterval>;

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("zh-CN");
const etaText = (h: number | null) =>
	h == null
		? "估算中"
		: h >= 1
			? `${Math.round(h)} 小时`
			: `${Math.max(1, Math.round(h * 60))} 分钟`;
const pct = (a: number, b: number) =>
	b > 0 ? Math.min((a / b) * 100, 100) : 0;

async function load() {
	try {
		const res = await fetch("/api/lab/cleanup-monitor/", { cache: "no-store" });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		data = await res.json();
		err = "";
	} catch (e) {
		err = String(e);
	}
}

onMount(() => {
	load();
	timer = setInterval(load, 15000);
});
onDestroy(() => clearInterval(timer));
</script>

<div class="cm">
	{#if err}
		<p class="cm-err">读取失败:{err}(管线状态文件缺失或 dev 服务未运行)</p>
	{/if}
	{#if data}
		<div class="cm-cards">
			<div class="cm-card">
				<div class="cm-k">库内总数</div>
				<div class="cm-v">{fmt(data.sumOnDisk)}<small> / {fmt(data.scanTotal)} 张</small></div>
			</div>
			<div class="cm-card">
				<div class="cm-k">成员完成</div>
				<div class="cm-v">{data.vlmDone}<small> / {data.membersTotal}</small></div>
			</div>
			<div class="cm-card">
				<div class="cm-k">已判图</div>
				<div class="cm-v">{fmt(data.judged)}<small> 张</small></div>
				<div class="cm-s">均速 {fmt(data.rate)} 张/时</div>
			</div>
			<div class="cm-card">
				<div class="cm-k">判出废片</div>
				<div class="cm-v cm-gold">{fmt(data.eliminated)}<small> 张</small></div>
				<div class="cm-s">待统一隔离(不删除)</div>
			</div>
			<div class="cm-card">
				<div class="cm-k">无人脸隔离</div>
				<div class="cm-v">{fmt(data.sumNoface)}<small> 张</small></div>
				<div class="cm-s">预筛阶段已移入隔离区</div>
			</div>
			<div class="cm-card">
				<div class="cm-k">预计剩余</div>
				<div class="cm-v">{etaText(data.etaH)}</div>
				<div class="cm-s">已运行 {data.elapsedH} 小时</div>
			</div>
			<div class="cm-card">
				<div class="cm-k">运行状态</div>
				<div class="cm-pills">
					<span class={`cm-pill ${data.gpu ? "ok" : "bad"}`}>{data.gpu ? "GPU 正常" : "GPU 掉线"}</span>
					<span class={`cm-pill ${data.driverAlive ? "ok" : "warn"}`}>
						{data.driverAlive ? "管线运行中" : `> ${data.stateAgeMin} 分钟无写盘`}
					</span>
				</div>
			</div>
		</div>

		<div class="cm-sect">
			<h3>总进度</h3>
			<div class="cm-bar">
				<i style={`width:${pct(data.vlmDone, data.membersTotal)}%`} />
			</div>
			<p class="cm-note">
				成员完成 {(pct(data.vlmDone, data.membersTotal)).toFixed(1)}% · 判图 {fmt(data.judged)} / 约
				{fmt(data.estTotalWithface)} 张(按已预筛样本外推全库,随进度校准)
			</p>
			<p class="cm-note">
				安全机制:整个过程只有「移入隔离区」,没有任何删除;错关的好图随时可以捞回来。
			</p>
		</div>

		<div class="cm-sect">
			<h3>当前正在处理</h3>
			{#if data.current}
				<p class="cm-cur-name">{data.current.m}</p>
				<p class="cm-note">
					预筛:{data.current.prescreen === "ok" ? "完成" : "待处理"} · 待判 {fmt(data.current.listN)} 张 · 已判
					{fmt(data.current.judged)} 张 · 判出废片 {fmt(data.current.eliminated)}
				</p>
				<div class="cm-bar gold">
					<i style={`width:${pct(data.current.judged, data.current.listN)}%`} />
				</div>
			{:else}
				<p class="cm-note">全部成员已处理完毕 ✔ 等待复核与统一隔离</p>
			{/if}
		</div>

		<div class="cm-sect">
			<h3>成员明细(按耗时排序)</h3>
			<div class="cm-scroll">
				<table>
					<thead>
						<tr>
							<th>成员</th>
							<th class="num">盘上</th>
							<th class="num">无人脸隔离</th>
							<th class="num">待判</th>
							<th class="num">VLM</th>
							<th class="num">耗时</th>
							<th>状态</th>
						</tr>
					</thead>
					<tbody>
						{#each data.perMember as p (p.m)}
							<tr>
								<td>{p.m}</td>
								<td class="num">{fmt(p.onDisk)}</td>
								<td class="num">{fmt(p.noface)}</td>
								<td class="num">{fmt(p.withface)}</td>
								<td class="num">{p.vlm === "ok" ? "✓" : p.vlm === "none-needed" ? "—" : (p.vlm ?? "").slice(0, 20)}</td>
								<td class="num">{p.secs ? `${Math.round(p.secs / 60)}分` : ""}</td>
								<td>
									{#if p.vlm === "ok" || p.vlm === "none-needed"}
										<span class="cm-pill ok">完成</span>
									{:else}
										<span class="cm-pill warn">进行中</span>
									{/if}
								</td>
							</tr>
						{:else}
							<tr><td colspan="7">暂无</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<p class="cm-note">
			管线:①机械预筛(提特征 + 没人脸自动隔离) → ②本地大模型判内容类废片 → ③全部判完后由 GLM
			复核并统一隔离移动 → ④老板抽查隔离区。
		</p>
	{:else}
		<p class="cm-note">加载中…</p>
	{/if}
</div>

<style>
	.cm {
		color: rgb(228 228 231);
	}
	.cm-err {
		border: 1px solid rgb(248 113 113 / 0.4);
		border-radius: 0.75rem;
		background: rgb(69 10 10 / 0.4);
		color: rgb(252 165 165);
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
	}
	.cm-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.cm-card {
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.875rem;
		background: rgb(255 255 255 / 0.04);
		padding: 0.875rem;
	}
	.cm-k {
		font-size: 0.72rem;
		color: rgb(161 161 170);
		margin-bottom: 0.35rem;
	}
	.cm-v {
		font-size: 1.5rem;
		font-weight: 800;
		color: #fff;
		font-variant-numeric: tabular-nums;
	}
	.cm-v small {
		font-size: 0.72rem;
		font-weight: 500;
		color: rgb(161 161 170);
	}
	.cm-v.cm-gold {
		color: #e6c26e;
	}
	.cm-s {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		color: rgb(139 147 161);
	}
	.cm-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.4rem;
	}
	.cm-pill {
		display: inline-block;
		border-radius: 9999px;
		padding: 0.125rem 0.625rem;
		font-size: 0.7rem;
		font-weight: 700;
	}
	.cm-pill.ok {
		background: rgb(5 46 22);
		color: rgb(74 222 128);
	}
	.cm-pill.warn {
		background: rgb(69 26 3);
		color: rgb(251 191 36);
	}
	.cm-pill.bad {
		background: rgb(69 10 10);
		color: rgb(248 113 113);
	}
	.cm-sect {
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.875rem;
		background: rgb(255 255 255 / 0.03);
		padding: 0.875rem;
		margin-bottom: 1rem;
	}
	.cm-sect h3 {
		margin: 0 0 0.6rem;
		font-size: 0.82rem;
		font-weight: 800;
		color: rgb(170 179 192);
	}
	.cm-bar {
		height: 0.875rem;
		border-radius: 0.375rem;
		background: rgb(35 42 52);
		overflow: hidden;
	}
	.cm-bar i {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #22d3ee);
		transition: width 0.6s ease;
	}
	.cm-bar.gold i {
		background: linear-gradient(90deg, #f59e0b, #fbbf24);
	}
	.cm-note {
		margin: 0.5rem 0 0;
		font-size: 0.72rem;
		line-height: 1.6;
		color: rgb(139 147 161);
	}
	.cm-cur-name {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: #f7e3ae;
	}
	.cm-scroll {
		max-height: 26rem;
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid rgb(35 42 52);
		white-space: nowrap;
	}
	th {
		color: rgb(139 147 161);
		font-weight: 500;
		position: sticky;
		top: 0;
		background: #101318;
	}
	td.num,
	th.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
