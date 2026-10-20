# 按钮与表单

按钮是用户点得最多、也最容易被做廉价的地方。本文件的核心是**登录按钮形变**（长条 → 圆 → 对勾 → 失败复原），它同时示范了"不得不动布局属性时怎么办"。

## 1. 登录按钮形变（旗舰配方）

### 一句话

提交时文字先退，按钮左右向中心收成一个圆，圆内画出 loading 环与对勾，随后进入系统；失败时圆抖一下再长回长条，文字回来。

### 适用 / 不适用

- 适用：登录/注册、OAuth 授权、单实例的关键提交（一次只发生一个结果）、需要强确认感的操作（支付、发布）。
- 不适用：列表里可重复点的行操作（太重）、并发多任务、结果需要展示详情（应该用 Toast/结果页）。

### 交互流程（状态机）

```
idle ──点击/回车──▶ loading ──成功──▶ success ──(路由)──▶ 离开页面
                      │
                      └──失败──▶ error ──0.9s──▶ idle（恢复长条，保留输入）
```

- `idle`：胶囊按钮，文字 + 可选图标。
- `loading`：**宽度不变**（保持长条），文字淡出，环开始转。宽度在此刻不变是关键——请求时长不可控，任何宽度动画都不能挂在等待时长上。
- `success`：宽度收到 46px（= 高度，`border-radius: 999px` 自然成为圆），环的描边从 0 画满，对勾接着画出，末尾一次 `scale 1.06 → 1` 的确认弹。
- `error`：在圆状态下 `x: ±6` 抖三下（0.36–0.42s），然后宽度回到 100%，文字淡回，焦点留在密码或验证码输入框。
- 被打断：`success` 期间用户再次点击 → 忽略（`disabled` + `aria-busy`）；`loading` 期间路由被取消（比如会话过期）→ 播放 `error` 分支的复原段，不要停在圆里。

### 结构：一个元素，而不是两个

项目原来的做法是 `v-if` 切换 `<Button>` 与 `.success-orb`，再让 orb 从 `slot.clientWidth` 收到 46px。这样能work，但状态切换时有一段"旧元素消失、新元素出现"的空隙，且复原逻辑要写两次。**推荐单元素方案**：同一个按钮承载三种状态，只切 class 与子元素可见性。

```html
<!-- 固定高度槽位：宽度变化只影响它自己 -->
<div class="auth-slot">
  <button class="auth-action" type="button" data-state="idle" aria-live="polite">
    <span class="auth-label">登录</span>
    <svg class="auth-mark" viewBox="0 0 46 46" aria-hidden="true">
      <circle class="mark-track" cx="23" cy="23" r="20" />
      <circle class="mark-progress" cx="23" cy="23" r="20" />
      <path class="mark-check" d="m15 23.5 5.5 5.5L31.5 18" />
    </svg>
  </button>
</div>
```

```css
.auth-slot { display: flex; justify-content: center; height: 46px; } /* 高度锁死，页面不抖 */
.auth-action {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: 100%; height: 46px;               /* 宽度由 JS 补间，高度永远 46 */
  border-radius: 999px;                    /* 宽 == 高 时自然成圆 */
  background: var(--accent, #236de9);
  color: #fff; border: 0;
  overflow: hidden;                        /* 收窄时裁掉文字残影 */
  will-change: width;                      /* 只提示，不常驻 */
  transition: background .2s ease, box-shadow .2s ease; /* 颜色归 CSS，宽度归脚本 */
}
.auth-action .auth-label { font-size: 14px; font-weight: 660; }
.auth-mark {
  position: absolute; width: 30px; height: 30px; opacity: 0;
}
.mark-track,
.mark-progress { fill: none; stroke-width: 2.4; transform: rotate(-90deg); transform-origin: 50% 50%; }
.mark-track { stroke: rgba(255, 255, 255, .5); }
.mark-progress {
  stroke: #fff;
  stroke-dasharray: 126;              /* 2πr，r=20 → 125.66 */
  stroke-dashoffset: 126;
}
.mark-check {
  fill: none; stroke: #fff; stroke-width: 3;
  stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 24;               /* 勾的路径长度，量出来或写略大值 */
  stroke-dashoffset: 24;
}
/* loading 态：环自己转，不占宽度 */
.auth-action[data-state="loading"] .auth-mark { opacity: 1; }
.auth-action[data-state="loading"] .mark-check { opacity: 0; }
.auth-action[data-state="loading"] .mark-progress {
  stroke-dasharray: 44 82;            /* 一段弧 */
  animation: auth-spin .9s linear infinite;  /* 常驻旋转用 CSS，不必每帧补间 */
}
@keyframes auth-spin { to { transform: rotate(270deg); } } /* 已 -90，转满一圈 */
.auth-action[data-state="success"] .auth-mark { opacity: 1; }
.auth-action[data-state="success"] .mark-progress { animation: none; stroke-dasharray: 126; stroke-dashoffset: 0; }
```

