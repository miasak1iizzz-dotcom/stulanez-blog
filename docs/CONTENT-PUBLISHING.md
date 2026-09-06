# 网站内容创作与发布内部说明

本站文章不只是一段 Markdown。这份说明定义「怎么写」和「怎么发」两条硬规矩，所有为本站创作/更新内容的 AI 都必须遵守。它补充 `docs/AI-COLLABORATION.md` 的协作纪律与 Token 成本纪律，冲突时以后两者为准。

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

## 2. 发布文章：自己推送，不用老板确认

**规矩：内容/功能改动做完、验证通过后，AI 直接自行 `commit` + `push`，无需等老板点头。** 老板只看结果。

**执行要求：**

1. 只暂存**自己认领的**文件，不要 `git add .` / `-A` / `-a` / `commit -a`。逐项 `git add -- <path>`，然后 `git diff --cached --name-only` 确认列表。
2. 提交信息用 Conventional Commits（`feat: ...` / `fix: ...` / `chore: ...`），一条提交只做一件事。
3. 推送前跑与改动相称的验证（`pnpm check`，涉及内容/互动再加 `pnpm type-check` / `pnpm build`），并记录结果。
4. 推送 `origin` 的 `main`（Vercel 监听 main 自动部署），发完即可向老板简短汇报「已推送」+ 链接。
5. 若因其他代理活跃认领同一文件而必须等待，**不要**强行拉取/变基/覆盖；保留现场并报告老板待协调。

## 3. 附：与协作纪律的关系

- 涉及源码组件时，照常走 `docs/AI-COLLABORATION.md` 的**认领卡** + Git 纪律（先认领、后修改、只提交自己范围）。
- 涉及看板三件套（`tasks.json` / `inbox.json` / `CURRENT-STATE.md`）等共享状态时，用**短锁**（`node scripts/agent-board-lock.mjs`）。
- 内容写作遵循看板「大白话规范」：写给不懂技术的老板，禁术语、分段短句、数字具体、进度诚实、代入自查、给方向性建议。
