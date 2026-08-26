# Cursor → Codex briefing

Machine-to-machine snapshot for parallel work on **永恒欲望** (`stulanez.com`).
User-facing talk stays short; this file is the dense handoff.

Author: Cursor (Grok 4.6)  
Date: 2026-08-26 Asia/Shanghai  
Git HEAD at write time: `af93fd6` on `origin/main`

## 0. Read first

1. `docs/AI-COLLABORATION.md` — exclusive claims, no `git add .`, no history rewrite while the other claim is live.
2. `.ai-work/CLAIM_TEMPLATE.md` — write `.ai-work/claims/codex-<task>.md` before any edit. Claims are gitignored.
3. Hard constraints below. They override “make it look like rainzt.cn”.

Cursor occupies **port 4321**. Codex should claim **4322+**.

Saki asked Cursor to auto-commit/push owned work to `origin` after a finished coding task. That still obeys the collab protocol: stage **only claimed paths**, never Codex’s dirty files, never force-push, never push `upstream`.

## 1. Product

Personal blog for **Saki** (student). Chinese-first Firefly (Astro 7 + Svelte 5).

| | |
|---|---|
| Live | https://stulanez.com |
| Production git | `origin` → https://github.com/miasak1iizzz-dotcom/stulanez-blog.git (`main`, Vercel project `stulanez`) |
| Theme upstream | `upstream` → CuteLeaf/Firefly **fetch only, push disabled** |
| Do not touch | `archive` → private `miasak1iizzz-dotcom/stulanez` |

Inspiration: https://rainzt.cn/ is **Aemeath**, a **private** Firefly fork. Public theme is CuteLeaf/Firefly (MIT). Learn *patterns* (public webp wallpapers, widgets). **Do not reverse-engineer Aemeath, copy its UI chrome, splash characters, or assets.**

## 2. Hard no

- Copy 鸣潮 / 流萤 / Aemeath 开屏角色 (千咲, 爱弥斯, 菲比) or the long-scroll works stage.
- Push `upstream`. Force-push `archive` or `origin`.
- Enable bangumi / vndb / bilibili / mal with Firefly demo IDs.
- Commit `素材/` (gitignored; 4K/8K + commercial K-pop originals, ~700MB).
- Commit secrets.
- `git add .` / `git add -A` / `git commit -a` / `git stash` / hard reset / clean in the shared worktree.

## 3. What’s live on origin (`af93fd6`)

Identity

- Site title 永恒欲望, profile **Saki**, hue **335**, Giscus on `stulanez-blog`.
- Avatar: LE SSERAFIM Hong Eunchae → `src/assets/images/avatar.jpg` + `public/assets/images/avatar.jpg`.
- Logo/favicon: Riven → `src/assets/images/logo/riven.png`, `public/favicon/riven-*.png`.

Atmosphere (commit `0be68f8`)

- Local hitokoto, clock, time-progress, welcome toast, desktop custom cursor.
- Footer GitHub + CC BY-NC-SA. Profile GitHub.

Music (`musicConfig.ts`)

- `mode: "local"`, **one track only**: BTS *One More Night*, `playMode: "one"`.
- Files: `public/assets/music/bts-one-more-night.mp3` + cover jpg. Do not import the rest of `素材/音乐`.

Wallpapers (`af93fd6`)

- **Same storage model as rainzt**: pre-compressed webp in `public/assets/images/wallpaper/`.
- Paths in `src/config/backgroundWallpaper.ts` start with `/` (no Astro image pipeline).
- 34 desktop + 34 mobile from Saki’s `素材/壁纸` (LoL + 美女). ~10MB total.
- Carousel: `enable: true`, `interval: 20000`, `transitionEffect: "fade"`.
- `WallpaperSection.astro` idle-prefetches remaining slides for the current breakpoint.

Pages / chrome already wired

- Nav: 主页, 文章(归档/分类/标签), 更新日志, 友链, 留言, 工具(booknav), 关于我.
- Changelog page, about hero + page chips, friends apply-via-guestbook.
- Display settings panel **on** (`displaySettingsConfig.enable: true`).
- Card borders on. Post cards show date | words | reading time.
- Banner GitHub + RSS. `dynamic` / `gallery` / `sponsor` / anime trackers **off**.

## 4. Local dirt that is NOT Cursor’s

Codex already started the collab protocol (uncommitted when this briefing was written). **Do not let Cursor commit these unless you own the claim:**

- `docs/AI-COLLABORATION.md`
- `AGENTS.md` (collab section)
- `.cursor/rules/ai-collaboration.mdc`
- `.cursor/rules/auto-push-origin.mdc` (Codex tightened it)
- `.ai-work/CLAIM_TEMPLATE.md` and claims gitignore

If those are still unstaged, Codex should claim them, finish, and push.

## 5. Suggested split (low coupling)

**Codex (good next slices — pick one claim at a time)**

- Content: retire Firefly demo posts; keep 永恒欲望上线了; write real about/changelog copy.
- `src/config/booknavConfig.ts` + booknav page: Saki’s actual tools, not demo bookmarks.
- Friends list copy / empty state (not a wallpaper rewrite).
- Optional: **thumbnail picker** for *our* 34 public webps in the display-settings wallpaper tab. Build a small Firefly-native control. Do **not** clone Aemeath’s character/banner picker.
- Isolated component polish that does not touch `src/config/backgroundWallpaper.ts` while Cursor is on assets.

**Cursor (default owner unless handed off)**

- Identity assets, `public/assets/images/wallpaper/**`, music, favicons, Vercel/git remotes.
- Scroll-performance constraints in `src/utils/fullscreen-wallpaper-utils.ts` and `grid-layout-utils.ts` (rAF, quantized blur, no per-frame layout reads).

**Serial (one agent only)**

- `package.json` / lockfile, `astro.config.mjs`, global layouts, global CSS, `src/config/**` as a whole, LQIP generator + `src/constants/lqips.json`.

## 6. Firefly knobs that exist but are off on purpose

Spine/Live2D 看板娘 (`pioConfig`): disabled (would ship 鸣潮 Firefly model if enabled).  
Background video: `playerEnable: false` (URL still points at a Firefly demo mp4).  
Umami / bangumi / vndb / mal / gallery / sponsor / memos-style 动态: off.

Do not turn these on with demo IDs or copyrighted splash models unless Saki asks with her own IDs/assets.

## 7. Verify

- `pnpm` only, Node >= 22.
- Visual: `pnpm dev` (register port in the claim).
- Before PR-quality work: `pnpm check`, `pnpm type-check`; full `pnpm build` is heavy (LQIPs, fonts, pagefind).
- Never format/lint the whole `src/` tree while another claim is active.

## 8. How we talk

- To Saki: short Chinese, no protocol dumps.
- To each other: this file + claim notes + Conventional Commit messages.
- User board: Cursor canvas `stulanez-collab-board.canvas.tsx` (IDE surface, not in git).
