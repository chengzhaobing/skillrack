---
name: motion-recipes
description: Use when designing or implementing interface motion and front-end interaction — 登录按钮动画、按钮形变、loading 与成功/失败反馈、页面转场、路由切换、弹窗与抽屉、滚动动画、卡片悬停、磁吸、鼠标跟随、文字入场、SVG 描边、骨架屏、数字滚动、柱条生长、折线描画、环图展开、面板错峰入场、数据更新过渡、看板拖拽、图谱画布，或任何"把界面做得有质感/别像模板"的需求。A recipe library distilled from a production Vue admin scaffold (pearl-glass design language): the exact effect to build, its state machine, eases/durations/radii tokens, runnable vanilla JS plus React/Vue snippets, and reduced-motion/a11y fallbacks. Complements the official motion-API skills — use those for API correctness, use this one for what to build and how it should feel.
license: MIT
---

# 交互动效配方库（Motion Recipes）

把"好看的交互动效"变成可执行的配方：**先查效果表 → 读对应 reference → 套令牌 → 走自检清单**。

这个 skill 不复述动画 API。它回答的是"做什么效果、参数怎么定、状态怎么切、怎么收尾"。

## When to Use This Skill

在这些时刻加载它：

- 要做登录/注册/支付这类**关键按钮的状态动画**（loading → 成功对勾 → 失败复原）。
- 要设计**页面/路由转场、弹窗、抽屉、Toast、批量浮条**的整体节奏。
- 要给列表、卡片加**入场编排**，或做骨架屏、悬停/按压/磁吸/跟随这类微交互。
- 要做**数据看板**：数字从 0 滚到目标值、柱条生长、折线描画、环图展开、面板错峰入场、刷新时旧值平滑过渡到新值。
- 要做**看板拖拽、FLIP 重排、组织画布、关系图/图谱舞台**。
- 用户说"这个页面太像模板了""加点动效""要高级感""数据动起来""参考 XX 的交互"。
- 要**审查已有动效**：参数是否统一、是否漏了清理与 reduced-motion、是否该动 transform 却动了布局属性、刷新时是否误重播入场。

不适用：只问动画库 API 用法（去官方 API 系列 skill）、纯 CSS 静态样式、纯后端任务。

## Related skills

本 skill 只管"做什么/怎么有质感"，API 正确性交给官方流派。下表按**名称后缀**索引（这些 skill 的名称前缀就是本项目所用动画库的名字，见 `assets/recipes.js` 的 import）：

| 需要 | 官方 API skill |
| --- | --- |
| 单个 tween、ease、stagger、响应式条件 | `…-core` |
| 多步编排、position 参数、时间轴控制 | `…-timeline` |
| 滚动驱动、pin、scrub | `…-scrolltrigger`（本 skill 的 `references/scroll.md` 只讲配方与项目结构坑） |
| Flip / Draggable / DrawSVG / SplitText / MorphSVG / CustomEase | `…-plugins` |
| `clamp` / `mapRange` / `quickTo` 等工具 | `…-utils` |
| React 的 Hook 封装（scope + 自动清理） | `…-react` |
| 掉帧、合成层、`will-change` | `…-performance` |
| Vue / Svelte / Astro 集成 | `…-frameworks` |

冲突时以官方 skill 的 API 规则为准；本 skill 的**参数与配方**优先（它们来自真实项目验收）。

## 按场景选动效

先定场景，再查下面的效果表。同一个场景里只选一个主角效果，其余做衬托。

| 页面/场景 | 主角效果 | 衬托 | 不要做 |
| --- | --- | --- | --- |
| 登录/授权页 | 登录按钮形变（`buttons-forms.md` §1） | 卡片微倾、标题逐行入场 | 整页粒子、循环漂浮 |
| 后台列表页 | 表格行级联 + 骨架屏（`micro-interactions.md` §8） | 按压/悬停、抽屉共享元素 | 每行都弹跳、整表滚动动画 |
| 数据看板 | 面板错峰 + 数字滚动（`data-viz.md` §2、§6） | 柱条/折线/环图按内容选一种主图 | 所有图表同时从 0 生长、坐标轴跟着动 |
| 数据刷新 | 旧值→新值过渡（`data-viz.md` §7） | 变化块闪一次 | 重播入场、整块淡出再淡入 |
| 详情/配置 | 抽屉从行生长（`transitions.md` §4） | 内容级联、字段校验 | 全屏翻转、3D 卡片 |
| 组织/权限/图谱 | 画布分层入场（`graphs-canvas.md` §4） | 选中路径脉冲、视口平移 | 每个节点独立弹跳、常驻闪烁 |
| 营销/落地页 | 滚动叙事（`scroll.md`） | 磁吸 CTA、卡片级联、指针光 | 三处以上钉住、横向滚动不设退出 |
| 任务看板 | 拖拽幽灵 + 弹簧落位（`micro-interactions.md` §9） | FLIP 重排、Toast | 每次落位都重新入场 |

