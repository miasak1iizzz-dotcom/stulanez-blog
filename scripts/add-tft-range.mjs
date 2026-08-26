// 从 tactics.tools 的 set18 数据(ap.tft.tools/static/s18/data.js)提取单位 range，按英文名并入 set18.json。
// 单位 id：data.js 用 TFT18_<Champ>，本地用 DA_18_<Champ> / DA_<Champ>18，提取 Champ 英文名匹配。
import { readFile, writeFile } from "node:fs/promises";

const c = await (await fetch("https://ap.tft.tools/static/s18/data.js")).text();
const m = c.match(/JSON\.parse\(`([\s\S]*?)`\)/);
if (!m) throw new Error("cannot parse data.js");
const d = JSON.parse(m[1]);

function key(id) {
	return String(id)
		.replace(/^(TFT18_|DA_18_|DA_|18_)/i, "")
		.replace(/_(AD|AP|AD|Base|Small|UniqueTrait18|UniqueTrait|_Radiant.*)$/i, "")
		.replace(/\d+$/, "")
		.replace(/[^a-z0-9]/gi, "")
		.toLowerCase();
}

const dataRanges = new Map();
for (const [uid, u] of Object.entries(d.units || {})) {
	const k = key(uid) || key(u.name || "");
	if (k && typeof u.stats?.range === "number") dataRanges.set(k, u.stats.range);
}

const set = JSON.parse(await readFile("src/data/tft/set18.json", "utf8"));
let added = 0; const miss = [];
for (const u of set.units) {
	const k = key(u.id);
	if (k && dataRanges.has(k)) { u.range = dataRanges.get(k); added++; }
	else miss.push(`${u.name}(${u.id})`);
}
await writeFile("src/data/tft/set18.json", JSON.stringify(set, null, 2) + "\n");
console.log("added range:", added, "/", set.units.length, "| miss:", miss.length, miss.slice(0, 10).join(", "));
