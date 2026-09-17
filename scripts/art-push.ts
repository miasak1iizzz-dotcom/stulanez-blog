#!/usr/bin/env node
/**
 * art-push — 把本地展品目录（或只把清单）推到对象存储。
 *
 * 用途：命令行发布、批量补传、迁移到新存储。策展台的「发布到展厅」是日常路径，
 * 这个脚本是它的命令行等价物，也给测试和迁移用。
 *
 * 用法：
 *   npx tsx scripts/art-push.ts                    # 推 public/art 全部（缩略图 + 清单）
 *   npx tsx scripts/art-push.ts --only-manifest    # 只推清单
 *   npx tsx scripts/art-push.ts --dry              # 只看要传什么
 */
import fs from "node:fs";
import path from "node:path";
import { presign, resolveCredentials, WRITE_EXPIRES, type S3Credentials } from "../src/utils/s3-sign";

/** tsx 不会自动读 .env.local，这里补上（已存在的环境变量优先） */
function loadEnvFile(file = ".env.local"): void {
	if (!fs.existsSync(file)) return;
	for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const index = trimmed.indexOf("=");
		if (index < 0) continue;
		const key = trimmed.slice(0, index).trim();
		const value = trimmed.slice(index + 1).trim();
		if (!process.env[key]) process.env[key] = value;
	}
}

loadEnvFile();

const args = process.argv.slice(2);
const dirIndex = args.indexOf("--dir");
const dir = path.resolve(dirIndex >= 0 ? (args[dirIndex + 1] ?? "public/art") : "public/art");
const onlyManifest = args.includes("--only-manifest");
const dryRun = args.includes("--dry");

const resolved = resolveCredentials();
if (!resolved) {
	console.error("凭证没配齐（S3_* 或 R2_*）。检查 .env.local。");
	process.exit(1);
}
const credentials: S3Credentials = resolved;

const manifestPath = path.join(dir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
	console.error(`找不到清单：${manifestPath}`);
	process.exit(1);
}

const queueFiles: { key: string; file: string }[] = [];
if (!onlyManifest) {
	const thumbRoot = path.join(dir, "thumb");
	if (fs.existsSync(thumbRoot)) {
		for (const rel of fs.readdirSync(thumbRoot, { recursive: true })) {
			const name = String(rel);
			if (!name.endsWith(".webp")) continue;
			queueFiles.push({
				key: `art/thumb/${name.split(/[\\/]/).join("/")}`,
				file: path.join(thumbRoot, name),
			});
		}
	}
}
queueFiles.sort((a, b) => a.key.localeCompare(b.key));

console.log(`目录    ${dir}`);
console.log(`桶      ${credentials.bucket} @ ${credentials.endpoint}`);
console.log(`缩略图  ${queueFiles.length} 个${onlyManifest ? "（本次跳过）" : ""}`);

if (dryRun) {
	for (const item of queueFiles.slice(0, 10)) console.log("   ", item.key);
	console.log("（--dry 只是预览，什么都没传）");
	process.exit(0);
}

let done = 0;
let failed = 0;
const queue = [...queueFiles];
async function worker(): Promise<void> {
	while (queue.length) {
		const item = queue.shift();
		if (!item) break;
		try {
			const body = fs.readFileSync(item.file);
			const response = await fetch(presign("PUT", item.key, WRITE_EXPIRES, credentials), { method: "PUT", body });
			if (!response.ok) {
				failed++;
				console.error(`  ✗ ${item.key} → ${response.status}`);
			}
		} catch (error) {
			failed++;
			console.error(`  ✗ ${item.key} → ${(error as Error).message}`);
		}
		done++;
		if (done % 25 === 0 || done === queueFiles.length) console.log(`  ${done}/${queueFiles.length}`);
	}
}
if (queueFiles.length) await Promise.all(Array.from({ length: 6 }, worker));

if (failed) {
	console.error(`\n有 ${failed} 个缩略图上传失败，清单没有更新（展厅维持原样）。`);
	process.exit(1);
}

// 清单最后传：图片没就位就更新清单，展厅会读到一半白图
const manifestResponse = await fetch(presign("PUT", "art/manifest.json", WRITE_EXPIRES, credentials), {
	method: "PUT",
	body: fs.readFileSync(manifestPath),
});
if (!manifestResponse.ok) {
	console.error(`\n✗ 清单上传失败：${manifestResponse.status} ${(await manifestResponse.text()).slice(0, 200)}`);
	process.exit(1);
}

console.log(`\n✅ 完成：${queueFiles.length} 张缩略图 + 清单已进 ${credentials.bucket}`);
