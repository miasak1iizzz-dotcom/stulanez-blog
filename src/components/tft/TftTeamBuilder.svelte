<script lang="ts">
type TraitRef = { id: string; name: string; amount: number };
type Unit = {
	id: string;
	name: string;
	cost: number;
	plannerCode: number;
	traits: TraitRef[];
	image: string;
};
type Trait = {
	id: string;
	name: string;
	description: string;
	breakpoints: { min: number; max: number | null; style: number }[];
	image: string;
};
type Item = {
	id: string;
	name: string;
	category: "component" | "standard" | "emblem" | "artifact";
	image: string;
};
type TftData = {
	set: number;
	patch: string;
	updatedAt: string;
	units: Unit[];
	traits: Trait[];
	items: Item[];
};
type BoardUnit = { unitId: string; star: number; items: string[] };
type TraitStatus = Trait & {
	count: number;
	activeStyle: number;
	nextAt: number | null;
};

interface Props {
	data: TftData;
}

const { data }: Props = $props();
const BOARD_SIZE = 28;
const SHARE_PARAM = "team";
const STORAGE_KEY = "stulanez:tft-set18-builder:v1";
const plannerPlacement = [24, 17, 22, 19, 26, 10, 14, 12, 5, 8];
const itemGroups = [
	{ id: "all", label: "全部" },
	{ id: "standard", label: "成装" },
	{ id: "component", label: "散件" },
	{ id: "emblem", label: "纹章" },
	{ id: "artifact", label: "神器" },
] as const;

let board = $state<(BoardUnit | null)[]>(Array(BOARD_SIZE).fill(null));
let activeTab = $state<"units" | "items">("units");
let search = $state("");
let itemGroup = $state<(typeof itemGroups)[number]["id"]>("all");
let selectedCell = $state<number | null>(null);
let armedUnitId = $state<string | null>(null);
let showNames = $state(true);
let showImport = $state(false);
let plannerCodeInput = $state("");
let toast = $state("");
let hydrated = $state(false);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const unitMap = $derived(new Map(data.units.map((unit) => [unit.id, unit])));
const itemMap = $derived(new Map(data.items.map((item) => [item.id, item])));
const traitMap = $derived(
	new Map(data.traits.map((trait) => [trait.id, trait])),
);
const selectedBoardUnit = $derived(
	selectedCell === null ? null : board[selectedCell],
);
const selectedUnit = $derived(
	selectedBoardUnit ? unitMap.get(selectedBoardUnit.unitId) : null,
);
const filteredUnits = $derived.by(() => {
	const query = search.trim().toLocaleLowerCase("zh-CN");
	return data.units.filter(
		(unit) =>
			!query ||
			unit.name.toLocaleLowerCase("zh-CN").includes(query) ||
			unit.traits.some((trait) =>
				trait.name.toLocaleLowerCase("zh-CN").includes(query),
			),
	);
});
const filteredItems = $derived.by(() => {
	const query = search.trim().toLocaleLowerCase("zh-CN");
	return data.items.filter(
		(item) =>
			(itemGroup === "all" || item.category === itemGroup) &&
			(!query || item.name.toLocaleLowerCase("zh-CN").includes(query)),
	);
});
const traitStatuses = $derived.by(() => {
	const counts = new Map<string, number>();
	for (const slot of board) {
		if (!slot) continue;
		const unit = unitMap.get(slot.unitId);
		for (const trait of unit?.traits ?? []) {
			counts.set(trait.id, (counts.get(trait.id) ?? 0) + trait.amount);
		}
	}
	return [...counts]
		.map(([id, count]) => {
			const trait = traitMap.get(id) ?? {
				id,
				name:
					data.units
						.flatMap((unit) => unit.traits)
						.find((entry) => entry.id === id)?.name ?? id,
				description: "",
				breakpoints: [],
				image: "",
			};
			const reached = trait.breakpoints.filter((point) => point.min <= count);
			const current = reached.at(-1);
			const next = trait.breakpoints.find((point) => point.min > count);
			return {
				...trait,
				count,
				activeStyle: current?.style ?? 0,
				nextAt: next?.min ?? null,
			} satisfies TraitStatus;
		})
		.sort(
			(a, b) =>
				Number(b.activeStyle > 0) - Number(a.activeStyle > 0) ||
				b.activeStyle - a.activeStyle ||
				b.count - a.count ||
				a.name.localeCompare(b.name, "zh-CN"),
		);
});
const unitCount = $derived(board.filter(Boolean).length);

$effect(() => {
	if (typeof window === "undefined" || hydrated) return;
	const fromUrl = new URL(window.location.href).searchParams.get(SHARE_PARAM);
	const stored = window.localStorage.getItem(STORAGE_KEY);
	try {
		if (fromUrl) board = decodeTeam(fromUrl);
		else if (stored) board = normalizeBoard(JSON.parse(stored));
	} catch {
		notify("阵容记录无法读取，已为你打开空棋盘");
	}
	hydrated = true;
});

