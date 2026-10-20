# 数据看板动效

看板动效的目标不是"炫"，而是**建立阅读顺序 + 让数字变化可被感知**。六条配方共用一套底座，全部遵守三条纪律：

1. **轴、单位、卡片位置不动**：只有图形与读数在动。坐标轴跟着抖，人就无法比较。
2. **读数与图形同一个进度**：数字到 80%，柱子也必须在 80%。用一个 state 对象同时驱动两者。
3. **入场只播一次，刷新只做过渡**：第二次进入、切时间范围、轮询回来，只能走"旧值 → 新值"。

参数来源：`design-tokens.md`。数字落定类统一 0.8–1.2s，更新类 0.6s。

### 选型：什么数据配什么动效

| 你要表达 | 用 | 别用 | 理由 |
| --- | --- | --- | --- |
| 单点量级（播放量、销售额、在线数） | 数字滚动 §2 | 进度条、环图 | 读者要的是那个数，不是比例 |
| 同类目大小对比（平台、产品） | 横向柱条 §3 | 环图、3D 饼图 | 长度比面积更容易比较 |
| 时间趋势（留存、流量） | 折线描画 §4 | 柱条（点很多时）、环图 | 趋势要连续感，X 轴是时间 |
| 部分与整体（3–5 段） | 环图展开 §5 | 超过 6 段的环、3D 饼 | 段太多就读不出占比 |
| 首屏阅读顺序 | 面板错峰 §6 | 全部同时淡入 | 顺序即层级 |
| 数据变化（刷新、切范围） | 旧值→新值 §7 | 重播入场 | 从 0 重来会被误读成"掉过数据" |

一个看板只选**一个主图**（柱条或折线或环图），其余用数字与小图辅佐。两张图都想抢主角时，读者两张都不会看。

## 1. 共用底座

### 1.1 只播一次

```js
// 组件内用 ref 标记；跨路由的"每次会话只播一次"用 sessionStorage
const PLAYED_KEY = 'dash:entrance:v1'

export function shouldPlayEntrance() {
  if (motionSkipped()) return false
  if (sessionStorage.getItem(PLAYED_KEY)) return false
  sessionStorage.setItem(PLAYED_KEY, '1')
  return true
}
```

- 版本号写进 key（`v1`）：改了编排要重播时，改 key 即可，不要把老 key 删来删去。
- `motionSkipped()` = 减少动效或页面在后台（见 `assets/recipes.js`）。

### 1.2 数字格式化（不要每帧 `toLocaleString` 造新对象）

```js
const formatters = new Map()

function formatter(decimals, group) {
  const key = `${decimals}|${group}`
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: group,
    }))
  }
  return formatters.get(key)
}

/** 只写 textContent；单位放在兄弟节点里，绝不参与补间 */
export function paintNumber(el, value, { decimals = 0, group = true } = {}) {
  el.textContent = formatter(decimals, group).format(value)
}
```

```css
.kpi-value {
  display: inline-block;
  font-variant-numeric: tabular-nums;   /* 每位等宽，滚动时不左右跳 */
  min-width: 4ch;                        /* 预留位宽，避免 9 → 10 时挤动单位 */
  text-align: right;
}
.kpi-unit { margin-left: 4px; color: var(--ink-soft); font-size: .5em; }
```

### 1.3 无障碍

读屏用户不需要听你数 60 帧。让**容器**说终值，动画节点对读屏隐藏：

```html
<div class="kpi" role="group" aria-label="播放量 1284 万，较上周增长 12%">
  <span class="kpi-value" aria-hidden="true">0</span>
  <span class="kpi-unit" aria-hidden="true">万</span>
</div>
```

## 2. 数字滚动（0 → 目标值，只播一次）

### 适用 / 不适用