## 效果索引

先在这里找，再读对应文件的对应小节。文件名相对 `references/`。

| 效果 | 适用场景 | 读这里 |
| --- | --- | --- |
| 登录按钮形变（胶囊→圆→对勾→失败复原） | 登录、支付、单实例关键提交 | `buttons-forms.md` §1 |
| 按压压缩与松手回弹 | 所有可点控件，事件委托一次覆盖 | `buttons-forms.md` §2 |
| 悬停抬起（只给可点卡片） | 快捷入口、卡片列表 | `buttons-forms.md` §3 |
| 主按钮涟漪（从点击点化开） | 主操作、危险操作 | `buttons-forms.md` §4 |
| 输入焦点环与校验反馈 | 表单、弹窗表单 | `buttons-forms.md` §5 |
| 开关/勾选/分段/树箭头 | 设置项、视图切换 | `buttons-forms.md` §6 |
| **数字滚动（0 → 目标值，只播一次）** | 播放量、销售额、在线数等核心指标 | `data-viz.md` §2 |
| **柱条生长（0 → 向右伸长，轴固定）** | 平台/产品对比、排行 | `data-viz.md` §3 |
| **折线描画（沿时间轴从左向右展开）** | 趋势、留存、流量曲线 | `data-viz.md` §4 |
| **环图展开（色块依次展开，中心总量不动）** | 占比、渠道构成 | `data-viz.md` §5 |
| **面板错峰入场（指标 → 图表 → 明细）** | 数据看板首屏 | `data-viz.md` §6 |
| **数据更新（旧值 → 新值平滑过渡）** | 刷新、切时间范围、轮询 | `data-viz.md` §7 |
| 页面/路由转场 | 后台页面切换、首屏 | `transitions.md` §1 |
| 外壳首次入场 | 登录后进入主框架 | `transitions.md` §2 |
| 弹窗从触发点展开 | 表单弹窗、确认框 | `transitions.md` §3 |
| 抽屉共享元素（行 → 抽屉） | 详情抽屉、代码生成 | `transitions.md` §4 |
| 下拉/菜单/Popover | 所有浮层 | `transitions.md` §5 |
| Toast 牌堆 + 倒计时环 | 操作反馈 | `transitions.md` §6 |
| 批量操作浮条 | 列表多选、未保存改动 | `transitions.md` §7 |
| 滑动玻璃块（分段/导航/步进器） | 视图切换、命令面板 | `transitions.md` §8 |
| 顶栏凝结 / 滚动批次显现 / 钉住叙事 | 落地页、长页面 | `scroll.md` |
| 指针光、卡片微倾、磁吸、鼠标跟随 | 主卡、登录卡、CTA | `micro-interactions.md` §1–4 |
| 数字逐位滚动（Odometer） | 读数位、成功率（强调"位"在动） | `micro-interactions.md` §5 |
| 刻度环、柱状图生长 | 仪表盘 | `micro-interactions.md` §6–7 |
| 骨架屏、表格行级联 | 列表加载 | `micro-interactions.md` §8 |
| 看板拖拽（幽灵 + 弹簧落位） | 状态看板、任务板 | `micro-interactions.md` §9 |
| FLIP 重排 / 卡片原地展开 | 筛选后重排、样本册 | `micro-interactions.md` §10 |
| 画布平移缩放 | 组织架构、关系图 | `micro-interactions.md` §11 |
| 文字逐行/逐字入场、打字机 | 登录标题、引导页、问答 | `text-svg.md` §4 |
| 对勾/圆环/折线描边 | 成功反馈、图表首次渲染 | `text-svg.md` §1–3 |
| 沿路径脉冲、图标状态切换 | 连线、选中路径、星标 | `text-svg.md` §5–6 |
| 图谱舞台（珍珠球 + 刻度表盘 + 脉冲） | 菜单星图、权限溯源、岗位阶梯 | `graphs-canvas.md` §3–4 |
| 组织画布（分层入场 + 路径脉冲） | 部门管理、审批流、依赖图 | `graphs-canvas.md` §4 |
| 弹簧 + 帧循环底座 | 拖拽落位、节点追随 | `graphs-canvas.md` §1–2 |
| 缓动/时长/圆角/阴影/配色/反模式 | 任何新效果的参数来源 | `design-tokens.md` |

