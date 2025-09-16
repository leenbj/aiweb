# 设计文档 — 模板库 + 组件库 + 装配（Phase 2: Design）

## Overview
本设计面向“模板库 + 组件库 + 装配”的落地实现，覆盖前后端架构、数据模型、接口协议、安全与测试方案。目标是在现有技术栈（Frontend: Vite + React + TS；Backend: Express + TS + Prisma）上，以最小侵入复用既有能力，快速形成可用的模板/组件管理与装配能力，并与 AI 生成流程衔接。

当前阶段针对“仅静态文件上传（.html/.css/.js/.jpg/.png 等）”的场景进行实现：
- 后台仅需上传 ZIP；系统自动完成解包校验 → 整页识别与预览 → 启发式组件候选抽取与预览 → 静态资源重写与 <base> 注入 → 索引建立；
- 前端模板库/组件库页面自动可见；装配视图支持排序/删除与预览；
- 不依赖 manifest/schema（后续 Phase 2 再启用 schema 表单与更精确识别）。

## Best Practices（落地策略）
- 整页模板（Page Template）：面向“一键生成”的快速场景；仅静态文件也可导入并生成预览与导出。
- 组件候选（Inferred Components）：通过启发式抽取常见结构（header/hero/pricing/footer 等）形成候选，用于装配排序/删除；未来再接 schema 表单。
- manifest/schema：作为 Phase 2 的增强项，不在当前阶段强制。

## Steering Document Alignment

### Technical Standards (tech.md)
- TypeScript 优先、2 空格缩进、分层清晰：路由（routes）→ 服务（services）→ 数据（prisma）。
- 安全：`helmet` + CSP，上传校验、路径规范化、模板渲染前 `sanitizeHtmlCssJs`。
- 依赖：`multer` 上传、`adm-zip` 解压、`ajv` + `ajv-formats` 进行 JSON Schema 校验、`handlebars` 渲染、`lru-cache` 缓存。

### Project Structure (structure.md)
- 前端：页面位于 `frontend/src/pages`，服务 SDK 位于 `frontend/src/services`，状态管理与 UI 组件保持现有风格；路由注册在 `frontend/src/lib/router.ts`。
- 后端：API 路由在 `backend/src/routes`，业务逻辑在 `backend/src/services`，数据库模型在 `backend/prisma/schema.prisma`，通用工具在 `backend/src/utils`。
- 共享类型：新增跨端类型补充到 `shared/types.ts`（按需）。

## Code Reuse Analysis
- 直接复用
  - `backend/src/routes/templates.ts`：支持 ZIP 导入、搜索、按 slug 获取、渲染、页面组装（compose）。
  - `backend/src/services/importer/zipImporter.ts`：从 ZIP 识别 page / component，参数化组件（HBS），抽取主题 tokens。
  - `backend/src/services/templateRenderer.ts`：Handlebars 渲染、AJV Schema 校验、主题 CSS 注入、HTML 清洗。
  - `backend/src/services/templateIndex.ts`：模板搜索与排序。
  - `backend/src/services/templateMemory.ts`：无 DB 兜底内存模板。
  - `frontend/src/services/templateSDK.ts`：前端 SDK 已涵盖 search/get/render/compose。
  - `frontend/src/pages/TemplateLibrary.tsx`、`frontend/src/components/AIEditorWithNewUI.tsx`：已具备模板预览与组装体验，可扩展为装配编辑器。
- 轻量扩展
  - 导出 ZIP、版本回滚 API（依托 `TemplateVersion` 表）。
  - 组件维度的筛选/分类 UI（沿用 search 接口 `type=component`）。
  - 前端装配编辑器：在 `AIEditorWithNewUI` 基础上补充 Schema 表单编辑、拖拽排序与一键导出。

## Architecture
- 分层：
  - 路由层（Express Router）：参数校验、权限判断、限流与错误处理。
  - 服务层（Services）：模板导入、渲染、组装、检索、导出、版本管理、主题注入等。
  - 数据层（Prisma）：`Template` / `TemplateVersion` 表读写。
- 关键流程：
  - 导入（当前阶段）：上传 ZIP → 解包至 `uploads` → 识别页面与组件候选（启发式）→ 静态资源重写与 base 注入 → 入库（或内存兜底）。
  - 渲染：AJV 校验 props → HBS 编译 → 注入 Theme CSS → HTML 清洗。
  - 组装：注册组件 partials → 依据结构 JSON 合成页面 → 预览。
  - 导出：打包渲染结果与静态资源为 ZIP 供下载。

