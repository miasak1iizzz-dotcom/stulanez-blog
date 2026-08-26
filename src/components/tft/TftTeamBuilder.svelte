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
type Augment = { id: string; name: string; image?: string };
type TftData = {
	set: number;
	patch: string;
	updatedAt: string;
	units: Unit[];
	traits: Trait[];
	items: Item[];
	augments?: Augment[];
};
type BoardUnit = { unitId: string; star: number; items: string[] };
type TraitStatus = Trait & {
	count: number;
	activeStyle: number;
	nextAt: number | null;
};
type PoolMode = "cost" | "name" | "origin" | "class";
type ItemTab = "standard" | "radiant" | "other";
type TooltipState = { x: number; y: number; unitId?: string; itemId?: string };

interface Props {
	data: TftData;
}

const { data }: Props = $props();
const BOARD_ROWS = 4;
const BOARD_COLS = 7;
const BOARD_SIZE = BOARD_ROWS * BOARD_COLS;
const SHARE_PARAM = "team";
const STORAGE_KEY = "stulanez:tft-set18-builder:v2";
const plannerPlacement = [24, 17, 22, 19, 26, 10, 14, 12, 5, 8];
const COST_COLORS = ["", "#b6bcc8", "#37d488", "#54c3ff", "#dc38c3", "#f1c555"];
const STYLE_COLORS = [
	"#5b6b85",
	"#b18b66",
	"#9baebd",
	"#f5bf38",
	"#de0ebd",
	"#37d488",
	"#54c3ff",
];

let board = $state<(BoardUnit | null)[]>(Array(BOARD_SIZE).fill(null));
let enemyBoard = $state<(BoardUnit | null)[]>(Array(BOARD_SIZE).fill(null));
let enemyVisible = $state(false);
let showSkins = $state(true);
let showTips = $state(true);
let showNames = $state(true);
let positionsOnly = $state(false);
let poolMode = $state<PoolMode>("cost");
let itemTab = $state<ItemTab>("standard");
let search = $state("");
let selectedCell = $state<number | null>(null);
let chosenAugments = $state<string[]>([]);
let pickerOpen = $state(false);
let pickerTab = $state<"augments" | "powerups">("augments");
let pickerSearch = $state("");
let importOpen = $state(false);
let plannerCodeInput = $state("");
let toast = $state("");
let tooltip = $state<TooltipState | null>(null);
let hydrated = $state(false);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const unitMap = $derived(new Map(data.units.map((unit) => [unit.id, unit])));
const itemMap = $derived(new Map(data.items.map((item) => [item.id, item])));
const traitMap = $derived(
	new Map(data.traits.map((trait) => [trait.id, trait])),
);
const augmentMap = $derived(
	new Map((data.augments ?? []).map((augment) => [augment.id, augment])),
);
const selectedBoardUnit = $derived(
	selectedCell === null ? null : board[selectedCell],
);
const selectedUnit = $derived(
	selectedBoardUnit ? unitMap.get(selectedBoardUnit.unitId) : null,
);
const placedIds = $derived(
	new Set(board.filter(Boolean).map((slot) => (slot as BoardUnit).unitId)),
);
const searchedUnits = $derived.by(() => {
	const query = search.trim().toLocaleLowerCase("zh-CN");
	return data.units.filter(
		(unit) =>
			!placedIds.has(unit.id) &&
			(!query ||
				unit.name.toLocaleLowerCase("zh-CN").includes(query) ||
				unit.traits.some((trait) =>
					trait.name.toLocaleLowerCase("zh-CN").includes(query),
				)),
	);
});
type PoolGroup = { key: string; label: string; image?: string; band: string; units: Unit[] };
const originIds = $derived(
	new Set(data.units.map((unit) => unit.traits[0]?.id).filter(Boolean)),
);
const poolGroups = $derived.by(() => {
	if (poolMode === "cost") {
		return [1, 2, 3, 4, 5]
			.map((cost) => ({
				key: `cost-${cost}`,
				label: "",
				band: COST_COLORS[cost] ?? "transparent",
				units: searchedUnits
					.filter((unit) => unit.cost === cost)
					.sort((a, b) => a.plannerCode - b.plannerCode),
			}))
			.filter((group) => group.units.length) satisfies PoolGroup[];
	}
	if (poolMode === "name") {
		return [
			{
				key: "name",
				label: "",
				band: "transparent",
				units: [...searchedUnits].sort((a, b) =>
					a.name.localeCompare(b.name, "zh-CN"),
				),
			},
		] satisfies PoolGroup[];
	}
	const wantOrigin = poolMode === "origin";
	return [...traitMap.values()]
		.filter((trait) => originIds.has(trait.id) === wantOrigin)
		.map((trait) => ({
			key: trait.id,
			label: trait.name,
			image: trait.image,
			band: "transparent",
			units: searchedUnits.filter((unit) =>
				unit.traits.some((entry, index) => entry.id === trait.id && wantOrigin === (index === 0)),
			),
		}))
		.filter((group) => group.units.length) satisfies PoolGroup[];
});
const emblemItems = $derived(data.items.filter((item) => item.category === "emblem"));
const artifactItems = $derived(data.items.filter((item) => item.category === "artifact"));
const radiantItems = $derived(data.items.filter((item) => item.category === "radiant"));
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
			const trait = traitMap.get(id);
			const reached = (trait?.breakpoints ?? []).filter(
				(point) => point.min <= count,
			);
			const next = (trait?.breakpoints ?? []).find(
				(point) => point.min > count,
			);
			return {
				id,
				name: trait?.name ?? id,
				description: trait?.description ?? "",
				breakpoints: trait?.breakpoints ?? [],
				image: trait?.image ?? "",
				count,
				activeStyle: reached.at(-1)?.style ?? 0,
				nextAt: next?.min ?? null,
			} satisfies TraitStatus;
		})
		.sort(
			(a, b) =>
				b.activeStyle - a.activeStyle ||
				b.count - a.count ||
				a.name.localeCompare(b.name, "zh-CN"),
		);
});
const unitCount = $derived(board.filter(Boolean).length);
const goldTotal = $derived(
	board.reduce(
		(sum, slot) =>
			sum + (slot ? ((unitMap.get(slot.unitId)?.cost ?? 0) * 3) : 0),
		0,
	),
);

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

