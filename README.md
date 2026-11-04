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

## 管理后台

访问 `/admin` 管理场景、模型资源、视角、热点和室内行走区域。首次使用需要初始化数据库与管理员。部署和操作步骤见 [后台系统说明](docs/admin-system.md)。云端一键 SOG 转换服务位于 `converter/`，需要单独部署；未接入节点时任务会排队。
