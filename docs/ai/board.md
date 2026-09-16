# 看板公共协议（涉及看板才读）

## 边界

- 看板给老板本人用，成熟前留本地；`stulanez-deck://` 启动本地指挥室不等于公网开放。
- 看板任务/报告/欲望等数据只留本地；功能代码按部署协议提交，但保留生产隐藏策略。
- v2 已拍板黑金指挥室、卷宗式汇报；不恢复撤掉的信箱/AI笔记/新手指南/已完成墙渲染。
- mail/experience/CURRENT-STATE 仍维护但不上墙。decisions 已并 inbox，board-enrichments 已并 tasks，不重建旧文件。
- 改哪个 Tab 补读哪个协议：欲望 → [board-desires](board-desires.md)；任务 → [board-tasks](board-tasks.md)；等你过目 → [board-inbox](board-inbox.md)；团队/空间 → [board-team](board-team.md)；协议书 → [board-library](board-library.md)。跨 Tab 取并集。

## 共享数据短锁

覆盖 `src/data/agent-board/` 的 agents/tasks/inbox/mail/experience/desires JSON 和 CURRENT-STATE.md。
1. `node scripts/agent-board-lock.mjs acquire <本次唯一owner> "事项"`
2. 锁内重新读取目标，只改本次记录，保留其他字段；校验 JSON 与差异。
3. `node scripts/agent-board-lock.mjs release <同一owner>`，用 finally 保证成功/失败都释放。
锁忙先等或做别的，不删他人的锁；不持锁构建、浏览或等用户。共享状态不放长期 claim。
reports/<agentId>.json 每 AI 独占、不需短锁，只追加本人报告。

## 大白话与交付

- plain/statusLine/nextStep/story/pages 写给非技术老板；一段一事，story 每段≤3行，卷宗每页≤3段。
- 不堆 manifest/hash/WAL 等裸术语，必要概念解释清楚。数字具体；进度不确定填 null，不编百分比。
- 请老板过目前先代入自查，给有理由的方向建议，不让老板替 AI 做琐碎技术选择。
- 收工更新本任务；需要老板处理才写/清 inbox；CURRENT-STATE 只写相关变更；新经验写可复用教训。
- 追加本人报告 `{ taskRef, at, text }`；agents 只改本人 status/currentTask；停下心跳 idle。schema 以当前 JSON 和 src/utils/agent-board.ts 为准。
- 字段/Tab 改动一起检查复制指令、草稿保存和旧记录兼容，不为新 UI 丢弃已拍板约定。

来源：旧“Agent 看板中心”；T-028/029/030；2026-09-07 本地优先与2026-09-09部署修正。
