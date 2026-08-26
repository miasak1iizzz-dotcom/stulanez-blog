# Cursor → Codex briefing

Machine-to-machine snapshot for parallel work on **永恒欲望** (`stulanez.com`).
User-facing talk stays short; this file is the dense handoff.

Author: Cursor (Grok 4.6)  
Updated: 2026-08-26 Asia/Shanghai  
Live claim: `.ai-work/claims/cursor-appearance-dropdown.md` (**active**)

## 0. Read first

1. `docs/AI-COLLABORATION.md` — exclusive claims, no `git add .`, no history rewrite while the other claim is live.
2. `.ai-work/CLAIM_TEMPLATE.md` — write `.ai-work/claims/codex-<task>.md` before any edit.
3. Hard constraints below. They override “make it look like rainzt.cn”.

Cursor occupies **port 4321**. Codex should claim **4322+**.

## 1. Cursor is in the display-settings dropdown — stay off this slice

Saki asked Cursor to ship the appearance dropdown UX first (wallpaper thumbs + splash picker). Codex should **not** touch these exclusive paths until the claim file is deleted:

- `src/components/controls/DisplaySettingsIntegrated.svelte`
- `src/components/controls/WallpaperPicker.svelte`
- `src/components/controls/SplashPicker.svelte`
- `src/components/features/SplashScreen.astro`
- `src/styles/display-settings.css`
- `src/styles/splash.css`
- `src/config/displaySettingsConfig.ts`
- `src/config/atmosphereConfig.ts`
- `src/types/displaySettingsConfig.ts`
- `src/types/atmosphereConfig.ts`
- `src/utils/display-settings-utils.ts`
- `src/utils/setting-utils.ts`
- `src/utils/wallpaper-picker-utils.ts`
- `src/components/layout/WallpaperSection.astro`
- `src/layouts/Layout.astro`
- `src/i18n/i18nKey.ts`
- `src/i18n/languages/*.ts`
- `docs/CURSOR-CODEX-BRIEFING.md`
- `public/assets/images/wallpaper/thumbs/`

What Cursor is building (Firefly-native, **our** assets):

- Wallpaper tab: 3-column thumbs of the 34 public webps; pin index in `localStorage.bannerWallpaperIndex`.
- Preferences tab (renamed from 特效): splash play toggle + 3 original styles (`logo` / `petal` / `wash`). **No** Aemeath characters, no 千咲/爱弥斯/菲比, no upper/lower splash banners.
- Layout switch moved into Preferences to match the reference IA.

## 2. Product / remotes

| | |
|---|---|
| Live | https://stulanez.com |
| Production git | `origin` → https://github.com/miasak1iizzz-dotcom/stulanez-blog.git (`main`, Vercel `stulanez`) |
| Theme upstream | `upstream` → CuteLeaf/Firefly **fetch only, push disabled** |
| Do not touch | `archive` → private `miasak1iizzz-dotcom/stulanez` |

Inspiration: https://rainzt.cn/ is **Aemeath** (private Firefly fork). Learn patterns only.

## 3. Hard no

- Copy 鸣潮 / 流萤 / Aemeath 开屏角色 or the long-scroll works stage.
- Push `upstream`. Force-push. `git add .` / stash / hard reset / clean in the shared worktree.
- Enable bangumi / vndb / bilibili / mal with Firefly demo IDs.
- Commit `素材/` or secrets.

## 4. What’s already live

Identity: 永恒欲望, Saki, hue 335, Eunchae avatar, Riven logo, Giscus.  
Wallpapers: 34+34 public webp, 20s fade carousel.  
Music: BTS *One More Night* only.  
Atmosphere: hitokoto, clock, time-progress, welcome toast, desktop cursor.  
Pages: about, changelog, friends, guestbook, booknav — **skeleton, copy still weak**.

## 5. Codex: do these instead (low coupling)

1. Claim + commit + push the collab protocol files you already drafted (`docs/AI-COLLABORATION.md`, `AGENTS.md`, `.cursor/rules/*`, `.ai-work/CLAIM_TEMPLATE.md`). Cursor will not stage those.
2. Retire Firefly demo posts; keep 永恒欲望上线了.
3. Real booknav tools (`src/config/booknavConfig.ts` + booknav page) — do **not** take `src/config/` as a directory; claim that one file.
4. About / changelog / friends copy under `src/content/` / those pages. Avoid `Layout.astro` and i18n while Cursor holds them.

## 6. Local dirt that is still Codex’s

If still unstaged when you read this:

- `docs/AI-COLLABORATION.md`
- `AGENTS.md`
- `.cursor/rules/ai-collaboration.mdc`
- `.cursor/rules/auto-push-origin.mdc`
- `.ai-work/CLAIM_TEMPLATE.md`

## 7. Verify / talk

- `pnpm` only. Visual: `pnpm dev --port 4322`.
- Do not `pnpm format` / repo-wide lint while Cursor’s claim is active.
- To Saki: short Chinese. To Cursor: this file + claims.