$effect(() => {
	if (!hydrated || typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
});

function normalizeBoard(value: unknown): (BoardUnit | null)[] {
	if (!Array.isArray(value)) return Array(BOARD_SIZE).fill(null);
	return Array.from({ length: BOARD_SIZE }, (_, index) => {
		const slot = value[index] as Partial<BoardUnit> | null;
		if (!slot?.unitId || !unitMap.has(slot.unitId)) return null;
		return {
			unitId: slot.unitId,
			star: Math.min(3, Math.max(1, Number(slot.star) || 1)),
			items: Array.isArray(slot.items)
				? slot.items.filter((id) => itemMap.has(id)).slice(0, 3)
				: [],
		};
	});
}

function notify(message: string) {
	toast = message;
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => (toast = ""), 2400);
}

function cloneBoard() {
	board = board.map((slot) =>
		slot ? { ...slot, items: [...slot.items] } : null,
	);
}

function placeUnit(unitId: string, target: number) {
	const existing = board.findIndex((slot) => slot?.unitId === unitId);
	if (existing === target) {
		selectedCell = target;
		armedUnitId = null;
		return;
	}
	if (existing >= 0) board[existing] = null;
	board[target] = { unitId, star: 1, items: [] };
	cloneBoard();
	selectedCell = target;
	armedUnitId = null;
}

function chooseUnit(unitId: string) {
	const existing = board.findIndex((slot) => slot?.unitId === unitId);
	if (existing >= 0) {
		selectedCell = existing;
		armedUnitId = null;
		return;
	}
	if (selectedCell !== null && !board[selectedCell]) {
		placeUnit(unitId, selectedCell);
		return;
	}
	const empty = board.findIndex((slot) => !slot);
	if (empty >= 0) placeUnit(unitId, empty);
	else notify("棋盘已经放满了");
}

function clickCell(index: number) {
	if (armedUnitId && !board[index]) {
		placeUnit(armedUnitId, index);
		return;
	}
	selectedCell = index;
}

function handleDragStart(event: DragEvent, payload: string) {
	event.dataTransfer?.setData("text/plain", payload);
	if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function handleDrop(event: DragEvent, target: number) {
	event.preventDefault();
	const payload = event.dataTransfer?.getData("text/plain") ?? "";
	if (payload.startsWith("unit:")) {
		placeUnit(payload.slice(5), target);
		return;
	}
	if (!payload.startsWith("board:")) return;
	const source = Number(payload.slice(6));
	if (!Number.isInteger(source) || source === target || !board[source]) return;
	const moving = board[source];
	board[source] = board[target];
	board[target] = moving;
	cloneBoard();
	selectedCell = target;
}

function setStar(star: number) {
	if (selectedCell === null || !board[selectedCell]) return;
	board[selectedCell] = { ...board[selectedCell], star } as BoardUnit;
	cloneBoard();
}

function removeSelected() {
	if (selectedCell === null) return;
	board[selectedCell] = null;
	cloneBoard();
	selectedCell = null;
}

function toggleItem(itemId: string) {
	if (selectedCell === null || !board[selectedCell]) {
		notify("请先在棋盘上选择一名弈子");
		return;
	}
	const slot = board[selectedCell] as BoardUnit;
	const items = [...slot.items];
	const existing = items.indexOf(itemId);
	if (existing >= 0) items.splice(existing, 1);
	else if (items.length < 3) items.push(itemId);
	else {
		notify("每名弈子最多携带 3 件装备");
		return;
	}
	board[selectedCell] = { ...slot, items };
	cloneBoard();
}

function clearBoard() {
	if (unitCount && !window.confirm("确定清空当前阵容吗？")) return;
	board = Array(BOARD_SIZE).fill(null);
	selectedCell = null;
	armedUnitId = null;
	notify("棋盘已清空");
}

function encodeTeam() {
	const compact = board.map((slot) =>
		slot ? [slot.unitId, slot.star, slot.items] : null,
	);
	const bytes = new TextEncoder().encode(JSON.stringify(compact));
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function decodeTeam(value: string) {
	const padded = value
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	const compact = JSON.parse(new TextDecoder().decode(bytes));
	return normalizeBoard(
		compact.map((slot: [string, number, string[]] | null) =>
			slot ? { unitId: slot[0], star: slot[1], items: slot[2] } : null,
		),
	);
}

async function copyShareLink() {
	const url = new URL(window.location.href);
	url.searchParams.set(SHARE_PARAM, encodeTeam());
	await navigator.clipboard.writeText(url.toString());
	window.history.replaceState({}, "", url);
	notify("分享链接已复制");
}

function exportPlannerCode() {
	const codes = board
		.filter((slot): slot is BoardUnit => Boolean(slot))
		.slice(0, 10)
		.map((slot) => unitMap.get(slot.unitId)?.plannerCode ?? 0);
	while (codes.length < 10) codes.push(0);
	return `02${codes.map((code) => code.toString(16).padStart(3, "0")).join("")}TFTSet18`;
}

async function copyPlannerCode() {
	const code = exportPlannerCode();
	plannerCodeInput = code;
	await navigator.clipboard.writeText(code);
	showImport = true;
	notify("客户端阵容码已复制");
}

function importPlannerCode() {
	const code = plannerCodeInput.trim();
	const match = code.match(/^02([0-9a-fA-F]{30})TFTSet18$/);
	if (!match) {
		notify("阵容码格式不正确");
		return;
	}
	const nextBoard: (BoardUnit | null)[] = Array(BOARD_SIZE).fill(null);
	for (let index = 0; index < 10; index++) {
		const plannerCode = Number.parseInt(
			match[1].slice(index * 3, index * 3 + 3),
			16,
		);
		if (!plannerCode) continue;
		const unit = data.units.find((entry) => entry.plannerCode === plannerCode);
		if (unit)
			nextBoard[plannerPlacement[index]] = {
				unitId: unit.id,
				star: 1,
				items: [],
			};
	}
	board = nextBoard;
	selectedCell = null;
	notify("阵容码已导入；客户端阵容码不包含站位与装备");
}

function costColor(cost: number) {
	return (
		["#7c8799", "#5dbb75", "#49a7e8", "#b46de5", "#f0b84b", "#ef7b45"][cost] ??
		"#e0d4a4"
	);
}

function traitColor(style: number) {
	return (
		[
			"#596574",
			"#b18b66",
			"#9baebd",
			"#d8a83d",
			"#78a9dc",
			"#e2b85b",
			"#d979f2",
		][style] ?? "#596574"
	);
}

function traitProgress(trait: TraitStatus) {
	if (!trait.nextAt) return "已达最高层级";
	return trait.activeStyle
		? `距下一级还差 ${trait.nextAt - trait.count}`
		: `${trait.count}/${trait.nextAt}`;
}

function loadImage(src: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = reject;
		image.src = src;
	});
}

