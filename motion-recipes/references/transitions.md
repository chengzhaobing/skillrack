# 页面、路由与浮层转场

转场回答的是"我从哪来、到哪去、层次是什么"。所有配方都遵循两条：**进入慢、退出快（约 2:1）**；**位移用 transform，透明度用 autoAlpha**。

## 1. 页面切换（路由级）

### 效果

旧页面向后退一点（`scale .988` + 淡出 0.18s），新页从稍远处推进（`scale .994 → 1`，0.62s），页内 `.reveal` 按阅读序逐条升起，`.bento` 并列卡片从中间向两侧展开。

### 实现（Vue 的 `<Transition mode="out-in" :css="false">`）

```js
const EASE = { reveal: 'expo.out', glide: 'power4.out', exit: 'power2.in' }

export function pageLeave(el, done) {
  // 关键：out-in 模式下同步调用 done 会让框架在补丁过程中重渲染，必须推迟到本轮之后
  if (skipMotion()) { setTimeout(done, 0); return }
  gsap.to(el, { autoAlpha: 0, scale: 0.988, duration: 0.18, ease: EASE.exit, onComplete: done })
}

export function pageEnter(el, done) {
  const page = el
  if (skipMotion()) { page.classList.add('is-entrance-ready'); return done() }

  const items = page.querySelectorAll('.reveal')
  const cards = page.querySelectorAll('.bento')

  // 初始态写在开头，后面只用 to 推进（避免 from() 与已有行内样式打架）
  gsap.set(page, { autoAlpha: 1, scale: 0.994 })
  gsap.set(items, { autoAlpha: 0, y: 12 })
  gsap.set(cards, { autoAlpha: 0, y: 18 })
  page.classList.add('is-entrance-ready')   // 解除 CSS 兜底隐藏

  gsap.timeline({ onComplete: () => { gsap.set(page, { clearProps: 'transform' }); done() } })
    .to(page, { scale: 1, duration: 0.62, ease: EASE.glide }, 0)
    .to(items, { autoAlpha: 1, y: 0, duration: 0.62, ease: EASE.reveal, stagger: { each: 0.05, from: 'start' }, clearProps: 'transform' }, 0.04)
    .to(cards, { autoAlpha: 1, y: 0, duration: 0.72, ease: EASE.reveal, stagger: { each: 0.045, from: 'center' }, clearProps: 'opacity,visibility,transform' }, 0.1)
}
```

CSS 兜底（很重要，否则脚本就位前会闪一下终态）：

```css
.page { transform-origin: 50% 0; }        /* 从顶部推进，符合"往下读" */
.page:not(.is-entrance-ready) .reveal { opacity: 0; }
.page:not(.is-entrance-ready) .bento   { opacity: 0; }
```

### 为什么这么做

- `stagger: { from: 'start' }` 用于**有阅读顺序**的内容（页头、筛选区、表格）。`from: 'center'` 用于**并列卡片**，从视觉中心向两侧展开，比从左到右更像"一整块交付"。
- 每项 45–50ms、总数不超过 8–10 项。20 项 × 50ms = 1s，用户已经在找按钮了。
- `clearProps` 必须在结束帧清掉 `transform`，否则后续 `position: sticky`、`overflow` 和 Hover 抬起的 `y` 会叠加在这个 transform 上。
- 离开前要复位滚动容器：`@after-leave` 里 `content.scrollTo({ top: 0 })`，并清掉"已滚动"状态（顶栏凝结层）。

### React 等价写法

```jsx
function Page({ children, routeKey }) {
  const scope = useRef(null)
  useGSAP(() => {
    const q = gsap.utils.selector(scope)
    gsap.set(q('.reveal'), { autoAlpha: 0, y: 12 })
    gsap.timeline()
      .to(q('.reveal'), { autoAlpha: 1, y: 0, duration: .62, ease: 'expo.out', stagger: .05, clearProps: 'transform' }, .04)
  }, { scope, dependencies: [routeKey], revertOnUpdate: true })
  return <main ref={scope} key={routeKey}>{children}</main>
}
```

`revertOnUpdate: true` 让路由 key 变化时自动回滚上一次的补间与行内样式，等价于 Vue 的 `:key="route.path"` + 卸载。

## 2. 外壳首次入场

品牌 → 导航分组（`from: start`）→ 顶栏，一次 1.2s 内结束，只播一次（会话内不重播）。

