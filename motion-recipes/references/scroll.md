# 滚动驱动效果

本项目目前**没有**使用 ScrollTrigger：页面进场（`pageEnter`）已经把"内容按阅读序出现"做完了，滚动本身只负责一件事——顶栏凝结。所以这个文件分两部分：项目里真实存在的滚动行为（照抄即可），以及需要滚动叙事时的 ScrollTrigger 配方（按项目结构写，注意作用域）。

## 1. 先搞清楚滚动发生在哪

```html
<div class="app-frame">            <!-- height: calc(100dvh - 16px); overflow: clip -->
  <aside class="rail">…</aside>
  <div class="workspace">          <!-- 顶栏 + 内容区 -->
    <header class="topbar">…</header>
    <main class="content">         <!-- ← 真正的滚动容器，overflow-y: auto -->
      <div class="page">…</div>
    </main>
  </div>
</div>
```

三条由此推出的事实：

1. **`window` 不滚动**。ScrollTrigger 默认监听 `window`，在这里必须传 `scroller: '.content'`，否则触发器永远不会动。
2. **外壳是 `overflow: clip`**（为了圆角裁切），`pin` 的 `position: fixed` 会被裁掉/错位。需要 pin 时把 pin 容器移到 `.content` 内部，或临时给 `.content` 加 `overflow: visible`（会丢圆角，慎用）。
3. **页面切换时会 `scrollTo({ top: 0 })`**，任何滚动状态都要在 `@after-leave` 里重置，否则新页面一进来就"已滚动"。

## 2. 顶栏凝结（项目现有做法）

内容滚动超过 8px 时，顶栏下方浮出一层玻璃与一道投影。

```js
function onContentScroll() {
  const next = content.scrollTop > 8
  if (next !== scrolled) scrolled = next      // 只在跨过阈值时改 class
}
```

```css
.topbar::before {
  content: ""; position: absolute; inset: 0; z-index: -1;
  opacity: 0;
  background: var(--rail-bg);
  box-shadow: 0 1px 0 var(--line-strong), 0 10px 26px rgba(0,0,0,.07);
  transition: opacity .3s ease;
}
.workspace.is-scrolled .topbar::before { opacity: 1; }
```

要点：

- 只切一层**静态**玻璃的 `opacity`，绝不补间 `backdrop-filter`（每一帧都要重新栅格化整个区域，是最贵的属性之一）。
- 用阈值 + 状态比较，不要每帧写 class。
- 滚动监听用 `{ passive: true }`。

## 3. 首屏内容：不用 ScrollTrigger 的做法

内容在视口内、只是"进入页面"时出现，用 `pageEnter` 的级联就够（见 `transitions.md`）。判断标准：**首屏能看到的东西用时间轴，滚下去才出现的东西才用 ScrollTrigger。**

## 4. 视口批次显现（ScrollTrigger.batch）

### 效果

卡片/列表项滚入视口时逐条升起，同一批出现的元素按阅读序错开；滚出去不还原（只播一次）。

### 实现

```js
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)

const mm = gsap.matchMedia(content)     // 第三个参数是作用域，选择器文本被它限定

mm.add({
  motionOK: '(prefers-reduced-motion: no-preference) and (min-width: 720px)',
  reduce: '(prefers-reduced-motion: reduce)',
}, (ctx) => {
  const { motionOK } = ctx.conditions
  const items = gsap.utils.toArray('.card', content)

  if (!motionOK) {
    gsap.set(items, { clearProps: 'all' })   // 降级：不做任何位移
    return
  }

  gsap.set(items, { autoAlpha: 0, y: 18 })
  ScrollTrigger.batch(items, {
    scroller: content,                       // ← 项目里必须写
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out',
      stagger: { each: 0.05, from: 'start' }, clearProps: 'transform',
    }),
  })
})
```

注意事项：

- **在 matchMedia 里不要再套 `gsap.context()`**：matchMedia 内部已经建了 context，清理只调 `mm.revert()`。
- `once: true` 是克制：来回滚动反复播放会让页面像"失灵"。
- 只对**首页/落地页**用批量显现。后台列表页已经有 `revealRows`，两者叠加会出现"先消失再出现"的双重动画。
- `start: 'top 88%'` 而不是 `100%`：元素刚触底时还在视口边缘，等它进入 12% 再出现更从容。

## 5. 钉住章节叙事（一页最多一处）

### 效果

左侧一张图/一个画布，右侧三段文案；滚动时图不动（被钉住），文案依次替换，进度条在左侧缓缓推进。

### 结构