```mermaid
graph TD
  U[用户/AI] -->|上传ZIP| R1[POST /api/templates/import-zip]
  R1 --> S1[zipImporter 导入]
  S1 --> DB[(Prisma: Template/Version)]
  U -->|搜索/查看| R2[GET /api/templates/search|:slug]
  U -->|渲染| R3[POST /api/templates/render]
  R3 --> S2[templateRenderer]
  U -->|组装| R4[POST /api/templates/compose]
  R4 --> S3[Handlebars 部分应用]
  U -->|导出| R5[GET /api/templates/:id/export]
```

## Components and Interfaces

### 后端路由与服务
- `backend/src/routes/templates.ts`
  - 已有：
    - `POST /import-zip`（表单 `file`）：导入 ZIP。
    - `GET /search`：查询（支持 `type=component|page|theme`、关键词、分页）。
    - `GET /:slug`：按 slug 获取模板详情。
    - `POST /render`：渲染单一模板（HBS/Plain）。
    - `POST /compose`：依据 `page + components[]` 结构进行组装渲染。
  - 新增（设计）：
    - `GET /:id/export`：导出模板当前版本 ZIP（含预览 HTML、依赖静态资源、metadata）。
    - `POST /:id/versions`：创建新版本（基于当前模板代码或上传资源生成）。
    - `POST /:id/rollback`：将模板回滚至指定 `version`（写入 `Template.version` 并复制代码快照）。

- 核心服务
  - `services/importer/zipImporter.ts`：负责 ZIP 解包、模板/组件识别、HBS 参数化、主题 token 抽取与入库。
  - `services/templateRenderer.ts`：负责模板渲染、Schema 校验、主题注入与 HTML 清洗。
  - `services/templateIndex.ts`：统一搜索与排序策略。
- 设计新增：`services/templateExporter.ts`（导出 ZIP）；`services/templateVersioning.ts`（版本创建/回滚）。

### 上传包识别（Importer 增强）
- 在 `services/importer/zipImporter.ts` 中增加：
  - 读取并解析包内 `manifest.json`（若存在）与 `schema.json`：
    - `manifest.type` → `Template.type`（component/page/theme）；
    - `manifest.engine` → `Template.engine`（hbs/react/plain）；
    - `manifest.tags` 合并到 `Template.tags`；
    - `manifest.aiHints`（intents/industries/styles）→ 扁平化写入 `Template.tags`（前缀 `intent:`/`industry:`/`style:`）。
    - `schema.json` → 写入 `Template.schemaJson` 并在渲染时 AJV 校验。
  - 识别优先级：`manifest` > 启发式（文件后缀与 DOM 片段识别）。
  - 失败处理：schema 不合法时返回 422，错误信息包含字段路径，阻止入库。

### 前端页面与模块
- 复用：
  - `pages/TemplateLibrary.tsx`：展示列表与预览。
  - `components/AIEditorWithNewUI.tsx`：作为装配编辑器的基础（选择 page + components，调用 compose 渲染）。
- 新增/扩展：
  - 在编辑器中加入 Schema 表单编辑（根据 `schemaJson` 自动生成表单，双向绑定 props）。
  - 拖拽排序、复制、删除 section（本期可用简单上/下移动 + 删除按钮实现）。
  - 一键导出：调用 `GET /api/templates/:id/export` 或对 compose 结果进行前端打包下载（MVP 先走后端导出）。
  - 组件库筛选：在左侧或抽屉中按分类/关键词筛选 `type=component` 模板。

## Data Models

Prisma（已存在）：`backend/prisma/schema.prisma`

```
model Template {
  id          String   @id @default(cuid())
  type        String   // component | page | theme
  name        String
  slug        String   @unique
  engine      String   // hbs | react | plain
  description String?  @db.Text
  code        String   @db.Text
  schemaJson  Json?
  tokensJson  Json?
  tags        String[]
  version     String   @default("1.0.0")
  previewHtml String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  versions    TemplateVersion[]
}

model TemplateVersion {
  id          String   @id @default(cuid())
  templateId  String
  version     String
  code        String   @db.Text
  schemaJson  Json?
  createdAt   DateTime @default(now())

  template Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, version])
}
```

索引与约束（设计约定）：
- `Template.slug` 全局唯一；`Template(type, name)` 逻辑唯一（通过业务规则守护）。
- `TemplateVersion(templateId, version)` 唯一；语义化版本（semver）比较在业务层处理。

## API 约定与协议

