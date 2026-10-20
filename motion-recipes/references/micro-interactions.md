# 微交互：悬停、跟随、拖拽、读数

这一层决定"贵不贵"。原则：**反馈必须发生在 100ms 内**，跟随类动作用 `quickTo` 而不是每次新建补间，常驻动画只在真实状态进行时存在。

## 1. 容器级指针光

鼠标在卡片上移动时，一层 120px 的径向高光跟着走，用 `screen` 混合模拟"玻璃被打亮"。

```js
/** 坐标写在容器自身（叶子），不写到上层，避免污染子元素的自定义属性 */
export function trackGlow(event) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--px', `${event.clientX - rect.left}px`)
  el.style.setProperty('--py', `${event.clientY - rect.top}px`)
}
```

```html
<section class="card m-glow" onpointermove="trackGlow(event)">
  <span class="glow-layer" aria-hidden="true"></span>
  ...
</section>
```

```css
.m-glow { --px: 50%; --py: 50%; position: relative; isolation: isolate; }
.m-glow > .glow-layer {
  position: absolute; inset: 0; z-index: 0;
  border-radius: inherit; pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle 120px at var(--px) var(--py),
    rgba(255,255,255,.9), rgba(130,221,45,.08) 42%, transparent 72%);
  mix-blend-mode: screen;
  transition: opacity .28s ease;
}
@media (hover: hover) { .m-glow:hover > .glow-layer { opacity: .72; } }
@media (pointer: coarse), (prefers-reduced-motion: reduce) { .m-glow > .glow-layer { display: none; } }
```

- 光斑是**材质**，不是可点承诺：不要给所有卡片加，只给"这一屏的主角"加（每页一个）。
- 只写 CSS 变量，不写 transform，因此不会与容器上的其他补间冲突。
- 深色主题把白色高光降到 7%，并关掉 `screen`（否则会发灰）。

## 2. 卡片微倾（≤ 4°）

```js
const card = document.querySelector('.login-card')
const mm = window.matchMedia('(hover: hover)')
let tiltX = null, tiltY = null

if (card && mm.matches) {
  // quickTo：每次指针移动只更新目标值，不新建补间
  tiltX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' })
  tiltY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' })
}

card?.addEventListener('pointermove', (event) => {
  if (!tiltX || !tiltY) return
  const r = card.getBoundingClientRect()
  const px = (event.clientX - r.left) / r.width - 0.5
  const py = (event.clientY - r.top) / r.height - 0.5
  tiltY(Math.max(-1, Math.min(1, px * 2)) * 4)    // 左右最多 4°
  tiltX(Math.max(-1, Math.min(1, py * 2)) * -3)   // 上下最多 3°
})
card?.addEventListener('pointerleave', () => { tiltX?.(0); tiltY?.(0) })
```

```css
.login-side { perspective: 1200px; }        /* 透视放在父级 */
.login-card { transform-style: preserve-3d; will-change: transform; }
@media (prefers-reduced-motion: reduce) { .login-card { will-change: auto; } }
```

- 角度超过 5° 就会让文字发虚，3–4° 是"有厚度"的上限。
- 上下角度比左右小（-3 vs 4），因为人眼对垂直倾斜更敏感。
- `perspective` 必须在父级，写在自身会导致平面变形。

## 3. 磁吸（按钮被指针轻轻吸引）

本项目没有用到，但这是同一套 `quickTo` 的自然延伸，做落地页 CTA 很好用。只在 `(hover: hover) and (pointer: fine)` 启用。

```js
export function magnetize(el, { radius = 90, strength = 0.28, max = 10 } = {}) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
  const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })

  const onMove = (event) => {
    const r = el.getBoundingClientRect()
    const dx = event.clientX - (r.left + r.width / 2)
    const dy = event.clientY - (r.top + r.height / 2)
    const dist = Math.hypot(dx, dy)
    if (dist > radius + Math.max(r.width, r.height) / 2) { xTo(0); yTo(0); return }
    xTo(gsap.utils.clamp(-max, max, dx * strength))
    yTo(gsap.utils.clamp(-max, max, dy * strength))
  }
  const reset = () => { xTo(0); yTo(0) }

  window.addEventListener('pointermove', onMove, { passive: true })
  el.addEventListener('pointerleave', reset)
  return () => {
    window.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerleave', reset)
    gsap.killTweensOf(el)
  }
}
```

- 吸引幅度 8–12px 就够，超过就是"按钮在追鼠标"，很吵。
- 一定返回清理函数：监听挂在 window 上，组件卸载不摘会越积越多。
- 磁吸元素上如果再叠按压 `scale`，注意两条补间写的是不同属性（`x/y` vs `scale`），不要都写 `transform`。

## 4. 鼠标跟随光斑（整页）

```js
const spot = document.querySelector('.cursor-spot')
const xTo = gsap.quickTo(spot, 'x', { duration: 0.5, ease: 'power3.out' })
const yTo = gsap.quickTo(spot, 'y', { duration: 0.5, ease: 'power3.out' })
window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY) }, { passive: true })
```