```js
export function playShellEntrance(frame) {
  if (skipMotion()) { frame.classList.add('is-entrance-ready'); return }
  const brand = frame.querySelectorAll('.rail-brand')
  const groups = frame.querySelectorAll('.nav-group')
  const top = frame.querySelectorAll('.topbar > *')

  const tl = gsap.timeline({ paused: true })
  tl.set([...brand, ...groups, ...top], { autoAlpha: 0, y: 8 })
  tl.add(() => frame.classList.add('is-entrance-ready'))
  tl.to(brand, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 0)
  tl.to(groups, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: { each: 0.06, from: 'start' } }, 0.08)
  tl.to(top, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.04 }, 0.14)
  tl.add(() => gsap.set([...brand, ...groups, ...top], { clearProps: 'transform' }))
  // 等两帧合成后再起播：避开 backdrop-filter 首次栅格化那一帧的掉帧
  requestAnimationFrame(() => requestAnimationFrame(() => tl.play(0)))
}
```

两个细节值得记：`paused: true` + 两帧后再 `play` 能避开玻璃材质首次栅格化的卡顿；`set` 放在时间轴内部而不是创建前，保证 `revert()` 时整体可回收。

## 3. 弹窗（从触发点展开）

### 效果

遮罩淡入 0.22s；面板从**指针按下处**为原点，`scale .86 → 1`（0.48s `expo.out`）。键盘打开时没有来处，改为 `y 14 + scale .975` 的"上浮"，避免从屏幕中心莫名其妙放大。

```js
export const lastPointer = { x: 0, y: 0, at: 0 }

// 记录最近一次指针按下位置；键盘动作清空"来处"，让浮层回落到居中动画
document.addEventListener('pointerdown', (e) => {
  lastPointer.x = e.clientX; lastPointer.y = e.clientY; lastPointer.at = performance.now()
}, { capture: true, passive: true })
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') lastPointer.at = 0
}, { capture: true, passive: true })

const recentPointer = () => (lastPointer.at && performance.now() - lastPointer.at < 600 ? lastPointer : null)

/** 原点限制在面板外扩 25% 内：避免从屏幕角落飞入 */
function originOf(panel) {
  const point = recentPointer()
  if (!point) return '50% 50%'
  const r = panel.getBoundingClientRect()
  const x = Math.min(Math.max(point.x - r.left, -r.width * 0.25), r.width * 1.25)
  const y = Math.min(Math.max(point.y - r.top, -r.height * 0.25), r.height * 1.25)
  return `${x}px ${y}px`
}

export function overlayEnter(el, done, kind = 'modal') {
  const panel = el.querySelector('.modal, .drawer') ?? el
  if (skipMotion()) return done()
  const tl = gsap.timeline({ onComplete: done })
  tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' }, 0)
  if (kind === 'pop') {
    tl.fromTo(el, { autoAlpha: 0, y: -6, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: 'expo.out', clearProps: 'transform' })
    return
  }
  gsap.set(panel, { transformOrigin: originOf(panel) })
  const from = recentPointer() ? { scale: 0.86, autoAlpha: 0, y: 0 } : { y: 14, scale: 0.975, autoAlpha: 0 }
  tl.fromTo(panel, from, { y: 0, scale: 1, autoAlpha: 1, duration: 0.48, ease: 'expo.out', clearProps: 'transform,transformOrigin' }, 0.02)
}

export function overlayLeave(el, done, kind = 'modal') {
  if (skipMotion()) return done()
  const panel = el.querySelector('.modal, .drawer') ?? el
  const tl = gsap.timeline({ onComplete: done })
  if (kind === 'pop') { tl.to(el, { autoAlpha: 0, y: -4, duration: 0.14, ease: 'power2.in' }); return }
  if (kind === 'drawer') tl.to(panel, { x: 24, duration: 0.2, ease: 'power2.in' }, 0)
  else tl.to(panel, { scale: 0.94, autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 0)
  tl.to(el, { autoAlpha: 0, duration: 0.2, ease: 'power2.in' }, 0)
}
```

### 为什么

- `transformOrigin` 指向点击处，视觉上是"你点的东西长成了这个面板"，这是最便宜的因果感。
- 退场不再回到原点（那会让 0.2s 的离开显得忙），只轻微缩小 + 淡出。
- `clearProps: 'transform,transformOrigin'` 必须加：否则面板里如果有 `position: fixed` 的子元素（下拉菜单），会被这个 transform 变成包含块而错位。
- 遮罩的 `backdrop-filter: blur(3px)` 不要参与补间，只补间 `opacity`。

## 4. 抽屉：共享元素生长

### 效果

点击表格某行 → 一块玻璃从该行的矩形**长成**右侧抽屉（宽高都变），抽屉标题、正文、底栏随后按 30ms 级联浮现。关闭时内容先退，玻璃缩回原行。

### 实现

