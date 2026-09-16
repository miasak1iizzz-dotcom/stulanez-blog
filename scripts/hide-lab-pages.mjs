// 构建后隐藏内部 lab 页：抖音下载名单、图库清理监控等，都属于本地内部工具。
// 老板明确「成熟前留在线下」。Astro 会把 src/pages/lab/** 预渲染成静态 HTML 拷进 dist，
// 而 vercel.json 里的 /lab/* → 404 重定向不会覆盖这些静态文件，导致内部页在公网可见。
// 这里在构建后把 dist/lab 整目录删掉，让 /lab/* 落到那个 404 重定向上，从公网彻底隐藏；
// 本地 dev 不受影响。

import fs from "node:fs";
import path from "node:path";

const DIST_DIR = process.cwd();
const LAB_DIR = path.join(DIST_DIR, "dist", "lab");

if (fs.existsSync(LAB_DIR)) {
	fs.rmSync(LAB_DIR, { recursive: true, force: true });
	console.log("🎭 Hidden internal /lab pages: removed dist/lab from deploy output");
} else {
	console.log("🎭 dist/lab not present, nothing to hide");
}
