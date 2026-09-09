# 网站代码与内容

适用：页面、组件、样式、配置、网站工具；写入先遵守 coordination。不是图库采集任务的必读项。

- 项目：永恒欲望 stulanez.com，Firefly / Astro 7 / Svelte 5 / TypeScript。用 pnpm（preinstall 强制）；命令以 package.json 为准。
- 路由 src/pages，布局 src/layouts，组件 src/components，样式 src/styles，内容 src/content，工具 src/utils，插件 src/plugins。
- 配置 src/config 与 src/types 配套，优先从 `@/config` 导入；静态资源 public，源码图片 src/assets。
- Biome：tab 缩进、双引号；Astro/Svelte PascalCase，配置 camelCase + Config.ts，工具 kebab-case。避免无关格式化。
- `pnpm dev`/`start` 开发；`preview` 预览。`format`/`lint` 会写 src 和 scripts，不可在共享工作区直接全跑；定向处理本人文件。
- 渲染、内容、生成资源工作运行 `pnpm check`、`pnpm type-check`、`pnpm build`；视觉/交互在 dev/preview 验证，PR 附真实截图。无专用单测框架，不为小型可逆文档修改造测试。
- build 会生成 GitHub 卡片、LQIP、VNDB 封面，构建后隐藏 lab、删未用看板娘资源、字体子集/内联脚本压缩、Pagefind。先认领受影响生成输出，特别是 src/constants/lqips.json / github-card-data.json；不要按旧说明假定 icons.ts 必然生成。
- 修改内容另读 [内容发布](../CONTENT-PUBLISHING.md)；部署/提交另读 [deployment.md](deployment.md)。Conventional Commits；PR 写问题、行为、验证，UI 附截图。重大设计先讨论，当前用户明确要求即按范围执行。

## 按需检查

- 看板组件必须读 board 和所涉 Tab；文章 MDX 的组件 import 与实际渲染不能仅靠 check。
- 改滚动/背景/侧栏时才查 [架构参考](reference/site-architecture.md) 对应章节：保持 rAF 节流、避免逐帧布局读取和全屏 blur 重绘。
- 内部面板维持 noindex 与 sitemap 排除；生产隐藏策略不是 noindex 能替代的。
- 不挂 Firefly 作者的演示相册、赞助链接/收款码冒充本站真实内容；涉及这些页面先核对配置和历史记录。
- 任务/经验中的版本、接口、数量是当时结果，依当前源码核验，不盲目复用过期脚本。

来源：原 AGENTS.md、CLAUDE.md、CONTENT-PUBLISHING；构建细节于2026-09-09核对 package.json。
