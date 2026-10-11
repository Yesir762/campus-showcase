# 三板块接入与维护（2026-10-10）

## 本次交付

首页为三板块入口，独立详情地址为 `/scenes/main-campus`、`/scenes/navigation-building`、`/scenes/navigation-museum`。主校区使用现有测试资源，后两个板块显示待接入介绍。首页没有模型窗口，不自动下载任何模型。

本次为本地开发交付。完整模型、正式内容、场馆资料与公开发布授权仍为正式发布前置条件，不执行外部模型上传。室内行走控制器、边界检测和摇杆已实现，但没有博物馆模型与真实边界，不能把单元测试视为真实室内漫游验收。

## 配置入口

运行时场景来源改为 `config/scenes.json`；`config/site.json` 维护全站品牌和简介，其中历史 places 不再参与页面渲染。旧 `config/scene.json`、`config/bindings.json` 和旧报告保留为迁移档案，不再作为新网页场景配置入口。

每个场景包含：

- `id`：稳定网址编号；`kind`：outdoor/indoor；`mode`：orbit/walk。
- `availability`：pending 或 ready；缺少资料时保持 pending。
- `poster`、`posterAlt`、`title`、`summary`、`content`：独立图文。当前封面均为明确标注的 AI 占位图。
- `activeVersion`：当前版本键。`versions` 和 `bindings` 以同一版本键关联。

每个模型版本配置桌面 `desktopUrl`/`format`、手机 `mobileUrl`/`mobileFormat`/`mobileLabel`/`mobileBytes` 和精度 variants。手机资源大小和名称读取配置，不能把主校区 LOD2 名称复制到其他场景。无手机资源时进入图文模式。

空间绑定包括方向、位置、缩放、相机边界、视角、`locations: [{placeId, viewId}]` 与 `markers: [{placeId, position}]`。位置使用模型变换后的世界坐标，标记由相机投影更新，不用百分比固定在画布上。没有有效 locations 的内容只显示图文。

版本缺失、绑定版本不一致、视角编号错误或室内校准无效时，仅关闭对应场景的三维入口，保留介绍和其他板块。

## 新模型接入步骤

1. 原始数据留档，检查 3DGS 属性、方向、范围及点数；沿用现有转换和完整性检查工具。
2. 创建独立场景版本目录，为桌面和手机分别优化资源，流式文件保持完整目录关系。
3. 在对应场景 versions 中添加版本；在 bindings 中添加同键配置，重新校准方向、尺度、相机与位置。不要复用主校区坐标。
4. 更新内容和正式照片，建立已确认的内容编号与视角绑定。
5. 数据和性能验收后设置 activeVersion，最后将 availability 改为 ready。
6. 回滚只修改该场景 activeVersion 到原版本键；对应资源和 bindings 均保留。无需改 React 页面及正文。

主校区已同时保留 v1/v2 的模型与绑定关系。其他板块初始 activeVersion 为 null，不存在假模型或预置室内边界。

## 博物馆行走配置

先取得平面图或实测边界、至少一组真实尺寸、入口与展区位置及展品图文。将变换后模型校准为一世界单位一米，Y 为向上，X/Z 为地面。

室内 bindings 增加 navigation：

```json
{
  "calibrated": false,
  "floorY": 0,
  "eyeHeight": 1.6,
  "radius": 0.25,
  "speed": 1.2,
  "walkable": [],
  "obstacles": []
}
```

这只是待填写的结构，不能直接启用。walkable/obstacles 为 X/Z 多边形列表，每个至少三个有限坐标点，按地面实测绘制简单、不自交的边界；墙体和展柜应纳入障碍。每个自由行走区域需要足够的角色半径余量，连续区域应绘制为同一外边界，彼此分离的区域使用展区跳转连接。

所有 views 的 camera 必须位于有效地面区域，Y 为 floorY + eyeHeight；初始 view 即入口。target 需提供有效水平观察方向。审核后才把 calibrated 设为 true。

电脑 WASD 行走、拖动观察，方向键转向；手机左侧摇杆与右侧观察使用不同指针。角色固定高度，斜向移动归一化；每帧时间限幅，并以不超过 5cm 的步长检查碰撞。暂不支持楼梯、跨楼层、跳跃和飞行。展区切换淡出后直接定位，再淡入，不动画穿墙。

点击详情、失焦、页面隐藏、触控取消、复位、切换精度或离开页面都会停止运动。详情打开时暂停行走；关闭后需重新操作。不能仅凭点云视觉判断碰撞精度，必须真机核对墙角、狭窄通道、展柜和入口。

## 检查与验收

```sh
npm run test:campus
npx tsc --noEmit
npm run build
```

自动化覆盖场景失效隔离、版本回滚、入口合法性、角色边界、薄障碍防穿越、窄通道、移动归一化和失焦/取消后的停止。浏览器检查覆盖三个页面、主校区实际渲染、页面全屏退出、详情页刷新与前进后退。

每份新模型仍需分别完成指定设备下加载、帧率、内存及十分钟稳定性验收，未完成不能声称达到正式性能目标。博物馆鼠标/多指触控在真实室内模型上的操作、碰撞与视觉质量留待模型到位后验收。