- 适用：播放量、销售额、在线人数、转化率等**首屏核心指标**（一屏 2–4 个）。
- 不适用：明细表里的每个数字（太多、太吵）、会频繁刷新的实时数字（用 §7 的更新过渡）、需要精确读数且旁边没有图的场景（滚动会短暂妨碍阅读）。

### 交互流程

```
骨架（"—" 占位）──数据到达──▶ 首帧渲染 0 ──1.1s expo.out──▶ 目标值 ──▶ 静止
                                      └─ 卡片位置、单位、标签全程不动
```

多个卡片时错开 0.08s，顺序按阅读序（左 → 右，上 → 下），**不要随机**。

### 实现

```js
import { gsap } from 'gsap'

/**
 * 数字滚动：只播一次，单位与卡片位置不动。
 * 语义：结 Crystallize
 */
export function countUp(el, to, {
  from = 0, decimals = 0, duration = 1.1, delay = 0, group = true, onDone,
} = {}) {
  if (!el) return null
  if (motionSkipped()) { paintNumber(el, to, { decimals, group }); onDone?.(); return null }

  paintNumber(el, from, { decimals, group })
  const state = { v: from }
  const step = 1 / 10 ** decimals
  return gsap.to(state, {
    v: to,
    duration,
    delay,
    ease: 'expo.out',                 // 前 30% 走完 70% 的距离，读起来"一下就到位"
    snap: { v: step },                // 只落在显示精度上，避免 12.60000001
    onUpdate: () => paintNumber(el, state.v, { decimals, group }),
    onComplete: () => {
      paintNumber(el, to, { decimals, group })   // 用终值兜底，杜绝浮点误差
      onDone?.()
    },
  })
}
```

用法：

```js
const cards = document.querySelectorAll('[data-kpi]')
cards.forEach((card, i) => {
  const el = card.querySelector('.kpi-value')
  const to = Number(card.dataset.value)
  countUp(el, to, { decimals: Number(card.dataset.decimals || 0), delay: i * 0.08 })
})
```

### 可调参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| 时长 | 1.1s | 0.8s 太快像跳变；1.4s 以上用户会等 |
| 曲线 | `expo.out` | 金融/严肃场景换 `power3.out`，少一点急停 |
| 卡片错开 | 0.08s | 4 张卡总计 0.24s，超过 0.1s 会显得拖 |
| 小数位 | 0 | 转化率/客单价用 1 位，金额用 0 或 2 位 |
| 起始值 | 0 | 若上游已有粗略值（缓存），从缓存值起滚更诚实 |

### 注意事项

- **单位、卡片的 padding、标题位置必须由 CSS 固定**：单位单独节点、数字 `tabular-nums` + `min-width`。否则 9 → 10 时整行会挤一下。
- 不要用 `innerHTML` 拼字符串（每帧解析 HTML，且可能吞掉子节点）；只写 `textContent`。
- 千分位与单位不要用动画渐显——它们是基准信息，应该一开始就在。
- 数据是 `null`/未加载时显示 `—`，**不要显示 0**（0 是有意义的值）。
- `aria-label` 给终值，动画节点 `aria-hidden`（见 §1.3）。
- 减少动效时直接写目标值，`onDone` 仍要调用（后面的编排依赖它）。

## 3. 柱条生长（0 → 向右伸长，轴固定）

### 适用 / 不适用

- 适用：不同平台/产品/渠道的横向对比、排行榜（条形比饼图更容易比较）。
- 不适用：时间序列（用折线）、精确到个位的强对比（用表格）。

### 交互流程

```
坐标轴、分类标签、网格线：静态直出（不参与动画）
柱条：scaleX 0 → 1（按 --ratio），每根错开 0.06s
数值：该柱到位后 0.1s 淡入 + 右移 6px → 0
完成后：整组静止，悬停才给 tooltip
```

### 实现：统一用 `--ratio` 驱动，入场与更新共用一条路径

