# 按任务查规则

**这是路由表，不是阅读清单。只读命中的一组；跨领域取并集，同一文件只读一次。**
所有任务遵守根 AGENTS.md；写入另读 [coordination.md](coordination.md)。

## 任务 → 必读

- 纯问答、欲望闲聊：仅相关话题记录。准备落卡才读下一项，不加载网站/部署/全部看板协议。
- 欲望滋生室、青涩/成熟卡、转任务：[board.md](board.md) + [board-desires.md](board-desires.md)；转任务再读 [board-tasks.md](board-tasks.md)。
- 协作指挥、任务卡、主理人、依赖：[board.md](board.md) + [board-tasks.md](board-tasks.md)。
- 等你过目、卷宗、老板反馈：[board.md](board.md) + [board-inbox.md](board-inbox.md)。
- AI 团队、代理空间、在线状态、报告：[board.md](board.md) + [board-team.md](board-team.md)。
- 看板导航、多 Tab、草稿保护、API：board + 所涉 Tab；改组件再读 [site.md](site.md)。
- 网页、组件、样式、配置、TFT、工具页面：[site.md](site.md)；按任务号定位该功能既有决定。
- 写文章、MDX、阅读器、内容展示：site + [内容发布](../CONTENT-PUBLISHING.md)，其中“新文封面”必读：Grok API 新出图，禁止复用旧图。
- 图库、Serpent、下载、判图、去重、尺寸/分类：[assets.md](assets.md)。做网页加 site；写欲望卡加 board-desires。
- Git 提交推送、Vercel、Cloudflare/Cloudfare、Workers、DNS、域名、生产故障：[deployment.md](deployment.md)。
- 整理协议、补记忆、消除冲突：[memory.md](memory.md)；追溯才查看 [HISTORY.md](HISTORY.md)。

## 文件路径 → 必读

- `src/data/agent-board/**`、`src/components/lab/**`、`src/pages/lab/**`、`src/pages/api/lab/**`、`src/utils/agent-board.ts`、`scripts/agent-*.mjs`：board + 所涉 Tab。
- `src/content/**`：site + 内容发布。其他 `src/**`、`public/**`：site + 所属功能约定。
- `astro.config.mjs`、`vercel.json`、`wrangler.jsonc`、`src/middleware.ts`、`scripts/hide-lab-pages.mjs`、`.github/workflows/**`：deployment。
- `.ai-work/*asset*`、下载/质检脚本、`E:/AI/Serpent/资源库`：assets；临时区不是规则豁免区。
- `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/**`、`docs/ai/**`：memory。

## 查不到约定

先用任务号/页面名/Tab 名在 tasks、experience、reports 定位，再精读命中段落。
相同主题以用户最新明确决定为准；同日矛盾记录核对正文和代码，不凭排列顺序猜。
`state=done` 可能是作废，`kind=mature` 不等于开发授权。找到所需后停止，不逐个打开所有历史。