```js
import { gsap } from 'gsap'

const EASE = { reveal: 'expo.out', glide: 'power4.out', exit: 'power2.in', swap: 'power2.inOut', settle: 'back.out(1.6)' }
const DUR = { press: 0.14, release: 0.46, swap: 0.42, overlayIn: 0.42 }

const CIRCLE = 46
const RING = 126
const CHECK = 24

/**
 * 登录按钮形变。返回 { toLoading, toSuccess, toError, destroy }
 * 语义：放 Discharge（收拢）→ 结 Crystallize（对勾）→ 停摆 Halt（失败复原）
 */
export function createAuthButton(slot, { onBlocked } = {}) {
  const action = slot.querySelector('.auth-action')
  const label = slot.querySelector('.auth-label')
  const ring = slot.querySelector('.mark-progress')
  const check = slot.querySelector('.mark-check')
  if (!action || !label || !ring || !check) throw new Error('auth button markup missing')

  let timeline = null
  let state = 'idle'

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const kill = () => { timeline?.kill(); timeline = null }

  /* 状态切换：CSS 负责最终外观，动效引擎只负责过程 */
  function setState(next) {
    state = next
    action.dataset.state = next
    action.disabled = next === 'loading' || next === 'success'
    action.setAttribute('aria-busy', next === 'loading' ? 'true' : 'false')
  }

  /* 归零：把被补间写过的行内样式交回 CSS */
  function resetInline() {
    gsap.set(action, { clearProps: 'width,transform' })
    gsap.set([ring, check], { clearProps: 'strokeDashoffset,opacity' })
    gsap.set(label, { clearProps: 'opacity,visibility' })
  }

  function toLoading() {
    if (state !== 'idle') return false
    kill()
    setState('loading')
    if (reduced()) { gsap.set(label, { autoAlpha: 0 }); return true }
    timeline = gsap.timeline()
    // 文字先退，避免收窄时被压扁
    timeline.to(label, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' })
    return true
  }

  function toSuccess() {
    if (state === 'success') return Promise.resolve()
    kill()
    setState('success')
    if (reduced()) {
      gsap.set(action, { width: CIRCLE })
      gsap.set(ring, { strokeDashoffset: 0 })
      return Promise.resolve()
    }
    const full = slot.clientWidth           // 用像素值：不收 %/auto，避免每帧解析
    return new Promise((resolve) => {
      timeline = gsap.timeline({ onComplete: resolve })
      timeline
        .to(label, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' }, 0)
        // 宽度从当前槽宽收到 46：这一步必然触发布局，但只影响按钮自己
        .fromTo(action, { width: full }, { width: CIRCLE, duration: DUR.swap, ease: EASE.swap }, 0.02)
        // 环从 0 画满：只动 strokeDashoffset，不动布局
        .fromTo(ring, { strokeDashoffset: RING }, { strokeDashoffset: 0, duration: 0.5, ease: EASE.reveal }, '-=0.08')
        // 对勾随后，用落定曲线带一点过冲
        .fromTo(check, { strokeDashoffset: CHECK }, { strokeDashoffset: 0, duration: 0.32, ease: EASE.settle }, '-=0.22')
        // 确认弹：先推到 1.06，再落回 1
        .to(action, { scale: 1.06, duration: 0.16, ease: 'power1.out' })
        .to(action, { scale: 1, duration: 0.3, ease: EASE.settle })
    })
  }

  function toError(message) {
    kill()
    const wasCircle = state === 'success' || action.getBoundingClientRect().width <= CIRCLE + 2
    setState('error')
    if (reduced()) { setState('idle'); resetInline(); return Promise.resolve() }
    const full = slot.clientWidth
    return new Promise((resolve) => {
      timeline = gsap.timeline({ onComplete: () => { setState('idle'); resetInline(); resolve() } })
      // 1. 抖动：左右三下，幅度递减（停摆 Halt）
      timeline.to(action, { keyframes: [
        { x: -6, duration: 0.06 }, { x: 5, duration: 0.07 },
        { x: -4, duration: 0.06 }, { x: 3, duration: 0.06 }, { x: 0, duration: 0.07 },
      ], ease: 'none' })
      // 2. 圆 → 长条：宽度回满，文字淡回
      if (wasCircle) {
        timeline.to(action, { width: full, duration: 0.46, ease: EASE.settle }, '>-0.02')
        timeline.to(label, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, '<0.12')
      } else {
        timeline.to(label, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, '>-0.05')
      }
    })
  }

  function destroy() {
    kill()
    resetInline()
    setState('idle')
  }

  return { toLoading, toSuccess, toError, destroy, get state() { return state } }
}
```

