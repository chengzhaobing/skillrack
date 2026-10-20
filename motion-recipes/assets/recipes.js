/**
 * 交互效果配方库 · 原生 JS 工具集
 * 与 scaffold-vue/src/composables/motion.ts 同一套语义，去掉 Vue 依赖即可复用。
 *
 * 用法：
 *   import { gsap } from 'gsap'
 *   import { EASE, installPressFeedback, slideThumb, overlayEnter } from './recipes.js'
 *
 * 每个 effect 函数要么返回 timeline，要么返回 cleanup；组件卸载时调用它们。
 */
import { gsap } from 'gsap'

/* ── 令牌（与 references/design-tokens.md 一致） ─────────────── */
export const EASE = Object.freeze({
  reveal: 'expo.out',
  glide: 'power4.out',
  exit: 'power2.in',
  swap: 'power2.inOut',
  settle: 'back.out(1.6)',
})

export const DUR = Object.freeze({
  press: 0.14,
  release: 0.46,
  hoverIn: 0.34,
  hoverOut: 0.42,
  slide: 0.52,
  pageOut: 0.18,
  pageIn: 0.62,
  overlayIn: 0.42,
  overlayOut: 0.2,
})

const reducedQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

/** 用户是否要求减少动效 */
export function prefersReducedMotion() {
  return Boolean(reducedQuery?.matches)
}

/** 是否应跳过过程动画（减少动效或页面在后台） */
export function motionSkipped() {
  return prefersReducedMotion() || (typeof document !== 'undefined' && document.hidden)
}

/** 等两帧合成后再起播：避开 backdrop-filter 首次栅格化那一帧 */
export function afterTwoFrames(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn))
}

/* ── 按压反馈：事件委托，新控件命中选择器即获得同一手感 ───── */
const PRESSABLE = [
  '.btn', '.icon-btn', '.nav-item', '.segmented button', '.pg-btn',
  '.perm-chip', '.cmd-trigger', '.user-chip', '.quick-link', '.menu-item',
].join(', ')

let pressInstalled = false

export function installPressFeedback(selector = PRESSABLE) {
  if (pressInstalled || typeof window === 'undefined') return () => {}
  pressInstalled = true
  const pressed = new Set()

  const release = () => {
    pressed.forEach(el => gsap.to(el, { scale: 1, duration: DUR.release, ease: EASE.settle, overwrite: 'auto' }))
    pressed.clear()
  }

  const down = (event) => {
    if (motionSkipped() || event.button !== 0) return
    if (!event.target || typeof event.target.closest !== 'function') return
    const el = event.target.closest(selector)
    if (!el || el.disabled) return
    pressed.add(el)
    gsap.to(el, { scale: 0.955, duration: DUR.press, ease: 'power2.out', overwrite: 'auto' })
  }

  document.addEventListener('pointerdown', down, { passive: true })
  window.addEventListener('pointerup', release, { passive: true })
  window.addEventListener('pointercancel', release, { passive: true })

  return () => {
    document.removeEventListener('pointerdown', down)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    release()
    pressInstalled = false
  }
}

/* ── 悬停抬起：只给可点的卡片（hover 写 y，press 写 scale，互不覆盖） ── */
let hoverInstalled = false

export function installHoverLift(selector = '.lift', amount = 3) {
  if (hoverInstalled || typeof window === 'undefined') return () => {}
  if (!window.matchMedia('(hover: hover)').matches) return () => {}
  hoverInstalled = true

  const over = (event) => {
    if (motionSkipped()) return
    const el = event.target.closest(selector)
    if (!el || el.contains(event.relatedTarget)) return
    gsap.to(el, { y: -amount, duration: DUR.hoverIn, ease: EASE.glide, overwrite: 'auto' })
  }
  const out = (event) => {
    const el = event.target.closest(selector)
    if (!el || el.contains(event.relatedTarget)) return
    gsap.to(el, { y: 0, duration: DUR.hoverOut, ease: EASE.settle, overwrite: 'auto' })
  }

  document.addEventListener('pointerover', over)
  document.addEventListener('pointerout', out)
  return () => {
    document.removeEventListener('pointerover', over)
    document.removeEventListener('pointerout', out)
    hoverInstalled = false
  }
}

