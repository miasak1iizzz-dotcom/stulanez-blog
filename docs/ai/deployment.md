# 提交、部署与域名

适用：发布、Git、Vercel、Cloudflare（含 Cloudfare 拼写）、Workers、DNS/域名与生产故障。先遵守 coordination。

## 提交边界

- 网站功能/代码/内容/资产/协议改动完成并验证后，自行提交并 push origin main，不留本地等别人推；看板共享状态/报告/欲望数据只本地留档。
- 只暂存本人明确路径，用 Conventional Commits。提交前检查 cached 文件列表；已有他人暂存不可捎带提交，也不替人撤销暂存。
- 不提交 `.ai-work/`、个人素材、Cookie、密钥、`.env*`；只选需要发布的内容。自动上线不能覆盖并发协作边界。
- origin 当前为 `miasak1iizzz-dotcom/stulanez-blog`；upstream 是主题 CuteLeaf/Firefly，禁止推；archive 不是生产发布目标。执行前核对 remote/branch，不自动切分支。
- 推送被拒、远端新增提交等按 coordination 处理，不 force、不在多人共享脏目录重写历史。

## 已核对的本地部署结构（2026-09-09）

- 生产主线为 Vercel 监听 origin/main；vercel.json：pnpm install、pnpm build、dist。
- astro.config.mjs 默认 `@astrojs/vercel`；设置 `CF_WORKERS` 时用 `@astrojs/cloudflare`。这是两条构建适配分支，不证明 DNS/域名已迁移 Cloudflare。
- 新增 `prerender=false` 接口需要服务端适配器；不能回退为“默认无适配器”的旧配置。此问题曾导致推送成功但生产停在旧版本。
- wrangler.jsonc 有 Workers 资源配置（name=firefly，assets.directory=./dist）；不能凭此宣称 Cloudflare 已部署或直接用它覆盖真实项目。
- DNS 注册商、Cloudflare zone/account、路由、密钥与实际项目绑定没有统一可信当前记录。相关任务先核对目标域名和平台现状；不猜、不因仓库支持就切换 nameserver/部署目标。

## 内部看板不得意外公开

- 老板明确成熟前 `/lab/*` 留本地；网站导航可通过本地协议启动器打开。
- 当前保护涉及 `src/middleware.ts` 生产拦截、`scripts/hide-lab-pages.mjs` 构建后清除静态 lab 页、vercel.json 路由；必须一起理解。
- 旧记录“移除一个 Vercel 404 配置就重新上线”已经过时。修改托管目标时验证静态页、SSR、对应 API 的实际边界，不能认为一条重定向或 noindex 就保护所有路径。
- noindex/sitemap 排除继续保留，但不是访问控制。不要将本地看板数据/凭证随部署输出公开。

## 完成标准

- 推送成功只报已推送；已上线必须有目标平台部署成功/对应版本或页面核验依据。不能用本地 build 成功代替生产 Ready。
- 改部署配置检查所涉分支；仅文档整理做文档/链接/覆盖检查，不为它刷新图库或构建生成资产。
- 远端状态本轮没查就标未核验，不把历史报告当当前在线证据。

来源：2026-09-07 本地优先拍板、2026-09-09 DeepSeek T-032·上线/收尾报告，以及当前部署配置和脚本。