function cloneBoard(target: "main" | "enemy" = "main") {
	if (target === "enemy")
		enemyBoard = enemyBoard.map((slot) =>
			slot ? { ...slot, items: [...slot.items] } : null,
		);
	else
		board = board.map((slot) =>
			slot ? { ...slot, items: [...slot.items] } : null,
		);
}

function placeUnit(unitId: string, target: number) {
	const target_ = enemyVisible ? enemyBoard : board;
	const existing = target_.findIndex((slot) => slot?.unitId === unitId);
	if (existing === target) return;
	const next = [...target_];
	if (existing >= 0) next[existing] = null;
	next[target] = { unitId, star: 1, items: [] };
	if (enemyVisible) enemyBoard = next;
	else board = next;
	cloneBoard(enemyVisible ? "enemy" : "main");
	selectedCell = null;
}

function chooseUnit(unitId: string) {
	const target_ = enemyVisible ? enemyBoard : board;
	const existing = target_.findIndex((slot) => slot?.unitId === unitId);
	if (existing >= 0) {
		if (enemyVisible) enemyBoard[existing] = null;
		else board[existing] = null;
		cloneBoard(enemyVisible ? "enemy" : "main");
		return;
	}
	const empty = target_.findIndex((slot) => !slot);
	if (empty >= 0) placeUnit(unitId, empty);
	else notify(enemyVisible ? "敌方棋盘已经放满了" : "棋盘已经放满了");
}

function clickCell(index: number) {
	const target_ = enemyVisible ? enemyBoard : board;
	const slot = target_[index];
	if (!slot) {
		selectedCell = null;
		return;
	}
	if (selectedCell === index) {
		if (enemyVisible) enemyBoard[index] = null;
		else board[index] = null;
		cloneBoard(enemyVisible ? "enemy" : "main");
		selectedCell = null;
		return;
	}
	selectedCell = index;
}

function cycleStar(index: number) {
	const slot = enemyVisible ? enemyBoard[index] : board[index];
	if (!slot) return;
	const star = slot.star === 3 ? 1 : 3;
	if (enemyVisible) enemyBoard[index] = { ...slot, star };
	else board[index] = { ...slot, star };
	cloneBoard(enemyVisible ? "enemy" : "main");
}