/** 容器级指针光：坐标写在容器自身（叶子），不写在上层 */
export function trackGlow(event) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--px', `${event.clientX - rect.left}px`)
  el.style.setProperty('--py', `${event.clientY - rect.top}px`)
}

/* ── 滑动玻璃块：导航选中、分段滑块共用（transform 归动效脚本） ── */
export function slideThumb(thumb, target, axis = 'x', instant = false) {
  const parent = thumb?.offsetParent
  if (!thumb || !target || !parent) return
  // 用几何差值定位：目标与滑块不必是同一个定位父级。
  // 祖先若正在缩放（弹窗从触发点展开），包围盒带着缩放比，需折算回布局像素。
  const pr = parent.getBoundingClientRect()
  const tr = target.getBoundingClientRect()
  const kx = parent.offsetWidth ? pr.width / parent.offsetWidth : 1
  const ky = parent.offsetHeight ? pr.height / parent.offsetHeight : 1
  const props = axis === 'y'
    ? { y: (tr.top - pr.top) / ky - parent.clientTop + parent.scrollTop, height: tr.height / ky }
    : { x: (tr.left - pr.left) / kx - parent.clientLeft + parent.scrollLeft, width: tr.width / kx }
  if (instant || motionSkipped()) {
    gsap.set(thumb, props)
    return null
  }
  return gsap.to(thumb, { ...props, duration: DUR.slide, ease: EASE.glide, overwrite: true })
}

/* ── 浮层来处：最近一次指针按下的位置 ─────────────────────── */
export const lastPointer = { x: 0, y: 0, at: 0 }
let pointerTracked = false

export function trackPointer() {
  if (pointerTracked || typeof document === 'undefined') return
  pointerTracked = true
  document.addEventListener('pointerdown', (event) => {
    lastPointer.x = event.clientX
    lastPointer.y = event.clientY
    lastPointer.at = performance.now()
  }, { capture: true, passive: true })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') lastPointer.at = 0
  }, { capture: true, passive: true })
}

/** 刚刚（600ms 内）由指针触发的打开动作才有「来处」 */
function recentPointer() {
  return lastPointer.at && performance.now() - lastPointer.at < 600 ? lastPointer : null
}

/** 指针下方、匹配选择器的元素（共享元素的「来处」）；键盘触发为 null */
export function originAtPointer(selector) {
  const point = recentPointer()
  if (!point) return null
  return document.elementFromPoint(point.x, point.y)?.closest(selector) ?? null
}

function originOf(panel) {
  const point = recentPointer()
  if (!point) return '50% 50%'
  const r = panel.getBoundingClientRect()
  const x = Math.min(Math.max(point.x - r.left, -r.width * 0.25), r.width * 1.25)
  const y = Math.min(Math.max(point.y - r.top, -r.height * 0.25), r.height * 1.25)
  return `${x}px ${y}px`
}

/* ── 浮层：弹窗 / 抽屉 / 下拉 ───────────────────────────────── */
export function overlayEnter(el, done, kind = 'modal', origin = null) {
  const panel = el.querySelector('.modal, .drawer') ?? el
  if (motionSkipped()) return done()
  const tl = gsap.timeline({ onComplete: done })

  if (kind === 'pop') {
    tl.fromTo(el, { autoAlpha: 0, y: -6, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: EASE.reveal, clearProps: 'transform' })
    return tl
  }

  tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' }, 0)

  if (kind === 'drawer') {
    if (origin && document.contains(origin)) {
      const ghost = morphGhost(origin.getBoundingClientRect(), panel.getBoundingClientRect())
      gsap.set(panel, { autoAlpha: 0 })
      tl.add(ghost, 0)
      tl.to(panel, { autoAlpha: 1, duration: 0.26, ease: 'power1.out' }, 0.3)
      tl.fromTo(
        panel.querySelectorAll('.drawer-head, .drawer-body > *, .drawer-foot'),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.42, ease: EASE.reveal, stagger: 0.03, clearProps: 'opacity,visibility,transform' },
        0.34,
      )
      return tl
    }
    tl.fromTo(panel, { x: 36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.52, ease: EASE.glide, clearProps: 'transform' }, 0)
    return tl
  }

  gsap.set(panel, { transformOrigin: originOf(panel) })
  const from = recentPointer() ? { scale: 0.86, autoAlpha: 0, y: 0 } : { y: 14, scale: 0.975, autoAlpha: 0 }
  tl.fromTo(panel, from, { y: 0, scale: 1, autoAlpha: 1, duration: 0.48, ease: EASE.reveal, clearProps: 'transform,transformOrigin' }, 0.02)
  return tl
}