用法（提交处必须有并发保护）：

```js
const auth = createAuthButton(document.querySelector('.auth-slot'))
let busy = false

async function submit() {
  if (busy) return
  busy = true
  auth.toLoading()
  try {
    await login(form)               // 真实接口结果决定走向，不用定时器假装成功
    await auth.toSuccess()
    router.push('/')
  } catch (error) {
    await auth.toError(error.message)
  } finally {
    busy = false
  }
}
```

> 项目里的 React/Vue 版本：在 Vue 中把 `createAuthButton` 放进 `onMounted`，`onBeforeUnmount(destroy)`；React 中用 `useGSAP(() => { ... return () => destroy() }, { scope })`，或者把这个工厂函数放进 `useEffect` 并在 cleanup 里 `destroy()`。它自己管住了时间轴与行内样式，不依赖框架自动回收；如果外层还建了 `gsap.context()`，把 `createAuthButton` 放进去，让 `ctx.revert()` 统一收尾即可。

### 为什么这里必须动 `width`（和官方"优先 transform"的冲突怎么处理）

胶囊 → 圆是**同一个盒子的宽高比变化**。用 `scaleX` 缩放会同时拉扁文字、描边宽度和 `border-radius`（`999px` 在横向压缩后变成椭圆），还会让可点区域与视觉不一致。所以这类"容器形状本身在变"的效果只能用布局属性。

项目与配方的折中做法，按重要性排：

1. **固定高度的槽位 + flex 居中**：`.auth-slot { height: 46px; display: flex; justify-content: center }`。按钮宽度变化时，父级高度不变、兄弟元素位置不变，重排被限制在槽位内部。
2. **只动 `width`**，不动 `height` / `margin` / `padding` / `top`。高度恒定是"圆"成立的前提，也避免了双重布局。
3. **一次性、短时长**：0.42s 一趟，不循环、不随滚动。
4. **用像素目标值**（`slot.clientWidth` → `46`），不用 `auto` / `%`，避免每帧反复解析与抖动。
5. **结束时清行内样式**（`clearProps: 'width,transform'`），让 CSS 类接管，后续 resize 不会错位。
6. **屏幕内多个卡片联动变形时不要各自补间宽度**：用 Flip（记录 → 改 DOM → 回放）一次性处理，见 `transitions.md` 的共享布局变形。

会翻车的场景：如果按钮的兄弟元素靠 `flex: 1` 分空间（比如"登录"旁边还有一个"忘记密码"按钮），宽度变化会推着它动。此时把可变元素包进固定宽度的槽位，给兄弟 `flex: none`，或干脆让可变元素绝对定位在槽内居中。

