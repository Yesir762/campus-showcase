# 校园风光展示网页

面向公众的校园图文与高斯泼溅三维展示网站。当前版本使用明确标注的测试占位场景；配置兼容的 PLY、SOG 或 Streamed SOG 后，会按需加载 PlayCanvas 渲染器与模型。

## 本地运行

```bash
npm install
npm run dev
```

## 内容与模型维护

- `config/site.json`：学校名称、介绍、主题色和景点图文。
- `config/scene.json`：当前场景版本、模型格式及桌面/手机资源地址。
- `config/bindings.json`：模型变换、相机视角和景点空间标记。

完整替换步骤见 `docs/model-replacement.md`，公开发布前按 `docs/release-checklist.md` 验收。