```html
<div class="hbar" style="--ratio: 0.82">
  <span class="hbar-label">视频号</span>
  <span class="hbar-track">
    <span class="hbar-fill"></span>
  </span>
  <span class="hbar-value" aria-hidden="true">82.4 万</span>
</div>
```

```css
.hbar {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 76px;  /* 三列固定，数值列不随柱长移动 */
  align-items: center;
  gap: 12px;
  height: 32px;
}
.hbar-track { position: relative; height: 10px; border-radius: 999px; background: rgba(46, 58, 62, .08); }
.hbar-fill {
  position: absolute; inset: 0;
  border-radius: inherit;
  background: var(--blue);
  transform: scaleX(var(--ratio, 0));      /* 只动 transform */
  transform-origin: 0 50%;                 /* 从左端向右伸长 */
  will-change: transform;
}
.hbar-value {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--ink-muted);
  font-size: 12.5px;
}
.hbar.is-highlight .hbar-fill { background: var(--lime); }
```

```js
import { gsap } from 'gsap'

/**
 * 柱条生长：轴与标签保持不动，数值在该柱到位后出现。
 * 语义：结 Crystallize
 */
export function growBars(root, { duration = 0.8, stagger = 0.06, highlightLast = true } = {}) {
  const rows = Array.from(root.querySelectorAll('.hbar, .vbar'))
  if (!rows.length) return null

  // 入场前先把比例归零、数值藏起来（用 set 而不是 from，避免重复调用时闪回）
  rows.forEach((row) => {
    const ratio = Number(row.dataset.ratio || 0)
    row.style.setProperty('--ratio', '0')
    gsap.set(row.querySelector('.hbar-value, .vbar-value'), { autoAlpha: 0, x: 6 })
    if (highlightLast) row.classList.remove('is-highlight')
  })

  if (motionSkipped()) {
    rows.forEach((row) => {
      row.style.setProperty('--ratio', String(row.dataset.ratio || 0))
      gsap.set(row.querySelector('.hbar-value, .vbar-value'), { autoAlpha: 1, x: 0 })
    })
    return null
  }

  const tl = gsap.timeline()
  rows.forEach((row, i) => {
    const ratio = Number(row.dataset.ratio || 0)
    const proxy = { v: 0 }
    const at = i * stagger
    tl.to(proxy, {
      v: ratio, duration, ease: 'power3.out',
      onUpdate: () => row.style.setProperty('--ratio', proxy.v.toFixed(4)),
    }, at)
    // 数值在本柱到位后才出现：位置算在 at + duration * 0.85
    tl.to(row.querySelector('.hbar-value, .vbar-value'), {
      autoAlpha: 1, x: 0, duration: 0.24, ease: 'power1.out', clearProps: 'transform',
    }, at + duration * 0.85)
  })

  if (highlightLast && rows.length > 1) {
    tl.call(() => rows[rows.length - 1].classList.add('is-highlight'), undefined, '>-0.1')
  }
  return tl
}
```

### 竖向柱状图

同一套 `--ratio`，只换 CSS：

```css
.vbar { display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
.vbar-fill {
  width: 100%; height: 100%;
  transform: scaleY(var(--ratio, 0));
  transform-origin: 50% 100%;
  border-radius: 6px 6px 2px 2px;
}
```

### 要点

- **不要用 `width` 长柱子**：每帧布局，且 `border-radius` 会被压成椭圆。`scaleX` + `transform-origin: 0 50%` 是唯一正确做法。
- 数值列必须在网格里**独立占位**，不要贴着柱子终点绝对定位——否则柱长变化时数字会跟着跑。
- 数值出现时间用 `at + duration * 0.85`，让"柱到位 → 数字亮"有 0.1s 的先后，读起来是"测出来了"。
- 高亮项最后落定（`is-highlight`），用斜线填充或青柠色区分"当前/冠军"，不要靠变色表示状态。
- 排序：先按最终值排好序再动画，**不要在动画里交换位置**（那需要 FLIP，且观众看不清）。
- 减少动效：直接给 `--ratio` 终值与数值。