export function overlayLeave(el, done, kind = 'modal', origin = null) {
  if (motionSkipped()) return done()
  const panel = el.querySelector('.modal, .drawer') ?? el
  const tl = gsap.timeline({ onComplete: done })

  if (kind === 'pop') {
    tl.to(el, { autoAlpha: 0, y: -4, duration: 0.14, ease: EASE.exit })
    return tl
  }
  if (kind === 'drawer' && origin && document.contains(origin)) {
    // 收回原处（停摆 Halt）：内容先退，玻璃再缩回来处
    const ghost = morphGhost(panel.getBoundingClientRect(), origin.getBoundingClientRect(), true)
    tl.to(panel, { autoAlpha: 0, duration: 0.14, ease: EASE.exit }, 0)
    tl.add(ghost, 0.06)
    tl.to(el, { autoAlpha: 0, duration: 0.3, ease: EASE.exit }, 0.08)
    return tl
  }
  if (kind === 'drawer') tl.to(panel, { x: 24, duration: DUR.overlayOut, ease: EASE.exit }, 0)
  else tl.to(panel, { scale: 0.94, autoAlpha: 0, duration: DUR.overlayOut, ease: EASE.exit }, 0)
  tl.to(el, { autoAlpha: 0, duration: DUR.overlayOut, ease: EASE.exit }, 0)
  return tl
}

/** 一块独立的玻璃从 from 矩形变形到 to 矩形，结束即移除 */
export function morphGhost(from, to, closing = false) {
  const ghost = document.createElement('div')
  ghost.className = 'morph-ghost'
  document.body.appendChild(ghost)
  const tl = gsap.timeline({ onComplete: () => ghost.remove() })
  gsap.set(ghost, { left: 0, top: 0, x: from.left, y: from.top, width: from.width, height: from.height, autoAlpha: closing ? 1 : 0.9 })
  tl.to(ghost, { x: to.left, y: to.top, width: to.width, height: to.height, duration: closing ? 0.36 : 0.5, ease: closing ? EASE.swap : EASE.glide })
  tl.to(ghost, { autoAlpha: 0, duration: closing ? 0.16 : 0.22, ease: 'power1.out' }, closing ? '-=0.12' : '-=0.18')
  return tl
}

/* ── 底部浮条（批量操作、未保存变更） ─────────────────────── */
export function floatBarEnter(el, done) {
  if (motionSkipped()) return done()
  gsap.fromTo(el, { y: 40, autoAlpha: 0, scale: 0.96 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.56, ease: EASE.settle, clearProps: 'transform', onComplete: done })
}

export function floatBarLeave(el, done) {
  if (motionSkipped()) return done()
  gsap.to(el, { y: 30, autoAlpha: 0, duration: 0.22, ease: EASE.exit, onComplete: done })
}

/* ── 群组进场：列表行按阅读序（结 Crystallize） ───────────── */
export function revealRows(rows) {
  if (motionSkipped() || !rows.length) return null
  const list = Array.from(rows).slice(0, 14)
  return gsap.fromTo(list, { autoAlpha: 0, y: 6 }, {
    autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.reveal,
    stagger: { each: 0.025, from: 'start' }, clearProps: 'opacity,visibility,transform',
  })
}

