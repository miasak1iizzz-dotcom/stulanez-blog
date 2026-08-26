# 永恒欲望 · 一号（DeepSeek）工作总结 / 新一号 agent catch-up

> 这不是给访客看的内容，而是给**下一个接手本仓的 DeepSeek 一号**的项目状态速览。
> 读这份 + `docs/AI-COLLABORATION.md` + `.ai-work/claims/` + `git log origin/main`，即可快速融入。

## 0. 说明：一号 vs 二号的分工

这个仓里"deepseek"实际上是一、二号（甚至更多实例）并行，用 `.ai-work/claims/deepseek-<task>.md` 认领协调。**二号**已经写了一版 `docs/AGENT-2-SUMMARY.md`（覆盖整体站点 + TFT 等）。**本文件专记一号这条线的关键工作 + 最新的「素材库/Serpent」资产线**——这是新一号最需要的 catch-up 点。

## 1. 项目背景（速览）

- **永恒欲望** = Saki 的个人站 `https://stulanez.com`，主题 **Firefly**（Astro 7 + Svelte 5 + Tailwind + TypeScript + i18n + Giscus + Vercel 部署）。
- 多代理并行：Codex / Cursor / DeepSeek(一号·二号·…)，用 `.ai-work/claims/` 认领协调（一个文件同一时刻只有一个负责人）。
- 协作协议（必读）：`docs/AI-COLLABORATION.md`（AGENTS.md/CLAUDE.md 皆以其为准）。核心：先认领后改、改前看 claims + `git status`、显式 `git add -- <自己的文件>`、禁 `git add .`/`-A`/`commit -a`/`reset --hard`/`stash`/`clean`、不碰他人认领文件、Conventional Commit、完成后删自己认领。
- 端口：Cursor 4321 / Codex 4322 / DeepSeek 4323。命令：`pnpm check`(0 errors 为准) / `pnpm build`(必须跑，因有"图标名不存在→整站构建失败"教训) / `pnpm dev --port 4323`。

## 2. 一号这条线做过的重要工作（git 提交可考）

### 站点功能/视觉
- **K-pop 本地播放列表**：`musicConfig.ts` 从 1 首扩到 37 首（MP3 + FLAC 转 MP3），专辑封面（iTunes/Deezer 获取），缩略图加载修复，`?v=2` 缓存破坏，跨页续播。相关提交多（`7fd5ee2`/`5abae13`/`24ffc7b`/`679b84f`/`bb489f9` 等）。
- **页面启用 + 导航**：`dynamic`/`gallery`/`sponsor`/`bilibili` 开启（`0755d20`），并把它们加进导航栏"我的"分组（`ab25048`）。
- **B站关注/粉丝名片**：about 页 `BiliCard.astro`（`api.x...relation/stat` 构建时拉关注/粉丝，`450e4d6`）。
- **期末数学超级联赛项目**：介绍文章 + LeagueShowcase 交互组件 + 可玩模拟器 `/league/5.15.html` + 作品页入口（`761a2a9`/`6fae26a`/`77efbf0`）。
- **卡片质感 + 衍生色板**：`SiteDecor.astro` 卡片纹理、`variables.styl` 衍生色 `--primary-soft/strong/tint/glow`、卡片 hover 主题色光晕（`04b8187`/`a0bf1e4`）。
- **AI 封面**：先用 pollinations，后换 **Grok**（xAI API）生成高质量文章封面（`29806bb`/`e308f0d`，见下）。

### 素材库 / Serpent 资产线（**最新、新一号重点**）
用 **Serpent**（开源跨平台数字资产管理软件，Electron，MIT，面向美术设计师）管理素材库。安装在 **`E:\AI\Serpent`**（与 `E:\AI\Lowkey` 同级，卸载=删文件夹）。资源库在 **`E:\AI\Serpent\资源库\`**。用户已创建 `我的资源库`（Serpent 的库，含 `.serpent` 库 db + `Assets` 目录）。

**下载目标与来源调研（已实测）**：
- **二次元图**：safebooru/gelbooru 公开图库 API（标签搜索批量，`https://safebooru.org/index.php?page=dapi&s=post&q=index&tags=<tag>&limit=N&json=1`）——已验证可靠，已下 `资源库\二次元`（分主题子目录：风景/夜空/花海/少女等）。
- **LOL 英雄原画/皮肤**：**Riot ddragon 官方 API**（`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/<英雄>_<编号>.jpg`，版本从 `/api/versions.json` 取）——官方高清，已验证 `Ahri_0.jpg` 可用。GLM 已用类似源下到 `资源库\LOL\原画`（300 张，带 manifest）。
- **AI 画作**：**Civitai** 社区公开 API（`https://civitai.com/api/v1/images?limit=N&sort=Most+Reactions&query=<主题>&page=N`，item.url 可直接下原图）——已验证批量可用。已下 `资源库\AI画作`（分主题）。
- **Kpop**：暂无可靠免费批量源；用户说"后续自己找渠道"，**暂缓**。

