# 脚本入口

构建/部署脚本（生成数据、字体子集、Pagefind）遵守网站协议，唯一出处：docs/site-protocol.md（线上已下架）。Serpent 与本机数字资源库已下线；公开相册看 gallery 配置。大文件同步阿里云：`pnpm oss:sync`（密钥只在本机 `.env`）。
生成产物（lqips.json、github-card-data.json 等）是构建输出，不手改；改动相关资产后让构建再生成。看板与协作脚本（presence/lock/claims/启动器）已于 2026-09-16 停用移除。
