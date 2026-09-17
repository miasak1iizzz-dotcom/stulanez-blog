#!/usr/bin/env node
/**
 * art-preview — 把 art-scan 产出的 manifest.json 渲染成一张展墙预览页。
 *
 * 目的是验证「清单 + 缩略图」这两样产物能不能撑起一个展厅，纯本地静态文件，
 * 不依赖 dev server、不联网。
 *
 * 用法：
 *   node scripts/art-preview.mjs --dir .ai-work/art-scan
 * 产物：<dir>/preview.html
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
	const out = { dir: ".ai-work/art-scan" };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--dir") out.dir = argv[++i];
	}
	return out;
}

const options = parseArgs(process.argv.slice(2));
const dir = path.resolve(options.dir);
const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
const data = JSON.stringify(manifest).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>艺术馆预览 · ${manifest.items.length} 件</title>
<style>
  :root { --ink:#25302b; --muted:#737970; --paper:#f8f7f3; --line:#e2ded6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:14px/1.6 system-ui,"Noto Sans SC",sans-serif; padding:32px clamp(16px,3vw,48px) 64px; }
  header { display:flex; flex-wrap:wrap; gap:16px; align-items:end; justify-content:space-between; border-bottom:1px solid var(--line); padding-bottom:18px; }
  .eyebrow { letter-spacing:.16em; font-size:10px; color:var(--muted); }
  h1 { font-family:Georgia,"Noto Serif SC",serif; font-weight:500; font-size:30px; margin:6px 0 0; }
  h1 span { display:block; font:13px/1.5 system-ui; color:var(--muted); margin-top:8px; }
  .stats { display:flex; gap:22px; flex-wrap:wrap; font-size:12px; color:var(--muted); }
  .stats b { display:block; font-size:22px; color:var(--ink); font-weight:500; }
  .bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:22px 0 8px; }
  .bar button { font:inherit; font-size:12px; padding:7px 13px; border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:999px; cursor:pointer; }
  .bar button.on { background:#324b3d; border-color:#324b3d; color:#fff; }
  .bar input { font:inherit; font-size:13px; padding:8px 14px; border:1px solid var(--line); border-radius:8px; background:#fff; min-width:220px; }
  .count { font-size:12px; color:var(--muted); margin:10px 0 20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:20px 16px; align-items:start; }
  figure { margin:0; }
  .shot { background:#e5e2dc; border-radius:7px; overflow:hidden; display:block; width:100%; aspect-ratio:4/3; }
  .shot img { width:100%; height:100%; object-fit:cover; display:block; }
  figcaption { margin-top:9px; font-size:11px; color:var(--muted); }
  figcaption strong { display:block; color:var(--ink); font-weight:500; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .meta { display:flex; gap:6px; align-items:center; margin-top:6px; flex-wrap:wrap; }
  .chip { background:#eceade; border-radius:999px; padding:2px 8px; font-size:10px; color:#4b554c; }
  .dupe { background:#f6e0d0; color:#8a4b1e; }
  .swatches { display:flex; gap:3px; margin-top:7px; }
  .swatches i { width:15px; height:15px; border-radius:3px; display:block; border:1px solid rgba(0,0,0,.08); }
  footer { margin-top:44px; padding-top:18px; border-top:1px solid var(--line); font-size:11px; color:var(--muted); }
</style>
</head>
<body>
<header>
  <div>
    <div class="eyebrow">STULANEZ / ART MUSEUM — PIPELINE PREVIEW</div>
    <h1>判图管线预览<span>这份页面完全由 manifest.json + 缩略图生成，没有连接任何服务端。</span></h1>
  </div>
  <div class="stats" id="stats"></div>
</header>
<div class="bar" id="uses"></div>
<div class="bar" id="grades"></div>
<div class="bar"><input id="q" type="search" placeholder="搜索文件名 / 路径…" /></div>
<div class="count" id="count"></div>
<div class="grid" id="grid"></div>
<footer>生成时间 ${manifest.updatedAt} · generator ${manifest.generator} · 图片来自本机缩略图，原图未上传</footer>
<script id="manifest" type="application/json">${data}</script>
<script>
const manifest = JSON.parse(document.getElementById("manifest").textContent);
const items = manifest.items;
const state = { use: "", grade: "", q: "" };
const $ = id => document.getElementById(id);
const byName = (a, b) => a.localeCompare(b, "zh-CN", { numeric: true });

const uses = [...new Set(items.flatMap(i => i.auto.uses))].sort(byName);
const grades = ["8K", "4K", "2K", "1080P", "低清"].filter(g => items.some(i => i.auto.grade === g));
const totalBytes = items.reduce((s, i) => s + i.bytes, 0);
const dupes = items.filter(i => i.origin.duplicates?.length).length;

$("stats").innerHTML = [
  ["展品", items.length],
  ["原图合计", (totalBytes / 1024 / 1024).toFixed(0) + " MB"],
  ["完全重复", dupes + " 组"],
  ["用途标签", uses.length],
].map(([k, v]) => \`<div><b>\${v}</b>\${k}</div>\`).join("");

function chipRow(host, list, key, allLabel) {
  host.innerHTML = "";
  const make = (label, value) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = state[key] === value ? "on" : "";
    b.onclick = () => { state[key] = state[key] === value ? "" : value; render(); };
    return b;
  };
  host.append(make(allLabel, ""));
  for (const v of list) host.append(make(v, v));
}

function render() {
  chipRow($("uses"), uses, "use", "全部用途");
  chipRow($("grades"), grades, "grade", "全部等级");
  const q = state.q.trim().toLowerCase();
  const list = items.filter(i =>
    (!state.use || i.auto.uses.includes(state.use)) &&
    (!state.grade || i.auto.grade === state.grade) &&
    (!q || (i.origin.path + " " + i.auto.uses.join(" ")).toLowerCase().includes(q))
  );
  $("count").textContent = \`\${list.length} / \${items.length} 件\`;
  $("grid").innerHTML = list.slice(0, 240).map(i => {
    const name = i.origin.path.split("/").pop();
    const src = i.thumbs["480"] ? i.thumbs["480"].replace(/^art\//, "") : "";
    const chips = i.auto.uses.map(u => \`<span class="chip">\${u}</span>\`).join("") +
      (i.auto.grade && i.auto.grade !== "低清" ? \`<span class="chip">\${i.auto.grade}</span>\` : "") +
      (i.origin.duplicates?.length ? \`<span class="chip dupe">重复 +\${i.origin.duplicates.length}</span>\` : "");
    const sw = i.auto.colors.slice(0, 4).map(c => \`<i style="background:\${c}"></i>\`).join("");
    return \`<figure>
      <span class="shot"><img loading="lazy" src="\${src}" alt=""></span>
      <figcaption><strong title="\${i.origin.path}">\${name}</strong>
        \${i.width}×\${i.height} · \${i.ratio} · \${(i.bytes / 1024).toFixed(0)} KB
        <div class="meta">\${chips}</div>
        <div class="swatches">\${sw}</div>
      </figcaption></figure>\`;
  }).join("");
}

$("q").addEventListener("input", e => { state.q = e.target.value; render(); });
render();
</script>
</body>
</html>
`;

await writeFile(path.join(dir, "preview.html"), html, "utf8");
console.log(`预览页已生成：${path.join(dir, "preview.html")}`);
console.log(`展品 ${manifest.items.length} 件，缩略图目录 ${path.join(dir, "thumbs")}`);