/** 面板内容级联浮现：分析栏、抽屉正文（结 Crystallize） */
export function revealCascade(container, selector = ':scope > *', gap = 0.075) {
  if (!container || motionSkipped()) return null
  const items = Array.from(container.querySelectorAll(selector)).slice(0, 18)
  if (!items.length) return null
  return gsap.fromTo(items, { autoAlpha: 0, y: 10 }, {
    autoAlpha: 1, y: 0, duration: 0.56, ease: EASE.reveal,
    stagger: { each: gap, from: 'start' }, clearProps: 'opacity,visibility,transform', overwrite: 'auto',
  })
}

/** 状态确认：一次 back.out 的 scale 弹入，不用 opacity 脉冲 */
export function settlePop(el) {
  if (!el || motionSkipped()) return null
  return gsap.fromTo(el, { scale: 0.6 }, { scale: 1, duration: 0.42, ease: EASE.settle, clearProps: 'transform' })
}

/** 折线描绘：数据沿路径推进（导 Conduct） */
export function drawPath(path, area) {
  if (!path || motionSkipped()) return null
  const length = path.getTotalLength()
  const main = gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
    strokeDashoffset: 0, duration: 1.1, ease: EASE.swap, clearProps: 'strokeDasharray,strokeDashoffset',
  })
  if (area) gsap.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.5, ease: 'power1.out' })
  return main
}

/** 打字机：逐字写出 text，返回取消函数 */
export function typeOut(text, write, done, speed = 42) {
  if (motionSkipped()) {
    write(text)
    done?.()
    return () => {}
  }
  let i = 0
  write('')
  const timer = window.setInterval(() => {
    i += 1
    write(text.slice(0, i))
    if (i >= text.length) {
      window.clearInterval(timer)
      window.setTimeout(() => done?.(), 180)
    }
  }, speed)
  return () => window.clearInterval(timer)
}

/* ── 数据看板：数字、柱条、折线、环图、错峰、更新 ─────────────
   三条纪律：轴/单位/卡片位置不动；读数与图形同一进度；入场只播一次。
   详细说明见 references/data-viz.md
   ───────────────────────────────────────────────────────────── */

const numberFormatters = new Map()

function numberFormatter(decimals, group) {
  const key = `${decimals}|${group}`
  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: group,
    }))
  }
  return numberFormatters.get(key)
}

/** 只写 textContent；单位放在兄弟节点里，不参与补间 */
export function paintNumber(el, value, { decimals = 0, group = true } = {}) {
  if (!el) return
  el.textContent = numberFormatter(decimals, group).format(value)
}

/**
 * 数字滚动：0 → 目标值。只播一次（由调用方判断）。
 * 语义：结 Crystallize
 */
export function countUp(el, to, {
  from = 0, decimals = 0, duration = 1.1, delay = 0, group = true, onDone,
} = {}) {
  if (!el) return null
  if (motionSkipped()) {
    paintNumber(el, to, { decimals, group })
    onDone?.()
    return null
  }
  paintNumber(el, from, { decimals, group })
  const state = { v: from }
  const step = 1 / 10 ** decimals
  return gsap.to(state, {
    v: to,
    duration,
    delay,
    ease: EASE.reveal,
    snap: { v: step },
    onUpdate: () => paintNumber(el, state.v, { decimals, group }),
    onComplete: () => {
      paintNumber(el, to, { decimals, group })
      onDone?.()
    },
  })
}

/**
 * 柱条生长：轴与标签不动，柱条 scaleX 0 → --ratio，数值在该柱到位后出现。
 * 入场与刷新共用同一条 --ratio 通道。
 */
export function growBars(root, { duration = 0.8, stagger = 0.06 } = {}) {
  const rows = Array.from(root?.querySelectorAll('.hbar, .vbar') ?? [])
  if (!rows.length) return null
  const valueOf = (row) => row.querySelector('.hbar-value, .vbar-value')

  rows.forEach((row) => {
    row.style.setProperty('--ratio', '0')
    gsap.set(valueOf(row), { autoAlpha: 0, x: 6 })
  })
  if (motionSkipped()) {
    rows.forEach((row) => {
      row.style.setProperty('--ratio', String(row.dataset.ratio || 0))
      gsap.set(valueOf(row), { autoAlpha: 1, x: 0 })
    })
    return null
  }

  const tl = gsap.timeline()
  rows.forEach((row, i) => {
    const proxy = { v: 0 }
    const target = Number(row.dataset.ratio || 0)
    const at = i * stagger
    tl.to(proxy, {
      v: target, duration, ease: 'power3.out',
      onUpdate: () => row.style.setProperty('--ratio', proxy.v.toFixed(4)),
    }, at)
    tl.to(valueOf(row), { autoAlpha: 1, x: 0, duration: 0.24, ease: 'power1.out', clearProps: 'transform' }, at + duration * 0.85)
  })
  return tl
}