## 设计哲学：什么样的动效算"有质感"

### 1. 每个效果都要能说出能量语态

借鉴项目里的约束（`motion.ts` 开头的注释）：**说不出语态的效果就是装饰，不做**。

| 语态 | 场景 | 手法 |
| --- | --- | --- |
| 蓄 Charge | 输入、悬停、聚焦 | 小位移 + 提亮，0.2–0.35s |
| 放 Discharge | 按压、提交、展开 | 一次明确的形变或位移，带轻微过冲 |
| 导 Conduct | 数据在流、进行中 | 描边、脉冲、逐根点亮，时长与数据量相关 |
| 结 Crystallize | 落定、成功 | 一次 `back.out` 的收尾，然后**彻底静止** |
| 停摆 Halt | 取消、失败、收回 | 回到起点，路径可逆 |

### 2. 节奏：进入慢、退出快

同一动作的进场 ≈ 退场的 2 倍时长（页面 0.62 / 0.18，浮层 0.48 / 0.2，浮条 0.56 / 0.22）。进入需要被看清，离开只需要被确认。

### 3. 层次：一屏只有一个主角

主卡可以有指针光 + 编号级联；其余卡片只有基础入场。所有东西都动 = 什么都没重点。这一条比任何曲线都更决定"高级感"。

### 4. 克制：动效服务于状态，不服务于炫技

- 常驻动画只允许出现在"真实进行中"（loading 环、倒计时、正在播放的图谱）。
- 装饰性循环（呼吸、漂浮、闪烁）默认关闭。
- 一次操作只播一条主时间轴；不要在转场里再套放大。

### 5. 反馈及时性

- 指针反馈 ≤ 100ms 开始（按压 0.14s 已经到极限）。
- 提交后 100ms 内必须有可见变化（按钮进入 loading），**不要等接口回来才给反馈**。
- 成功/失败的结果必须由真实结果驱动，不许用 `setTimeout` 假装。

### 6. 数据动效的三条纪律

1. **轴、单位、卡片位置不动**：只有图形与读数在动。坐标轴跟着抖，读者就无法比较。
2. **读数与图形同一个进度**：数字到 80% 柱子也必须在 80%。用一个 state 对象同时驱动两者，不要各写一条补间。
3. **入场只播一次，刷新只做过渡**：第二次进入页面、切时间范围、轮询回来，只能走"旧值 → 新值"，绝不能重播从 0 生长的动画。

### 7. 时长体系

| 层级 | 时长 | 例子 |
| --- | --- | --- |
| 即时反馈 | 0.12–0.2s | 按压、图标切换、浮层退出 |
| 控件状态 | 0.3–0.5s | 悬停、滑块、开关、Toast |
| 结构变化 | 0.5–0.72s | 页面进场、抽屉、卡片让位 |
| 数据落定 | 0.8–1.2s | 数字滚动、柱条生长、折线描画、环图展开 |
| 叙事 | 1.2–1.8s | 开场编排、涟漪、看板整屏错峰入场 |

超过 1.2s 的**阻塞式**动画（用户必须等它结束才能继续）一律砍掉；数据落定类可以到 1.2s，但必须允许用户在这期间点击别处。

### 8. 怎么避免"通用 AI 风格"

- 不用紫蓝渐变 + 到处发光 + 所有卡片都玻璃。材质只有 4 种，按层级分配。
- 不用 emoji 当图标或状态。
- 不给所有元素同样的 `y: 40 / opacity: 0 / stagger: 0.2`。错开量要按内容量压缩（8 项以内 45–50ms，超过就减）。
- 不用 `scale: 1.05` 处理所有悬停；可点卡片抬 3px，文字链接只变颜色。
- 数字用等宽字形（`tabular-nums`）、按位或按值滚动；不要整块淡入假装"数据在动"。
- 系统字体栈，不引第三方字体；等宽只给数字与编码。
- 状态色只有三个（蓝=操作、青柠=正常、红=警示），其余是分类色，不表示状态。

## 通用约定

### reduced-motion

- 用引擎的 `matchMedia()` 建条件作用域，在 `(prefers-reduced-motion: reduce)` 分支里**直接给终态**，不建时间轴。
- **不要在 matchMedia 里再套 `context()`**：它内部已有作用域，清理只调 `mm.revert()`。
- CSS 侧同步降级：`transition-duration: 1ms`、关掉光斑、关掉 `will-change`。
- 原则：**效果可以消失，状态不能消失**。对勾要立刻可见，数字要直接是目标值，不能卡在 0 或"进行中"。