**脚本/状态**（在 `E:\AI\Lowkey\.ai-work\` 或 `_kpop_tmp\`，勿提交）：
- `dl-safebooru.cjs`/`dl.cjs`、`dl-civitai.cjs`/`.ps1`（Node/Powershell 下载）
- ⚠️ **已知坑**：① `.ps1` 含中文时 PowerShell 5.1 会按 GBK 读坏 → 中文移到 UTF-8 JSON + 脚本纯 ASCII，或用 pwsh 内联；② Node `https.get` 抓 civitai 会被拒（返回 null）→ 用 PowerShell `Invoke-WebRequest` 能拿到；③ Node `.js` 因 `package.json"type":"module"` 需改 `.cjs`。

### 素材库当前真实状态（核对）
- `资源库\AI画作`：**33 张**（anime 30 + fantasy 3，46MB）——其他主题(cyberpunk/landscape/portrait/painting/3d/realistic/concept)因 job 被中断未落盘，**需重跑补全**。
- `资源库\LOL`：300 张（GLM 下，含 manifest）。
- `资源库\我的资源库`：Serpent 库（3 项）。
- ⚠️ **重复问题**：用户反馈下载的很多图片重复。原因：Civitai 翻页 `Most+Reactions` 会跨页返回重复 + 我脚本用 `$start+$i` 编号在重跑时可能覆盖/重复。**重下时用 content-hash 去重**（下载后按文件 hash 去重，或用 url hash 去重后不翻页太多）。

## 3. Grok 生图（已接入，质量顶级）

- **xAI Grok API**：密钥在 `C:\Users\Administrator\Desktop\GrokAPI.txt` 第 1 行（`xai-...`）。生图端点：`POST https://api.x.ai/v1/images/generations`，body `{model:"grok-imagine-image-quality", prompt:"...", n:1, aspect_ratio:"16:9"}`，返回 `data[0].url`（**临时 URL，立即下载固化**）。
- 已用它生成：站点版图 8 卡素材图（`资源库` 相关…实际放 `public/assets/images/portal/`）+ 3 篇文章封面（`public/assets/images/posts/*-grok-cover.jpg`）。
- ⚠️ **坑**：Grok 生成**中文标题文字不可靠**（会幻觉成别的字）→ 封面用纯净高清图，标题用 CSS/文字精确叠加。
- xAI models 里有 `grok-imagine-image`/`-2.0`/`-quality`、`grok-imagine-video`、`grok-4.x`。

## 4. 协作边界（当前活跃认领，开工前先看）

- `codex-tft-set18-builder`、`bigmodel-asset-dl-lol-kpop`、`deepseek-*`（很多 deepseek 认领是历史的，新一号开工前逐个看 Status，旧的已是 handoff）。
- ⚠️ `SiteDecor.astro` 曾有两个代理改，`git status` 显示 ` M` 时**别动别提交**，先确认归属。
- 不要提交 `.ai-work/` 下的临时数据/脚本（`dl-*.mjs`、`lol-*.json`、`probe-*.mjs`）、`_blog_scan/`、`_site_scan/`、`_design/`、`site*.html`、`xgr.css`、`xiaoxi.css`、`public/assets/tft/set18/`(已入库的 radiant 图勿重复)。
- 上线链路：`git push origin main` → Vercel 自动构建；浏览器需**强刷**(Ctrl+Shift+R)看新版（组件改了 hash，缓存易旧）。

## 5. 新一号行动建议

1. 先读 `docs/AGENT-2-SUMMARY.md`（二号）补全站点/TFT 全貌 + 本文件。
2. 用 `pnpm check` + `pnpm build` 看当前是否 0 errors（可能有并行代理未提交改动，先 `git status` 分清）。
3. **素材库线**：重跑 AI画作补全 + **加内容 hash 去重**；LOL 补全皮肤（ddragon 官方）；二次元补 城市/幻想 分类。
4. 任何改动坚持认领 + 显式 git add + 完成后删自己认领。
