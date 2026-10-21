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

统一走 npm。CLI 装一次或直接 `npx`，两种写法装的技能完全一样：

```bash
# 1. 全局安装（推荐）：之后任何项目里直接用 skillrack
npm i -g skillrack

# 2. 不安装：npx 每次取最新版
npx skillrack add motion-recipes

# 3. 项目内固定版本（团队 / CI 可复现）
npm i -D skillrack
npx skillrack add motion-recipes
```

技能只装到两个位置，不再按宿主分目录：

| 范围 | 目录 | 触发方式 |
| --- | --- | --- |
| 本项目（默认） | `<项目根>/.agent/skills/<skill>/` | `skillrack add motion-recipes` |
| 全局 | `~/.agent/skills/<skill>/` | `skillrack add motion-recipes --global` |

需要别的目录时用 `--target` 显式指定。

常用写法：

```bash
skillrack add motion-recipes                  # 未指定范围时问一次：本项目 / 全局
skillrack add motion-recipes --project        # 脚本 / CI：直接本项目，无交互
skillrack add motion-recipes --global         # 全局：所有项目可用
skillrack add motion-recipes --target ./shared/agent-skills   # 自定义目录
skillrack add motion-recipes --force          # 覆盖同名目录（默认跳过）
skillrack add motion-recipes --dry-run        # 只看会写到哪里
skillrack paths                               # 两个安装目录与各自已装技能数
skillrack list                                # 查看全部技能
skillrack info motion-recipes                 # 查看详情
skillrack remove motion-recipes               # 卸载（项目级 + 全局都搜）
```

从本仓库直接安装（适用于不想依赖 npm 清单、或想锁定这个仓库的版本）：

```bash
skillrack add https://github.com/chengzhaobing/skillrack --skill motion-recipes
```

未指定范围且处于交互终端时，只问这一次：

```
  ? 第 2 步 / 选择安装范围
  ❯ ● 本项目（项目级）  .agent/skills
    ○ 全局（用户级）    ~/.agent/skills
  ↑↓ 移动 · Enter 确认 · Q 取消
```

取消即不写任何文件；非交互环境（管道 / `CI` / `--no-input`）不弹菜单，范围缺省按本项目处理。
装完只需新开一个对话（或重启宿主）即可加载，不需要改任何配置。

> 0.4.0 起移除了 `--agent` / `--all` / `--native`：安装位置只剩「本项目 / 全局 / `--target`」，旧参数会直接报错。此前装在 `.agents/skills`、`.codebuddy/skills` 等目录的技能，重新执行一次 `skillrack add <skill>` 即可落到 `.agent/skills`。

## npm 包与 GitHub 仓库

| 位置 | 内容 |
| --- | --- |
| npm [`skillrack`](https://www.npmjs.com/package/skillrack) | CLI + 本仓库全部技能（`npx skillrack` 可直接跑） |
| GitHub [chengzhaobing/skillrack](https://github.com/chengzhaobing/skillrack) | 只有技能内容、本页与展示页；CLI 源码不在此仓库 |

- 用 CLI 安装：`npm i -g skillrack` 或 `npx skillrack add <skill>`（取 npm 最新版）。
- 直接从仓库安装：`skillrack add https://github.com/chengzhaobing/skillrack --skill <skill>`。
- 展示页：<https://chengzhaobing.github.io/skillrack/> ，与 npm 包内 `skills/index.html` 同一份文件。

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

安装后的落位：

```text
<项目根>/.agent/skills/motion-recipes/    # 默认：本项目
~/.agent/skills/motion-recipes/           # --global：全局
  ├─ SKILL.md
  ├─ references/*.md
  └─ assets/*
```

## 新增技能

1. 新建 `<skill-name>/` 目录，与 `motion-recipes` 同级。
2. 放 `SKILL.md`，frontmatter 至少写 `name`、`description`、`license`，`name` 必须等于目录名。
3. 细节拆到 `references/`，主文件保持一次能读完。
4. 在下方表格补一行，说明类型、版本与用途。
5. 本地 `npx skillrack add ./<skill-name>` 验证能装、能删；发布后 `npx skillrack add <skill-name>` 应装到 `.agent/skills`。

命名规则：全小写、多词用 `-` 连接、不带版本号、不带领域前缀（避免下次放不同类型技能时名不副实）。

## 展示页

线上：<https://chengzhaobing.github.io/skillrack/>

`index.html` 是零依赖单页：像素字由 5×5 点阵逐格绘制，含「全部技能 / 快速开始 / 命令 / 结构 / 许可」标签页，可直接用 GitHub Pages 托管，也可本地双击打开。

## License

MIT © 2026 chengzhaobing
