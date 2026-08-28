# 全局现状（每对话必读 · 最后更新 2026-08-29）

## 项目

永恒欲望 stulanez.com — Astro 7 + Svelte 5 个人站，Vercel 监听 main 自动部署。仓库 `E:\AI\Lowkey`。
多 AI 协作：代理注册表 `agents.json`（6 成员）；协作协议 `docs/AI-COLLABORATION.md`；认领卡 `.ai-work/claims/`。

## 进行中

- T-015 Serpent 链接资源库 + 全量重扫（**用户操作中**——库已重置干净，等链接后首扫 8.2 万文件）
- T-016 网站建设回归（**Codex 进行中**——首轮已补齐内部 Agent 看板 noindex，并从 sitemap 排除）

## 最近完成（08-27 晚 ~ 08-29）

- 二次元两池合并去重收官（T-010）：4,221 张全唯一零重复；待人工 141 清零（97 张滞留正身归位画风夹 + 44 张非插画素材隔离）；根 manifest 重建（双维度标签 1,281 + 来源元数据 2,938）
- kpop 资产 29,007 → 48,168 张（IG 600/号全队列 167 号、B站 592、Danbooru 1,092、kpopping 821、LOL 全皮肤 1,700）
- 二次元：内容 6 类 + 画风 11 类双维度分类（54 联络表 × 2 轮目检）；一号 10G 冲刺并行（pixiv_* 主题夹）
- TFT 规划器：纹章/奥恩神器拆分独立页签（1b112f1）
- Serpent 卡死修复：225MB WAL 病根定位，备份式重置
- 全库内容级去重：57,928 实扫，401 跨池重复隔离
- Agent 看板隐私修复：总览及代理空间补齐 noindex，生产 sitemap 已排除内部路由

## 阻塞 / 待用户

- **质量标记（约 5 分钟）**：`.ai-work/quality-review/MARK-HERE.md` 两张联络表（kpop 30 + 二创 28）填编号即可——回收后自动筛全库，二创表兼定「神图」标准
- **隔离区 44 张「非插画素材」（漫画页/书页/设定图/带字截图等）删留裁决**：`资源库/_隔离待删-0828/`
- 二创返工标准（等删修样本）
- 微博/小红书/抖音 cookie（提供后 1 小时通线）
- IG 老图深挖 1500/号 是否执行（见决策队列）

## 下一步（按优先级）

1. Serpent 链接完成验收（用户）
2. 网站建设回归（Codex 进行中）
3. kpop 低质量图筛选（bigmodel，等样本）
4. （可选）二次元主题夹 ~2,900 张目检分类轮：pixiv_*/B站美图 尚无画风标签，管线现成

## 详细资料

- 每日战报 `daily/` · 经验库 `experience.json` · 任务状态机 `tasks.json`
- 方法手册 `.ai-work/glm-download-methods.md` · 资产规格 `.ai-work/asset-library-spec.md`
- 一号心得 `.ai-work/dsh-asset-summary.md` · 复盘 `.ai-work/claims/glm-work-retrospective.md`
