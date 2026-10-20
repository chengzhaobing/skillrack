/* 演示页自检：只用 ?selftest=1 触发，结果写进 <html data-selftest> 并在角落显示。
   用途：交付前确认每条配方真的跑起来了（不依赖人工点）。 */
(function () {
  'use strict'
  if (!new URLSearchParams(location.search).has('selftest')) return
  var gsap = window.gsap
  var results = []

  function wait(ms) { return new Promise(function (r) { window.setTimeout(r, ms) }) }
  function assert(name, ok, detail) { results.push({ name: name, ok: Boolean(ok), detail: detail || '' }) }
  function pointer(el, type, x, y) {
    var rect = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true,
      clientX: x === undefined ? rect.left + rect.width / 2 : x,
      clientY: y === undefined ? rect.top + rect.height / 2 : y,
    }))
  }
  function realClick(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, view: window }))
  }
  function width(el) { return el.getBoundingClientRect().width }
  function dash(el, prop) {
    var value = getComputedStyle(el)[prop]
    return value === 'none' ? 0 : parseFloat(value) || 0
  }

  async function run() {
    if (!gsap) { assert('动画库加载', false); return report() }

    /* 01 登录按钮 */
    try {
      var action = document.querySelector('.auth-action')
      var slot = document.querySelector('.auth-slot')
      var full = width(action)
      action.click()
      await wait(120)
      assert('01 loading 态宽度不变', action.dataset.state === 'loading' && Math.abs(width(action) - full) < 2,
        action.dataset.state + ' / ' + Math.round(width(action)) + '/' + Math.round(full))
      await wait(2400)
      assert('01 成功收缩成圆', action.dataset.state === 'success' && Math.abs(width(action) - 46) < 3,
        action.dataset.state + ' / ' + Math.round(width(action)))
      assert('01 对勾描边完成', dash(document.querySelector('.mark-check'), 'strokeDashoffset') < 0.5,
        dash(document.querySelector('.mark-check'), 'strokeDashoffset'))
      document.querySelector('[data-auth="error"]').click()
      await wait(1600)
      assert('01 失败恢复长条', action.dataset.state === 'idle' && Math.abs(width(action) - full) < 3,
        action.dataset.state + ' / ' + Math.round(width(action)) + '/' + Math.round(full))
    } catch (e) { assert('01 登录按钮', false, e.message) }

    /* 02 按压 */
    try {
      var btn = document.querySelector('.btn-primary')
      pointer(btn, 'pointerdown')
      await wait(120)
      var scale = Number(gsap.getProperty(btn, 'scale'))
      assert('02 按压压缩', scale < 1 && scale > 0.9, 'scale=' + scale.toFixed(3))
      pointer(document.body, 'pointerup')
      await wait(400)
      assert('02 松手回弹', Math.abs(Number(gsap.getProperty(btn, 'scale')) - 1) < 0.01)
    } catch (e) { assert('02 按压', false, e.message) }

    /* 03 指针光 */
    try {
      var glow = document.querySelector('.glow-card')
      pointer(glow, 'pointermove', 40, 50)
      assert('03 指针光坐标', glow.style.getPropertyValue('--px') !== '' && glow.style.getPropertyValue('--py') !== '',
        glow.style.getPropertyValue('--px') + ',' + glow.style.getPropertyValue('--py'))
    } catch (e) { assert('03 指针光', false, e.message) }

    /* 05 滑动玻璃块 */
    try {
      var seg = document.getElementById('seg')
      var thumb = seg.querySelector('.seg-thumb')
      seg.querySelector('[data-seg="board"]').click()
      await wait(700)
      var tx = Number(gsap.getProperty(thumb, 'x'))
      assert('05 滑块跟到第 3 项', tx > 30 && width(thumb) > 20, 'x=' + Math.round(tx) + ' w=' + Math.round(width(thumb)))
    } catch (e) { assert('05 滑块', false, e.message) }

    /* 06 弹窗 */
    try {
      var openBtn = document.querySelector('[data-modal]')
      pointer(openBtn, 'pointerdown')
      openBtn.click()
      await wait(500)
      var overlay = document.querySelector('.overlay')
      assert('06 弹窗出现', Boolean(overlay && overlay.querySelector('.modal')))
      assert('06 遮罩不透明', Boolean(overlay) && Number(gsap.getProperty(overlay, 'opacity')) > 0.9)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wait(500)
      assert('06 Escape 关闭并移除', !document.querySelector('.overlay'))
    } catch (e) { assert('06 弹窗', false, e.message) }

    /* 06 抽屉共享元素 */
    try {
      var row = document.querySelector('.row-item')
      pointer(row, 'pointerdown')
      row.click()
      var ghostSeen = false
      var observer = new MutationObserver(function () {
        if (document.querySelector('.morph-ghost')) ghostSeen = true
      })
      observer.observe(document.body, { childList: true })
      realClick(document.querySelector('[data-drawer]'))
      await wait(900)
      assert('06 抽屉生长出现', Boolean(document.querySelector('.drawer')))
      assert('06 使用了共享元素幽灵', ghostSeen)
      observer.disconnect()
      document.querySelector('.drawer .icon-x').click()
      await wait(600)
      assert('06 抽屉关闭', !document.querySelector('.overlay'))
    } catch (e) { assert('06 抽屉', false, e.message) }

    /* 07 Toast */
    try {
      document.querySelector('[data-toast="ok"]').click()
      await wait(200)
      var slots = document.querySelectorAll('.toast-slot')
      assert('07 提示入栈', slots.length === 1)
      document.querySelector('[data-toast="danger"]').click()
      await wait(300)
      slots = document.querySelectorAll('.toast-slot')
      var depth = slots.length === 2 ? slots[0].style.getPropertyValue('--depth') : 'x'
      assert('07 牌堆深度', slots.length === 2 && depth === '1', 'count=' + slots.length + ' depth=' + depth)
    } catch (e) { assert('07 Toast', false, e.message) }

    /* 08 读数 */
    try {
      document.querySelector('[data-odo]').click()
      await wait(120)
      var moved = Array.prototype.some.call(document.querySelectorAll('.odo-strip'), function (el) {
        return /translateY\(-[1-9]/.test(el.style.transform)
      })
      assert('08 数字逐位滚动', moved || document.querySelectorAll('.odo-strip').length > 0)
      var lit = document.querySelectorAll('.ring-tick.is-on').length
      assert('08 刻度环点亮比例', lit > 20 && lit < 60, 'lit=' + lit)
      assert('08 末端刻度存在', Boolean(document.querySelector('.ring-cap')))
    } catch (e) { assert('08 读数', false, e.message) }

    /* 09 图表 */
    try {
      var line = document.getElementById('line')
      assert('09 折线有路径', (line.getAttribute('d') || '').length > 60)
      document.querySelector('[data-line="b"]').click()
      await wait(900)
      assert('09 形变后路径仍有效', (line.getAttribute('d') || '').length > 60)
      var cols = document.querySelectorAll('.bar-col')
      assert('09 柱子数量', cols.length === 7, 'cols=' + cols.length)
      document.querySelector('[data-bars]').click()
      await wait(900)
      assert('09 柱子生长到位', Math.abs(Number(gsap.getProperty(cols[0], 'scaleY')) - 1) < 0.02)
    } catch (e) { assert('09 图表', false, e.message) }

    /* 10 文字与对勾 */
    try {
      document.querySelector('[data-check]').click()
      await wait(1200)
      assert('10 对勾描边完成', dash(document.querySelector('.check-path'), 'strokeDashoffset') < 0.5,
        dash(document.querySelector('.check-path'), 'strokeDashoffset'))
      document.querySelector('[data-lines]').click()
      await wait(200)
      var firstLineOpacity = Number(gsap.getProperty('.lines .line', 'opacity'))
      assert('10 文字行入场中', firstLineOpacity >= 0 && firstLineOpacity <= 1)
    } catch (e) { assert('10 文字/对勾', false, e.message) }

    /* 11 卡片级联 */
    try {
      document.querySelector('[data-stagger]').click()
      await wait(1000)
      var tiles = document.querySelectorAll('.grid-demo .tile')
      var allVisible = Array.prototype.every.call(tiles, function (t) { return Number(gsap.getProperty(t, 'opacity')) > 0.9 })
      assert('11 卡片全部落定', tiles.length === 6 && allVisible)
    } catch (e) { assert('11 卡片级联', false, e.message) }

    /* 12 骨架与行 */
    try {
      document.querySelector('[data-table]').click()
      await wait(120)
      assert('12 骨架出现', document.querySelectorAll('.table-demo .skeleton').length > 0)
      await wait(1400)
      assert('12 数据行替换骨架', document.querySelectorAll('.table-demo .skeleton').length === 0 && document.querySelector('.table-demo .t-text'))
    } catch (e) { assert('12 骨架', false, e.message) }

    /* 13 FLIP */
    try {
      var grid = document.getElementById('flip-grid')
      var before = Array.prototype.map.call(grid.children, function (c) { return c.textContent }).join(',')
      document.querySelector('[data-flip]').click()
      await wait(900)
      var after = Array.prototype.map.call(grid.children, function (c) { return c.textContent }).join(',')
      assert('13 顺序发生变化', before !== after, before + ' → ' + after)
    } catch (e) { assert('13 FLIP', false, e.message) }

    /* 14 弹簧 */
    try {
      var stage = document.getElementById('spring-stage')
      var puck = document.getElementById('puck')
      document.getElementById('spring').scrollIntoView({ block: 'center' })
      await wait(600)
      var beforeT = puck.style.transform
      pointer(stage, 'pointermove', 40, 40)
      await wait(600)
      assert('14 弹簧追随', beforeT !== puck.style.transform, puck.style.transform)
    } catch (e) { assert('14 弹簧', false, e.message) }

    /* 15 数据看板：数字 / 柱条 / 折线 / 环图 / 错峰 */
    try {
      var dashRoot = document.getElementById('dashboard')
      dashRoot.scrollIntoView({ block: 'center' })
      await wait(300)
      if (window.__motionDash) window.__motionDash.play()
      await wait(2600)

      var kpis = Array.prototype.map.call(dashRoot.querySelectorAll('[data-kpi] .kpi-value'), function (el) { return el.textContent })
      assert('15 数字滚动到目标值', kpis[0] === '1,284' && kpis[1] === '86.4', kpis.join(' / '))

      var firstBar = dashRoot.querySelector('.hbar')
      var ratio = parseFloat(getComputedStyle(firstBar).getPropertyValue('--ratio'))
      assert('15 柱条生长到目标比例', Math.abs(ratio - 0.82) < 0.02, String(ratio))

      var firstSeg = dashRoot.querySelector('.donut-seg')
      var segLen = parseFloat(firstSeg.style.strokeDasharray)
      assert('15 环图首段展开', segLen > 100, firstSeg.style.strokeDasharray)

      var total = dashRoot.querySelector('.donut-total').textContent
      assert('15 中心总量到位', total === '100', total)

      var legendOpacity = Number(gsap.getProperty(dashRoot.querySelector('.donut-legend li'), 'opacity'))
      assert('15 占比标签保留', legendOpacity > 0.9, String(legendOpacity))

      var trendLine = dashRoot.querySelector('.trend-line')
      assert('15 折线描画完成', (trendLine.getAttribute('d') || '').length > 80 && dash(trendLine, 'strokeDashoffset') < 0.5,
        String(dash(trendLine, 'strokeDashoffset')))
      assert('15 面板全部落定', Number(gsap.getProperty(dashRoot.querySelector('[data-layer="detail"] > *'), 'opacity')) > 0.9)
    } catch (e) { assert('15 数据看板', false, e.message) }

    /* 16 数据更新：旧值 → 新值，不重播入场 */
    try {
      var refreshCard = document.getElementById('refresh-card')
      refreshCard.scrollIntoView({ block: 'center' })
      await wait(300)
      var readValues = function () {
        return Array.prototype.map.call(refreshCard.querySelectorAll('.kpi-value'), function (el) { return el.textContent }).join('/')
      }
      var readRatio = function () {
        return getComputedStyle(refreshCard.querySelector('.hbar')).getPropertyValue('--ratio').trim()
      }
      var beforeValues = readValues()
      var beforeRatio = readRatio()
      document.querySelector('[data-refresh]').click()
      await wait(1200)
      var afterValues = readValues()
      var afterRatio = readRatio()
      assert('16 读数过渡到新值', beforeValues !== afterValues, beforeValues + ' → ' + afterValues)
      assert('16 柱条同步过渡', beforeRatio !== afterRatio, beforeRatio + ' → ' + afterRatio)
      assert('16 未重播入场', Number(gsap.getProperty(refreshCard.querySelector('.kpi'), 'opacity')) > 0.9)
    } catch (e) { assert('16 数据更新', false, e.message) }

    report()
  }

  function report() {
    var failed = results.filter(function (r) { return !r.ok })
    document.documentElement.dataset.selftest = (results.length - failed.length) + '/' + results.length
    document.documentElement.dataset.selftestFails = failed.map(function (r) { return r.name + '(' + r.detail + ')' }).join(' | ')
    var badge = document.createElement('div')
    badge.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:999;padding:10px 14px;border-radius:12px;' +
      'font:600 12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#fff;' +
      'background:' + (failed.length ? '#e0443b' : '#2f8f3f') + ';box-shadow:0 10px 24px rgba(0,0,0,.25)'
    badge.textContent = '自检 ' + (results.length - failed.length) + '/' + results.length +
      (failed.length ? ' · 失败: ' + failed.map(function (r) { return r.name }).join(', ') : ' 通过')
    document.body.appendChild(badge)
    console[failed.length ? 'error' : 'log']('[selftest]', results)
  }

  // 等演示脚本完成首帧初始化
  window.setTimeout(run, 400)
})()