## 4. 折线描画（沿时间轴从左向右展开）

### 适用 / 不适用

- 适用：趋势、留存、流量、转化曲线（时间在 X 轴的场景）。
- 不适用：无序类别的对比、只有 2–3 个数据点（用柱状/数字）。

### 交互流程

```
坐标轴、网格、时间刻度：静态直出
折线：从左端沿路径描到右端（1.1s power2.inOut），高低起伏原样保留
面积：折线走完后淡入（0.8s，delay 0.5）
末端点：scale 0 → 1（back.out），读数出现
```

### 实现

给路径加 `pathLength="1"`，把路径长度归一化，省掉 `getTotalLength()` 与每次重算：

```html
<svg class="trend" viewBox="0 0 560 180" preserveAspectRatio="none" aria-label="近 7 日播放量趋势">
  <path class="trend-area" d="…" />
  <path class="trend-line" pathLength="1" d="…" />
  <circle class="trend-dot" r="3" />
</svg>
```

```css
.trend-line { fill: none; stroke: var(--blue); stroke-width: 2; stroke-linecap: round; }
.trend-area { fill: rgba(35, 109, 233, .1); opacity: 0; }
```

```js
/**
 * 折线描画：X 轴（时间）固定，线从左向右展开。
 * 语义：导 Conduct
 */
export function drawTrend(root, { duration = 1.1 } = {}) {
  const svg = root.querySelector('svg')
  const line = root.querySelector('.trend-line')
  const area = root.querySelector('.trend-area')
  const dot = root.querySelector('.trend-dot')
  if (!line) return null
  if (motionSkipped()) {
    gsap.set([line, area, dot], { clearProps: 'all', autoAlpha: 1 })
    return null
  }

  const tl = gsap.timeline()
  tl.fromTo(line,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' }, 0)
  if (area) tl.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, duration * 0.45)
  if (dot) {
    const end = line.getPointAtLength(line.getTotalLength())
    gsap.set(dot, { attr: { cx: end.x, cy: end.y } })
    tl.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, duration * 0.82)
  }
  return tl
}
```

### 要点

- **描画方向必须与阅读方向一致**：从左到右。从中间向两边展开适合"分类对照"，不适合时间轴。
- Y 轴刻度不要跟着长：先固定 `viewBox` 与刻度，再描绘；否则整张图会上下缩放，读数错位。
- 只播一次；数据刷新走"形变"（见 §7），不要重新描。
- 不要给每个数据点加依次弹入的圆点——趋势图的主角是线，点只在末端或悬停时出现。
- 折线用"中点三次贝塞尔"（`C mx,p.y mx,c.y c.x,c.y`）比折线柔和，但**不要过度平滑**：真实尖峰被抹平就是失真。
- `pathLength="1"` 让 dasharray 与路径长度解耦，改数据（重新生成 `d`）后不需要重新量长度。

## 5. 环图展开（色块依次展开，中心总量不动）

### 适用 / 不适用

- 适用：占比关系（渠道构成、流量来源、预算分配），分段 3–5 个。
- 不适用：需要精确比较（用条形）、分段超过 6 个（用堆叠条或表格）。

### 交互流程

```
底环：淡入（0.2s）
各色段：按顺时针依次展开，每段 0.42s，衔接处重叠 0.06s
中心总量：与各段同步从 0 滚到 100%
占比标签/图例：最后一段结束后 0.2s 淡入，之后永久保留
```

### 实现

几何先算好，动画只改 `stroke-dasharray`：