- 光斑 `position: fixed; left: 0; top: 0; translate: -50% -50%`，只补间 `x/y`。
- 不要替换系统光标（`cursor: none`）除非做了完整的 hover/active/text 三态。
- 触屏设备直接不渲染；`prefers-reduced-motion` 时也关掉。

## 5. 数字逐位滚动（Odometer）

每一位是一条 0–9 的竖带，只有变化的位会滚。用 CSS transition，不用脚本（几十个字符同时滚动时脚本反而更重）。

```html
<span class="odometer" role="img" aria-label="1,284">
  <!-- 每个字符一个 cell；数字是 10 行的竖带，translateY(-digit * 10%) -->
  <span class="odo-cell"><span class="odo-strip" style="transform: translateY(-40%)">0…9</span></span>
</span>
```

```js
// 首帧先显示 0，下一帧再滚到目标值（否则没有"滚动"这个过程）
let mounted = false
requestAnimationFrame(() => { mounted = true })
const offset = (digit) => `translateY(${-(mounted ? digit : 0) * 10}%)`
```

```css
.odo-strip { display: flex; flex-direction: column; transition: transform .6s cubic-bezier(.16,1,.3,1); }
.odo-cell { overflow: hidden; }
```

要点：

- 位次 key 用**从右往左**编号（`list.length - i`）：数字从 999 变 1000 时，个位不会因为前面多了一位而整列重排。
- 每一位加 `transition-delay: (key % 6) * 40ms`，产生轻微的波浪感。
- 无障碍：外层 `role="img"` + `aria-label` 给完整数字；内部的 0–9 全部 `aria-hidden`。
- 首屏骨架数字用 `—`，别显示 0 再跳（会被误读成真实值）。
- 项目还有 `document.hidden` 兜底：后台标签页 rAF 不触发，用 `setTimeout` 落地终态。

## 6. 刻度环（TickRing）

60 根径向刻度按顺时针逐根点亮，点亮完后末端刻度一次 `back.out` 过冲，中心读数逐位滚动。

```js
function play(root) {
  if (skipMotion()) return
  const on = root.querySelectorAll('.ring-tick.is-on')
  const cap = root.querySelector('.ring-cap')
  const tl = gsap.timeline()
  tl.fromTo(on, { opacity: 0.15 }, { opacity: 1, duration: 0.28, ease: 'power1.out', stagger: { each: 0.014, from: 'start' }, clearProps: 'opacity' })
  if (cap) tl.fromTo(cap, { scale: 0.2, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(1.6)', clearProps: 'transform' }, '-=0.1')
}
```

- 只点亮一次（`played` 标记）：数值刷新时不要再从 0 走一遍，会让人以为数据掉了。
- 刻度颜色 `stroke` 变化不要用脚本，用 CSS 类即可（一组 60 条线的补间只动 `opacity` 更便宜）。
- 中心读数配 `Odometer`，组合起来就是"数据落定"的完整语感。

## 7. 柱状图生长

```js
function grow(barsEl) {
  const list = barsEl.querySelectorAll('.bar-col')
  if (!list.length || skipMotion()) return
  gsap.fromTo(list, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: 'back.out(1.6)', stagger: { each: 0.05, from: 'start' }, clearProps: 'transform' })
}
```

- `transform-origin: bottom`（CSS），`scaleY` 从 0 生长，比重算高度便宜得多。
- 每次数据变化都播会很吵：只在**首次拿到数据**时播（`grown` 标记），后续切换用趋势图那种形变或直接更新。
- "当前"柱用斜线填充（`repeating-linear-gradient`）而不是换色，语义是"区间/当前"，与选中状态区分开。

## 8. 骨架屏与列表级联

```js
export function revealRows(rows) {
  if (skipMotion() || !rows.length) return
  const list = Array.from(rows).slice(0, 14)
  gsap.fromTo(list, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: { each: 0.025, from: 'start' }, clearProps: 'opacity,visibility,transform' })
}
```

- **换了一批数据才播**：用 `rows.map(r => r.id).join(',')` 做签名，原地修改（切换某个开关）不重播，否则整表会闪。
- 最多 14 行：第 15 行之后用户已经开始读了，继续级联没有意义还会有拖慢感。
- 骨架屏：6 行假数据，条宽用 `36 + ((i * 7 + ci * 13) % 48)%` 造出不规则感，`opacity 1 → .5 → 1` 的 1.4s `ease-in-out` 无限循环（这是"真实进行中"，允许常驻）。
- 用 `aria-busy` 标记表格，骨架自检时不要被屏幕阅读器读成数据。

## 9. 看板拖拽（指针 + 幽灵 + 弹簧落位）

### 交互流程

```
pointerdown（卡片空白处，位移 > 5px 才启动）
  → 克隆一张 .board-ghost 固定在 body，rotate -2.5° scale 1.03（0.24s glide）
  → 原卡变暗占位；拖动时只 gsap.set 幽灵的 x/y（不走补间）
  → 松手：判断落点列
      成功 → 先 capture() FLIP 快照 → 调接口 → nextTick → 其余卡片从旧位置滑到新位置（0.5s glide）
               幽灵用弹簧飞向新卡片位置（k=72），速度与位移双收敛即结束
      取消 / 失败 → 幽灵弹簧飞回原位置（k=50，更软），原卡恢复
```