### 清理

| 环境 | 做法 |
| --- | --- |
| 原生 | 用 `context(() => {...}, root)` 建立作用域，卸载时 `ctx.revert()` |
| Vue | `onMounted` 建、`onBeforeUnmount` 里 `timeline.kill()` / `mm.revert()` / `ctx.revert()` |
| React | 官方 React skill 的 Hook（`scope` + `dependencies`）；需要手动时返回 cleanup |
| 帧循环 | `loop.stop()`；`ResizeObserver.disconnect()`；`ticker.remove()` |
| 事件委托 | 返回取消函数，组件卸载时摘掉 `pointerdown/pointerup/pointermove` |

### 防重复点击

三层一起上，缺一层就会漏：

1. 视觉：`disabled` 或 `aria-disabled`。
2. 逻辑：模块内 `busy` 标志（键盘回车可绕过视觉禁用）。
3. 动画：同一元素上的新补间用 `overwrite: 'auto'` 或先 `kill()`。

### 无障碍

- 状态变化用 `aria-live="polite"`（Toast、成功提示）；错误用 `role="alert"`。
- 异步按钮加 `aria-busy="true"`。
- 浮层：焦点陷阱 + Escape 关闭 + 关闭后焦点回到触发控件；多层浮层只有最上层响应 Escape。
- 图标按钮必须有中文 `aria-label`；SVG 装饰 `aria-hidden="true"`。
- 动画不能是唯一的信息通道：失败要有文案，选中要有 `aria-pressed/aria-current`，涨跌要有箭头与数值。
- 数据图形给完整 `aria-label`（例："近 7 日播放量 812 万，较上周 +12%"），不要让读屏用户只能听到"图表"。
- 键盘替代：看板拖拽要有"移动到…"菜单；画布要有方向键导航。

### 布局属性：什么时候可以违背"优先 transform"

必须动 `width/height/top/left` 的合法例外只有三类：

1. **容器形状本身在变**（胶囊→圆）。用 `scaleX` 会把文字、描边、圆角一起拉扁。
2. **一次性、脱流的临时元素**（抽屉的 morph ghost、克隆的拖拽卡）。
3. **测量驱动的布局动画**（滑块在槽里换位置），且已经用 Flip 或几何差值算好起止。

即使如此也要满足：固定高度的外层槽位、只动一个维度、时长 ≤ 0.6s、结束后 `clearProps`、不让兄弟元素跟着重排。详见 `buttons-forms.md` §1 的"为什么这里必须动 width"。

### 属性分工

| 属性 | 归谁 |
| --- | --- |
| `transform`（x/y/scale/rotation）、`opacity`、`strokeDashoffset` | 动效脚本 |
| 颜色、背景、边框、阴影、圆角 | CSS `transition` |
| 需要连续补间的自定义属性（如 `--fill`） | CSS `@property` + transition |
| `backdrop-filter` | 谁都不补间（只切 `opacity` 或类） |

同一条属性两处都写，必然出现"点了没反应"或"回弹两次"。

### 后台标签页兜底

`document.hidden` 时 rAF 被节流，补间会停在中途：

```js
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  finishRunningAnimations()   // recipes.js 导出：把所有进行中的补间推到终态
})
```

Vue 的 `<Transition>` 若拿不到 `done`，元素会永远留在 DOM 里；所有跳过动画的分支都必须同步调用 `done()`。

## Best practices ✅

- ✅ 先查效果表，再读一个 reference；不要凭记忆拼 API。
- ✅ 参数从 `design-tokens.md` 取；新参数先加进令牌表再使用。
- ✅ 用 transform 别名（`x`、`y`、`scale`、`rotation`、`xPercent`），淡入淡出用 `autoAlpha`。
- ✅ 多步动画用一条 timeline + position 参数；同一时刻开始的东西写同一个 position。
- ✅ 每个效果函数返回 timeline 或 cleanup；收尾清 `clearProps`，让 CSS 类接管终态。
- ✅ 初始隐藏态写在时间轴开头的 `set()` 里，后面只用 `to()` 推进；并用 CSS 兜底类防止首帧闪现。
- ✅ 连续多个 `from()` / `fromTo()` 作用于同一属性时，后者设 `immediateRender: false`。
- ✅ 指针跟随用 `quickTo`；弹簧用临界阻尼 + 有上限的 `dt`。
- ✅ 常驻帧动画走统一的帧循环（挂 `ticker`、离屏/隐藏停帧、`try/catch` 只报一次）。
- ✅ 状态动画与真实请求结果绑定；等待期间锁定宽度，不要"收缩再展开"。
- ✅ 数据看板：轴/单位/容器固定，读数与图形共用一个 state 驱动，入场只播一次。
- ✅ 数字用 `tabular-nums` + `min-width`（或按位容器）锁住宽度，避免滚动时左右跳。
- ✅ 刷新数据只做"旧值 → 新值"的过渡，并对变化的块做一次轻提示（不要重播入场）。
- ✅ reduced-motion 下直接给终态，同时保证 `done` 回调执行。
- ✅ 大列表/图谱：先算目标坐标，再让弹簧追随；不要在帧循环里读布局。