```js
/** 一次性的"飞行玻璃"：绝对定位在 body，从 from 矩形变到 to 矩形，结束自毁 */
function morphGhost(from, to, closing = false) {
  const ghost = document.createElement('div')
  ghost.className = 'morph-ghost'    // position: fixed; border-radius: 24px; background: 浮层材质; z-index: 300
  document.body.appendChild(ghost)
  const tl = gsap.timeline({ onComplete: () => ghost.remove() })
  gsap.set(ghost, { left: 0, top: 0, x: from.left, y: from.top, width: from.width, height: from.height, autoAlpha: closing ? 1 : 0.9 })
  tl.to(ghost, { x: to.left, y: to.top, width: to.width, height: to.height, duration: closing ? 0.36 : 0.5, ease: closing ? 'power2.inOut' : 'power4.out' })
  tl.to(ghost, { autoAlpha: 0, duration: closing ? 0.16 : 0.22, ease: 'power1.out' }, closing ? '-=0.12' : '-=0.18')
  return tl
}
```

抽屉进入：遮罩淡入 → ghost 生长 → 面板在 ghost 快到位时淡入 → 内容级联。

```js
export function drawerEnter(el, done, origin) {
  const panel = el.querySelector('.drawer')
  if (skipMotion()) return done()
  const tl = gsap.timeline({ onComplete: done })
  tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' }, 0)
  if (origin && document.contains(origin)) {
    gsap.set(panel, { autoAlpha: 0 })
    tl.add(morphGhost(origin.getBoundingClientRect(), panel.getBoundingClientRect()), 0)
    tl.to(panel, { autoAlpha: 1, duration: 0.26, ease: 'power1.out' }, 0.3)
    tl.fromTo(
      panel.querySelectorAll('.drawer-head, .drawer-body > *, .drawer-foot'),
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.42, ease: 'expo.out', stagger: 0.03, clearProps: 'opacity,visibility,transform' },
      0.34,
    )
    return
  }
  // 没有来处（键盘、直接打开）：从右侧滑入
  tl.fromTo(panel, { x: 36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.52, ease: 'power4.out', clearProps: 'transform' }, 0)
}
```

### 为什么 ghost 可以动 width/height

`morph-ghost` 是**一次性、脱流的绝对定位元素**：它不参与文档流，`width/height` 变化不会推动任何兄弟元素，只影响自己的一层合成。这属于"布局属性可以用"的合法例外，代价只有它自己的重排。普通卡片不要学。

### 来处的判定

```js
// 打开时记录：最近一次指针下方、匹配选择器的元素；键盘触发为 null
export function originAtPointer(selector) {
  const point = recentPointer()
  if (!point) return null
  return document.elementFromPoint(point.x, point.y)?.closest(selector) ?? null
}
```

关闭时如果原行已经不存在（翻页、删除、筛选变了），`document.contains(origin)` 为假 → 自动退回"从右侧滑出"的普通动画，不能因为找不到起点而卡住。

## 5. 下拉、菜单、Popover

| 层 | 曲线 / 时长 | 说明 |
| --- | --- | --- |
| 下拉菜单、用户菜单 | `expo.out` 0.32s，`y -6 → 0`，`scale .98 → 1` | 从触发控件下方"弹出"，位移不超过 8px |
| 二级菜单 | 同上，但只补间 `autoAlpha` + `scale .97` | 层级深处不要位移，否则像抽屉 |
| 气泡卡片（HoverCard） | `autoAlpha` 0.16s，无位移 | 悬停触发的浮层要快，慢了像卡顿 |
| Tooltip | `autoAlpha` 0.12s | 不要 scale |

所有浮层关闭都是 0.14–0.2s 的 `power2.in`，不加位移方向反转。

## 6. Toast 牌堆

### 效果

新提示从底部弹入（`y 16 + scale .9` → 1，0.5s `back.out(1.6)`），较旧的提示缩小、变淡、向上叠成牌堆；鼠标悬停时牌堆展开成列表并暂停倒计时；每条右侧有一圈细环随剩余时间消退。

```js
function enter(el, done) {
  const card = el.querySelector('.toast')
  if (!card || skipMotion()) return done()
  gsap.fromTo(card, { autoAlpha: 0, y: 16, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.6)', clearProps: 'transform', onComplete: done })
}
function leave(el, done) {
  const card = el.querySelector('.toast')
  if (!card || skipMotion()) return done()
  gsap.to(card, { autoAlpha: 0, y: 8, scale: 0.96, duration: 0.2, ease: 'power2.in', onComplete: done })
}
```

```css
/* 牌堆位置由 CSS 负责（depth 越大越靠后），进出场由脚本负责内层 —— 两条通道互不覆盖 */
.toast-slot {
  position: absolute; left: 0; right: 0; bottom: 0;
  transform-origin: 50% 100%;
  transform: translateY(calc(var(--depth) * -9px)) scale(calc(1 - var(--depth) * .05));
  opacity: calc(1 - var(--depth) * .28);
  z-index: calc(10 - var(--depth));
  transition: transform .42s cubic-bezier(.16,1,.3,1), opacity .3s ease;
}
.toast-host.is-expanded .toast-slot { transform: translateY(calc(var(--depth) * (var(--toast-h) + 8px) * -1)); opacity: 1; }
.toast-slot:nth-last-child(n+4) { opacity: 0; }        /* 最多露 3 张，第 4 张起隐藏 */
```