- 查询：`GET /api/templates/search?type=component&page=...&query=...`
  - 响应：`{ items: TemplateDTO[], total: number }`
- 详情：`GET /api/templates/:slug`
  - 响应：`TemplateDTO & { code?: string }`
- 渲染：`POST /api/templates/render { slug, data, theme }`
  - 响应：`{ html, meta }`（渲染前执行 AJV 校验 + HTML 清洗）
- 组装：`POST /api/templates/compose { page, components[], theme }`
  - 响应：`{ html, meta }`
  - 导入 ZIP：`POST /api/templates/import-zip` (multipart form-data: file)
  - 响应：`{ importId, pages, components, theme, assetsBase }`
  - 说明（当前阶段）：仅静态文件即可完成导入/候选抽取/索引；manifest/schema 缺失不影响导入。导入时长目标（本地）：100MB 内 30s。
- 导出 ZIP（新增）：`GET /api/templates/:id/export`
  - 响应：ZIP（二进制下载），包含 `index.html`、`/assets/*` 与 `meta.json`
- 新版本（新增）：`POST /api/templates/:id/versions { version, code?, schemaJson? }`
  - 侧写：若 `code` 为空，默认复制当前版本 `code/schemaJson` 作为新版本；写入 `Template.version`。
- 回滚（新增）：`POST /api/templates/:id/rollback { version }`
  - 侧写：将指定版本内容写回当前模板，`Template.version` 同步为该版本号。

错误码与提示：
- 400 参数缺失/非法；409 冲突（slug 重复、版本重复）；413 文件过大；422 Schema 校验失败；403 权限不足。

## Security & Compliance
- 上传：`multer` 限制大小；ZIP 解包校验（拒绝路径穿越、限制文件数/总大小、白名单后缀）。
  - 渲染：`sanitizeHtmlCssJs` 进行 HTML/CSS/JS 基本净化；禁止内联危险脚本。AJV 校验在 Phase 2（schema 存在）启用。
- 预览：通过 `<iframe srcDoc>` 或静态只读资源，配合 `helmet` CSP 限制脚本来源。
- 存储：上传路径规范为 `uploads/u_{userId}/{importId}/...`，任何读取需经 `ensureRelative` 规范化。
 - 索引：禁止将未校验通过的 schema 建档；`aiHints` 仅以 tag 形式参与检索，不参与渲染执行。

## Error Handling
典型场景与处理：
1. ZIP 结构不合规/包含危险文件
   - Handling：中止导入，返回 422/400，错误信息含违规文件清单；记录日志与审计。
   - User Impact：toast/对话框友好提示。
2. Schema 校验失败（渲染/组装）
   - Handling：捕获 AJV 错误并整合字段路径；HTTP 422。
   - User Impact：表单字段高亮，错误指向具体属性。
3. 版本冲突（重复版本号）
   - Handling：返回 409 并提示应递增 semver；后端不覆盖。
4. 资源缺失（预览依赖静态资源 404）
   - Handling：导入期注入 `<base href>` + 重写相对路径；预览阶段 fallback。

## Testing Strategy

### Unit Testing
  - 服务单元：`templateRenderer`（主题注入/净化；AJV 在 Phase 2 验证）、`zipImporter`（识别/参数化/抽取/资源重写）、`templateExporter`（打包清单）。

### Integration Testing
- 路由流：导入（仅静态文件）→ 搜索 → 渲染 → 组装（排序/删除）→ 导出。用 `test-*.js` 脚本模拟实际请求，并记录导入时长。

### End-to-End Testing
- 前端串联：上传 ZIP → 模板/组件出现在库中 → 选择组件与页面装配 → 预览 → 导出 ZIP。
- 浏览器兼容：Chrome/Safari/Firefox 最新版，无严重控制台错误。

## Implementation Notes
- MVP 先复用 /templates 路由作为统一入口：组件库通过 `type=component` 过滤实现；如需独立 `/components` 路由，可在路由层代理到相同服务。
- 导出 ZIP 可基于 `compose` 渲染结果 + `uploads` 静态资源清单生成，避免复杂依赖分析；进阶版本再做依赖追踪。
- 表单 Schema：前端使用简单映射（string → input、number → number、array/object → JSON 编辑器或小部件集合），后续迭代到通用表单渲染器。
 - AI 检索：在 `searchTemplates` 基础上支持前缀标签过滤（如 `intent:landing`），或在前端将关键词补齐为前缀查询；必要时扩展 API 增加 `hints=intent:landing,industry:saas` 参数。
