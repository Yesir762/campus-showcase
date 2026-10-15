# 云漫武理开场

首页首次进入显示浅色蓝图开场，使用用户提供的 React Bits TechText 源码；网站品牌与浏览器标题已改为云漫武理，机构信息保留武汉理工大学余家头校区。

进入状态存储在 sessionStorage 的 `yunman-wuli:entered:v1`，存储失败时采用内存状态。点击任意区域后从点击位置进行整屏像素分解，桌面 900ms、手机 700ms；按 Enter / Space 从中心分解。不支持遮罩或初始化失败时淡出 350ms；减少动态效果时立即进入。详情页不挂载开场。再次体验请在新标签页打开首页。

开场锁定滚动并使首页内容 inert，退出后恢复页面和焦点，带锚点访问时定位目标模块。静态标题一直作为无障碍标题；动态导入或 Canvas 初始化失败时继续显示静态标题。减少动态效果时不挂载 TechText。开场不初始化三维渲染器，退出时卸载 Canvas 并清理监听与动画。

验证：类型检查、生产构建；桌面新访问、空白处点击、刷新不重复、进入后 Canvas 移除和滚动恢复；键盘 Space 进入及锚点定位。手机布局使用浏览器尺寸模拟验证，实际手机触摸、存储受限和系统减少动态效果仍需实机检查。

像素过渡使用固定内联 SVG 遮罩，矩形仅初始化一次，最多 30 FPS、768 格。分解期间冻结 TechText 并保留输入隔离；后台切换立即结束，窗口或视觉视口尺寸变化直接完成退出，避免像素重新出现。新增网格覆盖、格数预算、确定性顺序及结束透明测试。13 项测试、类型检查与构建通过；浏览器已验证鼠标进入、键盘 Enter、390px 布局、开场移除与刷新规则。减少动态效果、遮罩不可用与实际手机触控仍需专项设备检查。

Current Safari-compatible renderer: CSS clip-path:path(...) geometric pixel shrinking replaces the fixed inline SVG mask. Timing and session entry rules are unchanged. Verification is recorded in docs/safari-pixel-diagnosis.md.