```js
const R = 54
const C = 2 * Math.PI * R        // 339.29

/**
 * 环图展开。段按顺序展开，中心总量同步滚动。
 * 语义：导 Conduct → 结 Crystallize
 */
export function expandDonut(root, segments, { duration = 0.42, overlap = 0.06, total = 100 } = {}) {
  const nodes = Array.from(root.querySelectorAll('.donut-seg'))
  const center = root.querySelector('.donut-total')
  const legend = root.querySelectorAll('.donut-legend li')
  if (!nodes.length) return null

  // 静态布局：每段起点由前面的占比累加，用负的 dashoffset 定位（配合 rotate(-90) 从 12 点开始）
  let acc = 0
  nodes.forEach((node, i) => {
    const value = Number(segments[i] ?? 0)
    const len = (value / 100) * C
    node.dataset.len = String(len)
    node.dataset.start = String(acc)
    node.style.strokeDasharray = `0 ${C}`
    gsap.set(node, { strokeDashoffset: -acc })
    acc += len
  })

  if (motionSkipped()) {
    nodes.forEach((node) => { node.style.strokeDasharray = `${node.dataset.len} ${C}` })
    if (center) paintNumber(center, total, { decimals: 0 })
    gsap.set(legend, { autoAlpha: 1 })
    return null
  }

  const tl = gsap.timeline()
  nodes.forEach((node, i) => {
    const len = Number(node.dataset.len)
    const at = i * (duration - overlap)
    const proxy = { v: 0 }
    tl.to(proxy, {
      v: len, duration, ease: 'power2.out',
      onUpdate: () => { node.style.strokeDasharray = `${proxy.v} ${C - proxy.v}` },
    }, at)
  })
  if (center) {
    const tween = countUp(center, total, { duration: 0.9, decimals: 0 })
    if (tween) tl.add(tween, 0)
  }
  if (legend.length) {
    tl.fromTo(legend, { autoAlpha: 0, y: 6 }, {
      autoAlpha: 1, y: 0, duration: 0.24, ease: 'power1.out',
      stagger: 0.04, clearProps: 'transform',
    }, nodes.length * (duration - overlap) - overlap)
  }
  return tl
}
```

```css
.donut-seg {
  fill: none;
  stroke-width: 18;
  stroke-linecap: butt;        /* round 会让相邻段互相压边，视觉上占比就错了 */
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}
```

### 要点

- **中心总量位置与字号固定**，只补间数值（`countUp`），不要缩放整个环。
- 段之间留 1.5–2% 的缝隙（把每段长度乘 0.98，或 `stroke` 上加 gap），否则相邻同色深浅难分。
- `stroke-linecap: butt`：`round` 会在两端各多出半个线宽，最后一段会盖住第一段。
- 占比标签在动画结束后**必须保留**（用户需要读数），不要跟着淡出。
- 分类色只用于区分，不表示状态；图例要有文字与百分比，不能只靠颜色。
- 更新数据时走"角度补间"（见 §7），不要重播展开。

## 6. 面板错峰入场（指标 → 图表 → 明细）

### 适用 / 不适用

- 适用：数据看板首屏、报表页、概览页。
- 不适用：表单页、详情页（没有"先看结论再看细节"的阅读路径）。

### 交互流程

```
0.00s  指标卡    y 18 → 0，每张 0.045s
0.12s  图表区    y 20 → 0，每块 0.05s（图表内部的数字/柱子随后自己播）
0.24s  明细/表格 y 14 → 0，行级联 0.025s
≈0.9s  全部落定（总时长必须 ≤ 1.1s）
```

### 实现

用 DOM 上的 `data-layer` 分组，一条时间轴按层推进：

