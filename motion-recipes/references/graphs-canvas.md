# 图谱舞台与组织画布

这是本项目辨识度最高的两块：**菜单管理「星图」**（Canvas 图舞台：珍珠球 + 玻璃刻度表盘 + 脉冲）和**部门管理「画布」**（DOM/SVG 组织树：分层入场 + 选中路径脉冲 + 平移缩放）。两者共用一套物理底座：弹簧、帧循环、贝塞尔取点。

代码位置：`components/charts/RelationGraph.vue`、`components/business/MenuStarMap.vue`、`components/business/OrgCanvas.vue`、`composables/neural.ts`、`composables/viewport.ts`、`composables/motion.ts`。

## 0. 选型：什么时候上 Canvas，什么时候用 DOM

| 规模 | 方案 | 理由 |
| --- | --- | --- |
| < 60 个节点 | DOM + SVG 连线（组织画布） | 可聚焦、可读屏、可用 CSS 变量跟随主题 |
| 60–800 个装饰性点位 | Canvas（星图背景网络） | DOM 节点超过百个后 hover/焦点/合成都会掉帧 |
| 需要可点的小目标 | DOM 叠在 Canvas 上 | Canvas 命中区要自己算，小目标不友好 |

星图的做法是：**Canvas 画所有"看起来复杂"的东西**（连线、脉冲、珍珠球、刻度表盘、背景网络、轨道、涟漪），**DOM 只保留可点标签与命中区**。于是无障碍、键盘、焦点环、主题色都不用重写。

## 1. 弹簧：一切落位的手感来源

```js
/** 临界阻尼弹簧：每帧把 state.x 推向 target。k 越大越硬（62 ≈ 0.5s 落定） */
export function spring(state, target, dt, k = 62) {
  const c = 2 * Math.sqrt(k)          // 临界阻尼，不过冲
  state.v += (-k * (state.x - target) - c * state.v) * dt
  state.x += state.v * dt
  return state.x
}
```

k 的经验值：

| k | 落定时间 | 用在哪 |
| --- | --- | --- |
| 50 | ~0.6s | 取消操作后的"软"回弹（看板拖拽取消） |
| 60–70 | ~0.5s | 节点追随目标坐标（星图重布局） |
| 72 | ~0.45s | 拖拽成功后的"硬"落位 |
| 120 | ~0.3s | 幽灵节点淡出（只需要快速消失） |

为什么用弹簧而不是补间：**目标坐标会中途变化**（用户连续点击不同的菜单、窗口在 resize、拖拽时列在变）。补间需要每次重新算起止点，弹簧只需要改 target，速度和位移连续，不会一顿一顿。

## 2. 帧循环底座：只在一个地方 `ticker.add`

```js
export function createFrameLoop(step) {
  let target = null, offscreen = false, frames = 0, running = false, last = 0, time = 0, warned = false

  const run = (force) => {
    if (document.hidden && !force) { last = 0; return }
    // 每 20 帧量一次位置：离开视口就停帧（比 IntersectionObserver 更不受隐藏祖先影响）
    if (target && (offscreen || frames++ % 20 === 0)) {
      const r = target.getBoundingClientRect()
      offscreen = r.width === 0 || r.bottom < 0 || r.top > window.innerHeight
    }
    if (offscreen && !force) { last = 0; return }
    const now = performance.now()
    const dt = last ? Math.max(0, Math.min(1 / 30, (now - last) / 1000)) : 1 / 60   // 限制 dt，切回前台不会瞬移
    last = now; time += dt
    try { step(dt, time) } catch (error) { if (!warned) { warned = true; console.error(error) } }
  }

  const tick = () => run(false)
  return {
    start(el) { if (running) return; running = true; last = 0; target = el ?? null; gsap.ticker.add(tick) },
    stop() { running = false; gsap.ticker.remove(tick); target = null },
    flush() { run(true) },              // 立即画一帧：减少动效时用来落到终态
    get time() { return time },
  }
}
```

