# 全局现状（每对话必读 · 最后更新 2026-09-07）

## 项目

永恒欲望 stulanez.com — Astro 7 + Svelte 5 个人站，Vercel 监听 main 自动部署。仓库 `E:\AI\Lowkey`。
多 AI 协作：代理注册表 `agents.json`（6 成员）；协作协议 `docs/AI-COLLABORATION.md`；认领卡 `.ai-work/claims/`。
看板 v2（2026-09-04 用户拍板重做）：大白话卷宗制、代入老板自查、方向性建议；数据文件 tasks/inbox/agents 上墙，mail/experience/本文件为 AI 内部不再渲染。
**Token 纪律（必守，2026-09-07 老板拍板，详见 docs/AI-COLLABORATION.md 第 8 节）**：只读必读文件、大文件精读片段不整读、看图前先用小图验视觉通道（E-021）、无视觉禁加载 browser-use/computer-use 类重型技能、复杂脚本写 .mjs 文件禁 node -e 长单行、命令输出只取摘要、大活先报预估成本再动手。

## 进行中

- T-014 国内图源：**Cursor 已收工，暂待分工**——抖音单条能下、自主找图未通；看板主理人跟踪已上线。下任接手请改 owner。
- T-016 网站建设回归（**Codex 进行中**——T-018 已由 DeepSeek 过掉，下一项 T-019；额度恢复后继续）

## 最近完成（08-27 晚 ~ 09-07）

- 国内图源凭证说明（N-004）：维持 resolved。老板提供的『一期ASA壁纸』（爱吃杏仁）已从公开图文页 `/note/7666324619125407482` 保存 45 张，样本在 `.ai-work/douyin-sample-7666324619125407482.zip`。本条页面显示未登录仍可取图，无需再让老板准备文件；Cookie 仅以内存中的完整字段做官方接口测试，返回无作品详情，不能宣称凭证有效。撤销「1 小时通三线」承诺。
- Serpent 链接资源库（T-015）：2026-09-07 老板确认已链接、Serpent 内可见且无问题，同意结案；T-015 已 done、N-005 已 resolved。获明确授权后，已删除重置前旧备份 `_serpent-backup-20260828`（69,356 个文件、1,162,267,457 字节）；当前 `资源库` 保留。
- IG 老图深挖（T-013）：老板拍板暂不做——600 张/号还没筛完，不着急新增；任务关闭、inbox 卷宗 N-002 已 resolved
- 看板 v2 全面重做（T-028）：黑金指挥室、砍掉信箱/AI笔记/指南/已完成墙、inbox.json 卷宗制取代 decisions.json、board-enrichments 并入 tasks.json、协作协议看板章节重写（大白话规范+自查规则）；2026-09-07 老板回复「暂时看着还行 先凑合用吧 后面我们在慢慢改进即可」，本轮完成、T-028 已 done、N-006 已 resolved，先用当前版本，后续按使用反馈逐步改进
- 首页文章卡与封面回归（T-018）：4 篇新增文章封面全部存在且 200 正常、grid-mode + has-cover 正确、最长标题换行 2 行正常、卡片不塌陷；pnpm check 0 errors，无需改代码
- 首页门户 Bento 回归（T-017）：8 张卡片与问候胶囊通过亮暗主题、375/414/768 断点、链接/背景图和控制台核验；无需源码修复
- kpop 筛选管线升级（T-011，2026-09-07 深夜，老板要求提速→**GPU 已通**）：①机械层校准完成——无人脸规则精度 83%（36% 召回），模糊度/phash 无判别力（换姿势重复抓不到）；②老板授权代操作（N-007 resolved）：官方驱动 616.64 静默干净安装+重启，CUDA 驱动 API 实测正常；Ollama 壳崩溃已绕过——用其捆绑的 llama-server 裸跑 Qwen2.5-VL（模型取自 Ollama blobs，HF 镜像补 1.3GB mmproj；**CUDA DLL 必须与 exe 同目录**，Ollama 放子目录是裸跑认不到卡的根因）；**GPU 实测 0.7 秒/张**（CPU 1/40）；③GPU 抽样 21 张：一致率 81%、AI 淘汰精度 100%、漏放 4 张全是连拍类（单图判定盲区）。服务常驻 `D:/nvllama/llama-server.exe -m <blob> --mmproj D:/OLLAMA_MODELS/mmproj-qwen25vl-7b.gguf --port 8080 -ngl 99`；vlm-judge.mjs 走 /v1/chat/completions 断点续跑；Seungkwan 1,261 张已预筛（206 自动隔离 + 1,055 待 VLM）
- 二次元两池合并去重收官（T-010）：4,221 张全唯一零重复；待人工 141 清零（97 张滞留正身归位画风夹 + 44 张非插画素材隔离）；根 manifest 重建（双维度标签 1,281 + 来源元数据 2,938）
- kpop 资产 29,007 → 48,168 张（IG 600/号全队列 167 号、B站 592、Danbooru 1,092、kpopping 821、LOL 全皮肤 1,700）
- 二次元：内容 6 类 + 画风 11 类双维度分类（54 联络表 × 2 轮目检）；一号 10G 冲刺并行（pixiv_* 主题夹）
- TFT 规划器：纹章/奥恩神器拆分独立页签（1b112f1）
- Serpent 卡死修复：225MB WAL 病根定位，备份式重置
- 全库内容级去重：57,928 实扫，401 跨池重复隔离
- Agent 看板隐私修复：总览及代理空间补齐 noindex，生产 sitemap 已排除内部路由

## 阻塞 / 待用户

- **kpop 筛选（T-011）**：SVT 已判 26%（2,157/8,190）；隔离区 554 张（批3）+ 206 张（Seungkwan 无人脸）待抽查；**GPU 通道已通（N-007 resolved）**：982 张 GPU 全量校准跑完即对答案，达标后 Seungkwan 1,055 张及全库约 4 万张挂机自动清（0.7s/张，全库约 8-10 小时纯算力）；AI 只审 VLM 不确定 + 抽检
- 二创返工标准（等删修样本）；二创「神图」标准已拍板并进 GLM 进行中的图库质检/目检工作（N-003 已 resolved），改等 T-011 收尾后开工

## 下一步（按优先级）

1. 网站建设回归（Codex 进行中；T-018 已由 DeepSeek 过掉，下一项 T-019 移动端断点与触控）
2. kpop 低质量图筛选（bigmodel；GPU 已通，全量校准 → 达标后全库挂机清理，AI 只审疑难+抽检）
3. （可选）二次元主题夹 ~2,900 张目检分类轮：pixiv_*/B站美图 尚无画风标签，管线现成

## 详细资料

- 每日战报 `daily/` · 经验库 `experience.json` · 任务状态机 `tasks.json`
- 方法手册 `.ai-work/glm-download-methods.md` · 资产规格 `.ai-work/asset-library-spec.md`
- 一号心得 `.ai-work/dsh-asset-summary.md` · 复盘 `.ai-work/claims/glm-work-retrospective.md`