```js
/**
 * 面板错峰入场：顺序 = 信息层级（指标 → 图表 → 明细）。
 * 语义：放 Discharge
 */
export function staggerPanels(root, { y = 18 } = {}) {
  const layers = [
    { sel: '[data-layer="metrics"] > *', at: 0, each: 0.045, dur: 0.56 },
    { sel: '[data-layer="charts"] > *', at: 0.12, each: 0.05, dur: 0.62 },
    { sel: '[data-layer="detail"] > *', at: 0.24, each: 0.025, dur: 0.5 },
  ].map((layer) => ({ ...layer, items: Array.from(root.querySelectorAll(layer.sel)) }))

  const all = layers.flatMap((layer) => layer.items)
  if (!all.length) return null

  if (motionSkipped()) {
    gsap.set(all, { clearProps: 'opacity,visibility,transform' })
    return null
  }

  gsap.set(all, { autoAlpha: 0, y })
  const tl = gsap.timeline()
  layers.forEach((layer) => {
    if (!layer.items.length) return
    tl.to(layer.items, {
      autoAlpha: 1, y: 0, duration: layer.dur, ease: 'expo.out',
      stagger: { each: layer.each, from: 'start' }, clearProps: 'opacity,visibility,transform',
    }, layer.at)
  })
  return tl
}
```

### 要点

- **顺序即信息层级**：指标（结论）→ 图表（证据）→ 明细（可核对）。不要按 DOM 顺序随便来。
- 总时长 ≤ 1.1s。层与层之间 0.12s 足够，0.3s 以上会让人觉得页面在"加载"。
- 与路由转场**合并成一条**：如果页面已经有 `pageEnter`（见 `transitions.md`），把面板编排作为其中的一段，不要套两套入场（会出现"先淡入整页，再重新淡入面板"的二次闪）。
- 骨架屏要在面板入场**之前**：先骨架占位 → 数据到达 → 替换真实节点 → 再播错峰。顺序反了会看到"骨架闪 → 空白 → 内容"。
- 面板内的数字/图表不要在时间轴里再写一遍，让 §2–§5 的函数在各自 panel 的入场点之后启动。
- 只播一次（§1.1）；刷新数据时只做更新，不重播。

## 7. 数据更新（旧值 → 新值）

### 适用 / 不适用

- 适用：手动刷新、切换时间范围/筛选、轮询回来、保存后回读。
- 不适用：第一次加载（走入场的从 0 生长）、数据完全换了维度（应换图并给加载态）。

### 交互流程

```
旧值保持可见（不闪、不清空）
  → 读数：旧值 → 新值（0.6s power2.out，按位数/精度 snap）
  → 图形：同一进度形变（柱条 --ratio、环图角度、折线路径）
  → 变化的块：一层高光闪一次（0.9s，青柠 16% → 0）
  → 未变化的块：完全不动
```

### 实现：一个 state 驱动读数与图形

```js
/**
 * 更新一个指标块：数字与图形共用同一个进度，变化块闪一次提示。
 * 语义：导 Conduct → 结 Crystallize
 */
export function updateKpi(block, next, { duration = 0.6, flash = true } = {}) {
  const valueEl = block.querySelector('.kpi-value')
  const fill = block.querySelector('.hbar-fill, .vbar-fill')
  const from = Number(block.dataset.value || 0)
  const decimals = Number(block.dataset.decimals || 0)
  const ratio = Number(block.dataset.ratio || 0)
  const nextRatio = Number(next.ratio ?? ratio)

  block.dataset.value = String(next.value)
  block.dataset.ratio = String(nextRatio)

  if (motionSkipped()) {
    paintNumber(valueEl, next.value, { decimals })
    block.style.setProperty('--ratio', String(nextRatio))   // 图形也用同一个变量，直接落终态
    return null
  }

  const state = { v: from, r: ratio }
  const step = 1 / 10 ** decimals
  const tl = gsap.timeline()
  tl.to(state, {
    v: next.value, r: nextRatio, duration, ease: 'power2.out',
    snap: { v: step },
    onUpdate: () => {
      paintNumber(valueEl, state.v, { decimals })
      block.style.setProperty('--ratio', state.r.toFixed(4))
    },
  })

  // 只闪"变了的块"：高光层是独立元素，避免和卡片自身的 CSS transition 打架
  if (flash && from !== next.value) {
    const layer = block.querySelector('.kpi-flash')
    if (layer) tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0)
      .to(layer, { opacity: 0, duration: 0.72, ease: 'power2.inOut' }, 0.18)
  }
  return tl
}
```

