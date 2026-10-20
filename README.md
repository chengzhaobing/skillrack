# skillrack · skills

```text
 ████ █   █ █████ █     █     ████   ███   ████ █   █
█     █  █    █   █     █     █   █ █   █ █     █  █
 ███  ███     █   █     █     ████  █████ █     ███
    █ █  █    █   █     █     █  █  █   █ █     █  █
████  █   █ █████ █████ █████ █   █ █   █  ████ █   █
```

Agent 技能仓库。每个技能是一个目录，平铺在仓库根目录；新增技能同级追加，不需要改任何脚本。

## 全部可用技能

| 技能 | 类型 | 版本 | 说明 |
| --- | --- | --- | --- |
| [`motion-recipes`](./motion-recipes/SKILL.md) | 前端 / 动效 | 1.0.0 | 交互动效配方库：按钮形变、页面转场、数字滚动、柱条生长、图谱分层入场，附 ease/duration/radius 令牌与 reduced-motion 兜底 |

## 安装

一条命令，`npx` 自动取最新版，无需全局安装：

```bash
npx skillrack add motion-recipes
```

从本仓库直接安装（适用于还没装包、或想锁定这个仓库的版本）：

```bash
npx skillrack add https://github.com/chengzhaobing/skillrack --skill motion-recipes
```

常用变体：

```bash
npx skillrack add motion-recipes --to codebuddy     # 指定宿主：codebuddy | claude | cursor | agents
npx skillrack add motion-recipes --global           # 装到用户目录，所有项目可用
npx skillrack add motion-recipes --to ./shared/skills   # 自定义目录
npx skillrack add motion-recipes --force            # 覆盖同名目录
npx skillrack list                                  # 查看全部技能
npx skillrack info motion-recipes                   # 查看详情
npx skillrack remove motion-recipes                 # 卸载
```

默认安装位置：项目中已存在的 `.codebuddy/skills`、`.claude/skills`、`.cursor/skills`、`.agents/skills`，命中哪个装哪个；都没有则装到 `.codebuddy/skills`。安装完成后重启宿主会话即可加载。

## 仓库结构

```text
.
├─ motion-recipes/        技能本体（与后续技能同级）
│  ├─ SKILL.md            入口：何时使用 + 效果索引 + 自检清单
│  ├─ references/         按主题拆分的配方细节
│  ├─ assets/             可直接复用的 css / js / demo
│  └─ evals/              自测用例
├─ index.html             GitHub Pages 展示页（像素字 + 标签页）
├─ README.md
└─ LICENSE
```

## 新增技能

1. 新建 `<skill-name>/` 目录，与 `motion-recipes` 同级。
2. 放 `SKILL.md`，frontmatter 至少写 `name`、`description`、`license`，`name` 必须等于目录名。
3. 细节拆到 `references/`，主文件保持一次能读完。
4. 在下方表格补一行，说明类型、版本与用途。
5. 本地 `npx skillrack add ./<skill-name>` 验证能装、能删。

命名规则：全小写、多词用 `-` 连接、不带版本号、不带领域前缀（避免下次放不同类型技能时名不副实）。

## 展示页

线上：<https://chengzhaobing.github.io/skillrack/>

`index.html` 是零依赖单页：像素字由 5×5 点阵逐格绘制，含「全部技能 / 快速开始 / 命令 / 结构 / 许可」标签页，可直接用 GitHub Pages 托管，也可本地双击打开。

## License

MIT © 2026 chengzhaobing