### 可调参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `CIRCLE` | 46（= 按钮高度） | 必须等于高度，否则不是圆 |
| `RING` / `CHECK` | 126 / 24 | 精确值用 `path.getTotalLength()` 量，别硬编码错 |
| 收拢曲线 | `power2.inOut` | 想要更"吸"的感觉用 `power4.inOut`；不要用 `back`，形状会先胀一下 |
| 收拢时长 | 0.42s | 小于 0.3s 会显得被裁掉，大于 0.6s 会让人以为卡住 |
| 勾的曲线 | `back.out(1.6)` | 换成 `power2.out` 更克制，适合金融类产品 |
| 抖动幅度 | 6px × 5 段 | 幅度别超过 8px；频率固定在 60ms 左右，太快像故障 |

### 注意事项

- **防重复点击**：`disabled` + 内部 `state` 双保险，因为键盘回车可以绕过视觉禁用。
- **无障碍**：按钮本身 `aria-live="polite"` 会读出文字变化；成功时把 `aria-label` 改为"登录成功，正在进入"，失败时错误信息用页面级 `role="alert"`（不要只靠抖动传达失败）。
- **焦点**：成功进入路由时不要抢焦点；失败时把焦点移到第一个错误字段。
- **reduced-motion**：按钮直接变成完整圆环 + 对勾（`strokeDashoffset: 0`），或者干脆只切换文字为"登录成功"，不出现几何形变。
- **页面在后台**：`document.hidden` 时不要建时间轴，直接给终态并把 `onComplete` 同步执行，否则 Vue 过渡的 `done` 回调可能永远等不到。

## 2. 按压反馈（事件委托，全站同一手感）

按下压缩到 0.955，松手弹回；一个 `pointerdown` 委托覆盖所有控件，新写的按钮自动获得同一手感。

```js
const PRESSABLE = '.btn, .icon-btn, .nav-item, .segmented button, .pg-btn, .chip, .menu-item'

export function installPressFeedback() {
  const pressed = new Set()
  let installed = false
  if (installed) return
  installed = true

  const release = () => {
    pressed.forEach(el => gsap.to(el, { scale: 1, duration: 0.46, ease: 'back.out(1.6)', overwrite: 'auto' }))
    pressed.clear()
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || document.hidden) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = event.target.closest(PRESSABLE)
    if (!el || el.disabled) return
    pressed.add(el)
    gsap.to(el, { scale: 0.955, duration: 0.14, ease: 'power2.out', overwrite: 'auto' })
  }, { passive: true })
  window.addEventListener('pointerup', release, { passive: true })
  window.addEventListener('pointercancel', release, { passive: true })
}
```

要点：

- `transform-origin: 50% 68%` 写在 CSS 上，让按钮"向下压"而不是从正中缩小。
- 松手比按下慢 3 倍（0.14 → 0.46），这是"贵"的来源。
- `overwrite: 'auto'` 必须加：连续快速点击时不然会叠出两个补间互相拉扯。
- 与悬停抬起用**不同属性通道**（按压写 `scale`，悬停写 `y`），两条通道互不覆盖；同写 `y` 就会打架。
- 不要给 `.btn` 的 `transform` 挂 CSS transition。

## 3. 悬停抬起

```js
export function installHoverLift(selector = '.lift') {
  if (!window.matchMedia('(hover: hover)').matches) return
  document.addEventListener('pointerover', (event) => {
    const el = event.target.closest(selector)
    if (!el || el.contains(event.relatedTarget)) return
    gsap.to(el, { y: -3, duration: 0.34, ease: 'power4.out', overwrite: 'auto' })
  })
  document.addEventListener('pointerout', (event) => {
    const el = event.target.closest(selector)
    if (!el || el.contains(event.relatedTarget)) return
    gsap.to(el, { y: 0, duration: 0.42, ease: 'back.out(1.6)', overwrite: 'auto' })
  })
}
```

- 抬 3px 就够，8px 以上会显得飘。
- `el.contains(event.relatedTarget)` 是必须的：否则鼠标在卡片内的子元素之间移动会反复触发导致抖动。
- 只有 `(hover: hover)` 才装，触屏上 `pointerover` 会在点击后残留。

## 4. 主按钮涟漪（从真正点击的位置化开）

