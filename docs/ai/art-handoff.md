# 艺术馆 · 交接说明

写给下一个接手的人。**配套阅读**：`docs/ai/art-museum-spec.md`（艺术馆与数字资产仓库的完整规格）。

最后更新：2026-09-17 深夜，由 DSH 交接给 Cursor。

---

## 一句话现状

**发布链路已完全打通**，唯一未解决的是**图片加载慢**——图片存在美国，国内访客首屏要 12 秒。

```
策展台选图打标 → 浏览器直传 Backblaze B2（私有桶）→ 点「发布」→ 展厅立刻读云端清单
```

2026-09-17 晚上，老板用策展台成功发布了 100 件展品（抖音来源、按成员分目录），全部流程走通。

## 已完成

| 部分 | 位置 | 说明 |
|---|---|---|
| 判图规则（单一真相源） | `src/utils/art-rules.ts` | 用途 / 分辨率等级 / 比例 / 主色 / 感知哈希，本地管线与浏览器共用 |
| 本地判图管线 | `scripts/art-scan.ts` | `npx tsx scripts/art-scan.ts --in <目录> --out <目录>` |
| 命令行发布 / 补传 | `scripts/art-push.ts` | 把 `public/art` 推到对象存储 |
| 孤儿缩略图清理 | `scripts/art-prune.mjs` | 默认只预览，加 `--delete` 才删 |
| 浏览器端判图 | `src/utils/art-curate.ts` | sha1 + canvas 主色 + 感知哈希 + 两档 webp 缩略图，全程不出本机 |
| 策展台（站长） | `src/components/art/CurateDesk.svelte` | 选目录 → 判图 → 批量打标 → **发布到展厅** |
| 展厅（游客） | `src/components/art/ArtGallery.svelte` | 读云端清单；失败退回站内清单 |
| 自管懒加载 | `src/components/art/RemoteArtwork.svelte` | 不用原生 `loading="lazy"`（在多列布局下失效） |
| 签名与对象存储 | `src/utils/s3-sign.ts` | SigV4 预签名，B2 与 R2 通吃 |
| 发布签名接口 | `src/pages/api/art/sign.ts` | 发预签名 PUT，只允许 `art/img/`、`art/thumb/`、`art/manifest.json` |
| 清单接口 | `src/pages/api/art/manifest.ts` | 从桶读清单，把图片换成站内代理地址；边缘缓存 60 秒 |
| 图片代理 | `src/pages/api/art/img/index.ts` | 用 `?key=` 形式（站点开了 `trailingSlash: always`，路径形式会被 308 重定向） |
| CF Worker（**未投入使用**） | `workers/art-image/` | 已部署到 `stulanez-art-image.miasak1iizzz.workers.dev`，但**该域名国内打不开** |

## 当前卡点：图片慢

实测数据（2026-09-17，本机直连）：

| 路径 | 单张耗时 |
|---|---|
| 直连 B2 | 2.9s |
| 经 Vercel 代理（缓存命中） | 0.36~0.6s ✅ |
| 经 Vercel 代理（缓存未命中） | 1.4~19.8s ❌ |
| CF Worker | 国内 HTTP 000（workers.dev 不可达） |

**老板实测首屏 12 秒。**

根因：对象存储在美国，跨太平洋每张约 1.5 秒；Vercel Hobby 计划下函数代理的缓存命中率不稳定、还有冷启动。

## 下一步（按优先级）

1. **先问清一个关键问题**：那 12 秒是「第一屏图片出来」还是「页面出来后滚动时图片慢慢加载」？
   - 前者 → 懒加载没生效，改前端还能压（当前首批 8 件、预加载边距 120px）
   - 后者 → 每个访客都在跨洋拉图，只能换存储
2. **换国内对象存储**（老板已基本认可，约 2 元/月，微信支付）
   - 推荐腾讯云 COS 或阿里云 OSS；**登录后默认域名是否免备案、S3 SigV4 是否兼容，都要先实测再让老板付费**
   - 代码已做成可替换：只改环境变量 + 重传图片，`s3-sign.ts` 可能要按对方签名算法适配
3. **可选**：把域名 NS 迁到 Cloudflare 让 Worker 生效——动作大、影响整站，**不推荐**

## 踩过的坑（别再踩）

- **`pnpm build` 会污染共享产物**：重写 `src/constants/lqips.json`（把 public 下新图全量收录）和 `github-card-data.json`（联网拉数据，网络不稳会丢条目）。这个工作区有多个 AI 同时在用，验收请用 `pnpm check` / `pnpm type-check` 加 dev 目视。
- **站点开了 `trailingSlash: "always"`**：API 路径要带尾斜杠，带扩展名的路径会被 308 重定向。
- **`IntersectionObserver` 在自动化浏览器（Playwright）里失效**：测懒加载别用自动化浏览器下结论，要老板真机看。原生 `loading="lazy"` 在 CSS columns 布局下也会一次性加载整批。
- **PowerShell 是 5.1**：不支持 `??`、here-string 缩进结束符会吞行；`[...path]` 这类方括号路径要用 `-LiteralPath`。
- **凭据一律要文本，不要从截图认字**：这次因看错大小写和多一个 `0`，白折腾三轮。
- **git push 走不了 schannel**：用 `git -c http.sslBackend=openssl push`，且网络不稳（直连/代理交替重试，实测常要 2~4 次）。
- **`.env.local` 里有 `VERCEL_OIDC_TOKEN`**（别人配的），追加变量时别覆盖整个文件。

## 凭据与环境变量

**全部在 `.env.local`（已被 `.gitignore` 忽略，绝不进仓库）**，需要时自己读，别打印、别提交：

```
ART_PUBLISH_TOKEN        站长口令，策展台里填一次
S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET
                         Backblaze B2（桶名 stulanez，私有）
VERCEL_TOKEN             配 Vercel 环境变量与触发部署用（用完可删）
CLOUDFLARE_API_TOKEN     CF Worker 用（用完可删）
```

线上 Vercel 项目的环境变量已配好同样那 6 个（`ART_PUBLISH_TOKEN` + `S3_*`），函数区域已改为**香港（hkg1）**。

## 别动的东西

- 别人的未提交修改：`src/utils/pull/*`、`src/components/layout/NavDock.svelte` 等一长串
- `public/art/` 里的展品是老板策展的成果，删之前问
- B2 桶里现有 100 件展品（约 21MB）与清单