function drawHex(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
) {
	context.beginPath();
	for (let side = 0; side < 6; side++) {
		const angle = (Math.PI / 180) * (60 * side);
		const px = x + radius * Math.cos(angle);
		const py = y + radius * Math.sin(angle);
		if (side === 0) context.moveTo(px, py);
		else context.lineTo(px, py);
	}
	context.closePath();
}

async function downloadScreenshot() {
	const canvas = document.createElement("canvas");
	canvas.width = 1280;
	canvas.height = 720;
	const context = canvas.getContext("2d");
	if (!context) return;
	const gradient = context.createLinearGradient(0, 0, 1280, 720);
	gradient.addColorStop(0, "#071a24");
	gradient.addColorStop(1, "#123b36");
	context.fillStyle = gradient;
	context.fillRect(0, 0, 1280, 720);
	context.fillStyle = "#f3e4b5";
	context.font = "700 36px system-ui";
	context.fillText("星域幻想 · S18 阵容规划器", 64, 62);
	context.fillStyle = "#86aaa2";
	context.font = "18px system-ui";
	context.fillText(`${unitCount} 名弈子 · 数据版本 ${data.patch}`, 66, 94);

	const images = new Map<string, HTMLImageElement>();
	await Promise.all(
		board.map(async (slot) => {
			if (!slot || images.has(slot.unitId)) return;
			const unit = unitMap.get(slot.unitId);
			if (!unit) return;
			try {
				images.set(slot.unitId, await loadImage(unit.image));
			} catch {
				// 单个头像失败时仍可导出其余阵容。
			}
		}),
	);

	const radius = 56;
	for (let index = 0; index < BOARD_SIZE; index++) {
		const row = Math.floor(index / 7);
		const column = index % 7;
		const x = 92 + column * 98 + (row % 2 ? 49 : 0);
		const y = 160 + row * 97;
		drawHex(context, x, y, radius);
		context.fillStyle = "#102f37";
		context.fill();
		context.strokeStyle = "#3c625f";
		context.lineWidth = 3;
		context.stroke();
		const slot = board[index];
		if (!slot) continue;
		const unit = unitMap.get(slot.unitId);
		const image = images.get(slot.unitId);
		if (image) {
			context.save();
			drawHex(context, x, y, radius - 4);
			context.clip();
			context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
			context.restore();
		}
		context.strokeStyle = costColor(unit?.cost ?? 0);
		context.lineWidth = 5;
		drawHex(context, x, y, radius - 2);
		context.stroke();
		context.fillStyle = "#ffd86a";
		context.font = "700 18px system-ui";
		context.textAlign = "center";
		context.fillText("★".repeat(slot.star), x, y - 35);
		context.fillStyle = "#ffffff";
		context.font = "700 15px system-ui";
		context.fillText(unit?.name ?? "", x, y + 42);
	}

	context.textAlign = "left";
	context.fillStyle = "#dcebe6";
	context.font = "700 24px system-ui";
	context.fillText("羁绊", 850, 140);
	traitStatuses.slice(0, 12).forEach((trait, index) => {
		const y = 184 + index * 39;
		context.fillStyle = traitColor(trait.activeStyle);
		context.fillRect(850, y - 18, 8, 24);
		context.fillStyle = trait.activeStyle ? "#f4ead1" : "#8ca09d";
		context.font = "600 19px system-ui";
		context.fillText(`${trait.count}  ${trait.name}`, 875, y);
	});

	const link = document.createElement("a");
	link.download = `tft-set18-${Date.now()}.png`;
	link.href = canvas.toDataURL("image/png");
	link.click();
	notify("阵容图片已生成");
}
</script>

<svelte:head>
	<meta name="theme-color" content="#071a24" />
</svelte:head>