四条硬性要求，每一条都是踩过的坑：

1. **挂在 `gsap.ticker` 上**，不要自己 `requestAnimationFrame`：与补间共用一条时钟，不会出现一帧两次写入导致的抖动。
2. **`dt` 上限 1/30 秒**：标签页切回来时 `now - last` 可能是几秒，不夹住会瞬移。
3. **隐藏 / 离屏停帧**：这是"常驻动画也能上生产"的前提。离屏检测每 20 帧量一次足够，不必每帧。
4. **`try/catch` 只报一次**：单帧异常不能让整个循环停摆（否则用户会看到一个静止的画布，且控制台刷屏）。

组件卸载一定 `loop.stop()`；主题切换要重新读色（见 §6）。

## 3. 星图：三层下钻的构图

### 全景（hub）

- 中心「珍珠球」`kind: 'core'`，直径 96，不做交互。
- 一级目录/菜单按叶子数加权分成扇区，落在半径 0.52 的椭圆上，`kind: 'hub'`，直径 72–100，刻度环的着色比例是**真实读数**（该分支内已授权页面的占比）。
- 页面在 0.77 的椭圆上（`kind: 'dot'`，r 2.8），按钮在 0.97（r 1.5）。
- 背景是一张真实数据的网络（`network`），下钻时整体降到 `alpha 0.3 / 0.12`，制造"退远"。
- 三圈带刻度的虚线轨道随 `t` 缓慢转动（`paintOrbit`，`spin = t * 0.015`）。

### 分支（branch）

珍珠球退到左侧，一级项竖向排列、选中项放大到 100 其余 56 并退暗；下属页面作为胶囊从选中项右侧扇出，逐个长出。

### 页面（page）

角色在左、页面居中、按钮在右，脉冲沿 角色 → 页面 → 按钮 的方向流动；右侧 `InsightPanel` 展示路径、授权、洞察卡。

### "触须生长"的实现

节点带 `from`（父节点 id）与 `delay`：

```js
const st = {
  x: springOf(origin ? origin.x.x : node.x),   // 从父节点的当前位置出生
  y: springOf(origin ? origin.y.x : node.y),
  o: springOf(0),
  s: springOf(origin ? 0.4 : 0.82),
  born: now,
}
// 每帧
const ready = now - st.born >= (node.delay ?? 0) * 1000
spring(st.x, ready ? node.x : st.x.x, dt, 70)
spring(st.o, ready ? 1 : 0, dt, 50)
spring(st.s, ready ? 1 : st.s.x, dt, 60)
```

- `delay` 由页面按序给出（`0.15 + i * min(0.09, 1.6 / n)`）：数量多时自动压缩间隔，保证整段不超过 1.6s。
- 出生位置取父节点**当前**坐标，而不是目标坐标：这样在动画途中重布局，新节点也会从"父节点现在所在的位置"长出来。
- 变成幽灵的节点（被移除）把坐标设回 `from` 节点，`o` 用 `k=120` 快速归零，然后从数组里删掉——不要瞬间 `display: none`。

### 连线与脉冲

```js
// 三次贝塞尔，两端节点都在动，控制点每帧重算
const sway = live ? Math.sin(t * 1.1 + x2 * 0.013 + y2 * 0.017) * 6 : 0
// 脉冲沿曲线取点
const u = (t * 0.3 + i * 0.137 + k * 0.5) % 1
const x = bezierAt(g.x1, g.c1x, g.c2x, g.x2, u)
// 用 sin(uπ) 让脉冲在两端淡出
ctx.globalAlpha = Math.sin(u * Math.PI) * vis
```

- `flow: 'both'` 时第二条脉冲反向（`u = 1 - u`），速度略慢（0.24 vs 0.3），避免两条完全同步。
- 每条线 ≤ 2 个脉冲；`i * 0.137` 这种无理数错相，避免整张图同时闪烁。
- 悬停某节点时，邻居保持 100%，其余降到 25–35%（`isDim`）。**退暗用透明度，不换颜色**。

