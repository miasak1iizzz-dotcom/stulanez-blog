# 网页美化素材来源说明

本目录用于站点壳子美化（底纹 / 分区氛围），不是内容图库。

## 参考与灵感（未整站搬图）

| 站点 | 用途 | 许可提示 |
| --- | --- | --- |
| [Hero Patterns](https://heropatterns.com/) | 可平铺 SVG 底纹思路（点阵、地形线、叶子等） | CC BY 4.0，若直接使用其 SVG 需署名 |
| [Haikei](https://haikei.app/) | 分层波浪 / blob 分区装饰思路 | 免费生成导出 |
| [BGJar](https://bgjar.com/) | 波浪、云、星星等背景生成思路 | 见站内 License |
| [Creatica](https://creatica.app/) | 网格 / 噪点 / 几何背景思路 | MIT 倾向，见站内说明 |

## 本仓库实际文件

下列 SVG **为本站按主题色（hue≈335）手写的轻量装饰**，吸收上述站点的「可平铺 + 低对比」方案，而非批量下载外站原文件：

- `soft-dots.svg` — 细点阵底纹
- `petal-scatter.svg` — 花瓣点缀
- `wave-divider.svg` — 分区波浪分隔
- `contour-haze.svg` — 轻地形/等高线氛围
- `diagonal-sheen.svg` — 斜向微光

应用入口：`src/components/misc/PageAtmosphere.astro` + `src/styles/page-atmosphere.css`。