<div class="builder-shell">
	<header class="builder-header">
		<div>
			<div class="eyebrow">TEAMFIGHT TACTICS · SET {data.set}</div>
			<h2>星域阵容工坊</h2>
			<p>在六角棋盘上自由摆放弈子，实时计算羁绊，并为核心英雄配置装备。</p>
		</div>
		<div class="set-badge">
			<span>S18</span>
			<small>版本 {data.patch}</small>
		</div>
	</header>

	<div class="action-bar" aria-label="阵容操作">
		<button type="button" onclick={copyShareLink} title="复制包含站位、星级和装备的链接">
			<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>
			分享链接
		</button>
		<button type="button" onclick={copyPlannerCode} title="与国服客户端阵容规划器互通">
			<svg viewBox="0 0 24 24"><path d="M9 12h6M12 9v6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>
			阵容码
		</button>
		<button type="button" onclick={downloadScreenshot}>
			<svg viewBox="0 0 24 24"><path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z"/><circle cx="12" cy="13" r="3.5"/></svg>
			生成图片
		</button>
		<button type="button" class:active={showNames} onclick={() => (showNames = !showNames)}>
			<svg viewBox="0 0 24 24"><path d="M4 6h16M8 6v14m8-14v14M6 20h4m4 0h4"/></svg>
			英雄名
		</button>
		<button type="button" class="danger" onclick={clearBoard}>
			<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
			清空
		</button>
	</div>

	{#if showImport}
		<div class="code-panel">
			<div>
				<strong>客户端阵容码</strong>
				<span>可粘贴 S18 阵容码导入；客户端格式只保存英雄，不保存站位、星级和装备。</span>
			</div>
			<input bind:value={plannerCodeInput} aria-label="S18 阵容码" placeholder="02…TFTSet18" />
			<button type="button" onclick={importPlannerCode}>导入</button>
			<button type="button" class="icon-button" aria-label="关闭阵容码面板" onclick={() => (showImport = false)}>×</button>
		</div>
	{/if}

	<div class="workspace">
		<section class="board-panel" aria-label="S18 六角棋盘">
			<div class="board-topline">
				<div><span class="pulse"></span>{unitCount}/28 已上阵</div>
				<span>{armedUnitId ? `请选择棋盘位置：${unitMap.get(armedUnitId)?.name}` : "拖动头像或点击弈子即可上阵"}</span>
			</div>
			<div class="board-grid">
				{#each board as slot, index}
					{@const row = Math.floor(index / 7)}
					{@const column = index % 7}
					{@const unit = slot ? unitMap.get(slot.unitId) : null}
					<button
						type="button"
						class="hex-cell"
						class:selected={selectedCell === index}
						class:armed={Boolean(armedUnitId) && !slot}
						style={`grid-column: ${column * 2 + 1 + (row % 2)} / span 2; grid-row: ${row + 1}; --cost-color: ${costColor(unit?.cost ?? 0)}`}
						onclick={() => clickCell(index)}
						ondblclick={() => slot && selectedCell === index && setStar(slot.star === 3 ? 1 : slot.star + 1)}
						ondragover={(event) => event.preventDefault()}
						ondrop={(event) => handleDrop(event, index)}
						draggable={Boolean(slot)}
						ondragstart={(event) => handleDragStart(event, `board:${index}`)}
						aria-label={unit ? `${unit.name}，${slot?.star} 星` : `空棋格 ${index + 1}`}
					>
						<span class="hex-surface"></span>
						{#if unit && slot}
							<img src={unit.image} alt="" draggable="false" />
							<span class="star-row" aria-hidden="true">{"★".repeat(slot.star)}</span>
							{#if showNames}<span class="unit-name">{unit.name}</span>{/if}
							<span class="item-row">
								{#each slot.items as itemId}
									{@const item = itemMap.get(itemId)}
									{#if item}<img src={item.image} alt={item.name} title={item.name} />{/if}
								{/each}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="selection-panel" class:empty={!selectedUnit}>
				{#if selectedUnit && selectedBoardUnit}
					<img class="selection-portrait" src={selectedUnit.image} alt="" />
					<div class="selection-copy">
						<strong>{selectedUnit.name}</strong>
						<span>{selectedUnit.cost} 费 · {selectedUnit.traits.map((trait) => trait.name).join(" / ")}</span>
					</div>
					<div class="star-control" aria-label="设置星级">
						{#each [1, 2, 3] as star}
							<button type="button" class:active={selectedBoardUnit.star === star} onclick={() => setStar(star)}>{star}★</button>
						{/each}
					</div>
					<button type="button" class="remove-button" onclick={removeSelected}>移下棋盘</button>
				{:else}
					<span>选择棋盘上的弈子，可调整星级、装备或将其移除。</span>
				{/if}
			</div>
		</section>

		<aside class="trait-panel" aria-label="当前阵容羁绊">
			<div class="panel-heading">
				<div>
					<span>SYNERGIES</span>
					<h3>羁绊统计</h3>
				</div>
				<small>{traitStatuses.filter((trait) => trait.activeStyle).length} 个已激活</small>
			</div>
			<div class="trait-list">
				{#if traitStatuses.length}
					{#each traitStatuses as trait}
						<div class="trait-entry" class:inactive={!trait.activeStyle} title={trait.description}>
							<div class="trait-icon" style={`--trait-color: ${traitColor(trait.activeStyle)}`}>
								{#if trait.image}<img src={trait.image} alt="" />{:else}<span>{trait.name.slice(0, 1)}</span>{/if}
							</div>
							<div class="trait-copy">
								<div><strong>{trait.name}</strong><b>{trait.count}</b></div>
								<small>{traitProgress(trait)}</small>
							</div>
						</div>
					{/each}
				{:else}
					<div class="empty-traits">
						<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m8 10 4-2 4 2v4l-4 2-4-2v-4Z"/></svg>
						<strong>羁绊将在这里出现</strong>
						<span>从下方英雄库添加你的第一名弈子</span>
					</div>
				{/if}
			</div>
		</aside>
	</div>

	<section class="library-panel" aria-label="弈子与装备库">
		<div class="library-toolbar">
			<div class="tabs" role="tablist">
				<button type="button" role="tab" aria-selected={activeTab === "units"} class:active={activeTab === "units"} onclick={() => { activeTab = "units"; search = ""; }}>
					英雄 <span>{data.units.length}</span>
				</button>
				<button type="button" role="tab" aria-selected={activeTab === "items"} class:active={activeTab === "items"} onclick={() => { activeTab = "items"; search = ""; }}>
					装备 <span>{data.items.length}</span>
				</button>
			</div>
			<label class="search-box">
				<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
				<input bind:value={search} placeholder={activeTab === "units" ? "搜索英雄或羁绊" : "搜索装备"} />
				{#if search}<button type="button" aria-label="清空搜索" onclick={() => (search = "")}>×</button>{/if}
			</label>
		</div>

		{#if activeTab === "items"}
			<div class="item-filters">
				{#each itemGroups as group}
					<button type="button" class:active={itemGroup === group.id} onclick={() => (itemGroup = group.id)}>{group.label}</button>
				{/each}
				<span>{selectedUnit ? `正在为 ${selectedUnit.name} 配装` : "先选择棋盘上的弈子"}</span>
			</div>
		{/if}

		{#if activeTab === "units"}
			<div class="unit-library">
				{#each [1, 2, 3, 4, 5] as cost}
					{@const costUnits = filteredUnits.filter((unit) => unit.cost === cost)}
					{#if costUnits.length}
						<div class="cost-group">
							<div class="cost-heading" style={`--cost-color: ${costColor(cost)}`}><span>{cost}</span><small>金币</small></div>
							<div class="unit-grid">
								{#each costUnits as unit}
									{@const onBoard = board.some((slot) => slot?.unitId === unit.id)}
									<button
										type="button"
										class="unit-card"
										class:on-board={onBoard}
										class:armed={armedUnitId === unit.id}
										style={`--cost-color: ${costColor(cost)}`}
										onclick={() => chooseUnit(unit.id)}
										draggable="true"
										ondragstart={(event) => handleDragStart(event, `unit:${unit.id}`)}
										title={`${unit.name} · ${unit.traits.map((trait) => trait.name).join(" / ")}`}
									>
										<img src={unit.image} alt="" loading="lazy" />
										<span>{unit.name}</span>
										{#if onBoard}<b>已上阵</b>{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="item-grid">
				{#each filteredItems as item}
					{@const equipped = selectedBoardUnit?.items.includes(item.id)}
					<button type="button" class:equipped onclick={() => toggleItem(item.id)} title={item.name}>
						<img src={item.image} alt="" loading="lazy" />
						<span>{item.name}</span>
						{#if equipped}<b>✓</b>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<footer class="builder-footer">
		<span>数据版本 {data.patch} · 最后同步 {new Date(data.updatedAt).toLocaleDateString("zh-CN")}</span>
		<span>本站与 Riot Games 无隶属或赞助关系；英雄联盟及云顶之弈相关素材归其权利人所有。</span>
	</footer>

	{#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>

<style>
	:global(*) { box-sizing: border-box; }
	.builder-shell {
		--ink: #edf7f2;
		--muted: #8ba8a2;
		--line: rgba(167, 207, 191, 0.17);
		--panel: rgba(9, 29, 36, 0.92);
		--panel-2: rgba(13, 42, 48, 0.86);
		--gold: #e0bd68;
		position: relative;
		isolation: isolate;
		width: 100%;
		overflow: hidden;
		border: 1px solid rgba(168, 204, 190, 0.2);
		border-radius: 24px;
		background:
			radial-gradient(circle at 15% 0%, rgba(35, 113, 103, 0.28), transparent 34rem),
			radial-gradient(circle at 92% 18%, rgba(126, 90, 42, 0.2), transparent 26rem),
			linear-gradient(150deg, #06171f 0%, #0a252b 55%, #071a21 100%);
		box-shadow: 0 28px 70px rgba(0, 10, 14, 0.38);
		color: var(--ink);
		font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
	}
	.builder-shell::before {
		position: absolute;
		inset: 0;
		z-index: -1;
		background-image: linear-gradient(rgba(160, 204, 186, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(160, 204, 186, 0.025) 1px, transparent 1px);
		background-size: 32px 32px;
		content: "";
		mask-image: linear-gradient(to bottom, #000, transparent 70%);
	}
	button, input { font: inherit; }
	button { color: inherit; }
	.builder-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 28px 30px 20px;
		border-bottom: 1px solid var(--line);
	}
	.eyebrow { margin-bottom: 6px; color: #71c8b3; font-size: 11px; font-weight: 800; letter-spacing: .2em; }
	.builder-header h2 { margin: 0; color: #f2ead5; font-family: Georgia, "Songti SC", serif; font-size: clamp(25px, 3vw, 38px); letter-spacing: .04em; }
	.builder-header p { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
	.set-badge { display: grid; place-items: center; min-width: 86px; height: 72px; border: 1px solid rgba(224, 189, 104, .45); border-radius: 14px; background: linear-gradient(145deg, rgba(224, 189, 104, .13), rgba(14, 49, 48, .75)); box-shadow: inset 0 0 24px rgba(224, 189, 104, .08); }
	.set-badge span { color: #f5d987; font-family: Georgia, serif; font-size: 26px; font-weight: 800; line-height: 1; }
	.set-badge small { color: #9fb5ae; font-size: 9px; }
	.action-bar { display: flex; flex-wrap: wrap; gap: 7px; padding: 11px 30px; border-bottom: 1px solid var(--line); background: rgba(3, 15, 20, .35); }
	.action-bar button, .code-panel button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: rgba(20, 57, 61, .55); color: #bed2cc; font-size: 12px; font-weight: 650; cursor: pointer; transition: .18s ease; }
	.action-bar button:hover, .action-bar button.active, .code-panel button:hover { border-color: rgba(101, 206, 179, .45); background: rgba(40, 101, 91, .38); color: #e8f6f1; transform: translateY(-1px); }
	.action-bar button.danger { margin-left: auto; }
	.action-bar button.danger:hover { border-color: rgba(235, 111, 104, .45); background: rgba(122, 45, 45, .3); color: #ffb1aa; }
	.action-bar svg, .search-box svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
	.code-panel { display: grid; grid-template-columns: minmax(190px, .9fr) minmax(260px, 1.5fr) auto auto; align-items: center; gap: 10px; padding: 11px 30px; border-bottom: 1px solid var(--line); background: rgba(92, 70, 30, .15); }
	.code-panel > div { display: grid; gap: 2px; }
	.code-panel strong { color: #e7d8ad; font-size: 12px; }
	.code-panel span { color: #859b95; font-size: 10px; }
	.code-panel input, .search-box input { width: 100%; border: 1px solid var(--line); outline: none; background: rgba(2, 13, 17, .65); color: #e8f1ee; }
	.code-panel input { height: 34px; padding: 0 11px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 11px; }
	.code-panel input:focus, .search-box:focus-within { border-color: rgba(102, 210, 183, .5); box-shadow: 0 0 0 3px rgba(71, 171, 148, .09); }
	.code-panel .icon-button { width: 34px; padding: 0; font-size: 20px; }
	.workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(190px, 24%); gap: 14px; padding: 16px; }
	.board-panel, .trait-panel, .library-panel { border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(145deg, rgba(11, 35, 41, .92), rgba(5, 23, 29, .9)); box-shadow: inset 0 1px rgba(255, 255, 255, .025); }
	.board-panel { min-width: 0; overflow: hidden; }
	.board-topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--line); color: #79968f; font-size: 10px; }
	.board-topline > div { display: flex; align-items: center; gap: 7px; color: #bdd1ca; font-weight: 700; }
	.pulse { width: 7px; height: 7px; border-radius: 50%; background: #55d0aa; box-shadow: 0 0 0 4px rgba(85, 208, 170, .1), 0 0 12px #55d0aa; }
	.board-grid { display: grid; grid-template-columns: repeat(15, 1fr); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 4px 1px; width: 100%; aspect-ratio: 2.05; padding: 24px 3.5% 28px; background: radial-gradient(ellipse at center, rgba(31, 96, 89, .28), transparent 63%), linear-gradient(180deg, rgba(11, 48, 51, .4), rgba(2, 15, 20, .28)); }
	.hex-cell { position: relative; min-width: 0; border: 0; outline: 0; background: transparent; cursor: pointer; filter: drop-shadow(0 5px 4px rgba(0, 7, 9, .34)); isolation: isolate; }
	.hex-surface, .hex-cell > img { position: absolute; inset: 0; width: 100%; height: 100%; clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%); }
	.hex-surface { z-index: -2; background: linear-gradient(145deg, rgba(39, 85, 83, .45), rgba(9, 31, 38, .86)); box-shadow: inset 0 0 0 2px rgba(118, 159, 151, .28); transition: .16s ease; }
	.hex-cell > img { z-index: -1; object-fit: cover; opacity: .92; }
	.hex-cell:has(> img) .hex-surface { background: var(--cost-color); filter: brightness(.95); }
	.hex-cell:has(> img)::before { position: absolute; inset: 3px; z-index: -1; background: #092028; clip-path: polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%); content: ""; }
	.hex-cell:hover .hex-surface, .hex-cell.selected .hex-surface { filter: brightness(1.35); transform: scale(1.035); }
	.hex-cell.selected { filter: drop-shadow(0 0 8px rgba(244, 213, 124, .65)); }
	.hex-cell.armed .hex-surface { animation: breathe 1.2s ease-in-out infinite; background: rgba(67, 145, 125, .75); }
	.star-row { position: absolute; top: 1px; left: 50%; transform: translateX(-50%); color: #ffdc67; font-size: clamp(7px, 1.1vw, 12px); letter-spacing: -2px; text-shadow: 0 1px 3px #3c2900; white-space: nowrap; }
	.unit-name { position: absolute; right: 8%; bottom: 8%; left: 8%; overflow: hidden; padding: 2px 3px; border-radius: 4px; background: rgba(1, 8, 11, .74); color: #fff; font-size: clamp(7px, .82vw, 11px); font-weight: 750; line-height: 1.2; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; white-space: nowrap; }
	.item-row { position: absolute; right: -2px; bottom: 17%; display: grid; gap: 1px; }
	.item-row img { width: clamp(11px, 1.55vw, 19px); height: clamp(11px, 1.55vw, 19px); border: 1px solid #d9b55d; border-radius: 3px; background: #10262d; object-fit: cover; }
	.selection-panel { display: flex; align-items: center; gap: 10px; min-height: 64px; padding: 9px 13px; border-top: 1px solid var(--line); background: rgba(4, 17, 22, .5); }
	.selection-panel.empty { justify-content: center; color: #708b84; font-size: 11px; text-align: center; }
	.selection-portrait { width: 42px; height: 42px; border: 2px solid var(--gold); border-radius: 9px; object-fit: cover; }
	.selection-copy { display: grid; min-width: 0; gap: 3px; }
	.selection-copy strong { color: #f2e7c5; font-size: 14px; }
	.selection-copy span { overflow: hidden; max-width: 245px; color: #79978f; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.star-control { display: flex; gap: 4px; margin-left: auto; }
	.star-control button, .remove-button { height: 30px; border: 1px solid var(--line); border-radius: 7px; background: rgba(25, 61, 62, .55); color: #8fa9a2; font-size: 10px; cursor: pointer; }
	.star-control button { width: 34px; padding: 0; }
	.star-control button.active { border-color: rgba(233, 190, 82, .55); background: rgba(130, 94, 25, .35); color: #ffdc72; }
	.remove-button { margin-left: 5px; padding: 0 10px; }
	.remove-button:hover { border-color: rgba(231, 101, 93, .45); color: #ffaaa4; }
	.trait-panel { min-width: 0; max-height: 100%; overflow: hidden; }
	.panel-heading { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px 10px; border-bottom: 1px solid var(--line); }
	.panel-heading span { color: #5eb39f; font-size: 8px; font-weight: 800; letter-spacing: .18em; }
	.panel-heading h3 { margin: 1px 0 0; color: #e8dfc8; font-size: 16px; }
	.panel-heading small { color: #79968e; font-size: 9px; }
	.trait-list { max-height: 505px; overflow: auto; padding: 7px; scrollbar-color: rgba(106, 146, 137, .4) transparent; scrollbar-width: thin; }
	.trait-entry { display: flex; align-items: center; gap: 8px; min-height: 47px; padding: 6px; border-bottom: 1px solid rgba(157, 194, 181, .07); }
	.trait-entry.inactive { opacity: .58; }
	.trait-icon { display: grid; place-items: center; flex: 0 0 34px; width: 34px; height: 38px; background: var(--trait-color); clip-path: polygon(50% 0, 94% 24%, 86% 78%, 50% 100%, 14% 78%, 6% 24%); }
	.trait-icon::before { position: absolute; content: ""; }
	.trait-icon img { width: 24px; height: 24px; filter: brightness(0) invert(1); object-fit: contain; }
	.trait-icon span { color: #fff; font-size: 13px; font-weight: 800; }
	.trait-copy { min-width: 0; flex: 1; }
	.trait-copy > div { display: flex; align-items: center; justify-content: space-between; gap: 5px; }
	.trait-copy strong { overflow: hidden; color: #dbe8e3; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
	.trait-copy b { color: #f1d27b; font-size: 12px; }
	.trait-copy small { color: #718c85; font-size: 8px; }
	.empty-traits { display: grid; place-items: center; gap: 6px; min-height: 270px; padding: 20px; color: #69847d; text-align: center; }
	.empty-traits svg { width: 54px; height: 54px; margin-bottom: 5px; fill: none; stroke: #38675f; stroke-width: 1; }
	.empty-traits strong { color: #91aaa3; font-size: 12px; }
	.empty-traits span { font-size: 9px; }
	.library-panel { margin: 0 16px 16px; overflow: hidden; }
	.library-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 11px 14px; border-bottom: 1px solid var(--line); background: rgba(4, 18, 23, .42); }
	.tabs { display: flex; gap: 4px; }
	.tabs button { height: 32px; padding: 0 14px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #78958d; font-size: 11px; font-weight: 700; cursor: pointer; }
	.tabs button span { display: inline-grid; place-items: center; min-width: 21px; height: 17px; margin-left: 5px; border-radius: 9px; background: rgba(122, 156, 147, .12); font-size: 8px; }
	.tabs button.active { border-color: rgba(88, 183, 160, .31); background: rgba(37, 93, 84, .3); color: #bfe5da; }
	.search-box { display: flex; align-items: center; gap: 7px; width: min(270px, 45%); height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: rgba(2, 13, 17, .65); color: #698981; }
	.search-box input { min-width: 0; height: 100%; padding: 0; border: 0; background: transparent; font-size: 10px; box-shadow: none !important; }
	.search-box button { border: 0; background: transparent; color: #76918b; cursor: pointer; }
	.unit-library { max-height: 365px; overflow: auto; padding: 10px 12px; scrollbar-color: rgba(106, 146, 137, .4) transparent; scrollbar-width: thin; }
	.cost-group { display: grid; grid-template-columns: 43px minmax(0, 1fr); gap: 8px; margin-bottom: 10px; }
	.cost-heading { display: grid; align-content: center; justify-items: center; min-height: 64px; border-right: 1px solid color-mix(in srgb, var(--cost-color) 45%, transparent); color: var(--cost-color); }
	.cost-heading span { font-family: Georgia, serif; font-size: 21px; font-weight: 800; }
	.cost-heading small { font-size: 8px; }
	.unit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); gap: 6px; }
	.unit-card { position: relative; display: grid; min-width: 0; padding: 0 0 5px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--cost-color) 58%, #122f34); border-radius: 7px; background: #0a252b; cursor: grab; transition: transform .15s ease, filter .15s ease; }
	.unit-card:hover { z-index: 2; filter: brightness(1.18); transform: translateY(-2px); }
	.unit-card.on-board { opacity: .5; filter: saturate(.4); }
	.unit-card.armed { box-shadow: 0 0 0 2px #68cfb5, 0 0 16px rgba(104, 207, 181, .4); }
	.unit-card img { width: 100%; aspect-ratio: 1; object-fit: cover; }
	.unit-card span { overflow: hidden; padding: 4px 3px 0; color: #c7d8d3; font-size: 9px; font-weight: 650; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
	.unit-card b { position: absolute; top: 3px; right: 3px; padding: 2px 4px; border-radius: 4px; background: rgba(2, 12, 15, .78); color: #8ec8b9; font-size: 7px; }
	.item-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding: 9px 14px 2px; }
	.item-filters button { height: 25px; padding: 0 10px; border: 1px solid var(--line); border-radius: 13px; background: transparent; color: #78948d; font-size: 9px; cursor: pointer; }
	.item-filters button.active { border-color: rgba(218, 179, 87, .4); background: rgba(117, 85, 25, .27); color: #f0d486; }
	.item-filters span { margin-left: auto; color: #76918a; font-size: 9px; }
	.item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; max-height: 333px; overflow: auto; padding: 12px 14px; scrollbar-width: thin; }
	.item-grid button { position: relative; display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 6px 3px; border: 1px solid transparent; border-radius: 8px; background: rgba(15, 45, 50, .5); color: #a8beb8; cursor: pointer; }
	.item-grid button:hover, .item-grid button.equipped { border-color: rgba(224, 189, 104, .5); background: rgba(95, 70, 27, .27); color: #ead99f; }
	.item-grid img { width: 38px; height: 38px; border: 1px solid #846b36; border-radius: 6px; object-fit: cover; }
	.item-grid span { width: 100%; overflow: hidden; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
	.item-grid b { position: absolute; top: 3px; right: 4px; color: #f4d372; font-size: 11px; }
	.builder-footer { display: flex; justify-content: space-between; gap: 20px; padding: 3px 20px 15px; color: #55736c; font-size: 8px; line-height: 1.5; }
	.builder-footer span:last-child { text-align: right; }
	.toast { position: fixed; right: 24px; bottom: 24px; z-index: 100; padding: 11px 16px; border: 1px solid rgba(102, 206, 179, .4); border-radius: 10px; background: rgba(5, 28, 31, .96); box-shadow: 0 12px 40px rgba(0, 0, 0, .35); color: #dff5ee; font-size: 12px; animation: toast-in .22s ease-out; }
	@keyframes breathe { 50% { filter: brightness(1.5); transform: scale(1.035); } }
	@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } }
	@media (max-width: 900px) {
		.workspace { grid-template-columns: 1fr; }
		.trait-panel { order: 2; }
		.trait-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); max-height: 240px; }
		.code-panel { grid-template-columns: 1fr auto auto; }
		.code-panel > div { grid-column: 1 / -1; }
	}
	@media (max-width: 640px) {
		.builder-shell { border-radius: 18px; }
		.builder-header { padding: 20px 17px 15px; }
		.builder-header p { display: none; }
		.set-badge { min-width: 68px; height: 58px; }
		.action-bar { padding: 9px 12px; }
		.action-bar button { flex: 1 1 auto; padding: 0 8px; font-size: 10px; }
		.action-bar button.danger { margin-left: 0; }
		.code-panel { grid-template-columns: 1fr auto; padding: 10px 12px; }
		.code-panel input { grid-column: 1 / -1; }
		.workspace { padding: 9px; }
		.board-topline > span { display: none; }
		.board-grid { grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 2px 0; padding: 17px 2.5% 20px; aspect-ratio: 1.75; }
		.selection-panel { flex-wrap: wrap; }
		.selection-copy { flex: 1; }
		.star-control { order: 3; margin-left: 52px; }
		.remove-button { order: 4; margin-left: auto; }
		.library-panel { margin: 0 9px 10px; }
		.library-toolbar { align-items: stretch; flex-direction: column; gap: 8px; }
		.search-box { width: 100%; }
		.unit-library { max-height: 430px; }
		.cost-group { grid-template-columns: 31px minmax(0, 1fr); }
		.unit-grid { grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); }
		.item-grid { grid-template-columns: repeat(auto-fill, minmax(58px, 1fr)); }
		.item-filters span { width: 100%; margin: 2px 0 0; }
		.builder-footer { flex-direction: column; gap: 4px; padding: 3px 13px 13px; }
		.builder-footer span:last-child { text-align: left; }
		.toast { right: 12px; bottom: 12px; left: 12px; text-align: center; }
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
	}
</style>
