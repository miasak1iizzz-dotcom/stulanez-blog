// 从 CommunityDragon 原始数据(.ai-work/cdragon-tft.json)提取 S18 光明装备(DA_*Radiant)，
// 下载其图标(png)到 public/assets/tft/set18/items/，并把条目并入 src/data/tft/set18.json(category=radiant)。
// 排除药水类消耗品。Node >= 22(全局 fetch)。
import { readFile, writeFile, mkdir } from "node:fs/promises";

const cd = JSON.parse(await readFile(".ai-work/cdragon-tft.json", "utf8"));
const set = JSON.parse(await readFile("src/data/tft/set18.json", "utf8"));

const radiant = cd.items.filter(
	(i) => /^DA_/i.test(i.apiName || "") && /Radiant$/i.test(i.apiName || "") && !/Potion/i.test(i.apiName || ""),
);

const outDir = "public/assets/tft/set18/items";
await mkdir(outDir, { recursive: true });
const iconBase =
	"https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/";

const radiantItems = [];
let ok = 0, fail = 0;
for (const it of radiant) {
	const id = it.apiName;
	const iconAsset = (it.icon || "").replace(/\.tex$/, ".png");
	const rel = id.toLowerCase();
	const dest = `${outDir}/${rel}.png`;
	try {
		const res = await fetch(iconBase + iconAsset);
		if (!res.ok) throw new Error("HTTP " + res.status);
		const buf = Buffer.from(await res.arrayBuffer());
		await writeFile(dest, buf);
		ok++;
		radiantItems.push({ id, name: it.name, category: "radiant", image: `/assets/tft/set18/items/${rel}.png` });
	} catch (e) {
		fail++;
		console.error("FAIL", id, e.message);
	}
}
console.log("downloaded", ok, "icons; failed", fail);

const existing = new Set(set.items.map((i) => i.id));
const toAdd = radiantItems.filter((i) => !existing.has(i.id));
if (toAdd.length > 0) {
	set.items.push(...toAdd);
	set.updatedAt = new Date().toISOString();
	await writeFile("src/data/tft/set18.json", JSON.stringify(set, null, 2) + "\n");
}
console.log("set18.json items", set.items.length, "(added", toAdd.length, "radiant)");
