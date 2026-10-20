# 文字入场与 SVG 描边

SVG 的"画出来"是这个项目里最贵的两个瞬间之一（另一个是按钮形变）。核心手法只有三条：`strokeDashoffset` 描边、路径取点做脉冲、必要时用 `MorphSVG` 换形状。

## 1. 对勾：圆环 + 勾，两段描边

### 效果

成功时一个圆环从 12 点方向顺时针描满（0.5s `expo.out`），勾从第一段末端接着画出（0.32s `back.out(1.6)`），最后整体 `scale 1.06 → 1`。

### 标记

```html
<svg class="mark" viewBox="0 0 46 46" aria-hidden="true">
  <circle class="mark-track" cx="23" cy="23" r="20" />
  <circle class="mark-progress" cx="23" cy="23" r="20" />
  <path class="mark-check" d="m15 23.5 5.5 5.5L31.5 18" />
</svg>
```

```css
.mark { overflow: visible; }
.mark-track,
.mark-progress {
  fill: none; stroke-width: 2.4;
  transform: rotate(-90deg);          /* 从 12 点开始，而不是 3 点 */
  transform-origin: 50% 50%;
}
.mark-track { stroke: rgba(255,255,255,.5); }
.mark-progress { stroke: #fff; stroke-dasharray: 126; stroke-dashoffset: 126; }  /* 2πr, r=20 */
.mark-check {
  fill: none; stroke: #fff; stroke-width: 3;
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 24; stroke-dashoffset: 24;
}
```

### 时间轴

```js
const tl = gsap.timeline()
tl.fromTo(ring, { strokeDashoffset: 126 }, { strokeDashoffset: 0, duration: 0.5, ease: 'expo.out' })
  .fromTo(check, { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: 0.32, ease: 'back.out(1.6)' }, '-=0.22')
  .to(orb, { scale: 1.06, duration: 0.16, ease: 'power1.out' })
  .to(orb, { scale: 1, duration: 0.3, ease: 'back.out(1.6)' })
```

### 为什么不用 DrawSVG

`DrawSVGPlugin` 做的就是 `dasharray/dashoffset`，写法是 `drawSVG: '0% 100%'`，可读性更好。两种都可以，选一个并保持一致：

```js
gsap.registerPlugin(DrawSVGPlugin)
gsap.fromTo(ring, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5, ease: 'expo.out' })
```

原生 dashoffset 的好处是不依赖插件、`clearProps` 更可控；DrawSVG 的好处是百分比语义、支持多段路径。本项目用手写 dashoffset，因为 CSS 里已经写死了 `stroke-dasharray`，两者不会打架。

### 容易踩的坑

- **`stroke-dasharray` 用 CSS 写、`strokeDashoffset` 用脚本写**，别两处都补间 `dasharray`。
- 虚线 `stroke-dasharray` 若写成 `126 126`（带间隔），描边过程中会出现半截图案；描边动画请用单值。
- 路径长度必须量准：`path.getTotalLength()`。硬编码偏小会"提前画完再停住"，偏大会永远差一截。
- 动画结束 `clearProps: 'strokeDasharray,strokeDashoffset'`，否则后续 hover 描边会继承一个奇怪的起点。
- 圆环用 `rotate(-90deg)` 调整起点；不要用 `svgOrigin` 和 `transformOrigin` 同时写（只有后者生效）。

## 2. 折线描绘 + 面积淡入（图表首次渲染）

```js
export function drawPath(path, area) {
  if (!path || skipMotion()) return
  const length = path.getTotalLength()
  gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
    strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset',
  })
  if (area) gsap.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.5, ease: 'power1.out' })
}
```

- 线先走、面积后到（0.5s 后），视觉上像"数据填入"。
- **只画一次**。数据刷新要走"形变"（见下），重新描绘会让用户以为页面重载了。

## 3. 数据形变（折线在两组数之间变形）

不擦掉重画，而是把旧的采样点重采样到新点数，然后按比例插值，逐帧写回 `d`。

```js
const state = { t: 0 }
gsap.to(state, {
  t: 1, duration: 0.72, ease: 'power2.inOut',
  onUpdate: () => {
    shown.value = to.map((p, i) => ({ x: from[i].x + (p.x - from[i].x) * state.t, y: from[i].y + (p.y - from[i].y) * state.t }))
  },
})
```

- 先把旧点列 `resample` 成与目标相同数量（线性插值），否则点数不同会错位。
- 曲线用"中点三次贝塞尔"（`C mx,p.y mx,c.y c.x,c.y`）比折线更像"脉搏"，但不要做过度平滑（`catmull-rom` 会在尖峰处过冲，读数失真）。
- 形变时长 0.72s；切范围（24h/7d/30d）时用户在看趋势，动画太长会打断对比。

## 4. 文字入场：逐行落定，而不是逐字乱飞