```js
// 弹簧落位：不用补间，用临界阻尼弹簧 + 帧循环，手感更"有质量"
let settleLoop = null
function settleTo(ghost, landing, hard) {
  const st = { x: springOf(Number(gsap.getProperty(ghost, 'x'))), y: springOf(Number(gsap.getProperty(ghost, 'y'))) }
  let elapsed = 0
  settleLoop?.stop()
  settleLoop = createFrameLoop((dt) => {
    elapsed += dt
    const k = hard ? 72 : 50
    spring(st.x, landing.left, dt, k)
    spring(st.y, landing.top, dt, k)
    gsap.set(ghost, { x: st.x.x, y: st.y.x })
    const done = Math.abs(st.x.x - landing.left) < 1.2 && Math.abs(st.y.x - landing.top) < 1.2
      && Math.abs(st.x.v) < 24 && Math.abs(st.y.v) < 24
    if (done || elapsed > 0.9) { settleLoop.stop(); ghost.remove() }
  })
  settleLoop.start(ghost)
}
```

要点：

- 5px 阈值：没有它，点击卡片会顺便"拖一下"，观感很差。
- 拖动期间用 `gsap.set` 直写，不要 `gsap.to`：跟手比平滑重要。
- 落位判定用"位移 + 速度双收敛"并加 0.9s 超时兜底，避免低帧率下永远不收敛。
- 必须有键盘替代：卡片菜单里的"移动到…"，走同一条 `onMove` 路径，只是不播幽灵。
- 失败/取消也要播完"飞回"，不要直接消失——用户需要看到"它回去了"。

## 10. FLIP 共享布局（列表重排、卡片展开）

```js
export async function flipLayout(targets, mutate) {
  const list = Array.from(targets)
  if (skipMotion() || !list.length) { await mutate(); return }
  const state = Flip.getState(list)      // 1. 记录旧位置
  await mutate()                          // 2. 改 DOM / 数据，等框架渲染完
  Flip.from(state, { duration: 0.62, ease: 'power4.out', absolute: false, nested: true, prune: true, simple: true })
}
```

- 用于"同一个元素换了位置或尺寸"：卡片原地展开、看板列内重排、筛选后列表重排。
- `nested: true` 处理嵌套的 FLIP 目标；`prune: true` 清掉不再存在的目标；`simple: true` 少算一些边界情况（性能更好）。
- 手写版（不引 Flip）也可以：记录 `getBoundingClientRect`，改完后 `fromTo(el, { x: dx, y: dy }, { x: 0, y: 0 })`。项目看板就是手写版，少一个插件依赖。
- 数据变更**前**必须抓快照，变更**后**等一帧再回放；中间不要 await 网络请求，否则快照会过期。

## 11. 画布平移缩放

```js
// 视口状态 { x, y, k }；拖拽与滚轮直写，按钮缩放走 quickTo
const { view, zoomAt } = useViewportPan({ el: () => viewport, apply: (v, animate) => {
  if (!animate || skipMotion()) { gsap.set(layer, { x: v.x, y: v.y, scale: v.k }); return }
  setX(v.x); setY(v.y); setK(v.k)      // gsap.quickTo(..., { duration: 0.55, ease: 'power3.out' })
}, exclude: '.node, .controls, .panel' })
```

- **拖拽不平滑**：跟手必须直写（`gsap.set`），任何补间都会产生"橡皮筋"。
- **按钮缩放要平滑**：`quickTo` 0.55s `power3.out`。
- 以指针为中心缩放：`view.x = px - ((px - view.x) / view.k) * k`。
- `exclude` 选择器必须覆盖节点、控件、浮动面板，否则点节点会变成拖画布。
- 容器尺寸用 `clientWidth/clientHeight` 而不是 `getBoundingClientRect()`：页面进场缩放期间包围盒偏小，`fit()` 会算错。
- `pointerdown` 时 `setPointerCapture`，`pointerup/cancel` 都要解除 `.is-panning` 类。

## 12. 文字与内容的短反馈

| 反馈 | 做法 |
| --- | --- |
| 状态确认（保存成功的小勾、计数变化） | `gsap.fromTo(el, { scale: .6 }, { scale: 1, duration: .42, ease: 'back.out(1.6)', clearProps: 'transform' })`，不用透明度脉冲 |
| 面板内容切换（分析栏、详情抽屉） | `revealCascade(container)`：`y 10 / autoAlpha 0` → 1，0.56s，stagger 0.075，最多 18 项 |
| 打字机（问答输入、终端演示） | 42ms/字，写完停 180ms 再触发下一步；返回取消函数 |
| 复制成功 | 图标 `scale 0.8 → 1` + Toast，不做长文案动画 |

`revealCascade` 的清理：用 `overwrite: 'auto'` 并在容器内容切换时重新调用；如果容器会被卸载，把返回的时间轴存起来，在卸载时 `kill()`。
