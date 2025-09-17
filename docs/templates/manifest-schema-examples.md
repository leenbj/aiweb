# 静态模板包结构与配置示例

为了便于后端自动识别页面、组件和主题资源，静态 ZIP 包需要携带清晰的 `manifest.json`、`schema.json` 与 AI 辅助信息。以下示例展示了推荐的目录结构、字段含义及编写规范。

## 目录结构建议

```
landing-page.zip
├─ manifest.json          # 入口声明与元信息
├─ schema.json            # 页面或组件的参数结构（可选）
├─ ai-hints.json          # AI 生成/推荐提示（可选）
├─ index.html             # 页面入口或组件示例
├─ partials/
│  ├─ header.html
│  └─ footer.html
└─ assets/
   ├─ styles.css
   └─ hero.png
```

- **入口 HTML**：页面类模板需提供完整的 `index.html`，组件类可提供片段或示例包装页。
- **partials/**：可选，用于拆分 header/footer 等常用块，Importer 会尝试参数化并注册为组件。
- **assets/**：存放引用的 CSS/JS/图片资源，导入后会被重写为 `/uploads/u_{userId}/{importId}/**`。

## manifest.json 示例

```json
{
  "slug": "startup-landing",
  "name": "创业着陆页",
  "description": "适合 SaaS/创业公司的三屏落地页",
  "type": "page",
  "engine": "hbs",
  "version": "1.0.0",
  "entry": "index.html",
  "tags": ["landing", "startup", "saas"],
  "components": [
    { "slug": "site-header", "path": "partials/header.html" },
    { "slug": "pricing-table", "path": "partials/pricing.html" }
  ],
  "assets": [
    "assets/styles.css",
    "assets/hero.png"
  ],
  "schema": "./schema.json",
  "aiHints": "./ai-hints.json"
}
```

### 字段说明

- **slug**：模板唯一标识，Importer 会检测冲突并自动追加短 ID。
- **type**：`page` / `component` / `theme`，用于前端筛选。
- **engine**：`plain` / `hbs` / `react`，决定渲染方式与是否参数化。
- **components**：仅对页面模板生效，指向可拆分的片段文件。
- **assets**：静态资源相对路径，导出 ZIP 时会打包到 `assets/` 目录。
- **schema**、**aiHints**：可选路径，指向同级 JSON 文件。

## schema.json 示例

以下示例采用 JSON Schema（Draft-07）描述页面参数，Importer 会用于表单生成与运行时校验：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "hero": {
      "type": "object",
      "title": "英雄模块",
      "properties": {
        "title": { "type": "string", "title": "主标题" },
        "subtitle": { "type": "string", "title": "副标题" },
        "cta": {
          "type": "object",
          "title": "按钮",
          "properties": {
            "text": { "type": "string" },
            "href": { "type": "string" }
          },
          "required": ["text"]
        }
      },
      "required": ["title"]
    },
    "pricing": {
      "type": "array",
      "title": "价格方案",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "price": { "type": "string" },
          "features": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["name", "price"]
      }
    }
  }
}
```

## ai-hints.json 示例

`TemplateAIHints` 用于指导 AI 在生成或组合页面时的语义提示：

```json
{
  "summary": "适合展示 B2B SaaS 产品卖点的三屏页面",
  "recommendedUseCases": ["SaaS", "企业官网"],
  "keywords": ["SaaS", "Landing", "Startup"],
  "sections": {
    "hero": {
      "description": "首屏强调价值主张，配合 CTA",
      "example": "让团队 10 分钟上线营销页"
    },
    "pricing": {
      "description": "展示 3 款套餐并强调差异点",
      "required": true
    }
  },
  "prompts": [
    "请围绕产品效率优势撰写英雄模块文案",
    "根据三种用户类型给出价格方案"
  ]
}
```

## 编写建议

1. **命名规范**：`slug` 建议使用小写中划线（kebab-case），便于 URL 复用。
2. **版本管理**：发布新版本时更新 `version` 字段并使用导出的 ZIP 作为备份，可与版本 API 协同。
3. **Schema 粒度**：尽量拆分为 `object` + `array` 的层级结构，字段命名与组件 Handlebars 变量保持一致。
4. **AI 提示**：`aiHints` 中的 `summary`、`sections`、`prompts` 将用于提示词拼接，避免出现敏感信息或真实客户数据。
5. **资源引用**：HTML 内引用静态资源请使用相对路径（如 `assets/style.css`），Importer 会统一重写为 `/uploads/...` 前缀。

按照上述约定整理 ZIP 包，可显著提升导入成功率、组件参数化准确性，以及前后端联调体验。
