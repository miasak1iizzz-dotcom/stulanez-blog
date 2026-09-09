# 网站内容创作与发布内部说明

仅创作/更新本站内容时必读。先遵守 [网站协议](ai/site.md)；写入遵守 [协作协议](ai/coordination.md)。本文件只维护内容特有准则，不复制全部协作和部署规则。

## 1. 写文章：为内容配它需要的展示框架

**规矩：写任何文章时，都可以、也应该去给网站创建「更好展示这篇内容所必须的框架」。** 不局限于默认标题/正文/图片排版；如果这篇文章的核心需要更生动的呈现方式，就动手做一个配套的展示组件。

**怎么判断要不要做：** 先问「这篇文章想表达的核心是什么，最能呈现它的形式是什么」。表达流程/架构 → 代码块 + 图；表达一个能玩的规则 → 可交互组件 + 模拟器；表达阅读体验 → 专用阅读器；表达一块 UI/产品 → 可交互演示岛。

**已有的三条落地案例（对号入座）：**

| 文章 | 核心 | 配的展示框架 |
| --- | --- | --- |
| 星域幻想 | 小说阅读体验 | `src/components/novel/NovelReader.svelte`：单篇文章内章节翻页、卷/章目录、章节选择、上下章、页码点、全文检索、字号/行距、阅读进度、本机续读、URL 章节锚点、快捷键切章 |
| 期末数学超级联赛 | 一套能玩的规则 | `LeagueShowcase.svelte` 交互组件 + 可玩模拟器 `/league/5.15.html` + 作品页入口 |
| 数字资产库 | 可复用的采集流程 | 代码块 + 示例图 + `AssetPipeline.svelte` 管线组件 |
| ——（示例）指挥室看板 | 一块能看懂的产品 UI | `board/BoardShowcase.svelte` 可交互演示岛：四段标签 + 状态芯片 + 卷宗翻页 + 一键复制指令 |

**落地方式（与现有文章一致）：**

1. 发文在 `src/content/posts/*.mdx`。
2. 互动展示做成本地 Svelte 组件（Svelte 5 runes），放 `src/components/<领域>/`，在文章里 `import X from "@/components/<领域>/X.svelte"` 并用 `client:load`（或 `client:visible`）挂载。
3. 封面图放 `public/assets/images/posts/`，或复用站内已有图（如 `/assets/images/agent-board/*.jpg`）。`image` 字段填可访问路径。
4. `contentType: article`；如需分章阅读体验才用 `contentType: novel` 走 NovelReader，普通文章不得强制套用小说阅读器。

**⚠ 必做验证（`pnpm check` 查不出来的坑）：** MDX 里用了组件就必须在 frontmatter 后 `import` 它，否则运行时在 dev/preview 打开文章会报 `No matching import`（`pnpm check` 不报错，照样通过）。因此凡 MDX 挂了新组件，完成后**必须在浏览器打开该文章页确认渲染**，别只靠 `pnpm check`。另外，全新新增的文章若 dev server 一直 404，是该 server 的内容扫描没跟上，重启 `pnpm dev` 即可。

## 2. 发布文章：自己推送，不用老板确认

内容/功能完成并验证后自行提交推送；完整流程只维护在 [部署协议](ai/deployment.md)，执行时读该文件。不要把推送成功当成生产已上线。

## 3. 附：与协作纪律的关系

- 源码组件按协作协议认领；涉及看板记录时只补读 [看板协议](ai/board.md) 及相应 Tab。
- 内容写给读者，解释必要术语、短句分段、数字真实。向老板汇报采用大白话与代入自查，给有理由的方向建议。
