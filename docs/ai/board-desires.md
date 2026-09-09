# 欲望滋生室

适用：desires.json、DesireIncubator.svelte、api/lab/desires.ts、#desire 和对应复制指令。先读 board.md。

- **欲望 ≠ 正式任务**。先聊来由、体验、边界、是否值得养、图库/网站/工具分类。用户 dream big 时不强迫缩成 MVP 或先定架构。
- 已讲清的不反复追问，先按主题找已有动机记录，不从零猜。聊透且已授权落档后再写卡。
- 更新同一欲望保留 id；确属新想法才分配唯一 id，避免重复建卡。
- `kind=raw` 青涩卡保留原话 memo 等；`kind=mature` 已剖析仍可继续养，不代表获准开发。
- 成熟卡填 title / plain / story（来龙去脉·思路·接下来）/ statusLine / nextStep / priority / cat / cover / deps；保留 id、日期、memo、mood、taskRef 等元数据。
- cat 用现有 `assets` 图库 / `site` 网站 / `ops` 工具基建；封面用真实资源，依赖未定可空数组，不捏造任务号。
- 转正式任务须用户明确要求，补读 board-tasks；同一短锁中建任务和关联 taskRef。保留待分工/不立即开发等边界。
- 被打回的任务即使 done 也不是验收成功，不自动恢复开发或顺推依赖。
- 复制指令含目标 id、专题协议、短锁与写回要求；API 动作用当前实现核对，不照旧报告的 settle 等过期动作。

例：D-001/T-032 于2026-09-09打回酝酿，/art/ 页面保留；用户可继续扩展收藏/抽卡愿景，这不授权立刻改页面。
来源：T-030 双类型报告、D-001/T-032、本次欲望讨论。愿景与工程承诺分开记录。
