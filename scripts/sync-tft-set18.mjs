import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SET_NUMBER = 18;
const PATCH = "16.17.1";
const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "src/data/tft/set18.json");
const ASSET_ROOT = path.join(ROOT, "public/assets/tft/set18");

const SOURCES = {
	planner:
		"https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/zh_cn/v1/tftchampions-teamplanner.json",
	traits: "https://raw.communitydragon.org/pbe/cdragon/tft/zh_cn.json",
	items: `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/zh_CN/tft-item.json`,
};

const STANDARD_ITEM_IDS = new Set(
	[
		"AdaptiveHelm",
		"ArchangelsStaff",
		"Bloodthirster",
		"BlueBuff",
		"BrambleVest",
		"Crownguard",
		"Deathblade",
		"DragonsClaw",
		"EdgeOfNight",
		"Evenshroud",
		"GargoyleStoneplate",
		"GiantSlayer",
		"GuinsoosRageblade",
		"HandOfJustice",
		"HextechGunblade",
		"InfinityEdge",
		"IonicSpark",
		"JeweledGauntlet",
		"KrakensFury",
		"LastWhisper",
		"Morellonomicon",
		"NashorsTooth",
		"ProtectorsVow",
		"Quicksilver",
		"RabadonsDeathcap",
		"RedBuff",
		"SpearOfShojin",
		"SpiritVisage",
		"SteadfastHeart",
		"SteraksGage",
		"StrikersFlail",
		"SunfireCape",
		"TacticiansCape",
		"TacticiansCrown",
		"TacticiansShield",
		"ThiefsGloves",
		"TitansResolve",
		"VoidStaff",
		"WarmogsArmor",
	].map((name) => `DA_${name}`),
);

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: { "user-agent": "stulanez-tft-data-sync/1.0" },
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return response.json();
}

function safeName(value) {
	return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function clientAssetUrl(assetPath) {
	const relative = assetPath
		.replace(/^\/lol-game-data\/assets\/ASSETS\//i, "")
		.toLowerCase();
	return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/assets/${relative}`;
}

function gameAssetUrl(assetPath) {
	const relative = assetPath.replace(/\.tex$/i, ".png").toLowerCase();
	return `https://raw.communitydragon.org/pbe/game/${relative}`;
}

async function exists(file) {
	try {
		return (await stat(file)).size > 0;
	} catch {
		return false;
	}
}

async function downloadImage(url, output, size) {
	if (await exists(output)) return;
	const response = await fetch(url, {
		headers: { "user-agent": "stulanez-tft-data-sync/1.0" },
	});
	if (!response.ok) {
		throw new Error(`Image ${response.status}: ${url}`);
	}
	const input = Buffer.from(await response.arrayBuffer());
	await sharp(input)
		.resize(size, size, { fit: "cover" })
		.webp({ quality: 84, effort: 4 })
		.toFile(output);
}

async function runLimited(tasks, limit = 8) {
	let cursor = 0;
	async function worker() {
		while (cursor < tasks.length) {
			const task = tasks[cursor++];
			await task();
		}
	}
	await Promise.all(Array.from({ length: limit }, () => worker()));
}

function normalizeDescription(value = "") {
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/@[^@]+@/g, "数值")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

async function main() {
	const [plannerData, traitData, itemData] = await Promise.all([
		fetchJson(SOURCES.planner),
		fetchJson(SOURCES.traits),
		fetchJson(SOURCES.items),
	]);

	const plannerUnits = plannerData.TFTSet18;
	if (!Array.isArray(plannerUnits) || plannerUnits.length < 60) {
		throw new Error("S18 planner roster is incomplete");
	}

	const unitDir = path.join(ASSET_ROOT, "units");
	const traitDir = path.join(ASSET_ROOT, "traits");
	const itemDir = path.join(ASSET_ROOT, "items");
	await Promise.all([
		mkdir(path.dirname(DATA_FILE), { recursive: true }),
		mkdir(unitDir, { recursive: true }),
		mkdir(traitDir, { recursive: true }),
		mkdir(itemDir, { recursive: true }),
	]);

	const imageTasks = [];
	const units = plannerUnits
		.map((unit) => {
			const fileName = `${safeName(unit.character_id)}.webp`;
			imageTasks.push(() =>
				downloadImage(
					clientAssetUrl(unit.squareIconPath),
					path.join(unitDir, fileName),
					128,
				),
			);
			return {
				id: unit.character_id,
				name: unit.display_name,
				cost: unit.tier,
				plannerCode: unit.team_planner_code,
				traits: unit.traits.map((trait) => ({
					id: trait.id,
					name: trait.name,
					amount: trait.amount,
				})),
				image: `/assets/tft/set18/units/${fileName}`,
			};
		})
		.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "zh-CN"));

	const rawTraits = traitData.sets?.[String(SET_NUMBER)]?.traits ?? [];
	const rawTraitMap = new Map(rawTraits.map((trait) => [trait.apiName, trait]));
	const referencedTraits = new Map();
	for (const unit of units) {
		for (const trait of unit.traits) referencedTraits.set(trait.id, trait.name);
	}

	const traits = [...referencedTraits]
		.map(([id, name]) => {
			const source = rawTraitMap.get(id);
			let image = "";
			if (source?.icon) {
				const fileName = `${safeName(id)}.webp`;
				image = `/assets/tft/set18/traits/${fileName}`;
				imageTasks.push(() =>
					downloadImage(
						gameAssetUrl(source.icon),
						path.join(traitDir, fileName),
						64,
					),
				);
			}
			return {
				id,
				name: source?.name || name,
				description: normalizeDescription(source?.desc),
				breakpoints: (source?.effects ?? []).map((effect) => ({
					min: effect.minUnits,
					max: effect.maxUnits >= 25000 ? null : effect.maxUnits,
					style: effect.style,
				})),
				image,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

	const allItems = Object.values(itemData.data);
	const items = allItems
		.map((item) => {
			let category = "";
			if (item.id.startsWith("DA_Component_")) category = "component";
			else if (
				item.id.startsWith("DA_18_Emblem") &&
				!item.id.endsWith("Augment")
			)
				category = "emblem";
			else if (
				item.id.startsWith("DA_Artifact_") ||
				item.id.startsWith("DA_Item_Artifact_")
			)
				category = "artifact";
			else if (STANDARD_ITEM_IDS.has(item.id)) category = "standard";
			if (!category) return null;

			const fileName = `${safeName(item.id)}.webp`;
			imageTasks.push(() =>
				downloadImage(
					`https://ddragon.leagueoflegends.com/cdn/${PATCH}/img/tft-item/${item.image.full}`,
					path.join(itemDir, fileName),
					64,
				),
			);
			return {
				id: item.id,
				name: item.name,
				category,
				image: `/assets/tft/set18/items/${fileName}`,
			};
		})
		.filter(Boolean)
		.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

	await runLimited(imageTasks);

	const previous = await readFile(DATA_FILE, "utf8").catch(() => "");
	const previousUpdatedAt = previous
		? JSON.parse(previous).updatedAt
		: new Date().toISOString();
	const payload = {
		set: SET_NUMBER,
		patch: PATCH,
		updatedAt: previousUpdatedAt,
		sources: SOURCES,
		units,
		traits,
		items,
	};
	await writeFile(DATA_FILE, `${JSON.stringify(payload, null, "\t")}\n`);

	console.log(
		`Synced TFT Set ${SET_NUMBER}: ${units.length} units, ${traits.length} traits, ${items.length} items.`,
	);
}

await main();