### 珍珠球（`paintOrb`）

三层：缓慢扫描的刻度环（一段蓝色扫过，`head = t * 0.35`）+ 一枚青柠卫星绕行 + 珠光径向渐变球体（左上一个高光、右下青柠虹彩、左下蓝虹彩，`sin(t*0.5)` 轻微游移）。最后一道 1.6px 白色弧线做边缘高光。

这个"球"之所以像珍珠而不是塑料球，靠的是：**软阴影（`shadowBlur = r * 0.6`）+ 球体渐变的三段停点（纯白 → 246,249,248 → 214,223,221）+ 边缘那道短弧高光**。不要加外发光，一加就变霓虹。

### 玻璃刻度表盘（`paintDial`）

白色圆盘 + 顶部内高光弧 + 内圈 40/60 根刻度（前 `ratio` 比例着分类色）+ 激活时外圈同色 18% 光环 + 一枚沿着色段移动的亮刻度。

`ratio` 表示真实占比（如"已授权页面 / 全部页面"）。**读数必须真实**，不要为了好看伪造比例——这是这块设计可信的来源。

### 开场涟漪（`paintRipple`）

三道细环，`k` 从 0 到 1 用 1.8s，每道错开 0.14，半径用 `1 - (1-kk)^3` 缓出。涟漪只在"重播"按钮和首次挂载时出现。

## 4. 组织画布（部门管理）

### 布局

整齐树布局铺满内容区：叶子按 `cursor` 依次排开，父节点取子节点中点；`y = depth * (NODE_H + GAP_Y)`。连线用 SVG 路径（垂直段 + 圆角拐弯），`r = min(10, |dx| / 2)`。

四角留给页面放浮动玻璃面板（`#tl / #tr / #bl / #br`）：左上概要卡、右上读数铭牌、左下成员列表、右下操作。**画布本身不放控件**，控件在浮动面板里，这样平移时面板不动。

### 分层入场：先连线，后节点

```js
function playEntrance() {
  if (!layer || skipMotion()) return
  const tl = gsap.timeline()
  const depths = Math.max(0, ...layout.value.nodes.map(n => n.depth))
  for (let d = 0; d <= depths; d += 1) {
    const links = layer.querySelectorAll(`.org-link[data-depth="${d}"]`)
    links.forEach((path) => {
      const len = path.getTotalLength()
      tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.42, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' },
        Math.max(0, d * 0.2 - 0.12))
    })
    const nodes = layer.querySelectorAll(`.org-node[data-depth="${d}"]`)
    tl.fromTo(nodes, { autoAlpha: 0, y: 10, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'expo.out', stagger: { each: 0.04, from: 'start' }, clearProps: 'opacity,visibility,transform' },
      d * 0.2 + 0.18)
  }
}
```

- **连线的开始时间比同层节点早 0.3s**（`d*0.2 - 0.12` vs `d*0.2 + 0.18`）：视觉上"骨架先到，节点再落下"，这是层级感的来源。
- 按 `depth` 分组而不是按 DOM 顺序：同一层的节点应该同时出现。
- 每层 0.2s 的节拍，四层就是 0.8s，超过五层要压缩节拍。

### 选中路径脉冲

选中节点后，从根到它的连线点亮，两枚脉冲沿路径跑。

```js
const u = (t * 0.3 + k * 0.5 + (linkId % 7) * 0.11) % 1
const pt = path.getPointAtLength(len * u)
circle.setAttribute('cx', pt.x)
circle.setAttribute('cy', pt.y)
circle.style.opacity = String(Math.sin(u * Math.PI) * 0.9)
```

`pathLens` 缓存每条路径的长度；布局变化（展开/收起某个分支）时 `pathLens.clear()`。

### 平移缩放