要点：

- **位置归 CSS、进出场归脚本**，否则同一个元素被 `transform` 两处写会互相覆盖。
- 倒计时用 SVG `stroke-dashoffset` 的 CSS 动画（`animation: toast-count linear forwards`），悬停时 `animation-play-state: paused`；一条 4s 的提示不值得开时间轴。
- 容器 `role="status" aria-live="polite"`，只播报文案，不播报动画。
- 同时最多 3 条可见，超过就"藏"而不是"排队"。

## 7. 底部批量浮条

```js
export function floatBarEnter(el, done) {
  if (skipMotion()) return done()
  gsap.fromTo(el, { y: 40, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.56, ease: 'back.out(1.6)', clearProps: 'transform', onComplete: done })
}
export function floatBarLeave(el, done) {
  if (skipMotion()) return done()
  gsap.to(el, { y: 30, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: done })
}
```

- 语义是"放 Discharge"：升起来告诉你"有一件待办"。
- 进入 0.56s（有分量），退出 0.22s（不拖沓）。
- 浮条是 `Teleport` 到 body 的深色玻璃，`left: 50%; translate: -50% 0`，动效引擎只写 `y`，不要写 `x`（会和居中的 translate 打架）。

## 8. 视图切换（表格 ↔ 画布 ↔ 看板）

### 分段控件的滑块

一块玻璃在槽里滑动，标签与图标不动。用几何差值定位，不依赖 DOM 层级。

```js
export function slideThumb(thumb, target, axis = 'x', instant = false) {
  const parent = thumb?.offsetParent
  if (!thumb || !target || !parent) return
  const pr = parent.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  // 祖先若正在缩放（弹窗从触发点展开），包围盒带着缩放比，要折算回布局像素
  const kx = parent.offsetWidth ? pr.width / parent.offsetWidth : 1
  const ky = parent.offsetHeight ? pr.height / parent.offsetHeight : 1
  const props = axis === 'y'
    ? { y: (tr.top - pr.top) / ky - parent.clientTop + parent.scrollTop, height: tr.height / ky }
    : { x: (tr.left - pr.left) / kx - parent.clientLeft + parent.scrollLeft, width: tr.width / kx }
  if (instant || skipMotion()) { gsap.set(thumb, props); return }
  gsap.to(thumb, { ...props, duration: 0.52, ease: 'power4.out', overwrite: true })
}
```

- 首次定位必须 `instant = true`，否则会从左上角"飞"过来。
- `overwrite: true`：连续点击时只保留最后一趟。
- 祖先缩放折算（`rect / offsetWidth`）：弹窗入场动画期间测量的宽度会偏小，导致滑块错位到下次切换才纠正——这是真实踩过的坑。
- 容器或任一选项尺寸变化都要重新对位：`ResizeObserver` → `slideThumb(..., true)`。字体加载完成后选项宽度会变，容器宽度不变，所以必须同时观察子项。

### 内容横移

切换视图时，新内容从**切换方向**进来：

```js
gsap.fromTo(stage, { x: (next > prev ? 1 : -1) * 28, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, ease: 'power4.out', clearProps: 'transform,opacity' })
```

左 → 右切换，内容从右侧 28px 进来；反向则从左侧。距离别超过 40px，否则像轮播图。

## 9. 命令面板

- 遮罩 + 面板用同一套 modal 进入（指针来处），面板 `place-items: start center; padding-top: min(16vh, 140px)`，从"搜索框所在位置"展开的错觉来自原点。
- 结果列表有一块玻璃滑块跟随键盘焦点（`slideThumb(..., 'y')`），并用 `scrollIntoView({ block: 'nearest' })` 保证不跑出视口。
- 输入 `?` 进入问答模式：预设问题点击后用打字机写入输入框（42ms/字），答案卡按 90ms 级联浮现（`revealCascade`）。
- 关闭时清空状态、停掉打字机中断函数、`trap.deactivate()`。

## 10. 转场的通用纪律

- **一个页面只允许一次"大动作"**：页面推进 + 卡片级联已经两层，里面不要再套 modal 式放大。
- 所有 `done` 回调必须在**每条**分支里执行（reduced-motion、后台标签页、找不到来处）。Vue 的 `<Transition>` 若拿不到 `done`，元素会永远留在 DOM 里。
- 浮层关闭前先 `trap.deactivate()`，再把焦点还给触发控件，最后才播退出动画。
- 嵌套浮层用"层级栈"：Escape 只作用于最上层；打开新浮层时不要关掉底下的表单。
- 转场期间禁止输入：`pointer-events: none` 或 `aria-busy`，避免用户在 0.2s 的退场里点了两次提交。