/** 折线描画：X 轴固定，线沿时间轴从左向右展开（路径需带 pathLength="1"） */
export function drawTrend(root, { duration = 1.1 } = {}) {
  const line = root?.querySelector('.trend-line')
  const area = root?.querySelector('.trend-area')
  const dot = root?.querySelector('.trend-dot')
  if (!line) return null
  if (motionSkipped()) {
    gsap.set([line, area, dot].filter(Boolean), { clearProps: 'all', autoAlpha: 1 })
    return null
  }
  const tl = gsap.timeline()
  tl.fromTo(line,
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration, ease: EASE.swap, clearProps: 'strokeDasharray,strokeDashoffset' }, 0)
  if (area) tl.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, duration * 0.45)
  if (dot) {
    const end = line.getPointAtLength(line.getTotalLength())
    gsap.set(dot, { attr: { cx: end.x, cy: end.y } })
    tl.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: EASE.settle }, duration * 0.82)
  }
  return tl
}

/** 环图展开：各段依次展开，中心总量同步滚动（段需 stroke-linecap: butt） */
export function expandDonut(root, shares, { radius = 54, duration = 0.42, overlap = 0.06, total = 100 } = {}) {
  const nodes = Array.from(root?.querySelectorAll('.donut-seg') ?? [])
  const center = root?.querySelector('.donut-total')
  const legend = Array.from(root?.querySelectorAll('.donut-legend li') ?? [])
  if (!nodes.length) return null
  const C = 2 * Math.PI * radius

  let acc = 0
  nodes.forEach((node, i) => {
    const len = (Number(shares[i] || 0) / 100) * C
    node.dataset.len = String(len)
    node.style.strokeDasharray = `0 ${C}`
    gsap.set(node, { strokeDashoffset: -acc })
    acc += len
  })
  if (motionSkipped()) {
    nodes.forEach((node) => { node.style.strokeDasharray = `${node.dataset.len} ${C}` })
    paintNumber(center, total)
    gsap.set(legend, { autoAlpha: 1 })
    return null
  }

  const tl = gsap.timeline()
  nodes.forEach((node, i) => {
    const proxy = { v: 0 }
    const len = Number(node.dataset.len)
    tl.to(proxy, {
      v: len, duration, ease: 'power2.out',
      onUpdate: () => { node.style.strokeDasharray = `${proxy.v} ${C - proxy.v}` },
    }, i * (duration - overlap))
  })
  if (center) {
    const tween = countUp(center, total, { duration: 0.9 })
    if (tween) tl.add(tween, 0)
  }
  if (legend.length) {
    tl.fromTo(legend, { autoAlpha: 0, y: 6 }, {
      autoAlpha: 1, y: 0, duration: 0.24, ease: 'power1.out',
      stagger: 0.04, clearProps: 'transform',
    }, Math.max(0, nodes.length * (duration - overlap) - overlap))
  }
  return tl
}

/** 面板错峰入场：顺序 = 信息层级（指标 → 图表 → 明细） */
export function staggerPanels(root, { y = 18 } = {}) {
  const layers = [
    { sel: '[data-layer="metrics"] > *', at: 0, each: 0.045, dur: 0.56 },
    { sel: '[data-layer="charts"] > *', at: 0.12, each: 0.05, dur: 0.62 },
    { sel: '[data-layer="detail"] > *', at: 0.24, each: 0.025, dur: 0.5 },
  ].map(layer => ({ ...layer, items: Array.from(root?.querySelectorAll(layer.sel) ?? []) }))

  const all = layers.flatMap(layer => layer.items)
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
      autoAlpha: 1, y: 0, duration: layer.dur, ease: EASE.reveal,
      stagger: { each: layer.each, from: 'start' }, clearProps: 'opacity,visibility,transform',
    }, layer.at)
  })
  return tl
}