```js
export function installRipple(selector = '.btn-primary, .btn-danger') {
  let installed = false
  if (installed) return
  installed = true

  const fire = (button, x, y) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = button.getBoundingClientRect()
    const px = x === undefined ? rect.width / 2 : x - rect.left
    const py = y === undefined ? rect.height / 2 : y - rect.top
    // 半径取到最远角，保证任何点击位置都能铺满
    const radius = Math.max(
      Math.hypot(px, py), Math.hypot(rect.width - px, py),
      Math.hypot(px, rect.height - py), Math.hypot(rect.width - px, rect.height - py),
    )
    let clip = button.querySelector(':scope > .ripple-clip')
    if (!clip) {
      clip = document.createElement('span')
      clip.className = 'ripple-clip'          // 需要 overflow: hidden; border-radius: inherit
      clip.setAttribute('aria-hidden', 'true')
      button.appendChild(clip)
    }
    const dot = document.createElement('span')
    dot.className = 'ripple-dot'              // 圆形、当前文字色 18%、pointer-events: none
    clip.appendChild(dot)
    gsap.set(dot, { left: px, top: py, xPercent: -50, yPercent: -50, width: 20, height: 20 })
    gsap.timeline({ onComplete: () => dot.remove() })
      .to(dot, { scale: (radius * 2.2) / 20, duration: 0.62, ease: 'expo.out' }, 0)
      .to(dot, { opacity: 0, duration: 0.42, ease: 'power1.out' }, 0.2)
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const button = event.target.closest(selector)
    if (button && !button.disabled) fire(button, event.clientX, event.clientY)
  }, { passive: true })

  // 键盘触发没有坐标：从中心化开
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const button = event.target.closest(selector)
    if (button && !button.disabled) fire(button)
  })
}
```

- 只给主按钮和危险按钮用。次级/幽灵按钮加涟漪会显得廉价。
- 用 `scale` 放大一个 20px 圆点，而不是补间 `width/height`。
- 每个点补间结束就 `remove()`，别在 DOM 里堆 `<span>`。
- 页面在后台或 reduced-motion 时直接不画。

## 5. 输入框与校验

焦点环画在**外壳**上（`.input-shell:focus-within { outline: 2px solid; outline-offset: 2px }`），这样圆角与描边不会错位；输入框本身 `outline: none`。焦点环不做补间——它是"你现在在哪"的状态，瞬切比渐变更清楚。

校验失败：

- 字段级：错误文案在 `Field` 内以 11.5px 红字出现，输入框描边转红（150ms）。不要用抖动传达"格式错误"，抖动只留给"提交被服务端拒绝"。
- 表单级：顶部一条 `role="alert"` 的错误条（红底 11% + 红字），带图标，不自动消失。
- 成功后清空错误状态用同一帧完成，不要做退出动画。

## 6. 开关、勾选、分段、树箭头

这四类是"状态切换"，用 CSS 变量 + `@property` 注册补间，比脚本更省：

```css
@property --fill { syntax: "<percentage>"; inherits: false; initial-value: 0%; }
.switch-track {
  --fill: 0%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--lime) var(--fill), rgba(0,0,0,.14) var(--fill));
  transition: --fill .32s cubic-bezier(.16, 1, .3, 1);   /* 轨道"注满" */
}
.switch.is-on .switch-track { --fill: 100%; }
.switch-knob { transition: translate .32s cubic-bezier(.16, 1, .3, 1); }
.switch.is-on .switch-knob { translate: 16px 0; }
```

- 轨道用渐变注满 + 滑块 `translate`，比"背景色突变 + 滑块位移"更连贯。
- 分段选择器的滑块由脚本负责（需要测量几何），见 `transitions.md` 的 `slideThumb`。
- 勾选框只补间 `background / border-color / box-shadow`（180ms），不要弹跳。
- 树箭头 `rotate: 90deg`，240ms `--ease-premium`，只转图标不转整行。

## 7. 提交按钮的 loading 宽度锁定

工具栏里的"保存/导出"按钮在 loading 时如果用"转圈 + 文字隐藏"，宽度会跳（文字消失后按钮缩回）。两种解法：

- 文字保留，把图标位置换成 spinner（宽度不变）：`<span class="spinner" />保存`。
- 或者固定 `min-width: max-content` 在按钮上，spinner 绝对定位覆盖图标位。

**不要**在 loading 时给按钮做"宽度收缩 → 再展开"的动画：等待时长不可控，动画会在中途被卡住。
