# 永恒欲望 · AI 工作入口

## 协议唯一出处

网站的全部协议和要求（技术栈、代码约定、内容发布、提交部署、协作纪律）维护在一篇长期更新的文章里，改协议就是改那篇文章：

**https://stulanez.com/posts/site-protocol/**（源文件 `src/content/posts/site-protocol.mdx`）

开工前读它；它与根 AGENTS.md 冲突时，以用户当前指令为准。

## 全局底线

- 用户当前指令优先；历史报告里的「下一步」不等于新授权。
- 写入前查 `git status --short`：别人未提交的修改一律保留，只动本次任务明确的路径。
- 不 `git add .` / `git add -A` / `git commit -a`，不 `stash` / `reset --hard` / `clean`，不强推。
- 不提交密钥、Cookie、个人素材、本地运行数据；`.ai-work/` 不进仓库。
- 对老板用大白话，进度诚实，不捏造验收、截图或上线结果。

## 站长身份 · 设备清单

- 站长 = Saki，按设备认定，不设登录后台。当前站长设备：**本机**（即这份仓库所在的机器）。
- 给某台设备开站长权限：在那台设备的浏览器打开一次 `<站点地址>#saki-owner`（本地 dev 是 `http://localhost:4321/#saki-owner`，线上是 `https://stulanez.com/#saki-owner`），设备标记即存入该浏览器 localStorage（键 `stulanez:owner-device`）。收回：`#saki-owner-off`，或直接清掉该键。
- 每次认领/收回后，同步更新上面的设备清单，保持记账一致。识别实现见 `src/utils/owner.ts`。
- 页面落地规矩见协议文章「站长与游客」一节：站长徽章与维护类界面（选图库、上传、改配置等）只对站长设备出现，游客只见参观视角。

## 本地保留的专题文档

- 图库/Serpent/采集/判图操作规程：[docs/ai/assets.md](docs/ai/assets.md)。
- 封面生图端点说明：[docs/AGENT-1-SUMMARY.md](docs/AGENT-1-SUMMARY.md) §3（凭证只在本机）。
- 站点架构速查：[docs/ai/reference/](docs/ai/reference/)。

## 历史

AI 协作看板（指挥室）与认领卡/短锁/在线状态体系已于 2026-09-16 停用移除，相关历史看 git 记录。`docs/` 根下的各 AGENT-*-SUMMARY 是旧协作期的交接档案，仅供追溯，不作为当前准则。