function handleDragStart(event: DragEvent, payload: string) {
	event.dataTransfer?.setData("text/plain", payload);
	if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function handleDrop(event: DragEvent, target: number) {
	event.preventDefault();
	event.stopPropagation();
	const payload = event.dataTransfer?.getData("text/plain") ?? "";
	if (payload.startsWith("unit:")) {
		placeUnit(payload.slice(5), target);
		return;
	}
	if (payload.startsWith("item:")) {
		equipItem(payload.slice(5), target);
		return;
	}
	if (!payload.startsWith("board:")) return;
	const source = Number(payload.slice(6));
	const target_ = enemyVisible ? enemyBoard : board;
	if (!Number.isInteger(source) || source === target || !target_[source]) return;
	const next = [...target_];
	const moving = next[source];
	next[source] = next[target];
	next[target] = moving;
	if (enemyVisible) enemyBoard = next;
	else board = next;
	cloneBoard(enemyVisible ? "enemy" : "main");
	selectedCell = target;
}

// 拖到棋格外松手：删除该棋子（tactics.tools 交互）
function handleOutsideDrop(event: DragEvent) {
	const payload = event.dataTransfer?.getData("text/plain") ?? "";
	if (!payload.startsWith("board:")) return;
	event.preventDefault();
	const source = Number(payload.slice(6));
	const target_ = enemyVisible ? enemyBoard : board;
	if (!Number.isInteger(source) || !target_[source]) return;
	const next = [...target_];
	next[source] = null;
	if (enemyVisible) enemyBoard = next;
	else board = next;
	cloneBoard(enemyVisible ? "enemy" : "main");
	selectedCell = null;
	notify("已移出阵容");
}

function equipItem(itemId: string, target: number) {
	const slot = enemyVisible ? enemyBoard[target] : board[target];
	if (!slot) {
		notify("先把弈子放到这个棋格上");
		return;
	}
	const items = [...slot.items];
	const existing = items.indexOf(itemId);
	if (existing >= 0) items.splice(existing, 1);
	else if (items.length < 3) items.push(itemId);
	else {
		notify("每名弈子最多携带 3 件装备");
		return;
	}
	if (enemyVisible) enemyBoard[target] = { ...slot, items };
	else board[target] = { ...slot, items };
	cloneBoard(enemyVisible ? "enemy" : "main");
}

function clickItem(itemId: string) {
	if (selectedCell === null) {
		notify("先点击棋盘上的弈子，再点击装备");
		return;
	}
	equipItem(itemId, selectedCell);
}

function clearBoard() {
	const target = enemyVisible ? enemyBoard : board;
	const count = target.filter(Boolean).length;
	if (count && !window.confirm(enemyVisible ? "确定清空敌方棋盘吗？" : "确定清空当前阵容吗？"))
		return;
	if (enemyVisible) enemyBoard = Array(BOARD_SIZE).fill(null);
	else board = Array(BOARD_SIZE).fill(null);
	selectedCell = null;
	notify("棋盘已清空");
}

function toggleAugment(augmentId: string) {
	const items = [...chosenAugments];
	const existing = items.indexOf(augmentId);
	if (existing >= 0) items.splice(existing, 1);
	else if (items.length < 3) items.push(augmentId);
	else {
		notify("最多选择 3 个强化符文");
		return;
	}
	chosenAugments = items;
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
	importOpen = true;
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
	importOpen = false;
	notify("阵容码已导入；客户端阵容码不包含站位与装备");
}

function showTooltip(event: MouseEvent, payload: { unitId?: string; itemId?: string }) {
	if (!showTips) return;
	const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
	tooltip = { x: rect.x, y: rect.y + rect.height, ...payload };
}

function hideTooltip() {
	tooltip = null;
}

function moveTooltip(event: MouseEvent) {
	if (!tooltip) return;
	tooltip = { ...tooltip, x: event.clientX, y: event.clientY };
}

function styleColor(style: number) {
	return STYLE_COLORS[style] ?? STYLE_COLORS[0];
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
		const angle = (Math.PI / 180) * (60 * side - 30);
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
	context.fillStyle = "#0c1524";
	context.fillRect(0, 0, 1280, 720);
	context.fillStyle = "#142a52";
	context.fillRect(24, 24, 1232, 672);
	context.fillStyle = "#eaf6ff";
	context.font = "700 30px Montserrat, system-ui";
	context.fillText(`SET ${data.set} 阵容 · ${data.patch}`, 60, 84);
	context.fillStyle = "#8fa3c8";
	context.font = "16px system-ui";
	context.fillText(`${unitCount} 弈子 · ${goldTotal} 金币`, 60, 112);

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

	const radius = 52;
	for (let index = 0; index < BOARD_SIZE; index += 1) {
		const row = Math.floor(index / BOARD_COLS);
		const column = index % BOARD_COLS;
		const x = 130 + column * 104 + (row % 2 ? 52 : 0);
		const y = 170 + row * 92;
		const slot = board[index];
		const unit = slot ? unitMap.get(slot.unitId) : null;
		drawHex(context, x, y, radius);
		context.fillStyle = unit ? (COST_COLORS[unit.cost] ?? "#bbb") : "#0b1c3a";
		context.fill();
		if (unit) {
			drawHex(context, x, y, radius - 5);
			context.fillStyle = "#0b1c3a";
			context.fill();
		}
		if (slot && unit) {
			const image = images.get(slot.unitId);
			if (image) {
				context.save();
				drawHex(context, x, y, radius - 8);
				context.clip();
				context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
				context.restore();
			}
			context.fillStyle = "#ffffff";
			context.font = "700 15px system-ui";
			context.textAlign = "center";
			context.fillText(unit.name, x, y + radius - 12);
			context.fillStyle = "#ffd86a";
			context.font = "700 13px system-ui";
			context.fillText("★".repeat(slot.star), x, y - radius + 22);
			context.textAlign = "left";
		}
	}

	context.fillStyle = "#dfe8ff";
	context.font = "700 22px system-ui";
	context.fillText("羁绊", 940, 170);
	traitStatuses.slice(0, 12).forEach((trait, index) => {
		const y = 210 + index * 38;
		context.fillStyle = styleColor(trait.activeStyle);
		context.fillRect(940, y - 16, 8, 22);
		context.fillStyle = trait.activeStyle ? "#eaf6ff" : "#8fa3c8";
		context.font = "600 18px system-ui";
		context.fillText(`${trait.count}  ${trait.name}`, 962, y);
	});

	const link = document.createElement("a");
	link.download = `tft-set18-${Date.now()}.png`;
	link.href = canvas.toDataURL("image/png");
	link.click();
	notify("阵容图片已生成");
}
</script>

<svelte:head>
	<meta name="theme-color" content="#0a1322" />
</svelte:head>

<div class="ttb" onmouseleave={hideTooltip} ondrop={handleOutsideDrop}>
	<section class="ttb-controls" aria-label="阵容操作">
		<div class="ttc-set">
			<span class="ttc-set-badge">SET {data.set}</span>
			<span class="ttc-patch">{data.patch}</span>
		</div>
		<span class="ttc-hint">右键选中弈子标为3星</span>
		<button type="button" class="ttc-btn primary" onclick={copyShareLink}>
			<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
			分享阵容
		</button>
		<button type="button" class="ttc-btn primary" onclick={copyPlannerCode}>
			<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
			COPY CODE
		</button>
		<button type="button" class="ttc-btn ghost" onclick={clearBoard}>
			<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
			清空棋盘
		</button>
		<button type="button" class="ttc-btn ghost" class:on={enemyVisible} onclick={() => (enemyVisible = !enemyVisible)}>
			<svg viewBox="0 0 24 24"><path d="M7 4v12m0 0-3-3m3 3 3-3M17 20V8m0 0-3 3m3-3 3 3"/></svg>
			显示敌人棋盘
		</button>
		<span class="ttc-flex"></span>
		<label class="ttc-toggle">
			<input type="checkbox" bind:checked={showSkins} />
			<span class="ttc-switch" aria-hidden="true"></span>
			显示头像皮肤
		</label>
		<label class="ttc-toggle">
			<input type="checkbox" bind:checked={showTips} />
			<span class="ttc-switch" aria-hidden="true"></span>
			鼠标悬浮信息
		</label>
		<label class="ttc-toggle">
			<input type="checkbox" bind:checked={showNames} />
			<span class="ttc-switch" aria-hidden="true"></span>
			显示弈子名称
		</label>
		<label class="ttc-toggle">
			<input type="checkbox" bind:checked={positionsOnly} />
			<span class="ttc-switch" aria-hidden="true"></span>
			仅显示站位
		</label>
		<button type="button" class="ttc-btn ghost" onclick={downloadScreenshot}>
			<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></svg>
			SCREENSHOT
		</button>
		<button type="button" class="ttc-btn primary" onclick={() => (importOpen = !importOpen)}>
			<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
			IMPORT CODE
		</button>
	</section>

	<div class="ttb-workspace">
		<aside class="ttb-traits" aria-label="当前阵容羁绊">
			<h3>羁绊</h3>
			<div class="ttb-trait-list">
				{#each traitStatuses as trait (trait.id)}
					{@const reached = trait.breakpoints.filter((point) => point.min <= trait.count).at(-1)}
					<div class="ttb-trait" style={`--style-color: ${styleColor(trait.activeStyle)}`} title={trait.description}>
						<span class="ttb-trait-icon"><img src={trait.image} alt="" loading="lazy" /></span>
						<b class:lit={trait.activeStyle > 0}>{trait.count}{reached ? `/${reached.min}` : ""}</b>
						<span class="ttb-trait-name">{trait.name}</span>
					</div>
				{/each}
			</div>
			<footer>
				<span><img src="/assets/tft/set18/units/da_18_kobuko.webp" alt="" />{unitCount}</span>
				<span><i class="ttc-gold"></i>{goldTotal}</span>
			</footer>
		</aside>

		<div class="ttb-boards">
			{#if enemyVisible}
				<section class="ttb-board-wrap enemy" aria-label="敌方棋盘">
					<div class="ttb-board">
						<span class="ttb-mark left" aria-hidden="true">stulanez</span>
						<span class="ttb-mark right" aria-hidden="true">stulanez</span>
						{#each [0, 1, 2, 3] as row (row)}
							<div class="ttb-board-row">
								{#each [0, 1, 2, 3, 4, 5, 6] as col (col)}
									{@const index = row * BOARD_COLS + col}
									{@const slot = enemyBoard[index]}
									{@const unit = slot ? unitMap.get(slot.unitId) : null}
									<div
										class="ttb-hex"
										class:selected={selectedCell === index && enemyVisible}
										style={`--cost-color: ${unit ? COST_COLORS[unit.cost] : "transparent"}`}
										role="button"
										tabindex="-1"
										aria-label={unit ? `敌方 ${unit.name}` : "空棋格"}
										onclick={() => clickCell(index)}
										oncontextmenu={(event) => { event.preventDefault(); cycleStar(index); }}
										ondragover={(event) => event.preventDefault()}
										ondrop={(event) => handleDrop(event, index)}
										draggable={Boolean(slot)}
										ondragstart={(event) => handleDragStart(event, `board:${index}`)}
									>
										{#if !positionsOnly}
											{#if unit && slot}
												{#if showSkins}
													<img class="ttb-hex-img" src={unit.image} alt="" draggable="false" />
												{:else}
													<img class="ttb-hex-img gray" src={unit.image} alt="" draggable="false" />
												{/if}
												{#if showTips}
													<span class="ttb-hex-traits">
														{#each unit.traits as trait (trait.id)}
															{@const info = traitMap.get(trait.id)}
															{#if info}<img src={info.image} alt={info.name} title={info.name} />{/if}
														{/each}
													</span>
												{/if}
												{#if showNames}
													<span class="ttb-hex-name">{slot.star > 1 ? "★".repeat(slot.star) : ""}{unit.name}</span>
												{/if}
												{#if slot.items.length}
													<span class="ttb-hex-items">
														{#each slot.items as itemId (itemId)}
															{@const item = itemMap.get(itemId)}
															{#if item}<img src={item.image} alt={item.name} title={item.name} />{/if}
														{/each}
													</span>
												{/if}
											{/if}
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</section>
			{/if}
			<section class="ttb-board-wrap" aria-label="S18 六角棋盘">
				<div class="ttb-board">
					<span class="ttb-mark left" aria-hidden="true">stulanez</span>
					<span class="ttb-mark right" aria-hidden="true">stulanez</span>
					{#each [0, 1, 2, 3] as row (row)}
						<div class="ttb-board-row">
							{#each [0, 1, 2, 3, 4, 5, 6] as col (col)}
								{@const index = row * BOARD_COLS + col}
								{@const slot = board[index]}
								{@const unit = slot ? unitMap.get(slot.unitId) : null}
								<div
									class="ttb-hex"
									class:selected={selectedCell === index && !enemyVisible}
									style={`--cost-color: ${unit ? COST_COLORS[unit.cost] : "transparent"}`}
									role="button"
									tabindex="-1"
									aria-label={unit ? `${unit.name}，${slot?.star} 星` : "空棋格"}
									onclick={() => clickCell(index)}
									oncontextmenu={(event) => { event.preventDefault(); cycleStar(index); }}
									onmouseenter={(event) => slot && unit && showTooltip(event, { unitId: unit.id })}
									onmousemove={moveTooltip}
									onmouseleave={hideTooltip}
									ondragover={(event) => event.preventDefault()}
									ondrop={(event) => handleDrop(event, index)}
									draggable={Boolean(slot)}
									ondragstart={(event) => handleDragStart(event, `board:${index}`)}
								>
									{#if !positionsOnly && unit && slot}
										{#if showSkins}
											<img class="ttb-hex-img" src={unit.image} alt="" draggable="false" />
										{:else}
											<img class="ttb-hex-img gray" src={unit.image} alt="" draggable="false" />
										{/if}
										{#if showTips}
											<span class="ttb-hex-traits">
												{#each unit.traits as trait (trait.id)}
													{@const info = traitMap.get(trait.id)}
													{#if info}<img src={info.image} alt={info.name} title={info.name} />{/if}
												{/each}
											</span>
										{/if}
										{#if showNames}
											<span class="ttb-hex-name">{slot.star > 1 ? "★".repeat(slot.star) : ""}{unit.name}</span>
										{/if}
										{#if slot.items.length}
											<span class="ttb-hex-items">
												{#each slot.items as itemId (itemId)}
													{@const item = itemMap.get(itemId)}
													{#if item}<img src={item.image} alt={item.name} title={item.name} />{/if}
												{/each}
											</span>
										{/if}
									{/if}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</section>
		</div>

		<div class="ttb-side">
			<section class="ttb-augments" aria-label="强化符文">
				<h3>强化符文</h3>
				{#if chosenAugments.length}
					<div class="ttb-augment-chips">
						{#each chosenAugments as id (id)}
							{@const augment = augmentMap.get(id)}
							<button type="button" class="ttb-augment-chip" onclick={() => toggleAugment(id)} title="点击移除">
								{#if augment?.image}<img src={augment.image} alt="" />{/if}
								<span>{augment?.name ?? id}</span>
							</button>
						{/each}
					</div>
				{/if}
				<button type="button" class="ttb-augment-add" aria-label="添加强化符文" onclick={() => (pickerOpen = true)}>+</button>
			</section>
			<section class="ttb-bench" aria-label="装备散件">
				<h3>装备散件</h3>
				<div class="ttb-bench-grid">
					{#each componentItems as item (item.id)}
						<button
							type="button"
							title={item.name}
							aria-label={item.name}
							onclick={() => clickItem(item.id)}
							onmouseenter={(event) => showTooltip(event, { itemId: item.id })}
							onmousemove={moveTooltip}
							onmouseleave={hideTooltip}
							draggable="true"
							ondragstart={(event) => handleDragStart(event, `item:${item.id}`)}
						>
							<img src={item.image} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			</section>
		</div>
	</div>

	<div class="ttb-library">
		<section class="ttb-units" aria-label="弈子库">
			<header>
				<label class="ttb-search">
					<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
					<input bind:value={search} placeholder="搜索单位或羁绊" />
				</label>
				<div class="ttb-tabs" role="tablist">
					<button type="button" role="tab" aria-selected={poolMode === "cost"} class:active={poolMode === "cost"} onclick={() => (poolMode = "cost")}>费用</button>
					<button type="button" role="tab" aria-selected={poolMode === "name"} class:active={poolMode === "name"} onclick={() => (poolMode = "name")}>名称</button>
					<button type="button" role="tab" aria-selected={poolMode === "origin"} class:active={poolMode === "origin"} onclick={() => (poolMode = "origin")}>特质</button>
					<button type="button" role="tab" aria-selected={poolMode === "class"} class:active={poolMode === "class"} onclick={() => (poolMode = "class")}>职业</button>
				</div>
			</header>
			<div class="ttb-unit-scroll">
				{#each poolGroups as group (group.key)}
					{#if group.label}
						<div class="ttb-group-head">
							{#if group.image}<img src={group.image} alt="" />{/if}
							<span>{group.label}</span>
						</div>
					{/if}
					<div class="ttb-unit-row" style={`--band: ${group.band}`}>
						{#each group.units as unit (unit.id)}
							<button
								type="button"
								class="ttb-unit"
								style={`--cost-color: ${COST_COLORS[unit.cost] ?? "#bbb"}`}
								aria-label={unit.name}
								onclick={() => chooseUnit(unit.id)}
								onmouseenter={(event) => showTooltip(event, { unitId: unit.id })}
								onmousemove={moveTooltip}
								onmouseleave={hideTooltip}
								draggable="true"
								ondragstart={(event) => handleDragStart(event, `unit:${unit.id}`)}
							>
								<img src={unit.image} alt="" loading="lazy" draggable="false" />
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</section>

		<section class="ttb-items" aria-label="装备库">
			<header>
				<div class="ttb-tabs" role="tablist">
					<button type="button" role="tab" aria-selected={itemTab === "standard"} class:active={itemTab === "standard"} onclick={() => (itemTab = "standard")}>可合成装备</button>
					<button type="button" role="tab" aria-selected={itemTab === "radiant"} class:active={itemTab === "radiant"} onclick={() => (itemTab = "radiant")}>光明武器</button>
					<button type="button" role="tab" aria-selected={itemTab === "other"} class:active={itemTab === "other"} onclick={() => (itemTab = "other")}>其它</button>
				</div>
			</header>
			{#if itemTab === "standard"}
				<div class="ttb-item-grid">
					{#each standardItems as item (item.id)}
						<button
							type="button"
							class="ttb-item"
							class:equipped={selectedBoardUnit?.items.includes(item.id)}
							title={item.name}
							aria-label={item.name}
							onclick={() => clickItem(item.id)}
							onmouseenter={(event) => showTooltip(event, { itemId: item.id })}
							onmousemove={moveTooltip}
							onmouseleave={hideTooltip}
							draggable="true"
							ondragstart={(event) => handleDragStart(event, `item:${item.id}`)}
						>
							<img src={item.image} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			{:else if itemTab === "other"}
				<div class="ttb-item-section">
					<h4>不可合成纹章</h4>
					<div class="ttb-item-grid">
						{#each emblemItems as item (item.id)}
							<button
								type="button"
								class="ttb-item"
								title={item.name}
								aria-label={item.name}
								onclick={() => clickItem(item.id)}
								onmouseenter={(event) => showTooltip(event, { itemId: item.id })}
								onmousemove={moveTooltip}
								onmouseleave={hideTooltip}
								draggable="true"
								ondragstart={(event) => handleDragStart(event, `item:${item.id}`)}
							>
								<img src={item.image} alt="" loading="lazy" />
							</button>
						{/each}
					</div>
				</div>
				<div class="ttb-item-section">
					<h4>奥恩神器</h4>
					<div class="ttb-item-grid">
						{#each artifactItems as item (item.id)}
							<button
								type="button"
								class="ttb-item"
								title={item.name}
								aria-label={item.name}
								onclick={() => clickItem(item.id)}
								onmouseenter={(event) => showTooltip(event, { itemId: item.id })}
								onmousemove={moveTooltip}
								onmouseleave={hideTooltip}
								draggable="true"
								ondragstart={(event) => handleDragStart(event, `item:${item.id}`)}
							>
								<img src={item.image} alt="" loading="lazy" />
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="ttb-item-grid">
					{#each radiantItems as item (item.id)}
						<button
							type="button"
							class="ttb-item"
							class:equipped={selectedBoardUnit?.items.includes(item.id)}
							title={item.name}
							aria-label={item.name}
							onclick={() => clickItem(item.id)}
							onmouseenter={(event) => showTooltip(event, { itemId: item.id })}
							onmousemove={moveTooltip}
							onmouseleave={hideTooltip}
							draggable="true"
							ondragstart={(event) => handleDragStart(event, `item:${item.id}`)}
						>
							<img src={item.image} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	{#if pickerOpen}
		<div class="ttb-overlay" role="dialog" aria-modal="true" aria-label="选择强化符文">
			<div class="ttb-modal">
				<header>
					<label class="ttb-search grow">
						<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
						<input bind:value={pickerSearch} placeholder="搜索" />
					</label>
					<div class="ttb-tabs" role="tablist">
						<button type="button" role="tab" aria-selected={pickerTab === "augments"} class:active={pickerTab === "augments"} onclick={() => (pickerTab = "augments")}>AUGMENTS</button>
						<button type="button" role="tab" aria-selected={pickerTab === "powerups"} class:active={pickerTab === "powerups"} onclick={() => (pickerTab = "powerups")}>POWER UPs</button>
					</div>
					<button type="button" class="ttc-btn ghost" onclick={() => (pickerOpen = false)}>×</button>
				</header>
				{#if (data.augments?.length ?? 0) === 0}
					<div class="ttb-empty-note tall">
						当前数据源暂未提供 SET {data.set} 强化符文数据；面板与交互已就绪，数据接入后自动展示。
					</div>
				{:else}
					<div class="ttb-augment-grid">
						{#each (data.augments ?? []).filter((augment) => !pickerSearch.trim() || augment.name.toLocaleLowerCase("zh-CN").includes(pickerSearch.trim().toLocaleLowerCase("zh-CN"))) as augment (augment.id)}
							<button
								type="button"
								class="ttb-augment-tile"
								class:picked={chosenAugments.includes(augment.id)}
								onclick={() => toggleAugment(augment.id)}
							>
								{#if augment.image}<img src={augment.image} alt="" loading="lazy" />{/if}
								<span>{augment.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if importOpen}
		<div class="ttb-overlay" role="dialog" aria-modal="true" aria-label="导入阵容码">
			<div class="ttb-modal small">
				<header><strong>导入客户端阵容码</strong><button type="button" class="ttc-btn ghost" onclick={() => (importOpen = false)}>×</button></header>
				<textarea bind:value={plannerCodeInput} aria-label="阵容码" rows="3" placeholder="02…TFTSet18"></textarea>
				<p>粘贴 S18 客户端阵容码导入；该格式只保存英雄，不保存站位、星级和装备。</p>
				<footer>
					<button type="button" class="ttc-btn primary" onclick={importPlannerCode}>导入</button>
				</footer>
			</div>
		</div>
	{/if}

	{#if tooltip && (tooltip.unitId || tooltip.itemId)}
		{@const tipUnit = tooltip.unitId ? unitMap.get(tooltip.unitId) : null}
		{@const tipItem = tooltip.itemId ? itemMap.get(tooltip.itemId) : null}
		<div class="ttb-tooltip" style={`left: ${Math.min(tooltip.x + 16, typeof window !== "undefined" ? window.innerWidth - 340 : 9999)}px; top: ${Math.min(tooltip.y + 18, typeof window !== "undefined" ? window.innerHeight - 220 : 9999)}px`}>
			{#if tipUnit}
				<header>
					<img src={tipUnit.image} alt="" />
					<div>
						<strong>{tipUnit.name}</strong>
						<span style={`color: ${COST_COLORS[tipUnit.cost]}`}>{tipUnit.cost} 金币</span>
					</div>
				</header>
				<div class="ttb-tip-traits">
					{#each tipUnit.traits as trait (trait.id)}
						{@const info = traitMap.get(trait.id)}
						{#if info}
							<span><img src={info.image} alt="" />{info.name}</span>
						{/if}
					{/each}
				</div>
				{#each tipUnit.traits.slice(0, 2) as trait (trait.id)}
					{@const info = traitMap.get(trait.id)}
					{#if info?.description}<p>{info.description}</p>{/if}
				{/each}
			{:else if tipItem}
				<header>
					<img src={tipItem.image} alt="" />
					<div><strong>{tipItem.name}</strong><span>{tipItem.category === "component" ? "装备散件" : tipItem.category === "standard" ? "成装" : tipItem.category === "emblem" ? "纹章" : "神器"}</span></div>
				</header>
			{/if}
		</div>
	{/if}

	{#if toast}<div class="ttb-toast" role="status">{toast}</div>{/if}
</div>

<style>
	.ttb {
		--tt-bg: #0c1526;
		--tt-panel: #142a52;
		--tt-panel-deep: #101f3e;
		--tt-hex: #0b1c3a;
		--tt-line: #22406e;
		--tt-text: #eaf6ff;
		--tt-muted: #8fa3c8;
		--tt-blue: #0091ff;
		--tt-violet: #6d4df2;
		display: grid;
		gap: 14px;
		width: 100%;
		color: var(--tt-text);
		font-family: Montserrat, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
	}
	.ttb :global(button), .ttb button { font: inherit; }
	.ttb button { color: inherit; }

	/* 控制条 */
	.ttb-controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 14px 18px;
		border: 1px solid var(--tt-line);
		border-radius: 10px;
		background: var(--tt-panel);
	}
	.ttc-set { display: grid; gap: 4px; justify-items: center; }
	.ttc-set-badge {
		padding: 5px 12px;
		border-radius: 7px;
		background: var(--tt-violet);
		color: #fff;
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.ttc-patch { color: var(--tt-blue); font-size: 11px; font-weight: 700; }
	.ttc-hint { color: var(--tt-muted); font-size: 12px; }
	.ttc-flex { flex: 1; }
	.ttc-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		height: 36px;
		padding: 0 14px;
		border: 1px solid transparent;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: 0.15s ease;
	}
	.ttc-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
	.ttc-btn.primary { background: #1a2f5e; border-color: #33508c; color: #dfe8ff; }
	.ttc-btn.primary:hover { background: #22407a; color: #fff; }
	.ttc-btn.ghost { border-color: #2c4a7c; background: rgba(11, 28, 58, 0.5); color: #cfe0ff; }
	.ttc-btn.ghost:hover { border-color: var(--tt-blue); color: #fff; }
	.ttc-btn.ghost.on { border-color: var(--tt-blue); color: #fff; }
	.ttc-toggle {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: #cfe0ff;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		user-select: none;
	}
	.ttc-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
	.ttc-switch {
		position: relative;
		width: 30px;
		height: 16px;
		border-radius: 8px;
		background: #22355c;
		transition: 0.15s ease;
	}
	.ttc-switch::after {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #8fa3c8;
		content: "";
		transition: 0.15s ease;
	}
	.ttc-toggle input:checked + .ttc-switch { background: #2e5bd8; }
	.ttc-toggle input:checked + .ttc-switch::after { left: 16px; background: #fff; }
	.ttc-gold {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #ffe08a, #d99c1e);
	}

	/* 主区 */
	.ttb-workspace {
		display: grid;
		grid-template-columns: 224px minmax(0, 1fr) 148px;
		gap: 14px;
		align-items: stretch;
	}
	.ttb-traits, .ttb-augments, .ttb-bench {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--tt-line);
		border-radius: 10px;
		background: var(--tt-panel);
		overflow: hidden;
	}
	.ttb-traits h3, .ttb-augments h3, .ttb-bench h3 {
		margin: 0;
		padding: 14px 16px 10px;
		font-size: 17px;
		font-weight: 700;
	}
	.ttb-trait-list { display: grid; align-content: start; gap: 2px; flex: 1; max-height: 430px; overflow: auto; padding: 0 8px 8px; scrollbar-width: thin; scrollbar-color: #2c4a7c transparent; }
	.ttb-trait { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; }
	.ttb-trait:hover { background: rgba(11, 28, 58, 0.6); }
	.ttb-trait-icon { display: grid; place-items: center; flex: 0 0 30px; width: 30px; height: 30px; border-radius: 6px; background: #0b1c3a; overflow: hidden; }
	.ttb-trait-icon img { width: 24px; height: 24px; object-fit: contain; }
	.ttb-trait b { min-width: 30px; color: var(--style-color); font-size: 13px; font-weight: 800; text-align: right; }
	.ttb-trait b.lit { text-shadow: 0 0 8px color-mix(in srgb, var(--style-color) 60%, transparent); }
	.ttb-trait-name { overflow: hidden; color: #dfe8ff; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
	.ttb-traits footer {
		display: flex;
		justify-content: space-around;
		padding: 10px 12px;
		border-top: 1px solid var(--tt-line);
		font-size: 14px;
		font-weight: 800;
	}
	.ttb-traits footer span { display: inline-flex; align-items: center; gap: 6px; }
	.ttb-traits footer img { width: 18px; height: 18px; border-radius: 4px; object-fit: cover; }

	/* 棋盘 */
	.ttb-boards { display: grid; gap: 14px; align-content: start; }
	.ttb-board-wrap {
		padding: 12px 16px;
		border: 1px solid var(--tt-line);
		border-radius: 10px;
		background: linear-gradient(180deg, #16305c, #122647);
	}
	.ttb-board-wrap.enemy .ttb-board-wrap, .ttb-board-wrap.enemy { background: linear-gradient(180deg, #3c1626, #2b1120); border-color: #5c2237; }
	.ttb-board { position: relative; }
	.ttb-mark {
		position: absolute;
		top: 50%;
		color: rgba(234, 246, 255, 0.07);
		font-size: 15px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
	}
	.ttb-mark.left { left: -22px; transform: translateY(-50%) rotate(180deg); writing-mode: vertical-rl; }
	.ttb-mark.right { right: -22px; transform: translateY(-50%); writing-mode: vertical-rl; }
	.ttb-board-row { display: flex; justify-content: center; }
	.ttb-board-row + .ttb-board-row { margin-top: -3.6%; }
	.ttb-board-row:nth-child(even) { transform: translateX(6.7%); }
	.ttb-hex {
		position: relative;
		flex: 0 0 auto;
		width: calc(100% / 7.6);
		aspect-ratio: 1 / 1.14;
		margin: 0 1px;
		background: var(--cost-color, var(--tt-hex));
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		cursor: pointer;
	}
	.ttb-hex::before {
		position: absolute;
		inset: 3px;
		background: var(--tt-hex);
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		content: "";
	}
	.ttb-hex:hover::before { background: #0e2447; }
	.ttb-hex.selected { filter: drop-shadow(0 0 8px rgba(0, 145, 255, 0.8)); }
	.ttb-board-wrap.enemy .ttb-hex::before { background: #240b16; }
	.ttb-hex-img {
		position: absolute;
		inset: 5px;
		z-index: 1;
		width: calc(100% - 10px);
		height: calc(100% - 10px);
		object-fit: cover;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
	}
	.ttb-hex-img.gray { filter: grayscale(1) brightness(0.8); }
	.ttb-hex-traits {
		position: absolute;
		top: -7px;
		left: 50%;
		z-index: 3;
		display: flex;
		transform: translateX(-50%);
	}
	.ttb-hex-traits img {
		width: 17px;
		height: 17px;
		margin: 0 -2px;
		border: 1.5px solid #dfe8ff;
		border-radius: 50%;
		background: #0b1c3a;
		object-fit: contain;
	}
	.ttb-hex-name {
		position: absolute;
		right: 6%;
		bottom: 7%;
		left: 6%;
		z-index: 2;
		overflow: hidden;
		padding: 1px 2px;
		border-radius: 3px;
		background: rgba(4, 10, 22, 0.72);
		color: #fff;
		font-size: clamp(8px, 0.72vw, 11px);
		font-weight: 700;
		line-height: 1.25;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ttb-hex-items {
		position: absolute;
		right: 4%;
		bottom: 24%;
		z-index: 3;
		display: grid;
		gap: 1px;
	}
	.ttb-hex-items img {
		width: clamp(10px, 0.95vw, 15px);
		height: clamp(10px, 0.95vw, 15px);
		border: 1px solid #d9b55d;
		border-radius: 2px;
		background: #0b1c3a;
		object-fit: cover;
	}

	/* 右侧栏 */
	.ttb-side { display: grid; grid-template-rows: 1fr auto; gap: 14px; }
	.ttb-augment-add {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: 4px auto 18px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--tt-muted);
		font-size: 30px;
		font-weight: 300;
		cursor: pointer;
	}
	.ttb-augment-add:hover { color: #fff; background: rgba(11, 28, 58, 0.7); }
	.ttb-augment-chips { display: grid; gap: 6px; padding: 0 10px 6px; }
	.ttb-augment-chip {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px;
		border: 1px solid var(--tt-line);
		border-radius: 8px;
		background: var(--tt-panel-deep);
		font-size: 11px;
		cursor: pointer;
		text-align: left;
	}
	.ttb-augment-chip:hover { border-color: var(--tt-blue); }
	.ttb-augment-chip img { width: 26px; height: 26px; border-radius: 5px; object-fit: cover; }
	.ttb-bench-grid { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 10px 14px; }
	.ttb-bench-grid button {
		width: 34px;
		height: 34px;
		padding: 0;
		border: 1px solid var(--tt-line);
		border-radius: 6px;
		background: var(--tt-panel-deep);
		cursor: grab;
	}
	.ttb-bench-grid button:hover { border-color: var(--tt-blue); }
	.ttb-bench-grid img { width: 100%; height: 100%; object-fit: cover; border-radius: 5px; }

	/* 库区 */
	.ttb-library {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 316px;
		gap: 14px;
	}
	.ttb-units, .ttb-items {
		border: 1px solid var(--tt-line);
		border-radius: 10px;
		background: var(--tt-panel);
		overflow: hidden;
	}
	.ttb-units header, .ttb-items header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 14px 0;
	}
	.ttb-search {
		display: flex;
		align-items: center;
		gap: 7px;
		width: min(300px, 48%);
		padding: 6px 4px;
		border-bottom: 1px solid #2c4a7c;
		color: var(--tt-muted);
	}
	.ttb-search.grow { width: min(340px, 46%); }
	.ttb-search:focus-within { border-bottom-color: var(--tt-blue); }
	.ttb-search svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 2; }
	.ttb-search input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--tt-text); font-size: 13px; }
	.ttb-search input::placeholder { color: #56688f; }
	.ttb-tabs { display: flex; gap: 4px; }
	.ttb-tabs button {
		padding: 8px 13px 10px;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--tt-muted);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.ttb-tabs button.active { border-bottom-color: var(--tt-blue); color: var(--tt-blue); }
	.ttb-tabs button:hover { color: #fff; }
	.ttb-unit-scroll { max-height: 400px; overflow: auto; padding: 10px 12px 14px; scrollbar-width: thin; scrollbar-color: #2c4a7c transparent; }
	.ttb-group-head { display: flex; align-items: center; gap: 7px; padding: 8px 4px 4px; color: #9fb4dd; font-size: 12px; font-weight: 700; }
	.ttb-group-head img { width: 20px; height: 20px; border-radius: 4px; object-fit: contain; }
	.ttb-unit-row {
		display: grid;
		grid-template-columns: repeat(auto-fill, 42px);
		gap: 4px;
		margin-bottom: 6px;
		padding: 5px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--band, transparent) 9%, transparent);
	}
	.ttb-unit {
		width: 42px;
		height: 42px;
		padding: 0;
		border: 1.5px solid var(--cost-color);
		border-radius: 4px;
		background: #0b1c3a;
		cursor: pointer;
		transition: transform 0.12s ease, filter 0.12s ease;
	}
	.ttb-unit:hover { z-index: 2; filter: brightness(1.2); transform: translateY(-2px); }
	.ttb-unit img { width: 100%; height: 100%; border-radius: 3px; object-fit: cover; }
	.ttb-item-strip { display: flex; flex-wrap: wrap; gap: 3px; padding: 10px 10px 4px; }
	.ttb-item-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; max-height: 190px; overflow: auto; padding: 8px 10px 10px; scrollbar-width: thin; scrollbar-color: #2c4a7c transparent; }
	.ttb-item {
		aspect-ratio: 1;
		padding: 0;
		border: 1px solid #2c4a7c;
		border-radius: 5px;
		background: #0b1c3a;
		cursor: pointer;
	}
	.ttb-item:hover { border-color: var(--tt-blue); }
	.ttb-item.equipped { border-color: #f1c555; box-shadow: 0 0 6px rgba(241, 197, 85, 0.5); }
	.ttb-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
	.ttb-empty-note { padding: 26px 18px; color: var(--tt-muted); font-size: 13px; text-align: center; }
	.ttb-empty-note.tall { padding: 60px 30px; }
	.ttb-item-section { padding: 10px 12px 4px; }
	.ttb-item-section h4 {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 700;
		color: var(--tt-muted);
		white-space: nowrap;
	}
	.ttb-item-section .ttb-item-grid {
		max-height: none;
		overflow: visible;
		padding: 0 0 6px;
	}

	/* 弹层 */
	.ttb-overlay {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 24px;
		background: rgba(4, 8, 18, 0.72);
	}
	.ttb-modal {
		display: grid;
		grid-template-rows: auto 1fr;
		width: min(720px, 100%);
		max-height: min(640px, 90vh);
		border: 1px solid var(--tt-line);
		border-radius: 12px;
		background: var(--tt-panel);
		overflow: hidden;
	}
	.ttb-modal.small { width: min(480px, 100%); grid-template-rows: auto auto auto auto; }
	.ttb-modal header { display: flex; align-items: center; gap: 16px; padding: 14px 16px 10px; }
	.ttb-modal textarea {
		margin: 6px 16px;
		border: 1px solid var(--tt-line);
		border-radius: 8px;
		background: var(--tt-panel-deep);
		color: var(--tt-text);
		font-family: ui-monospace, monospace;
		font-size: 12px;
		resize: vertical;
	}
	.ttb-modal p { margin: 0 16px 10px; color: var(--tt-muted); font-size: 12px; }
	.ttb-modal footer { display: flex; justify-content: flex-end; padding: 0 16px 14px; }
	.ttb-augment-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; overflow: auto; padding: 8px 16px 16px; scrollbar-width: thin; scrollbar-color: #2c4a7c transparent; }
	.ttb-augment-tile {
		display: grid;
		justify-items: center;
		gap: 5px;
		padding: 10px 6px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		cursor: pointer;
	}
	.ttb-augment-tile:hover { background: rgba(11, 28, 58, 0.6); }
	.ttb-augment-tile.picked { border-color: var(--tt-blue); background: rgba(0, 145, 255, 0.12); }
	.ttb-augment-tile img { width: 40px; height: 40px; border-radius: 7px; object-fit: cover; }
	.ttb-augment-tile span { color: #cfe0ff; font-size: 11px; text-align: center; }

	/* 提示 */
	.ttb-tooltip {
		position: fixed;
		z-index: 120;
		width: 300px;
		padding: 12px;
		border: 1px solid var(--tt-line);
		border-radius: 10px;
		background: rgba(10, 20, 40, 0.97);
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
		pointer-events: none;
	}
	.ttb-tooltip header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
	.ttb-tooltip header img { width: 42px; height: 42px; border-radius: 7px; border: 2px solid #2c4a7c; object-fit: cover; }
	.ttb-tooltip strong { display: block; font-size: 15px; }
	.ttb-tooltip header span { font-size: 12px; font-weight: 700; }
	.ttb-tip-traits { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
	.ttb-tip-traits span { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px 3px 3px; border: 1px solid var(--tt-line); border-radius: 6px; background: var(--tt-panel-deep); color: #cfe0ff; font-size: 12px; }
	.ttb-tip-traits img { width: 18px; height: 18px; border-radius: 4px; object-fit: contain; }
	.ttb-tooltip p { margin: 4px 0 0; color: #aebfe3; font-size: 12px; line-height: 1.6; }
	.ttb-toast {
		position: fixed;
		right: 24px;
		bottom: 24px;
		z-index: 130;
		padding: 11px 16px;
		border: 1px solid #2c4a7c;
		border-radius: 10px;
		background: rgba(10, 20, 40, 0.97);
		color: var(--tt-text);
		font-size: 13px;
		animation: ttb-toast-in 0.22s ease-out;
	}
	@keyframes ttb-toast-in {
		from { opacity: 0; transform: translateY(8px); }
	}

	@media (max-width: 1100px) {
		.ttb-workspace { grid-template-columns: 200px minmax(0, 1fr); }
		.ttb-side { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; grid-template-rows: none; }
		.ttb-library { grid-template-columns: 1fr; }
	}
	@media (max-width: 760px) {
		.ttb-workspace { grid-template-columns: 1fr; }
		.ttb-traits .ttb-trait-list { max-height: 220px; }
		.ttb-side { grid-template-columns: 1fr; }
		.ttb-units header, .ttb-items header { flex-direction: column; align-items: stretch; }
		.ttb-search { width: 100%; }
		.ttb-unit-scroll { max-height: 320px; }
		.ttb-hex-name { font-size: 8px; }
	}
	@media (prefers-reduced-motion: reduce) {
		.ttb *, .ttb *::before, .ttb *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
	}
</style>
