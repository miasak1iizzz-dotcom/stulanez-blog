# 永恒欲望 · GLM (BigModel) 工作总结 / 完整工作史

> 面向看板展示与后续代理参考。Author: bigmodel (GLM-5.3, zhipu)

## 1. 定位

- **厂商/模型**：智谱 GLM-5.3，通过 ZCode CLI 接入
- **端口**：4325
- **专长**：全栈 · 资产管线 · 分类整理 · 协作看板

## 2. TFT 规划器一比一复刻

- 从 Codex/DeepSeek 接手，对标 tactics.tools/zh/team-builder 一比一复刻（`da96209`）
- 组件重写：搜索、装备 tab、拖拽、tooltip、automatic 前后排等
- 编译坑修复：moveTooltip 未定义→生产白屏（`2b70fe7`）
- 纹章/奥恩神器拆分独立页签（`1b112f1`）

## 3. 资产下载管线（多渠道）

### kpop IG 原图（48,168 张 / 27G）

- 167 号成员/团账号 × 600 上限，gallery-dl + cookie 官方线
- 代理注册表 + 认领卡体系（`agents.json` + `.ai-work/claims/`）

### LOL 全皮肤原画（1,700 张）

- ddragon 图片直链 + CDragon 元数据
- 全英雄 base + 全皮肤，manifest 落盘

### B站双线（819 张）

- kpop 美图 592 + 二次元 227
- 搜索 API + 专栏正文 + hdslb 直链
- 412 软风控：间隔≥2.5s + 退避 6/12/18s + 失败词 30min 补跑

### Danbooru 二创（1,092 张/1.1G）

- gallery-dl + 代理（27 团标签，SFW/Sensitive）
- 走代理原因：本机直连被 CF 标记

### kpopping 饭拍（821 张）

- 成员页封面流解码 cdn 原图直链
- 代理出口解 CF 封锁

## 4. 二次元/AI画作 整理

- 联络表目检管线：GPU CUDA 缩略图 + 6 路并行 + hstack/vstack 显式链
- 54 联络表 × 2 轮目检 = 内容 6 类 + 画风 11 类双维度标签
- 全库内容级去重：57,928 实扫 / 401 跨池重复隔离
- AI 画作摊平：30→34 张一层陈列

## 5. 协作看板中心（本页）

- 首版 + v2 重构（Tailwind 纯样式 + 代理空间页 + 全中文）
- 五个 Tab 切换（总览/任务看板/决策队列/站内信/经验库）
- 代理注册表驱动（`agents.json`，6 成员）
- 数据文件 `src/data/agent-board/`（随仓库提交，本地 dev 实时刷新）
- 每日部署同步（Vercel 监听 main）

## 6. 经验库

14 条结构化经验条目（见本页经验库 Tab），覆盖抓取/构建/TFT/协作/通用五大领域。
完整方法论手册见 `.ai-work/glm-download-methods.md`。
