# 余家头测试模型接入记录

## 当前资源

- 来源：用户提供的 `余家头测试模型.zip`，大疆智图 3DGS 工程。
- 选择：`3dgs/results/3dgs_ply/Block000/LOD2/point_cloud.ply` 与 `Block001/LOD2/point_cloud.ply`。
- 兼容性：二进制小端 PLY，含位置、颜色、不透明度、尺度及四元数旋转，属于高斯模型。
- 合并结果：897,910 个高斯点，64,650,112 字节，保留两个分块原始坐标关系。
- 网页资源：`public/models/yujiatou-test-v1/campus-lod2.ply`。
- 当前版本：`config/scene.json` 的 `yujiatou-test-v1`；空间变换和三个俯瞰视角位于 `config/bindings.json`。

模型按用户点击加载，不在首页自动下载。桌面支持旋转、右键或 Shift 拖动平移、滚轮缩放和键盘操作。当前没有经过验收的手机专用资源，因此手机窄屏触摸设备使用图文降级；桌面浏览器窗口较窄时仍可载入模型。

## 重新生成

在项目根目录执行，原始压缩包保留不动：

```sh
mkdir -p work/model-import public/models/yujiatou-test-v1
unzip -o '余家头测试模型.zip' '3dgs/results/3dgs_ply/Block000/LOD2/point_cloud.ply' '3dgs/results/3dgs_ply/Block001/LOD2/point_cloud.ply' -d work/model-import
node scripts/import-campus-ply.mjs
npm run check:ply -- public/models/yujiatou-test-v1/campus-lod2.ply
```

原始压缩包、临时解包文件和大型 PLY 不进入 Git。其他机器从代码检出后，需要执行上述步骤或从受控模型存储取得同名资源。发布时必须同时分发模型；也可以将场景资源地址改为已配置 CORS 的版本化 CDN 地址。

## 验证与待办

已在本地浏览器确认模型实际渲染，以及预设俯瞰视角切换。当前为低精度测试资源，不能据此判定正式模型性能已达标。

景点空间标记暂时关闭，图文仍可浏览；正式景点名称、内容、坐标需要结合真实校园资料校准。首页照片仍是明确标注的 AI 占位视觉。正式发布前需要完成模型优化、手机资源、设备帧率与十分钟稳定性验收。

后续完整模型按 `docs/model-replacement.md` 新建资源版本并重新校准空间绑定，不需要改写页面。