```html
<section class="narrative">
  <div class="narrative-stage">…</div>     <!-- 会被 pin -->
  <div class="narrative-steps">
    <article data-step="1">…</article>
    <article data-step="2">…</article>
    <article data-step="3">…</article>
  </div>
</section>
```

### 实现

```js
mm.add('(prefers-reduced-motion: no-preference) and (min-width: 960px)', () => {
  const stage = document.querySelector('.narrative-stage')
  const steps = gsap.utils.toArray('.narrative-steps article')
  const section = document.querySelector('.narrative')

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      scroller: '.content',        // 项目结构决定
      start: 'top top',
      end: () => `+=${window.innerHeight * (steps.length - 1)}`,
      pin: stage,
      pinSpacing: false,           // 由右栏高度撑开，避免双重留白
      scrub: 0.6,                  // 0.6s 追赶：比 true 顺滑，比 0 跟手
      invalidateOnRefresh: true,
    },
  })

  steps.forEach((step, i) => {
    if (i === 0) return
    tl.fromTo(step, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' }, i)
      .to(steps[i - 1], { autoAlpha: 0.25, duration: 1 }, i)   // 上一步退成"已读"
  })
  // 只动 transform / opacity：scrub 每帧都在跑，动布局属性会明显掉帧
})
```

要点：

- `scrub: 0.6`（数字）比 `scrub: true` 更自然：数字是"追赶时间"，让滚动有阻尼感。
- `end` 用函数返回，配合 `invalidateOnRefresh: true`，窗口尺寸变化后重新计算。
- `pinSpacing: false` 只在右栏本身有足够高度时用；否则会出现内容重叠。
- 项目里 `overflow: clip` 的外壳会让 pin 失效：这种情况下改用"sticky + 进度"方案——`position: sticky; top: 0` 的舞台 + `IntersectionObserver`/`onUpdate` 驱动的步骤切换，不依赖 ScrollTrigger 的 pin。
- 一页最多一处钉住。两处以上，用户会失去"我在哪"的感觉。

## 6. 滚动进度与章节刻度

```js
gsap.to('.read-progress', {
  scaleX: 1, transformOrigin: '0 50%', ease: 'none',
  scrollTrigger: { trigger: '.page', scroller: '.content', start: 'top top', end: 'bottom bottom', scrub: 0.3 },
})
```

- 进度条用 `scaleX`，不要用 `width`（每帧布局）。
- 章节刻度（右侧小圆点）用 `toggleClass` / `onToggle` 切状态，不要为每个点建补间。

## 7. 横向 storytelling（谨慎使用）

横向滚动在后台系统里几乎没有正当理由，只在营销页/引导页用。

```js
const panels = gsap.utils.toArray('.panel')
gsap.to('.track', {
  xPercent: -100 * (panels.length - 1),
  ease: 'none',
  scrollTrigger: {
    trigger: '.h-scroll', scroller: '.content',
    pin: true, scrub: 1,
    end: () => `+=${document.querySelector('.track').offsetWidth}`,
  },
})
```

- 必须给键盘用户留出路：横向滚动期间 Tab 到不可见内容会让人迷失，给"下一节"按钮或把内容改成纵向堆叠（窄屏强制纵向）。
- 移动端（`max-width: 760px`）直接退回纵向，不要保留横向。

## 8. 性能与清理清单

| 项 | 做法 |
| --- | --- |
| 属性 | 只补间 `transform` / `opacity`；`scrub` 场景绝不动 `top/left/width/height` |
| 图层 | 长列表滚动时不要给每一项都 `will-change: transform`（会爆显存），交给动效引擎的运行期优化 |
| 数量 | 一屏 ScrollTrigger 实例控制在 20 个以内；批量显现用 `batch`，不要每个元素一个 `trigger` |
| 刷新 | 图片/字体加载完、侧栏折叠、密度切换后调 `ScrollTrigger.refresh()` |
| 清理 | 路由离开时 `mm.revert()`（或 `ScrollTrigger.getAll().forEach(t => t.kill())`），否则旧页面的触发器会在新页面上继续跑 |
| 降级 | `(prefers-reduced-motion: reduce)` 下不建触发器，内容直接可见；窄屏用手册里的纵向布局 |
| 调试 | 只在开发环境开 `ScrollTrigger.config({ ignoreMobileResize: true })`，避免移动端地址栏收缩引发反复 refresh |

## 9. 什么时候不要滚动动画

- 后台列表页、表单页：用户在完成任务，滚动动画只会让他们等。
- 内容本身需要快速对比（表格、日志）：任何位移都是干扰。
- 已经有一层页面进场级联的页面：再加滚动触发，会出现"刚出现又消失"。
- 首屏：不需要滚动就能看到的，用时间轴做一次编排即可。
