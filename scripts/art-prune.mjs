#!/usr/bin/env node
/**
 * art-prune — 清理展品目录里不再被 manifest 引用的孤儿缩略图。
 *
 * 缩略图是由你的原图自动生成的派生物（按内容哈希命名），删掉随时能重生，
 * 不是原始素材。策展换展几次之后，旧批次的缩略图就会变成没人引用的孤儿。
 *
 * 用法：
 *   node scripts/art-prune.mjs                    # 只预览，不删
 *   node scripts/art-prune.mjs --delete           # 真删
 *   node scripts/art-prune.mjs --dir public/art --delete
 */
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const shouldDelete = args.includes("--delete");
const dirIndex = args.indexOf("--dir");
const dir = path.resolve(dirIndex >= 0 ? (args[dirIndex + 1] ?? "public/art") : "public/art");
const thumbRoot = path.join(dir, "thumb");

const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
const referenced = new Set();
for (const item of manifest.items ?? []) {
	for (const value of Object.values(item?.thumbs ?? {})) {
		const name = String(value).split("/").pop();
		if (name) referenced.add(name);
	}
	// 兜底：清单里没写 thumbs 时，按 id 推常规命名
	if (item?.id) {
		referenced.add(`${item.id}-480.webp`);
		referenced.add(`${item.id}-1280.webp`);
	}
}

let entries = [];
try {
	entries = await readdir(thumbRoot, { recursive: true });
} catch {
	entries = [];
}
const webps = entries.map(String).filter(name => name.endsWith(".webp"));

const orphans = [];
let freed = 0;
for (const rel of webps) {
	const name = rel.split(/[\\/]/).pop() ?? "";
	if (referenced.has(name)) continue;
	const full = path.join(thumbRoot, rel);
	const info = await stat(full).catch(() => null);
	if (!info) continue;
	orphans.push(full);
	freed += info.size;
}

console.log(`展品目录  ${dir}`);
console.log(`清单引用  ${referenced.size} 个文件`);
console.log(`实际存在  ${webps.length} 个缩略图`);
console.log(`孤儿      ${orphans.length} 个，共 ${(freed / 1024 / 1024).toFixed(2)} MB`);
if (orphans.length) console.log(`示例      ${orphans.slice(0, 5).map(p => path.basename(p)).join(", ")}`);

if (!orphans.length) {
	console.log("\n没有孤儿，很干净。");
	process.exit(0);
}

if (!shouldDelete) {
	console.log("\n这是预览。确认没问题后加 --delete 真删：");
	console.log(`  node scripts/art-prune.mjs --dir ${path.relative(process.cwd(), dir)} --delete`);
	process.exit(0);
}

for (const full of orphans) await rm(full, { force: true });
// 顺手清掉空掉的分片目录
for (const entry of await readdir(thumbRoot, { withFileTypes: true })) {
	if (!entry.isDirectory()) continue;
	const sub = path.join(thumbRoot, entry.name);
	const rest = await readdir(sub).catch(() => []);
	if (!rest.length) await rm(sub, { recursive: true, force: true });
}

console.log(`\n已删除 ${orphans.length} 个孤儿缩略图，释放 ${(freed / 1024 / 1024).toFixed(2)} MB。`);
console.log("别忘了提交：双击仓库根目录的「发布艺术馆.cmd」即可。");