### 项目做法（推荐默认）

大字按**语义行**切分（模板里就是多个 `<span class="hero-line">`），每行 `y 16 → 0 + autoAlpha`，stagger 0.08，0.9s `expo.out`。

```js
tl.to(q('.hero-line'), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.12)
```

- 语义行必须在 HTML 里就分开（`<span>` 各占一行），不要靠 JS 按宽度切——响应式会重排，切错了会有半个词掉到下一行。
- 主标题可以比正文晚 0.1s、慢 0.2s（"先看到标题，再读到副文案"）。
- 每个元素入场后 `clearProps: 'transform'`，避免影响后续 `text-wrap: balance` 的重排。

### 需要逐字时（SplitText）

```js
gsap.registerPlugin(SplitText)

const split = SplitText.create(heading, { type: 'lines,words', linesClass: 'sp-line', mask: 'lines' })
gsap.from(split.words, {
  yPercent: 110,               // 配合 mask: 'lines' 做"从行内升起"
  autoAlpha: 0,
  duration: 0.7,
  ease: 'expo.out',
  stagger: { each: 0.035, from: 'start' },
})

// 卸载 / 断点变化前一定还原，否则 DOM 里会留下一堆切好的 span
return () => split.revert()
```

- `mask: 'lines'` 需要父级 `overflow: hidden`（SplitText 会自动包一层），这是"文字从行里升起来"的关键，比 `y` 位移更像排版。
- `stagger.each` 控制在 0.02–0.04；0.1 以上整句会散架。
- **不要**每个字都随机旋转、随机位移、随机颜色——那是 2015 年的效果，且中文逐字旋转会破坏字形平衡。
- 中英混排时按 `words` 拆分比 `chars` 稳（中文没有空格，`chars` 会把标点单独拆出来，避头尾规则失效）。
- 无障碍：`SplitText` 会打碎文本节点，给原元素加 `aria-label` 保留完整句子，或把拆分结果 `aria-hidden` 并放一个视觉隐藏的原文。

### 打字机（终端 / 问答输入）

```js
export function typeOut(text, write, done, speed = 42) {
  let i = 0
  write('')
  const timer = setInterval(() => {
    i += 1
    write(text.slice(0, i))
    if (i >= text.length) { clearInterval(timer); setTimeout(() => done?.(), 180) }
  }, speed)
  return () => clearInterval(timer)
}
```

- 42ms/字是中文可读速度的上限（约 24 字/秒），再快就只是闪烁。
- 返回取消函数，用户中途输入或关闭面板时必须停掉。
- 光标用 CSS 的 `caret` 或一个 1px 的 `::after` 闪烁，不要用脚本每帧画。

## 5. SVG 沿路径的脉冲（连接线 / 选中路径）

```js
const path = layer.querySelector(`.link[data-link="${id}"]`)
const len = path.getTotalLength()
const u = (t * 0.3 + k * 0.5 + (id % 7) * 0.11) % 1     // 同一条线多个脉冲错开
const pt = path.getPointAtLength(len * u)
circle.setAttribute('cx', pt.x)
circle.setAttribute('cy', pt.y)
circle.style.opacity = String(Math.sin(u * Math.PI) * 0.9)   // 两端淡、中间实
```

- `sin(uπ)` 让脉冲在端点淡入淡出，比硬切自然。
- 每条线最多 2 个脉冲；每条线的 `getTotalLength()` 缓存起来（`Map`），别每帧量。
- 一条路径上的脉冲相位用 `id % 7 * 0.11` 错开，避免所有线同步闪。
- 这类动画属于"导 Conduct"，只在**进行中**存在：暂停、离屏、减少动效时必须停帧。

## 6. 图标状态切换（勾选、成功、切换）

三种做法，按成本排：

1. **两个图标叠放 + 交叉淡入**（最便宜）：`autoAlpha` 0.16s，`scale .9 → 1`，`power1.out`。用于勾选、星标。
2. **同一个路径变形**（`MorphSVGPlugin`）：播放/暂停、菜单/关闭。只有当两个形状**拓扑接近**（点数相近）时才好看，否则中间帧会扭曲。
3. **遮罩擦除**：一个矩形 `clip-path` 扫过新旧图标。适合线性图标（如箭头方向变化）。

```js
// 做法 1
gsap.to([outIcon], { autoAlpha: 0, scale: 0.9, duration: 0.16, ease: 'power1.out' })
gsap.to([inIcon], { autoAlpha: 1, scale: 1, duration: 0.24, ease: 'back.out(1.6)' })
```

- 图标切换**不要**用旋转 180°，除非是真实的"展开/收起"语义。
- 图标按钮内的 spinner 用 CSS `animation: spin .7s linear infinite`，别用脚本（无限循环不需要控制）。
- 所有 SVG 图标加 `aria-hidden="true"`，可点按钮自己带 `aria-label`。
