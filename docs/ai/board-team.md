# AI 团队、代理空间与在线状态

适用：agents.json、reports、agent-presence、团队/代理空间。先读 board.md。

- 三态：工作中/空闲中/离线。离线按客户端进程；在线时按 AI 心跳判断工作/空闲。
- `node scripts/agent-presence.mjs working|idle <bigmodel|deepseek|codex|cursor> [备注]`；开工 working，结束/等用户 idle，长任务10分钟内刷新。
- 心跳超过10分钟为空闲；无心跳才回退 doing 任务。不把 review 或旧认领当正在工作。
- processNames/路径映射按当前配置和代码，不猜在线情况。
- 执行任务改本人 status/currentTask；新代理按现有字段入册（id/name/vendor/model/port/color/role/plain/status/currentTask/summaries）。
- 有交付的阶段追加本人报告 `{ taskRef, at, text }`，写结果、验证、遗留和必要入口，不复制整段对话。
- 新对话仅定位该任务报告，不整读代理工作史；不改别人报告，不用历史分工代替当前认领。

来源：T-029 最终拍板，替代早期启发式方案；旧协议的心跳/报告规则。
