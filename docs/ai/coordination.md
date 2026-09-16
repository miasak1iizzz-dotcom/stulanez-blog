# 写入与协作（文件写入前必读）

## 开工

1. 查 `.ai-work/claims/` 的路径与状态、`git status --short`；只看目标路径的 diff。未认领的已有修改也须保留。
2. 从 `.ai-work/CLAIM_TEMPLATE.md` 创建本次认领，列准确路径、生成输出和端口。一个路径只有一个负责人；目录认领覆盖子文件。
3. `pnpm exec tsx scripts/check-agent-claims.ts --claim <stem>` 退出0才写源文件。通过检查不等于可接管旧 handoff；仍需交接或用户授权。
4. 扩范围先更新认领再检查。package.json、锁文件、Astro 配置、全局布局/样式、生成脚本及产物须精确认领。
5. 开发端口先核对占用；首个可用4321，其余登记独立端口，不沿用历史固定分配。

## 看板与临时文件

看板七份共享状态（agents/tasks/inbox/mail/experience/desires JSON 与 CURRENT-STATE.md）不放长期 claim，走 [board.md](board.md) 短锁。
代理报告按 agentId 独占，只追加本人条目。临时脚本放 `.ai-work/` 不提交；认领、短锁、心跳等协调元数据按专用流程维护。
实际任务开工执行 `node scripts/agent-presence.mjs working <id> "备注"`，结束/等用户时 idle。改在线功能时才补读 board-team。

## 协作底线

- 不编辑、格式化、暂存、还原、删改、移动或重新生成他人认领文件。
- 禁 `git add .`、`git add -A`、`git commit -a`、`git stash`、`git reset --hard`、`git clean`，不强推。
- 他人认领活跃时不 pull/rebase/merge/switch/checkout 改共享工作树。推送被拒则保留现场协调。
- 不跑批改全仓的 format/lint；仅对自有路径执行。构建前认领生成输出；不恢复别人的文件来消除副作用。
- 冲突只停相关路径，继续无冲突工作。陈旧/handoff 认领不由旁人删除；仅原负责人或用户可释放/移交。

## 收尾

1. 做相称验证，核对认领路径和 Git 状态，报告实际结果、既有问题。
2. 实际任务/可交接阶段按 [board.md](board.md) 记录；已有任务更新原条目，不为一句回答制造正式任务。
3. 网站/资产/协议改动按 [deployment.md](deployment.md) 提交推送；看板状态本地留档。
4. 确认无后台写进程，完成后只删除自己认领；暂停待接手留 handoff，写清已做、待做、验证。

来源：旧 AI-COLLABORATION §1–7；2026-09-09 按任务拆分要求。未取消旧有权和 Git 边界。
