# 协作指挥与任务卡

适用：tasks.json、任务卡/筛选/详情、主理人、依赖。先读 board.md。

- 状态流 backlog → doing → blocked/review → done；按实际更新，完成百分比不掩盖取消/作废。
- 领任务/完成/阻塞及时写回；接手改 owner 并追加 `ownershipHistory: { owner, at, note }`。主理人显示看 owner，不能只写报告。
- 保持 title/plain/story/statusLine/nextStep/priority/cat/cover/deps 对应，保留其他既有字段。
- story 讲来龙去脉、思路、接下来；statusLine 讲当前结果；nextStep 写实际下一步。进度不明填 null。
- 用户授权工作才建任务；id 唯一，deps 真实。欲望转任务补读 board-desires。
- done 也可能是“老板取消/作废结案”，需查正文和最新决定；不可直接认定依赖已满足。
- 需老板验收则 review，并用 inbox 提供具体可审结果；不能代替老板确认偏好验收。
- 不丢已有用户反馈，保持主理人跟踪与复制反馈可用。

来源：旧看板协议、Cursor 主理人跟踪记录、T-032 作废和 T-033 顺延。