```css
.kpi { position: relative; overflow: hidden; }
.kpi-flash {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: linear-gradient(120deg, rgba(130, 221, 45, .18), transparent 65%);
}
```

### 全屏刷新（多条数据一起变）

```js
export function refreshDashboard(root, snapshot) {
  const tl = gsap.timeline()
  // 1. 读数与柱子：同一时间窗（0.6s），但按阅读序错开 0.04s，避免"整块抽搐"
  root.querySelectorAll('[data-kpi]').forEach((block, i) => {
    const next = snapshot.kpis[i]
    tl.add(updateKpi(block, next, { duration: 0.6 }), i * 0.04)
  })
  // 2. 环图：角度补间（不重播展开）
  const donut = root.querySelector('.donut')
  if (donut) tl.add(morphDonut(donut, snapshot.donut), 0.08)
  // 3. 折线：重采样形变（不重新描）
  const trend = root.querySelector('.trend-card')
  if (trend) tl.add(morphTrend(trend, snapshot.trend), 0.12)
  return tl
}

/** 环图更新：只改 dasharray 与起点，不重播展开 */
export function morphDonut(root, shares, { duration = 0.6 } = {}) {
  const nodes = Array.from(root.querySelectorAll('.donut-seg'))
  const C = 2 * Math.PI * Number(root.dataset.radius || 54)
  const tl = gsap.timeline()
  let acc = 0
  nodes.forEach((node, i) => {
    const len = (Number(shares[i] || 0) / 100) * C
    const state = { v: Number(node.dataset.len || 0) }
    node.dataset.len = String(len)
    gsap.set(node, { strokeDashoffset: -acc })     // 起点随前一段变化，静态设置
    acc += len
    tl.to(state, {
      v: len, duration, ease: 'power2.out',
      onUpdate: () => { node.style.strokeDasharray = `${state.v} ${C - state.v}` },
    }, 0)
  })
  return tl
}

/** 沿路径等距采样 n 个点（用于两条折线之间插值） */
function samplePath(path, n = 48) {
  const len = path.getTotalLength()
  return Array.from({ length: n }, (_, i) => path.getPointAtLength((i / (n - 1)) * len))
}

/**
 * 折线形变：把当前 d 重采样后插值到 nextD，逐帧写回（不重新描画）。
 * baseline 是面积闭合用的底边 y（viewBox 坐标）。
 */
export function morphPathTo(line, area, nextD, { duration = 0.72, baseline } = {}) {
  const from = samplePath(line, 48)
  const probe = line.cloneNode(false)          // 离屏量新路径的点，避免闪一帧
  probe.setAttribute('d', nextD)
  probe.style.visibility = 'hidden'
  line.parentNode.appendChild(probe)
  const to = samplePath(probe, 48)
  probe.remove()

  const state = { t: 0 }
  return gsap.to(state, {
    t: 1, duration, ease: 'power2.inOut',
    onUpdate: () => {
      const points = to.map((p, i) => ({
        x: from[i].x + (p.x - from[i].x) * state.t,
        y: from[i].y + (p.y - from[i].y) * state.t,
      }))
      const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
      line.setAttribute('d', d)
      if (area && baseline !== undefined) {
        area.setAttribute('d', `${d} L${points[points.length - 1].x.toFixed(2)},${baseline} L${points[0].x.toFixed(2)},${baseline} Z`)
      }
    },
    onComplete: () => {
      // 结束帧写回精确的曲线 d，避免采样插值留下的折线感
      line.setAttribute('d', nextD)
      if (area && baseline !== undefined) {
        const last = samplePath(line, 2)[1]
        const first = samplePath(line, 2)[0]
        area.setAttribute('d', `${nextD} L${last.x.toFixed(2)},${baseline} L${first.x.toFixed(2)},${baseline} Z`)
      }
    },
  })
}

/** 按 viewBox 生成平滑折线 d；max 必须与 Y 轴刻度上限一致 */
export function buildTrendPath(line, values, { max } = {}) {
  const box = line.ownerSVGElement.viewBox.baseVal
  const padX = 16
  const padY = 16
  const peak = max ?? Math.max(...values) * 1.15
  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (box.width - padX * 2),
    y: box.height - padY - (v / peak) * (box.height - padY * 2),
  }))
  let d = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i - 1]
    const c = points[i]
    const mx = ((p.x + c.x) / 2).toFixed(2)
    d += ` C${mx},${p.y.toFixed(2)} ${mx},${c.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`
  }
  return d
}

/** 趋势卡更新：新数据先算成 d，再走形变 */
export function morphTrend(root, values) {
  const line = root.querySelector('.trend-line')
  const area = root.querySelector('.trend-area')
  if (!line) return null
  const nextD = buildTrendPath(line, values)         // 按调用方的比例尺生成 d
  return morphPathTo(line, area, nextD, { baseline: Number(root.dataset.baseline || 164) })
}
```

### 要点

- **绝不重播入场**：从 0 长一遍会让用户以为数据归零过。
- 读数与图形必须同一个 state（示例里 `state.v` 与 `state.r` 在同一条补间里推进），否则会出现"数字到了、柱子还在走"。
- 上升用 `power2.out`（先快后慢，像"落定"）；下降同样曲线即可，不要用弹跳——跌了还弹一下很刺眼。
- 涨跌要用**箭头 + 数值 + 颜色**三重编码，颜色不能是唯一通道。
- 轮询（< 2s 间隔）时关掉闪烁（`flash: false`），只在用户主动刷新时闪；否则屏幕一直在闪。
- 只闪"变化超过阈值"的块（例如相对变化 > 1%），噪声数据不要闪。
- 减少动效：直接写终值；闪烁层直接不显示。

## 8. 整屏编排（组合顺序）

一条时间轴，位置用绝对时间写清楚，便于后面加东西：

```js
const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })

tl.add(staggerPanels(dashboard), 0)                    // 0.00 面板入场（内部已分层）
tl.add(countUp(kpiEls[0], 1284, { delay: 0.18 }), 0.18) // 0.18 指标数字（与面板重叠，不必等面板）
tl.add(growBars(barsEl), 0.34)                          // 0.34 柱条
tl.add(drawTrend(trendEl), 0.4)                         // 0.40 折线
tl.add(expandDonut(donutEl, shares), 0.46)              // 0.46 环图
```

- 图表类动画在面板入场 **60% 处**开始，视觉上"卡片先到，内容随后填充"，比"等卡片全部到位再开始"更紧凑。
- 总时长控制在 1.6s 以内（含图表），超过就会有人开始滚动页面。
- 用户在这期间点击筛选/切换，直接 `tl.progress(1)` 收尾，再执行新数据（不要打断在半路）。

## 9. 检查清单

| 项 | 自查 |
| --- | --- |
| 轴/单位/卡片位置 | 动画前后 `getBoundingClientRect` 不变（可用自动化断言） |
| 读数与图形 | 共用 state；中途暂停时两者比例一致 |
| 只播一次 | 二次进入、切筛选、轮询不重播 |
| 刷新 | 走旧值→新值；未变化块不动；轮询不闪 |
| 数字宽度 | `tabular-nums` + `min-width`，9→10 不挤动单位 |
| reduced-motion | 直接终值，`onDone` 仍执行 |
| 后台标签页 | `document.hidden` 时直接落终态 |
| 读屏 | 容器 `aria-label` 给终值与涨跌，动画节点 `aria-hidden` |
| 性能 | 只动 `transform` / `opacity` / `stroke-dashoffset`（`--ratio` 走 transform） |
| 颜色 | 分类色只用图例，不表示状态；状态另有文字/箭头 |
