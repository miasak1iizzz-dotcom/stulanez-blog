# 永恒欲望 · 二号(DeepSeek)工作总结 / 新代理 catch-up

> 这不是给访客看的内容页，而是给**下一个接手本仓库的 DeepSeek 代理(新二号)**的项目状态速览。
> 读完这份 + `docs/AI-COLLABORATION.md` + `.ai-work/claims/` + `git log origin/main`，即可快速融入。

## 1. 项目是什么
- **永恒欲望** = Saki 的个人站 `https://stulanez.com`，主题是 **Firefly**(Astro 7 + Svelte 5 + Tailwind + TypeScript)，多语言(i18n)，Giscus 评论，Vercel 部署(`origin/main` → Vercel)。
- 有多代理并行干活：**Codex / Cursor / DeepSeek(一号、二号、…)**，用 `.ai-work/claims/`(认领卡)协调，**一个文件同一时刻只有一人负责**。

## 2. 协作协议(必读)
- 权威约定：`docs/AI-COLLABORATION.md`(AGENTS.md / CLAUDE.md 均以此为准)。
- 核心规则：**先认领后改**；改前看 `.ai-work/claims/` + `git status --short`；从 `.ai-work/CLAIM_TEMPLATE.md` 建自己的 `deepseek-<task>.md`；**只显式 `git add -- <自己文件>`**；禁 `git add .`/`-A`/`commit -a`/`reset --hard`/`stash`/`clean`；不碰他人认领文件；提交用 Conventional Commit；完成后删**自己**的认领。
- 端口：Cursor `4321`、Codex `4322`、DeepSeek `4323`(后端脚本可随意)。dev server 别抢别人端口。
- 命令：`pnpm check`(0 errors 为准)、`pnpm build`(*必须跑*，因为有过"图标名不存在 → 整站构建失败"的教训)、`pnpm dev --port 4323`。

## 3. 当前已上线的主要功能(`git log origin/main` 概览)
### 首页/视觉(差异化设计)
- **站点版图 Bento**(首页文章上方的身份小卡:小说/联赛/作品/TFT/动态/相册/工具箱/归档),每卡独立 hue 渐变 + 线稿纹样 + 顶部主题色边 + 颗粒 + 进入视口渐现 + 分时问候胶囊。
- 首页文章改 **3 列网格 + 封面**;卡片纹样/花底/极光背景;阅读进度条;自定义光标光晕;精美 404(material-symbols:signpost-**rounded** 才是有效图标)。
- 侧栏/卡片纹理打磨、AI 生成封面(Grok art)、Derived 配色等(部分由并行代理/一号推进)。

### TFT 阵容规划器(`/tft/team-builder/` 是本会话二号投入最大的)
- 从 `codex` 的初版接手、`GLM(bigmodel)` 二创后,二号做了大量对齐 tactics.tools 的改造:
  - 光明武器(radiant)tab:36 件带图标(从 CommunityDragon `cdragon-tft.json` 提取 + 下载图标,并入 `set18.json` category=radiant)。
  - 其它 tab 三段式(不可合成纹章/奥恩神器),删掉所有"装备散件"。
  - **自动前后排**:用攻击距离 `range`(近战≤2 前排前两行、远程最后一行);range 从 tactics.tools 的 `https://ap.tft.tools/static/s18/data.js` 抓来并入 `set18.json`(62/65 命中)。
  - **拖出棋盘松手删除**;拖放移动/换位;按全员 2 星算钱(基础费用×3);界面积压小、面板填充+滚轮。
  - **拉克丝(大元素使)**:英雄池只展开 **9 种形态**(Primal/Elderwood/Fae/Blossom/Coven/Solar/Blackthorn/Inferno/Lunar,权威来自 `TFT18_Lux_<羁绊>`),每张右下角挂羁绊图标;**选中羁绊拉上棋盘后该羁绊数 +2**。
  - 常见坑:`moveTooltip` 必须定义(否则生产 hydration `ReferenceError`→页面空白)、图标名必须真实存在(否则 `pnpm build` 失败)。

## 4. 二号的关键 commit(本会话)
- 首页:`196b325`(Bento)、`b72221c`(问候胶囊)、`25e89fd`(卡片/背景)、`983d9e5`(卡片纹样+花底/在更早轮)、`a88d022`(首页 3 列网格+封面)、`898abd1`(修 404 图标)、`66a4180`/`7ad3896`/`f56ee4b`(进度条/光标/404)。
- 更新日志:`fc8b13d`。
- TFT:`f2d0be9`(接手 codex/GLM 完成)、`da96209`(rework)、`2b70fe7`(moveTooltip)、`8811e2a`(对齐)、`598c71c`(压小+2星+拖删)、`d25f068`(光明武器)、`a8d77f9`(删散件)、`3808d7a`(自动前后排 range)、`66cf873`(最后一行+拖删+填充滚动)、`d6ea35a`/`20e9cd4`(拉克丝 9 形态 +2)。

## 5. 数据/脚本(重新拉取数据用)
- `scripts/sync-tft-radiant.mjs`(CDragon 提取 radiant + 下载图标;输入 `.ai-work/cdragon-tft.json`,但该临时文件已被清理,重跑需重新抓 CDragon)。
- `scripts/add-tft-range.mjs`(从 tactics.tools `s18/data.js` 抓 range 并入 `set18.json`;可离线重跑,因为它直接 fetch)。
- `scripts/sync-tft-set18.mjs`(GLM 的原始同步)。
- 数据源:Data Dragon(基础 items/units)、**tactics.tools** `https://ap.tft.tools/static/s<套>/data.js`(权威角色/range/技能,套号 s10..s18 对应 TFT 套 10~18)、`zh.js`(中文名)。

## 6. 当前待办/坑(新二号注意)
- **拉克丝未显示 role 文案**(如 "Magic Caster"):tactics.tools 数据里只有 `range`、没有 `role` 字段;要显示角色需再找它 role 出处。
- **`src/components/misc/SiteDecor.astro` 在工作区有未提交改动**(`git status` 显示 ` M`,可能是并行代理在途):**不要动它、不要提交**,先确认归谁。
- 不要提交 `.ai-work/` 下的临时数据/脚本(`dl-*.mjs`、`lol-*.json`、`probe-*.mjs`)、`_blog_scan/`、`_site_scan/`、`_design/`、`site*.html`、`xgr.css`、`xiaoxi.css`、`public/assets/tft/set18/`(已提交的 radiant 图已入库,别重复)。
- 上线链路:`git push origin main` → Vercel 自动构建;部署有延迟,**浏览器需强刷**(Ctrl+Shift+R)才看到新版本(组件改了 hash,缓存易旧)。

## 7. 当前活跃认领(其他代理)
- `codex-tft-set18-builder`(handoff)、`bigmodel-asset-dl-lol-kpop`、`deepseek-asset-download-*`、`deepseek-grok-visual-fill`、`deepseek-card-texture`、`deepseek-derived-palette`、`deepseek-visual-perf-polish`、`deepseek-pages-enable`、`deepseek-league-playground`、`deepseek-works-league-entry`、`deepseek-bili-card`、`deepseek-nav-add-pages`、`deepseek-math-league-showcase`、`deepseek-kpop-playlist` 等——**开工前先看谁认领了什么**。
