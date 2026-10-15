# Safari 像素分解诊断（2026-10-11）

本机 Safari 27.0.1 真实前台复现。调试过程中未启用系统减少动态效果。

## 对照结果

小型静态 CSS 引用内联 SVG mask 正常，SVG 根尺寸 0×0、1×1、200×200 均能遮掉下半部分。前台动态实验将三组矩形高度从 100 降到 0 后，三个蓝色区域均消失，说明不能概括为 Safari 不支持内联 SVG 或不支持零尺寸 defs。

实际首页开场则不同：正常前台进入，reduced=false、document.hidden=false。遮罩成功赋值，901×970 视口生成 399 格；draw 日志进度持续推进到 0.99，最终以 duration 正常结束，没有 fallback、resize 或 watchdog 中断。中途截图（约 0.5 进度）仍呈现完整开场，没有像素孔洞。

将开场层 position:fixed 暂改为 absolute 后，仍出现同样现象，因此仅更换定位不能修复。临时源代码追踪、CSS 对照及 public 诊断页均已移除，恢复实验前的产品代码；HTML 对照页留在 /private/tmp/safari-mask-check.html。

## 定位结论与限制

问题集中在当前首页整屏 HTML 层通过固定 mask-image URL 引用 SVG、仅修改其子矩形属性的渲染路径。JavaScript 动画正常执行，但 Safari 实际遮罩画面没有跟随矩形更新。本轮定位到这一浏览器渲染行为；具体 WebKit 内部缓存或重绘失效机制尚未用引擎调试确认。

CSS.supports 仅验证语法，不能发现此类运行时渲染异常，try/catch 也不会捕获未抛异常的绘制错误。这是此前将每帧 SVG 图片 URL 替换为固定内联 SVG 后遗漏的 Safari 实机兼容性验证。

建议下一步为 Safari 验证不依赖跨 HTML/SVG 子节点重绘通知的遮罩实现，例如直接更新 CSS 的几何裁切属性；保留像素分解结束后才播放完整首屏的时序，不回退到每帧生成 SVG 图片 URL。具体实现与视觉保真需要新的 A/B 实验，尚未修改产品行为。

## Safari fix and verification (current implementation)

The entrance now updates CSS clip-path:path(...) directly, avoiding cross-element SVG mask repaint invalidation. Click-origin ordering, smoothstep pixel shrinking, the 30 FPS / 768-cell budget and desktop 900ms / mobile 700ms durations remain. A valid zero-area path handles the empty final frame; the entrance is hidden before cleanup. Pixels disappear by geometry shrink; individual SVG alpha fading is no longer applied.

Safari 27.0.1 foreground verification: mouse click, Enter and Space all showed visible shrinking pixel blocks and holes, followed by the complete homepage intro. Evidence: /private/tmp/safari-pixel-fixed.png.

In-app browser samples: while the gate exists, the hero image remains clipped at 100% and navigation opacity stays at 0. After removal, image clipping advances from about 87% to 60%; the intro is no longer consumed behind the gate. The 390x844 layout also showed the pixel transition and paused hero start state.

All 15 campus tests, TypeScript, targeted ESLint and production build passed. Tests include initial cell coverage, a valid zero-area final path and non-increasing active cell count. Real iPhone and Chrome are not covered. Unsupported path() browsers retain the 350ms fade fallback; reduced motion retains immediate entry.

To replay, open the homepage in a fresh Safari tab. Existing-tab refresh intentionally skips the entrance using sessionStorage.