## Do Not ❌

- ❌ 不要用 `delay` 串多步动画；不要为了"看起来丰富"叠加两条主时间轴。
- ❌ 不要在 `backdrop-filter`、`box-shadow`、`filter` 上做补间。
- ❌ 不要让 `transition` 与脚本抢 `transform` / `opacity`。
- ❌ 不要给所有元素统一 `y: 40, duration: 1, stagger: 0.2`。
- ❌ 不要用无限循环的装饰动画（呼吸/旋转/闪烁），除了真实进行中的指示。
- ❌ 不要用 emoji 表达状态；不要用颜色作为唯一状态通道。
- ❌ 不要在 `matchMedia` 里嵌套 `context()`。
- ❌ 不要在 Vue/React 卸载后留下监听、时间轴或 ticker 回调。
- ❌ 不要用 `setTimeout` 假装接口成功；不要用抖动表达"格式校验失败"（抖动只留给服务端拒绝）。
- ❌ 不要在需要可读性的表格/正文上叠玻璃与指针光。
- ❌ 不要忘记 `document.hidden` 分支——它会让过渡回调永远不执行。
- ❌ 不要让坐标轴、单位、图例位置参与生长动画；不要用 `width` 长柱子（用 `scaleX` + `transform-origin`）。
- ❌ 不要在数据刷新时重播"从 0 开始"的入场动画；不要只让数字动、图形不动。

## 落地流程（做完再交付）

1. **查表**：在"效果索引"里定位效果，读对应 reference 的该小节（不要整份读）。
2. **定参数**：从 `design-tokens.md` 取 ease/duration；需要新值时先加令牌。
3. **写状态机**：idle → loading → success/error，或 首次入场 → 刷新过渡，写清被打断时怎么办。
4. **套代码**：`assets/recipes.js` 里已有可直接引用的函数（按压、滑块、浮层、级联、弹簧、帧循环、数字/柱条/折线/环图/数据更新）；`assets/motion-tokens.css` 是变量与材质。
5. **自检**：
   - 反馈是否在 100ms 内出现？
   - 卸载/切换时是否 kill、revert、摘监听？
   - reduced-motion 与 `document.hidden` 分支是否给了终态并调用了 `done`？
   - 有没有动不该动的布局属性？有没有和 CSS transition 打架？
   - 数据看板：轴是否固定？读数与图形是否同步？刷新是否误重播？
   - 键盘与读屏用户能否完成同一件事？
   - 一屏是否只有一个主角？
6. **预览**：`assets/demo/index.html` 集中演示全部效果，可直接对照手感（需联网加载动画库 CDN）。

## 文件说明

```
motion-recipes/
├── SKILL.md                      ← 你正在读的入口
├── references/
│   ├── buttons-forms.md          ← 按钮与表单（登录按钮形变在这里）
│   ├── data-viz.md               ← 数据看板：数字滚动、柱条、折线、环图、错峰、更新
│   ├── transitions.md            ← 页面/路由/浮层/Toast/浮条/视图切换
│   ├── scroll.md                 ← 项目滚动结构 + 滚动叙事配方
│   ├── micro-interactions.md     ← 悬停、指针光、磁吸、跟随、读数、拖拽、FLIP、视口
│   ├── text-svg.md               ← 文字入场、描边、形变、沿路径脉冲、图标切换
│   ├── graphs-canvas.md          ← 图谱舞台、组织画布、弹簧与帧循环
│   └── design-tokens.md          ← 缓动、时长、圆角、阴影、配色、反模式
├── assets/
│   ├── motion-tokens.css         ← 可直接引入的变量与材质类
│   ├── recipes.js                ← 原生 JS 可复用函数（无框架依赖）
│   └── demo/index.html|css|js    ← 集中演示页（16 组效果，含自检）
└── evals/evals.json              ← 触发与产出测试用例
```

读取建议：**一次只读一个 reference 的相关小节**。`design-tokens.md` 可以在每次开工时快速过一遍；`graphs-canvas.md` 只在做图谱/画布时读。
