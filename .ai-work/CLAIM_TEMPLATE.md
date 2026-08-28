# Work claim

- Owner: `codex | cursor`
- Task: `<short task name>`
- Status: `active | handoff`
- Started: `<YYYY-MM-DD HH:mm Asia/Shanghai>`
- Expected finish: `<optional>`
- Dev port: `<none | 4321 | 4322 | ...>`

## Exclusive paths

- `<exact/file/path>`

## Generated outputs

- `<none or exact path>`

## Notes / handoff

- `<dependencies, completed work, remaining work, validation>`

## Required gate

创建本卡后、任何写入前运行：

`pnpm exec tsx scripts/check-agent-claims.ts --claim <claim-file-stem>`

必须退出码为 0。`src/data/agent-board/` 的共享状态文件不要列入本卡；需要更新时使用 `node scripts/agent-board-lock.mjs acquire/release` 短锁。
