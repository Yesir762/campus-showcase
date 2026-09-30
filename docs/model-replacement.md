# 模型检查、替换与回滚

## 1. 检查 PLY

读取 PLY 头部。可用于高斯泼溅的文件应包含位置以及尺度、旋转、不透明度和颜色或球谐相关属性；普通点云或网格 PLY 不能直接作为高斯模型加载。

先用 SuperSplat 导入原文件，确认模型能完整显示，再裁剪漂浮点、无效边界并统一朝向。原始 PLY 只做留档，不覆盖。

## 2. 转换网页资源

正式发布优先转换为 SOG。大场景在普通 SOG 无法达到加载与帧率目标时，转换为 Streamed SOG。将产物放到带版本的独立目录，例如 `public/models/campus-2026-10/campus.sog`。

模型部署在独立 CDN 时，需要允许站点来源跨域读取资源，并返回正确的 `Content-Length`，这样页面才能显示真实下载进度。

## 3. 新建场景版本

编辑 `config/scene.json`，在 `versions` 中增加新版本并保留旧版本；配置格式和资源地址，最后切换 `activeVersion`。只有经过实机验证后才填写 `mobileUrl`。

编辑 `config/bindings.json`，将 `sceneVersion` 改成同一版本，并重新校准模型变换、相机视角和景点标记。站点会在构建时拒绝场景与绑定版本不一致的配置。

## 4. 验收与回滚

至少检查桌面 Chrome、Edge、Safari，iOS Safari 和 Android Chrome。验证加载、视角、标记、十分钟稳定浏览与图文降级。

若上线异常，将 `activeVersion` 和 `sceneVersion` 一并改回上一版本并重新发布。不要覆盖旧模型目录，以免浏览器缓存影响回滚。
