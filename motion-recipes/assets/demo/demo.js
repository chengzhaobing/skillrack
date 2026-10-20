/* 演示脚本：纯原生 JS + CDN 上的动画引擎，逐块初始化；单块失败不影响其他块。 */
(function () {
  'use strict'

  // 把运行时错误写到 DOM，便于自动化验证（无控制台也能看到）
  var errors = []
  window.addEventListener('error', function (event) {
    errors.push(String(event.message || event.error || 'unknown'))
    document.documentElement.dataset.demoErrors = errors.join(' | ')
  })

  var gsap = window.gsap
  if (!gsap) {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px;color:#e0443b">动画引擎未加载：请连网后刷新，或用本地文件替换 CDN 地址。</p>')
    return
  }
  if (window.Flip) gsap.registerPlugin(window.Flip)

  /* ── 令牌 ─────────────────────────────────────────────── */
  var EASE = { reveal: 'expo.out', glide: 'power4.out', exit: 'power2.in', swap: 'power2.inOut', settle: 'back.out(1.6)' }
  var DUR = { press: 0.14, release: 0.46, hoverIn: 0.34, hoverOut: 0.42 }

  function skip() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden
  }

  function safe(name, fn) {
    try { fn() } catch (error) { console.error('[demo] ' + name, error) }
  }

  var blocks = []
  function ready(id) { blocks.push(id) }

  /* ── 02 按压与悬停（全局委托） ─────────────────────────── */
  safe('press', function () {
    var pressed = new Set()
    var release = function () {
      pressed.forEach(function (el) { gsap.to(el, { scale: 1, duration: DUR.release, ease: EASE.settle, overwrite: 'auto' }) })
      pressed.clear()
    }
    document.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || skip()) return
      if (!event.target || typeof event.target.closest !== 'function') return
      var el = event.target.closest('.btn, .segmented button, .row-item, .card-mini, .flip-card')
      if (!el || el.disabled) return
      pressed.add(el)
      gsap.to(el, { scale: 0.955, duration: DUR.press, ease: 'power2.out', overwrite: 'auto' })
    }, { passive: true })
    window.addEventListener('pointerup', release, { passive: true })
    window.addEventListener('pointercancel', release, { passive: true })
    ready('press')
  })

  safe('hover', function () {
    if (!window.matchMedia('(hover: hover)').matches) return
    document.addEventListener('pointerover', function (event) {
      var el = event.target.closest('.lift')
      if (!el || el.contains(event.relatedTarget) || skip()) return
      gsap.to(el, { y: -3, duration: DUR.hoverIn, ease: EASE.glide, overwrite: 'auto' })
    })
    document.addEventListener('pointerout', function (event) {
      var el = event.target.closest('.lift')
      if (!el || el.contains(event.relatedTarget)) return
      gsap.to(el, { y: 0, duration: DUR.hoverOut, ease: EASE.settle, overwrite: 'auto' })
    })
    ready('hover')
  })

  /* ── 01 登录按钮形变 ─────────────────────────────────── */
  safe('auth', function () {
    var slot = document.querySelector('.auth-slot')
    var action = slot && slot.querySelector('.auth-action')
    var label = slot && slot.querySelector('.auth-label')
    var ring = slot && slot.querySelector('.mark-progress')
    var check = slot && slot.querySelector('.mark-check')
    var hint = document.getElementById('auth-hint')
    if (!action) return

    var RING = 126, CHECK = 24, CIRCLE = 46
    var state = 'idle'
    var tl = null

    function setState(next, text) {
      state = next
      action.dataset.state = next
      action.disabled = next === 'loading' || next === 'success'
      action.setAttribute('aria-busy', next === 'loading' ? 'true' : 'false')
      if (hint && text) hint.textContent = text
    }
    function kill() { if (tl) { tl.kill(); tl = null } }
    function resetInline() {
      gsap.set(action, { clearProps: 'width,transform' })
      gsap.set([ring, check], { clearProps: 'strokeDashoffset,opacity' })
      gsap.set(label, { clearProps: 'opacity,visibility' })
    }

    function toLoading() {
      if (state === 'loading') return
      kill()
      setState('loading', '请求中：宽度不变，只有环在转。')
      if (skip()) { gsap.set(label, { autoAlpha: 0 }); return }
      tl = gsap.timeline().to(label, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' })
    }

    function toSuccess() {
      kill()
      setState('success', '成功：胶囊收到圆 → 圆环 → 对勾 → 确认弹。')
      if (skip()) {
        gsap.set(action, { width: CIRCLE })
        gsap.set(ring, { strokeDashoffset: 0 })
        return
      }
      var full = slot.clientWidth
      tl = gsap.timeline()
      tl.to(label, { autoAlpha: 0, duration: 0.12, ease: 'power1.out' }, 0)
        .fromTo(action, { width: full }, { width: CIRCLE, duration: 0.42, ease: EASE.swap }, 0.02)
        .fromTo(ring, { strokeDashoffset: RING }, { strokeDashoffset: 0, duration: 0.5, ease: EASE.reveal }, '-=0.08')
        .fromTo(check, { strokeDashoffset: CHECK }, { strokeDashoffset: 0, duration: 0.32, ease: EASE.settle }, '-=0.22')
        .to(action, { scale: 1.06, duration: 0.16, ease: 'power1.out' })
        .to(action, { scale: 1, duration: 0.3, ease: EASE.settle })
    }

    function toError() {
      kill()
      var wasCircle = state === 'success' || action.getBoundingClientRect().width <= CIRCLE + 2
      setState('error', '失败：抖动三下 → 宽度回到 100% → 文字回来。')
      if (skip()) { setState('idle'); resetInline(); return }
      var full = slot.clientWidth
      tl = gsap.timeline({ onComplete: function () { setState('idle'); resetInline() } })
      tl.to(action, {
        keyframes: [
          { x: -6, duration: 0.06 }, { x: 5, duration: 0.07 },
          { x: -4, duration: 0.06 }, { x: 3, duration: 0.06 }, { x: 0, duration: 0.07 },
        ],
        ease: 'none',
      })
      if (wasCircle) {
        tl.to(action, { width: full, duration: 0.46, ease: EASE.settle }, '>-0.02')
        tl.to(label, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, '<0.12')
      } else {
        tl.to(label, { autoAlpha: 1, duration: 0.2, ease: 'power1.out' }, '>-0.05')
      }
    }

    action.addEventListener('click', function () {
      if (state !== 'idle') return
      toLoading()
      // 演示用的假请求：真实项目里由接口结果决定走向
      window.setTimeout(toSuccess, 900)
    })
    document.querySelector('[data-auth="error"]').addEventListener('click', function () {
      if (state === 'success' || state === 'loading') toError()
      else { toLoading(); window.setTimeout(toError, 700) }
    })
    document.querySelector('[data-auth="reset"]').addEventListener('click', function () {
      kill()
      setState('idle', '已复位。')
      resetInline()
    })
    ready('auth')
  })

  /* ── 03 指针光与倾斜 ─────────────────────────────────── */
  safe('glow', function () {
    var card = document.querySelector('.glow-card')
    card.addEventListener('pointermove', function (event) {
      var rect = card.getBoundingClientRect()
      card.style.setProperty('--px', (event.clientX - rect.left) + 'px')
      card.style.setProperty('--py', (event.clientY - rect.top) + 'px')
    })

    var tilt = document.querySelector('.tilt-card')
    var wrap = document.querySelector('.tilt-wrap')
    if (!window.matchMedia('(hover: hover)').matches || skip()) return
    var xTo = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' })
    var yTo = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    wrap.addEventListener('pointermove', function (event) {
      var r = wrap.getBoundingClientRect()
      var px = (event.clientX - r.left) / r.width - 0.5
      var py = (event.clientY - r.top) / r.height - 0.5
      yTo(Math.max(-1, Math.min(1, px * 2)) * 4)
      xTo(Math.max(-1, Math.min(1, py * 2)) * -3)
    })
    wrap.addEventListener('pointerleave', function () { xTo(0); yTo(0) })
    ready('glow')
  })

  /* ── 04 磁吸 ─────────────────────────────────────────── */
  safe('magnet', function () {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches || skip()) return
    var el = document.querySelector('[data-magnet]')
    var xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' })
    var yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' })
    var radius = 90, strength = 0.28, max = 10
    window.addEventListener('pointermove', function (event) {
      var r = el.getBoundingClientRect()
      var dx = event.clientX - (r.left + r.width / 2)
      var dy = event.clientY - (r.top + r.height / 2)
      if (Math.hypot(dx, dy) > radius + Math.max(r.width, r.height) / 2) { xTo(0); yTo(0); return }
      xTo(Math.max(-max, Math.min(max, dx * strength)))
      yTo(Math.max(-max, Math.min(max, dy * strength)))
    }, { passive: true })
    el.addEventListener('pointerleave', function () { xTo(0); yTo(0) })
    ready('magnet')
  })

  /* ── 05 滑动玻璃块 ───────────────────────────────────── */
  safe('thumb', function () {
    var root = document.getElementById('seg')
    var thumb = root.querySelector('.seg-thumb')
    var hint = document.getElementById('seg-hint')
    var LABEL = { star: '星图', table: '表格', board: '看板', canvas: '画布' }
    var current = 'star'

    function slide(target, instant) {
      if (!thumb || !target) return
      var parent = thumb.offsetParent || root
      var pr = parent.getBoundingClientRect()
      var tr = target.getBoundingClientRect()
      var kx = parent.offsetWidth ? pr.width / parent.offsetWidth : 1
      var props = { x: (tr.left - pr.left) / kx - parent.clientLeft + parent.scrollLeft, width: tr.width / kx }
      if (instant || skip()) { gsap.set(thumb, props); return }
      gsap.to(thumb, { x: props.x, width: props.width, duration: 0.52, ease: EASE.glide, overwrite: true })
    }

    var buttons = Array.prototype.slice.call(root.querySelectorAll('button'))
    root.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-seg]')
      if (!btn) return
      buttons.forEach(function (b) { b.classList.toggle('is-active', b === btn) })
      current = btn.dataset.seg
      if (hint) hint.textContent = '当前视图：' + LABEL[current]
      slide(btn, false)
    })
    requestAnimationFrame(function () { slide(root.querySelector('[data-seg="' + current + '"]'), true) })
    var ro = new ResizeObserver(function () { slide(root.querySelector('[data-seg="' + current + '"]'), true) })
    ro.observe(root)
    buttons.forEach(function (b) { ro.observe(b) })
    ready('thumb')
  })

  /* ── 06 浮层：弹窗（指针来处） + 抽屉（共享元素） ─────── */
  safe('overlay', function () {
    var lastPointer = { x: 0, y: 0, at: 0 }
    document.addEventListener('pointerdown', function (e) {
      lastPointer.x = e.clientX; lastPointer.y = e.clientY; lastPointer.at = performance.now()
    }, { capture: true, passive: true })

    function recentPointer() {
      return lastPointer.at && performance.now() - lastPointer.at < 800 ? lastPointer : null
    }

    function morphGhost(from, to, closing) {
      var ghost = document.createElement('div')
      ghost.className = 'morph-ghost'
      document.body.appendChild(ghost)
      var tl = gsap.timeline({ onComplete: function () { ghost.remove() } })
      gsap.set(ghost, { left: 0, top: 0, x: from.left, y: from.top, width: from.width, height: from.height, autoAlpha: closing ? 1 : 0.9 })
      tl.to(ghost, { x: to.left, y: to.top, width: to.width, height: to.height, duration: closing ? 0.36 : 0.5, ease: closing ? EASE.swap : EASE.glide })
      tl.to(ghost, { autoAlpha: 0, duration: closing ? 0.16 : 0.22, ease: 'power1.out' }, closing ? '-=0.12' : '-=0.18')
      return tl
    }

    function build(kind, title, sub) {
      var overlay = document.createElement('div')
      overlay.className = 'overlay' + (kind === 'drawer' ? ' drawer-overlay' : '')
      var panel = document.createElement(kind === 'drawer' ? 'aside' : 'div')
      panel.className = kind === 'drawer' ? 'drawer' : 'modal'
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-modal', 'true')
      panel.innerHTML =
        '<div class="panel-head"><div><h3>' + title + '</h3><p>' + sub + '</p></div>' +
        '<button class="icon-x" type="button" aria-label="关闭">×</button></div>' +
        '<div class="panel-body"><p>面板内容按 30ms 级联浮现，遮罩只补间透明度。</p>' +
        '<p>关闭时若来处还在页面上，玻璃会缩回原行；来处失效则退化为滑出。</p>' +
        '<p>键盘打开没有来处，回落成「上浮 14px」的居中动画。</p></div>' +
        '<div class="panel-foot"><button class="btn btn-secondary" type="button" data-close>关闭</button></div>'
      overlay.appendChild(panel)
      document.body.appendChild(overlay)
      return { overlay: overlay, panel: panel }
    }

    function open(kind, origin) {
      var refs = build(kind, kind === 'drawer' ? '菜单详情' : '新增菜单', kind === 'drawer' ? '从被点的行生长' : '从触发点展开')
      var overlay = refs.overlay
      var panel = refs.panel
      var close = function () { leave() }
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.closest('[data-close]') || e.target.closest('.icon-x')) close()
      })
      var onKey = function (e) { if (e.key === 'Escape') close() }
      document.addEventListener('keydown', onKey)

      function leave() {
        document.removeEventListener('keydown', onKey)
        if (skip()) { overlay.remove(); return }
        var tl = gsap.timeline({ onComplete: function () { overlay.remove() } })
        tl.to(overlay, { autoAlpha: 0, duration: 0.2, ease: EASE.exit }, 0)
        if (kind === 'drawer' && origin && document.contains(origin)) {
          var ghost = morphGhost(panel.getBoundingClientRect(), origin.getBoundingClientRect(), true)
          tl.to(panel, { autoAlpha: 0, duration: 0.14, ease: EASE.exit }, 0)
          tl.add(ghost, 0.06)
        } else if (kind === 'drawer') {
          tl.to(panel, { x: 24, duration: 0.2, ease: EASE.exit }, 0)
        } else {
          tl.to(panel, { scale: 0.94, autoAlpha: 0, duration: 0.2, ease: EASE.exit }, 0)
        }
      }

      if (skip()) return
      var tl = gsap.timeline()
      tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' }, 0)
      if (kind === 'drawer') {
        if (origin && document.contains(origin)) {
          gsap.set(panel, { autoAlpha: 0 })
          tl.add(morphGhost(origin.getBoundingClientRect(), panel.getBoundingClientRect()), 0)
          tl.to(panel, { autoAlpha: 1, duration: 0.26, ease: 'power1.out' }, 0.3)
          tl.fromTo(panel.querySelectorAll('.panel-head, .panel-body > *, .panel-foot'),
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.42, ease: EASE.reveal, stagger: 0.03, clearProps: 'opacity,visibility,transform' }, 0.34)
        } else {
          tl.fromTo(panel, { x: 36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.52, ease: EASE.glide, clearProps: 'transform' }, 0)
        }
        return
      }
      var point = recentPointer()
      var r = panel.getBoundingClientRect()
      var ox = '50%', oy = '50%'
      if (point) {
        ox = Math.min(Math.max(point.x - r.left, -r.width * 0.25), r.width * 1.25) + 'px'
        oy = Math.min(Math.max(point.y - r.top, -r.height * 0.25), r.height * 1.25) + 'px'
      }
      gsap.set(panel, { transformOrigin: ox + ' ' + oy })
      var from = point ? { scale: 0.86, autoAlpha: 0, y: 0 } : { y: 14, scale: 0.975, autoAlpha: 0 }
      tl.fromTo(panel, from, { y: 0, scale: 1, autoAlpha: 1, duration: 0.48, ease: EASE.reveal, clearProps: 'transform,transformOrigin' }, 0.02)
    }

    var lastRow = null
    document.querySelectorAll('.row-item').forEach(function (row) {
      row.addEventListener('click', function () { lastRow = row })
    })
    document.querySelector('[data-modal]').addEventListener('click', function () { open('modal', null) })
    document.querySelector('[data-drawer]').addEventListener('click', function (event) {
      // 键盘触发（detail === 0）没有来处
      open('drawer', event.detail === 0 ? null : lastRow)
    })
    ready('overlay')
  })

  /* ── 07 提示牌堆 ─────────────────────────────────────── */
  safe('toast', function () {
    var host = document.getElementById('toast-host')
    var items = []
    var seq = 0

    function layout() {
      var n = items.length
      items.forEach(function (item, i) {
        item.el.style.setProperty('--depth', String(n - 1 - i))
      })
    }

    function push(tone, msg) {
      var id = ++seq
      var slot = document.createElement('div')
      slot.className = 'toast-slot'
      slot.innerHTML = '<div class="toast tone-' + tone + '"><span class="toast-dot" aria-hidden="true"></span><span>' + msg + '</span></div>'
      host.appendChild(slot)
      var card = slot.querySelector('.toast')
      items.push({ id: id, el: slot })
      if (items.length > 4) {
        var old = items.shift()
        if (old) old.el.remove()
      }
      layout()
      if (skip()) return
      gsap.fromTo(card, { autoAlpha: 0, y: 16, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: EASE.settle, clearProps: 'transform' })
      window.setTimeout(function () { dismiss(id) }, 3600)
    }

    function dismiss(id) {
      var index = items.findIndex(function (i) { return i.id === id })
      if (index < 0) return
      var item = items[index]
      items.splice(index, 1)
      layout()
      if (skip()) { item.el.remove(); return }
      gsap.to(item.el.querySelector('.toast'), {
        autoAlpha: 0, y: 8, scale: 0.96, duration: 0.2, ease: EASE.exit,
        onComplete: function () { item.el.remove() },
      })
    }

    host.addEventListener('pointerenter', function () { host.classList.add('is-expanded') })
    host.addEventListener('pointerleave', function () { host.classList.remove('is-expanded') })
    document.querySelector('[data-toast="ok"]').addEventListener('click', function () { push('ok', '菜单已更新') })
    document.querySelector('[data-toast="info"]').addEventListener('click', function () { push('info', '已复制到剪贴板') })
    document.querySelector('[data-toast="danger"]').addEventListener('click', function () { push('danger', '部门保存失败') })
    ready('toast')
  })

  /* ── 08 读数与刻度环 ─────────────────────────────────── */
  safe('readout', function () {
    var odo = document.getElementById('odo')
    function render(value) {
      var text = Number(value).toLocaleString('en-US')
      var chars = text.split('')
      var dot = chars.indexOf('.')
      odo.setAttribute('aria-label', text)
      odo.innerHTML = chars.map(function (ch, i) {
        var key = chars.length - i
        var digit = /\d/.test(ch) ? Number(ch) : null
        var fraction = dot !== -1 && i > dot
        if (digit === null) return '<span class="odo-cell is-sep">' + ch + '</span>'
        var strip = ''
        for (var n = 0; n < 10; n += 1) strip += '<span>' + n + '</span>'
        return '<span class="odo-cell' + (fraction ? ' is-fraction' : '') + '">' +
          '<span class="odo-strip" data-digit="' + digit + '" style="transform:translateY(0);transition-delay:' + ((key % 6) * 40) + 'ms">' + strip + '</span></span>'
      }).join('')
      // 首帧画 0，下一帧再滚到目标值，才有滚动过程
      requestAnimationFrame(function () {
        odo.querySelectorAll('.odo-strip').forEach(function (el) {
          el.style.transform = 'translateY(' + (-Number(el.dataset.digit) * 10) + '%)'
        })
      })
    }
    var value = 1284
    render(value)
    document.querySelector('[data-odo]').addEventListener('click', function () {
      value = Math.floor(400 + Math.random() * 9000)
      render(value)
    })
    ready('odometer')

    var ring = document.getElementById('ring')
    var svg = ring.querySelector('svg')
    var TICKS = 60
    var lit = 49
    var marks = ''
    for (var i = 0; i < TICKS; i += 1) {
      var a = (i / TICKS) * Math.PI * 2 - Math.PI / 2
      var major = i % 5 === 0
      var inner = major ? 0.37 : 0.4
      marks += '<line class="ring-tick' + (major ? ' is-major' : '') + (i < lit ? ' is-on' : '') + '"' +
        ' x1="' + (0.5 + Math.cos(a) * inner) + '" y1="' + (0.5 + Math.sin(a) * inner) + '"' +
        ' x2="' + (0.5 + Math.cos(a) * 0.48) + '" y2="' + (0.5 + Math.sin(a) * 0.48) + '" />'
    }
    var capAngle = ((lit - 0.5) / TICKS) * Math.PI * 2 - Math.PI / 2
    marks += '<circle class="ring-cap" cx="' + (0.5 + Math.cos(capAngle) * 0.53) + '" cy="' + (0.5 + Math.sin(capAngle) * 0.53) + '" r="0.022" />'
    svg.innerHTML = marks

    function playRing() {
      if (skip()) return
      var on = svg.querySelectorAll('.ring-tick.is-on')
      var cap = svg.querySelector('.ring-cap')
      var tl = gsap.timeline()
      tl.fromTo(on, { opacity: 0.15 }, { opacity: 1, duration: 0.28, ease: 'power1.out', stagger: { each: 0.014, from: 'start' }, clearProps: 'opacity' })
      if (cap) tl.fromTo(cap, { scale: 0.2, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: EASE.settle, clearProps: 'transform' }, '-=0.1')
    }
    playRing()
    document.querySelector('[data-ring]').addEventListener('click', playRing)
    ready('ring')
  })

  /* ── 09 图表：描绘、形变、柱子 ──────────────────────── */
  safe('chart', function () {
    var line = document.getElementById('line')
    var area = document.getElementById('area')
    var pulse = document.getElementById('pulse-dot')
    var W = 560, H = 180, PAD = 16
    var A = [12, 18, 15, 26, 22, 34, 30, 42, 38, 52, 47, 61]
    var B = [30, 24, 33, 28, 40, 36, 44, 38, 47, 41, 52, 45]
    var shown = []

    function toPoints(values) {
      var max = Math.max.apply(null, values) * 1.15 || 1
      return values.map(function (v, i) {
        return {
          x: PAD + (i / (values.length - 1)) * (W - PAD * 2),
          y: H - PAD - (v / max) * (H - PAD * 2),
        }
      })
    }
    function smooth(points) {
      if (!points.length) return ''
      var d = 'M' + points[0].x + ',' + points[0].y
      for (var i = 1; i < points.length; i += 1) {
        var p = points[i - 1], c = points[i], mx = (p.x + c.x) / 2
        d += ' C' + mx + ',' + p.y + ' ' + mx + ',' + c.y + ' ' + c.x + ',' + c.y
      }
      return d
    }
    function write(points) {
      line.setAttribute('d', smooth(points))
      area.setAttribute('d', smooth(points) + ' L' + points[points.length - 1].x + ',' + (H - PAD) + ' L' + points[0].x + ',' + (H - PAD) + ' Z')
    }
    function resample(from, n) {
      if (!from.length) return toPoints(new Array(n).fill(0))
      return Array.from({ length: n }, function (_, i) {
        var pos = (i / (n - 1)) * (from.length - 1)
        var a = from[Math.floor(pos)], b = from[Math.min(from.length - 1, Math.ceil(pos))]
        var t = pos - Math.floor(pos)
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      })
    }
    function drawFirst(points) {
      var len = line.getTotalLength()
      gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: EASE.swap, clearProps: 'strokeDasharray,strokeDashoffset' })
      gsap.fromTo(area, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, delay: 0.5, ease: 'power1.out' })
    }
    function morphTo(values, first) {
      var to = toPoints(values)
      if (first || skip()) { shown = to; write(shown); return }
      var from = resample(shown, to.length)
      var state = { t: 0 }
      gsap.to(state, {
        t: 1, duration: 0.72, ease: EASE.swap,
        onUpdate: function () {
          shown = to.map(function (p, i) {
            return { x: from[i].x + (p.x - from[i].x) * state.t, y: from[i].y + (p.y - from[i].y) * state.t }
          })
          write(shown)
        },
      })
    }

    morphTo(A, true)
    requestAnimationFrame(function () { if (!skip()) drawFirst() })

    document.querySelectorAll('[data-line]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.line
        if (key === 'replay') {
          line.style.visibility = 'visible'
          var len = line.getTotalLength()
          gsap.fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, ease: EASE.swap, clearProps: 'strokeDasharray,strokeDashoffset' })
          return
        }
        morphTo(key === 'a' ? A : B, false)
      })
    })

    // 脉冲沿路径跑（导 Conduct）
    if (!skip()) {
      var t = 0
      gsap.ticker.add(function (time, delta) {
        t += Math.min(1 / 30, delta / 1000)
        var len = line.getTotalLength()
        if (!len) return
        var u = (t * 0.3) % 1
        var pt = line.getPointAtLength(len * u)
        pulse.setAttribute('cx', pt.x)
        pulse.setAttribute('cy', pt.y)
        pulse.style.opacity = String(Math.sin(u * Math.PI))
      })
    }
    ready('line')

    var bars = document.getElementById('bars')
    var values = [42, 58, 36, 74, 51, 66, 88]
    bars.innerHTML = values.map(function (v, i) {
      return '<span class="bar-slot"><span class="bar-col' + (i === values.length - 1 ? ' is-highlight' : '') + '" style="height:' + v + '%"></span></span>'
    }).join('')
    function grow() {
      var cols = bars.querySelectorAll('.bar-col')
      if (skip()) return
      gsap.fromTo(cols, { scaleY: 0 }, { scaleY: 1, duration: 0.8, ease: EASE.settle, stagger: { each: 0.05, from: 'start' }, clearProps: 'transform' })
    }
    grow()
    document.querySelector('[data-bars]').addEventListener('click', grow)
    ready('bars')
  })

  /* ── 10 文字逐行 + 对勾 ─────────────────────────────── */
  safe('text', function () {
    var lines = document.querySelectorAll('.lines .line')
    function playLines() {
      if (skip()) return
      gsap.fromTo(lines, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE.reveal, stagger: 0.08, clearProps: 'opacity,visibility,transform' })
    }
    playLines()
    document.querySelector('[data-lines]').addEventListener('click', playLines)
    ready('lines')

    var orb = document.querySelector('.check-orb')
    var ring = orb.querySelector('.check-ring')
    var path = orb.querySelector('.check-path')
    function playCheck() {
      if (skip()) return
      var tl = gsap.timeline()
      tl.fromTo(ring, { strokeDashoffset: 126 }, { strokeDashoffset: 0, duration: 0.5, ease: EASE.reveal })
        .fromTo(path, { strokeDashoffset: 24 }, { strokeDashoffset: 0, duration: 0.32, ease: EASE.settle }, '-=0.22')
        .to(orb, { scale: 1.06, duration: 0.16, ease: 'power1.out' })
        .to(orb, { scale: 1, duration: 0.3, ease: EASE.settle })
    }
    orb.addEventListener('click', playCheck)
    ready('check')
  })

  /* ── 11 卡片级联 ────────────────────────────────────── */
  safe('stagger', function () {
    var grid = document.getElementById('grid-demo')
    var tiles = grid.querySelectorAll('.tile')
    function play() {
      if (skip()) return
      gsap.fromTo(tiles, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.72, ease: EASE.reveal, stagger: { each: 0.045, from: 'center' }, clearProps: 'opacity,visibility,transform' })
    }
    play()
    document.querySelector('[data-stagger]').addEventListener('click', play)
    ready('stagger')
  })

  /* ── 12 骨架与行级联 ────────────────────────────────── */
  safe('table', function () {
    var table = document.getElementById('table-demo')
    var names = ['张明', '李静', '王强', '陈曦', '刘芳', '周宇']
    var signature = ''

    function skeleton() {
      var rows = ''
      for (var i = 1; i <= 6; i += 1) {
        var cells = ''
        for (var c = 0; c < 4; c += 1) {
          cells += '<span class="t-cell skeleton" style="width:' + (36 + ((i * 7 + c * 13) % 48)) + '%;flex:' + (c === 0 ? 2 : 1) + '"></span>'
        }
        rows += '<div class="t-row">' + cells + '</div>'
      }
      table.innerHTML = rows
    }

    function fill() {
      var next = names.join(',')
      var rows = names.map(function (name, i) {
        return '<div class="t-row"><span class="t-text">' + name + '</span>' +
          '<span class="t-text" style="flex:1;color:var(--ink-soft)">研发中心</span>' +
          '<span class="t-text tnum" style="flex:0 0 90px;text-align:right">' + (10 + i * 3) + ' 次</span></div>'
      }).join('')
      table.innerHTML = rows
      if (next === signature) return
      signature = next
      if (skip()) return
      gsap.fromTo(table.querySelectorAll('.t-row'), { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.reveal, stagger: { each: 0.025, from: 'start' }, clearProps: 'opacity,visibility,transform' })
    }

    function load() {
      skeleton()
      window.setTimeout(fill, skip() ? 0 : 900)
    }
    load()
    document.querySelector('[data-table]').addEventListener('click', load)
    ready('table')
  })

  /* ── 13 FLIP 重排 ───────────────────────────────────── */
  safe('flip', function () {
    var grid = document.getElementById('flip-grid')
    var labels = ['菜单', '部门', '角色', '用户', '字典', '参数']
    grid.innerHTML = labels.map(function (l) { return '<div class="flip-card">' + l + '</div>' }).join('')
    document.querySelector('[data-flip]').addEventListener('click', function () {
      var cards = Array.prototype.slice.call(grid.querySelectorAll('.flip-card'))
      var shuffled = cards.slice().sort(function () { return Math.random() - 0.5 })
      if (skip() || !window.Flip) {
        shuffled.forEach(function (c) { grid.appendChild(c) })
        return
      }
      var state = window.Flip.getState(cards)
      shuffled.forEach(function (c) { grid.appendChild(c) })
      window.Flip.from(state, { duration: 0.62, ease: EASE.glide, absolute: false, nested: true, prune: true, simple: true })
    })
    ready('flip')
  })

  /* ── 14 弹簧追随 ────────────────────────────────────── */
  safe('spring', function () {
    var stage = document.getElementById('spring-stage')
    var puck = document.getElementById('puck')
    var target = document.getElementById('spring-target')
    var state = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
    var box = null
    var running = false
    var visible = true

    function place(el, x, y) { el.style.transform = 'translate(' + x + 'px,' + y + 'px)' }

    function tick(time, delta) {
      if (!running || !visible || document.hidden) return
      var dt = Math.min(1 / 30, delta / 1000)
      var k = 70, c = 2 * Math.sqrt(k)
      state.vx += (-k * (state.x - state.tx) - c * state.vx) * dt
      state.vy += (-k * (state.y - state.ty) - c * state.vy) * dt
      state.x += state.vx * dt
      state.y += state.vy * dt
      place(puck, state.x, state.y)
    }

    stage.addEventListener('pointermove', function (event) {
      box = stage.getBoundingClientRect()
      state.tx = event.clientX - box.left
      state.ty = event.clientY - box.top
      place(target, state.tx, state.ty)
    })
    stage.addEventListener('pointerleave', function () {
      state.tx = stage.clientWidth / 2
      state.ty = stage.clientHeight / 2
      place(target, state.tx, state.ty)
    })

    box = stage.getBoundingClientRect()
    state.x = state.tx = stage.clientWidth / 2
    state.y = state.ty = stage.clientHeight / 2
    place(puck, state.x, state.y)
    place(target, state.tx, state.ty)

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting }).observe(stage)
    }
    if (skip()) return
    running = true
    gsap.ticker.add(tick)
    ready('spring')
  })

  /* ── 15 数据看板：数字 · 柱条 · 折线 · 环图 · 错峰 ──── */
  safe('dashboard', function () {
    var dash = document.getElementById('dash')
    if (!dash) return

    var formatters = {}
    function fmt(value, decimals) {
      var key = String(decimals)
      if (!formatters[key]) {
        formatters[key] = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      }
      return formatters[key].format(value)
    }

    /* 渠道对比：--ratio 驱动，入场与刷新共用一条通道 */
    var CHANNELS = [
      { label: '视频号', value: 82.4, ratio: 0.82 },
      { label: '抖音', value: 64.2, ratio: 0.64 },
      { label: '小红书', value: 41.8, ratio: 0.42 },
      { label: 'B 站', value: 27.5, ratio: 0.28 },
      { label: '公众号', value: 15.4, ratio: 0.15 },
    ]
    var hbars = document.getElementById('hbars')
    hbars.innerHTML = CHANNELS.map(function (c) {
      return '<div class="hbar" data-ratio="' + c.ratio + '">' +
        '<span class="hbar-label">' + c.label + '</span>' +
        '<span class="hbar-track"><span class="hbar-fill"></span></span>' +
        '<span class="hbar-value">' + c.value.toFixed(1) + ' 万</span></div>'
    }).join('')

    /* 环图：段按顺序展开，中心总量同步滚到 100 */
    var SHARES = [
      { label: '视频号', value: 42 },
      { label: '抖音', value: 28 },
      { label: '小红书', value: 18 },
      { label: '其他', value: 12 },
    ]
    var RADIUS = 54
    var C = 2 * Math.PI * RADIUS
    var donut = document.getElementById('donut')
    var donutSvg = donut.querySelector('svg')
    SHARES.forEach(function (share, i) {
      var seg = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      seg.setAttribute('class', 'donut-seg')
      seg.setAttribute('cx', '70')
      seg.setAttribute('cy', '70')
      seg.setAttribute('r', String(RADIUS))
      seg.style.stroke = 'var(--cat-' + (i + 1) + ')'
      seg.style.strokeDasharray = '0 ' + C
      donutSvg.appendChild(seg)
    })
    var segments = Array.prototype.slice.call(donutSvg.querySelectorAll('.donut-seg'))
    var legendItems = Array.prototype.slice.call(document.querySelectorAll('#donut-legend li'))
    document.getElementById('donut-legend').innerHTML = SHARES.map(function (share, i) {
      return '<li><i style="background:var(--cat-' + (i + 1) + ')"></i>' + share.label + '<b>' + share.value + '%</b></li>'
    }).join('')
    legendItems = Array.prototype.slice.call(document.querySelectorAll('#donut-legend li'))

    /* 折线：pathLength=1 归一化，描画时不用量长度 */
    var TREND = [12, 18, 15, 26, 22, 34, 30, 42, 38, 52, 47, 61]
    var W = 560, H = 180, PAD = 16
    var lineEl = dash.querySelector('.trend-line')
    var areaEl = dash.querySelector('.trend-area')
    var dotEl = dash.querySelector('.trend-dot')
    function trendPath(values) {
      var peak = 70
      var points = values.map(function (v, i) {
        return {
          x: PAD + (i / (values.length - 1)) * (W - PAD * 2),
          y: H - PAD - (v / peak) * (H - PAD * 2),
        }
      })
      var d = 'M' + points[0].x.toFixed(2) + ',' + points[0].y.toFixed(2)
      for (var i = 1; i < points.length; i += 1) {
        var p = points[i - 1], c = points[i], mx = ((p.x + c.x) / 2).toFixed(2)
        d += ' C' + mx + ',' + p.y.toFixed(2) + ' ' + mx + ',' + c.y.toFixed(2) + ' ' + c.x.toFixed(2) + ',' + c.y.toFixed(2)
      }
      return d
    }
    var trendD = trendPath(TREND)
    lineEl.setAttribute('d', trendD)
    areaEl.setAttribute('d', trendD + ' L544,164 L16,164 Z')
    var endPoint = lineEl.getPointAtLength(lineEl.getTotalLength())
    gsap.set(dotEl, { attr: { cx: endPoint.x, cy: endPoint.y } })

    /* 明细 */
    document.getElementById('mini-rows').innerHTML = [
      { name: '品牌短片 A', channel: '视频号', value: '412 万' },
      { name: '新品开箱', channel: '抖音', value: '286 万' },
      { name: '秋季穿搭', channel: '小红书', value: '164 万' },
    ].map(function (row) {
      return '<div class="mini-row"><span>' + row.name + '</span><span>' + row.channel + '</span><b>' + row.value + '</b></div>'
    }).join('')

    var kpiCards = Array.prototype.slice.call(dash.querySelectorAll('[data-kpi]'))
    var bars = Array.prototype.slice.call(hbars.querySelectorAll('.hbar'))
    var layerGroups = [
      { sel: '[data-layer="metrics"] > *', at: 0, each: 0.045, dur: 0.56 },
      { sel: '[data-layer="charts"] > *', at: 0.12, each: 0.05, dur: 0.62 },
      { sel: '[data-layer="detail"] > *', at: 0.24, each: 0.025, dur: 0.5 },
    ].map(function (layer) {
      return Object.assign({}, layer, { items: Array.prototype.slice.call(dash.querySelectorAll(layer.sel)) })
    })

    function resetEntrance() {
      gsap.set(layerGroups.reduce(function (acc, l) { return acc.concat(l.items) }, []), { autoAlpha: 0, y: 18 })
      kpiCards.forEach(function (card) {
        card.querySelector('.kpi-value').textContent = fmt(0, Number(card.dataset.decimals || 0))
      })
      bars.forEach(function (row) {
        row.style.setProperty('--ratio', '0')
        row.classList.remove('is-highlight')
        gsap.set(row.querySelector('.hbar-value'), { autoAlpha: 0, x: 6 })
      })
      segments.forEach(function (seg) { seg.style.strokeDasharray = '0 ' + C })
      donut.querySelector('.donut-total').textContent = '0'
      gsap.set(legendItems, { autoAlpha: 0, y: 6 })
      gsap.set([areaEl], { autoAlpha: 0 })
      gsap.set(lineEl, { strokeDasharray: 1, strokeDashoffset: 1 })
      gsap.set(dotEl, { scale: 0, transformOrigin: '50% 50%' })
    }

    function runEntrance() {
      resetEntrance()
      if (skip()) {
        gsap.set(layerGroups.reduce(function (acc, l) { return acc.concat(l.items) }, []), { autoAlpha: 1, y: 0 })
        kpiCards.forEach(function (card) {
          card.querySelector('.kpi-value').textContent = fmt(Number(card.dataset.value), Number(card.dataset.decimals || 0))
        })
        bars.forEach(function (row) {
          row.style.setProperty('--ratio', row.dataset.ratio)
          gsap.set(row.querySelector('.hbar-value'), { autoAlpha: 1, x: 0 })
        })
        segments.forEach(function (seg, i) { seg.style.strokeDasharray = ((SHARES[i].value / 100) * C) + ' ' + C })
        donut.querySelector('.donut-total').textContent = '100'
        gsap.set(legendItems, { autoAlpha: 1, y: 0 })
        gsap.set([lineEl, areaEl, dotEl], { clearProps: 'all', autoAlpha: 1 })
        return
      }

      var tl = gsap.timeline()
      // 1. 面板错峰：指标 → 图表 → 明细
      layerGroups.forEach(function (layer) {
        if (!layer.items.length) return
        tl.to(layer.items, {
          autoAlpha: 1, y: 0, duration: layer.dur, ease: EASE.reveal,
          stagger: { each: layer.each, from: 'start' }, clearProps: 'opacity,visibility,transform',
        }, layer.at)
      })
      // 2. 数字：0 → 目标值，卡片错开 0.08s
      kpiCards.forEach(function (card, i) {
        var el = card.querySelector('.kpi-value')
        var to = Number(card.dataset.value)
        var dec = Number(card.dataset.decimals || 0)
        var state = { v: 0 }
        tl.to(state, {
          v: to, duration: 1.1, ease: EASE.reveal, snap: { v: 1 / Math.pow(10, dec) },
          onUpdate: function () { el.textContent = fmt(state.v, dec) },
          onComplete: function () { el.textContent = fmt(to, dec) },
        }, 0.18 + i * 0.08)
      })
      // 3. 柱条：scaleX 0 → --ratio，数值在各自到位后出现
      bars.forEach(function (row, i) {
        var target = Number(row.dataset.ratio || 0)
        var proxy = { v: 0 }
        var valueEl = row.querySelector('.hbar-value')
        tl.to(proxy, {
          v: target, duration: 0.8, ease: 'power3.out',
          onUpdate: function () { row.style.setProperty('--ratio', proxy.v.toFixed(4)) },
        }, 0.34 + i * 0.06)
        tl.to(valueEl, { autoAlpha: 1, x: 0, duration: 0.24, ease: 'power1.out', clearProps: 'transform' }, 0.34 + i * 0.06 + 0.68)
      })
      tl.call(function () { if (bars[0]) bars[0].classList.add('is-highlight') }, [], 1.02)
      // 4. 折线：从左向右描
      tl.to(lineEl, { strokeDashoffset: 0, duration: 1.1, ease: EASE.swap, clearProps: 'strokeDasharray,strokeDashoffset' }, 0.4)
      tl.to(areaEl, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, 0.9)
      tl.to(dotEl, { scale: 1, duration: 0.4, ease: EASE.settle, clearProps: 'transform' }, 1.32)
      // 5. 环图：段依次展开 + 中心总量同步
      segments.forEach(function (seg, i) {
        var len = (SHARES[i].value / 100) * C
        var proxy = { v: 0 }
        gsap.set(seg, { strokeDashoffset: -((i === 0 ? 0 : SHARES.slice(0, i).reduce(function (a, s) { return a + s.value }, 0)) / 100) * C })
        tl.to(proxy, {
          v: len, duration: 0.42, ease: 'power2.out',
          onUpdate: function () { seg.style.strokeDasharray = proxy.v + ' ' + (C - proxy.v) },
        }, 0.46 + i * 0.36)
      })
      var totalEl = donut.querySelector('.donut-total')
      var totalState = { v: 0 }
      tl.to(totalState, {
        v: 100, duration: 0.9, ease: EASE.reveal,
        onUpdate: function () { totalEl.textContent = String(Math.round(totalState.v)) },
      }, 0.46)
      tl.to(legendItems, { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power1.out', stagger: 0.04, clearProps: 'transform' }, 1.4)
      return tl
    }

    // 只播一次：首次进入视口时（线上同理，用 sessionStorage 或组件标记）
    var played = false
    function playOnce() {
      if (played) return
      played = true
      runEntrance()
    }
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { playOnce(); io.disconnect() }
      }, { threshold: 0.15 })
      io.observe(dash)
    } else {
      playOnce()
    }
    document.querySelector('[data-dash-replay]').addEventListener('click', function () {
      played = true
      runEntrance()
    })
    window.__motionDash = { play: runEntrance }
    ready('dashboard')
  })

  /* ── 16 数据更新：旧值 → 新值，不重播入场 ──────────── */
  safe('refresh', function () {
    var card = document.getElementById('refresh-card')
    var barsRoot = document.getElementById('refresh-bars')
    var hint = document.getElementById('refresh-hint')
    if (!card) return

    var ROWS = [
      { label: '视频号', value: 82.4, ratio: 0.82 },
      { label: '抖音', value: 64.2, ratio: 0.64 },
      { label: '小红书', value: 41.8, ratio: 0.42 },
    ]
    barsRoot.innerHTML = ROWS.map(function (row) {
      return '<div class="hbar" data-ratio="' + row.ratio + '">' +
        '<span class="hbar-label">' + row.label + '</span>' +
        '<span class="hbar-track"><span class="hbar-fill"></span></span>' +
        '<span class="hbar-value">' + row.value.toFixed(1) + ' 万</span></div>'
    }).join('')
    var rows = Array.prototype.slice.call(barsRoot.querySelectorAll('.hbar'))
    rows.forEach(function (row) {
      row.style.setProperty('--ratio', row.dataset.ratio)
    })

    var formatters = {}
    function fmt(value, decimals) {
      var key = String(decimals)
      if (!formatters[key]) {
        formatters[key] = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      }
      return formatters[key].format(value)
    }

    function flash(block) {
      var layer = block.querySelector('.kpi-flash')
      if (!layer) return null
      return gsap.timeline()
        .fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' })
        .to(layer, { opacity: 0, duration: 0.72, ease: EASE.swap })
    }

    function refresh() {
      var tl = gsap.timeline()
      var changed = 0
      var instant = skip()      // 减少动效：直接落终值，不做过渡

      // 1. 读数与柱子：同一个 state 推进，保证"数字到了柱子也到了"
      card.querySelectorAll('[data-kpi]').forEach(function (block, i) {
        var el = block.querySelector('.kpi-value')
        var dec = Number(block.dataset.decimals || 0)
        var from = Number(block.dataset.value || 0)
        var next = Math.max(1, Math.round((from * (0.82 + Math.random() * 0.4)) * 10) / 10)
        if (next === from) next = from + 1
        block.dataset.value = String(next)
        if (next !== from) changed += 1
        if (instant) { el.textContent = fmt(next, dec); return }
        var state = { v: from }
        tl.to(state, {
          v: next, duration: 0.6, ease: 'power2.out', snap: { v: 1 / Math.pow(10, dec) },
          onUpdate: function () { el.textContent = fmt(state.v, dec) },
          onComplete: function () { el.textContent = fmt(next, dec) },
        }, i * 0.04)
        // 只闪"真的变了"的块
        if (next !== from) {
          var flashTl = flash(block)
          if (flashTl) tl.add(flashTl, 0)
        }
      })

      rows.forEach(function (row, i) {
        var valueEl = row.querySelector('.hbar-value')
        var fromRatio = Number(row.dataset.ratio || 0)
        var nextRatio = Math.max(0.08, Math.min(0.98, fromRatio * (0.75 + Math.random() * 0.5)))
        var nextValue = Math.round(nextRatio * 100 * 10) / 10
        row.dataset.ratio = String(nextRatio)
        var state = { r: fromRatio, v: nextValue }
        if (Math.abs(nextRatio - fromRatio) > 0.002) changed += 1
        if (instant) {
          row.style.setProperty('--ratio', nextRatio.toFixed(4))
          valueEl.textContent = nextValue.toFixed(1) + ' 万'
          return
        }
        gsap.set(valueEl, { autoAlpha: 1 })
        tl.to(state, {
          r: nextRatio, v: nextValue, duration: 0.6, ease: 'power2.out',
          onUpdate: function () {
            row.style.setProperty('--ratio', state.r.toFixed(4))
            valueEl.textContent = state.v.toFixed(1) + ' 万'
          },
        }, i * 0.04)
      })

      // 2. 提示：只说明"变了多少"，不重播入场
      if (hint) hint.textContent = '已更新 ' + changed + ' 处：数字与柱子同步过渡，未变化的部分没有动。'
      return tl
    }

    document.querySelector('[data-refresh]').addEventListener('click', refresh)
    ready('refresh')
  })

  /* ── 主题切换（令牌驱动，不需要重建动画） ────────────── */
  var themeBtn = document.getElementById('theme')
  themeBtn.addEventListener('click', function () {
    var dark = document.documentElement.dataset.theme === 'dark'
    document.documentElement.dataset.theme = dark ? 'light' : 'dark'
    themeBtn.textContent = dark ? '切换深色' : '切换浅色'
  })

  /* ── 就绪标记（便于自动化验证） ──────────────────────── */
  document.documentElement.dataset.demoReady = String(blocks.length)
  document.documentElement.dataset.demoBlocks = blocks.join(',')
})()