- 拖拽时 `gsap.set(layer, { x, y, scale })` 直写（跟手）。
- 按钮缩放 / `fit()` / `focusNode()` 用 `gsap.quickTo(layer, 'x'|'y'|'scale', { duration: 0.55, ease: 'power3.out' })`。
- `exclude: '.org-node, .org-controls, .org-panel'`：点节点不是拖画布。
- 容器尺寸用 `clientWidth/clientHeight`（进场缩放期间 `getBoundingClientRect` 偏小，会导致首帧 `fit()` 算歪）。
- `ResizeObserver` 触发时 `fit(false)`（不要动画，否则窗口 resize 时会持续弹跳）。

### 键盘

方向键在树里移动（上 = 父节点，下 = 第一个子节点，左右 = 同级相邻），`Enter` 聚焦居中；选中后 `nextTick` 把焦点移到新节点上。`role="button"` + `tabindex="0"` + `aria-pressed`。

## 5. 主题切换要重新取色

Canvas 的渐变在创建时就固定了颜色字符串，切主题后不会自己变。

```js
function readStagePalette(el) {
  const css = getComputedStyle(el)
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback
  return { cat: [/* --graph-1..5 */], ink: get('--graph-ink', '46, 58, 62'), accent: get('--graph-accent', '35, 109, 233'), … }
}

// 主题变了就把缓存置空，下一帧重新读
const themeObserver = new MutationObserver(() => { palette = null })
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
```

- 颜色令牌用 **RGB 三元组**（`--graph-accent: 35, 109, 233`），Canvas 里拼 `rgba()` 才能带透明度；用 hex 还得自己转。
- DOM 部分的颜色用普通 CSS 变量即可，不需要 JS。
- 深色主题的分类色是"中明度版"，不要直接把浅色值调亮（会发灰）。

## 6. 性能红线（照抄）

- Canvas DPR 上限 2：`Math.min(window.devicePixelRatio || 1, 2)`，4K 屏不封顶会掉一半帧。
- 每帧 `try/catch`，只报一次错。
- 页面隐藏 / 元素离屏 / `prefers-reduced-motion` 时停帧，`flush()` 画终态。
- 每条线脉冲 ≤ 2；背景网络脉冲只在"聚焦某类"时、且只在前 60 条线上流动。
- Canvas 只在尺寸真正变化时重设 `width/height`（每次都设会清空画布并重新分配显存）。
- 不要在帧循环里读 `getBoundingClientRect()`（强制同步布局），除非像离屏检测那样节流到每 20 帧。
- 粒子数量级：星图背景网络在 120 个点位以内时稳定；超过就只在全景层画点，下钻后隐藏。

## 7. 减少动效时的降级

```js
const snap = motionSkipped()   // prefers-reduced-motion 或 document.hidden
if (snap) {
  st.x.x = node.x; st.y.x = node.y; st.o.x = 1; st.s.x = 1
} else { /* 正常弹簧 */ }
```

- 关闭漂移（`float`）、脉冲、涟漪、扫描弧，但**保留布局与读数**。
- 隐藏"重播 / 暂停"工具条（没有动效就没有可暂停的东西）。
- 停帧后必须 `flush()` 一次，保证画面不是空的。

## 8. 复用到别的业务

这套底座可以套在：权限溯源、审批流、组织架构、依赖关系、数据血缘、技能树。

改造清单：

1. 页面算出 `nodes`（含 `id/x/y/label/sub/from/delay`）与 `links`（含 `a/b/flow/cat/dashed`），几何用极坐标或分层列。
2. 选中/下钻只改 `focusId` / `branchId`，**不要手动移动节点**——坐标由 computed 重算，弹簧自动追随。
3. 新增的视觉语义（缺权限、停用、孤立）用 `tone: 'danger' | 'off'`，不要新增颜色。
4. 需要"读数"就落到 `count` / `ratio`，不要写死装饰性刻度。