/** 单块指标更新：读数与图形共用同一进度，只闪变化过的块 */
export function updateKpi(block, next, { duration = 0.6, flash = true } = {}) {
  if (!block) return null
  const valueEl = block.querySelector('.kpi-value')
  const from = Number(block.dataset.value || 0)
  const decimals = Number(block.dataset.decimals || 0)
  const ratio = Number(block.dataset.ratio || 0)
  const nextRatio = Number(next.ratio ?? ratio)

  block.dataset.value = String(next.value)
  block.dataset.ratio = String(nextRatio)

  if (motionSkipped()) {
    paintNumber(valueEl, next.value, { decimals })
    block.style.setProperty('--ratio', String(nextRatio))
    return null
  }

  const state = { v: from, r: ratio }
  const tl = gsap.timeline()
  tl.to(state, {
    v: next.value, r: nextRatio, duration, ease: 'power2.out',
    snap: { v: 1 / 10 ** decimals },
    onUpdate: () => {
      paintNumber(valueEl, state.v, { decimals })
      block.style.setProperty('--ratio', state.r.toFixed(4))
    },
  })
  const layer = block.querySelector('.kpi-flash')
  if (flash && layer && Math.abs(next.value - from) > 0) {
    tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0)
      .to(layer, { opacity: 0, duration: 0.72, ease: EASE.swap }, 0.18)
  }
  return tl
}

/** 把当前所有进行中的补间推到终态（切后台、用户打断、跳过动画时用） */
export function finishRunningAnimations() {
  gsap.globalTimeline.getChildren(false, true, true).forEach((tween) => {
    try { tween.progress(1, false) } catch (_) { /* 已经销毁的补间忽略 */ }
  })
}

/* ── 物理底座 ───────────────────────────────────────────────── */

export const springOf = (x) => ({ x, v: 0 })

/** 临界阻尼弹簧：每帧把 state 推向 target，返回新值。k 越大越硬（62 ≈ 0.5s 落定） */
export function spring(state, target, dt, k = 62) {
  const c = 2 * Math.sqrt(k)
  state.v += (-k * (state.x - target) - c * state.v) * dt
  state.x += state.v * dt
  return state.x
}

/** 三次贝塞尔上 u 处的坐标分量 */
export function bezierAt(p0, p1, p2, p3, u) {
  const m = 1 - u
  return m * m * m * p0 + 3 * m * m * u * p1 + 3 * m * u * u * p2 + u * u * u * p3
}

/**
 * 常驻帧循环：挂在 gsap.ticker 上，页面隐藏或元素离开视口时停帧。
 * 回调拿到 dt（秒，限制在 1/30 内）与累计时间 t；单帧出错只报一次。
 */
export function createFrameLoop(step) {
  let target = null
  let offscreen = false
  let frames = 0
  let running = false
  let last = 0
  let time = 0
  let warned = false

  const run = (force) => {
    if (document.hidden && !force) { last = 0; return }
    if (target && (offscreen || frames++ % 20 === 0)) {
      const r = target.getBoundingClientRect()
      offscreen = r.width === 0 || r.bottom < 0 || r.top > window.innerHeight
    }
    if (offscreen && !force) { last = 0; return }
    const now = performance.now()
    const dt = last ? Math.max(0, Math.min(1 / 30, (now - last) / 1000)) : 1 / 60
    last = now
    time += dt
    try { step(dt, time) } catch (error) {
      if (!warned) { warned = true; console.error(error) }
    }
  }

  const tick = () => run(false)

  return {
    start(el) {
      if (running) return
      running = true
      last = 0
      target = el ?? null
      gsap.ticker.add(tick)
    },
    stop() {
      running = false
      gsap.ticker.remove(tick)
      target = null
    },
    /** 立即执行一帧（减少动态效果时用来直接画到终态） */
    flush() { run(true) },
    get time() { return time },
  }
}

export { gsap }
