# 模板 ZIP 规范与示例（manifest.json / schema.json）

本文档说明上传 ZIP 包的推荐结构，以及 manifest 与 schema 的编写示例，帮助团队生成可被系统良好识别的页面/组件/主题模板。

## 目录结构建议

```
my-template.zip
├── index.html            # 入口 HTML（页面模板必备）
├── components/           # 可选：组件片段（单文件或拆分）
│   ├── hero.html
│   └── pricing.html
├── assets/               # 资源文件（图片/CSS/JS/媒体等）
│   ├── style.css
│   ├── app.js
│   └── images/...
├── manifest.json         # 可选：模板清单（见下）
└── schema.json           # 可选：数据结构（HBS 组件/页面可用）
```

说明：
- Importer 对 `.html/.htm/.css/.js/.png/.jpg/.svg/.webp/.woff2/...` 等常见后缀开放白名单；
- 资源路径会被重写为 `/uploads/u_{userId}/{importId}/...` 并在 `<head>` 注入 `<base href>`，预览无 404；
- 未提供 manifest/schema 时，系统会通过启发式选择器（header/hero/pricing/features 等）自动抽取组件候选。

## manifest.json 示例

用于声明模板元信息与引擎类型（可选）。

```json
{
  "slug": "landing-basic",
  "name": "基础落地页",
  "version": "1.0.0",
  "type": "page",         
  "engine": "plain",      
  "description": "简洁的产品落地页模板",
  "tags": ["marketing", "landing"],
  "entry": "index.html",
  "schema": null,
  "aiHints": {
    "summary": "适用于产品宣传与活动推广",
    "recommendedUseCases": ["新品发布", "活动页"],
    "keywords": ["hero", "pricing"],
    "sections": {
      "title": { "description": "页面主标题", "example": "欢迎使用我们的产品" },
      "cta": { "description": "行动按钮", "example": "立即开始" }
    },
    "prompts": [
      "为着陆页生成引人注目的标题与副标题",
      "撰写三段简洁的功能介绍"
    ]
  },
  "assets": ["assets/style.css", "assets/app.js"]
}
```

字段说明：
- `type`: `page | component | theme`
- `engine`: `plain | hbs | react`（当前主要支持 plain/hbs）
- `entry`: 入口文件（页面或组件文件路径），默认 `index.html`
- `aiHints`: 供 AI 生成/编辑时参考的提示信息结构

## schema.json 示例（HBS 模板）

当引擎为 `hbs` 时，可提供 `schema.json` 以约束/提示渲染数据结构。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 1 },
    "subtitle": { "type": "string" },
    "cta": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "href": { "type": "string", "format": "uri-reference" }
      },
      "required": ["text", "href"]
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price": { "type": "string" }
        },
        "required": ["name", "price"]
      }
    }
  },
  "required": ["title", "cta"]
}
```

## 命名建议
- `slug`：仅小写字母/数字/短横线；例如：`hero-basic`、`pricing-cards`；
- 版本：遵循语义化版本 `MAJOR.MINOR.PATCH`；
- 资源目录：推荐 `assets/` 作为根目录，避免深层相对路径复杂度。

## 导入与预览
- 导入接口：`POST /api/templates/import-zip`（表单字段名：`file`）
- 搜索接口：`GET /api/templates/search?type=page|component|theme&query=...`
- 渲染接口：`POST /api/templates/render`（`{ slug, data?, theme? }`）
- 组合接口：`POST /api/templates/compose`（`{ page, components[], theme? }`）
- 导出接口：`GET /api/templates/:id/export`

## 常见问题
- 预览资源 404：请确保资源位于 ZIP 包内并使用相对路径；导入后系统会自动重写并注入 `<base>`。
- 未识别组件：可在 `components/` 中拆分片段；或在页面中使用常见选择器（header/hero/pricing/features 等）。

