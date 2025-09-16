# 模板库模块 — 需求规范（Phase 1: Requirements）

## 摘要与目标
- 在系统内提供“模板库 + 组件库 + 装配”能力，集中管理站点模板/复用组件，并支持 AI 自动装配与人工手动装配。
- 支持分类、标签、搜索、预览、版本管理、导入/导出、权限控制与基于 JSON Schema 的组件属性配置。
- 与现有前端（React + TS + Vite）和后端（Express + TS + Prisma）无缝集成。

## 项目背景
AI 建站系统通过大模型生成站点结构与文案，需要一个可复用、可扩展的模板库与组件库，实现页面的快速拼装与动态渲染。本规范定义功能边界、数据约束与接口契约，确保开发与后续迭代的一致性。

## 总体目标
- 统一管理：集中化存储与版本化网站模板及页面组件。
- 灵活装配：同时支持 AI 自动装配与用户手动装配。
- 高复用性：合理组件粒度与跨主题复用，降低重复开发。
- 可视化：组件属性通过 JSON Schema 自动生成编辑表单。
- 可扩展：支持新增主题、组件、国际化与多端适配。

## 最佳实践（Best Practices）
- 整页模板（Page Template）：用于“一键生成”的快速场景，面向落地页/首页等整页输出。当前阶段上传包通常仅含静态文件（.html/.css/.js/.jpg/.png 等），系统默认以整页为主进行预览与导出。
- 组件化可复用（Inferred Components）：在无 manifest/schema 的前提下，导入时尝试启发式抽取常见结构（header/hero/pricing/footer 等）作为“组件候选”，用于基础装配（排序/删除）。
- 未来增强（Phase 2）：当上传可携带 `manifest.json` 与 `schema.json` 时，再启用更精准的类型识别、Schema 校验与表单化编辑（本阶段不强制）。

## 术语定义
- 模板（Template）：可独立复用的页面或区块集合，包含代码与资源。
- 版本（Version）：遵循语义化版本的模板快照，具备不可变性。
- 预览（Preview）：只读、隔离执行环境中的渲染效果展示。
- 包（Package）：模板的 ZIP 打包形式，用于导入/导出与传输。

## 范围（In-Scope）
- 模板实体：名称、描述、缩略图、分类、标签、作者、状态（草稿/已发布）、版本列表。
- 模板内容：文件集合（HTML/TSX、CSS、JSON、图片等），以 ZIP/目录形式存储与传输。
- 基础能力：
  - 列表与筛选（按分类、标签、关键词、状态、创建者）。
  - 详情与预览（安全隔离、只读资产）。
  - CRUD（创建/编辑/上架/下架/删除，软删）。
  - 版本管理（语义化版本、设为最新、回滚）。
  - 导入（上传 ZIP / 远程 URL）、导出（打包 ZIP）。
  - 权限（仅管理员/编辑可创建与发布；游客只读）。

### 组件库（Component Library）
- 组件注册：名称、描述、分类、预览图、依赖资源、props Schema（JSON Schema）、默认示例数据。
- 组件分类：基础/内容/互动/营销/导航（可扩展）。
- 组件版本：语义化版本管理、设为最新、回滚。
- 组件预览与测试：单组件预览、快照/渲染校验（CI 可选）。

### 装配（Assembly）
- 输入：站点结构 JSON（pages → sections → props）。
- 匹配：section.type → 组件类别映射；行业/风格 → 主题优先级。
- 输出：带插槽的 HTML/CSS/JS 静态文件或 ZIP 包；支持可视化预览。
- 编辑：拖拽排序、复制、删除、Schema 表单自动生成与即时预览。

## 上传包规范（Manifest & Schema）
（注意）本节为Phase 2增强方案；当前阶段若仅有静态文件，请参考下方“仅静态文件上传流程”。
- 文件结构（建议）：
  - `manifest.json`：模板元数据与 AI 检索线索，示例：
    ```json
    {
      "name": "Hero Section",
      "slug": "hero",
      "type": "component", // component | page | theme
      "engine": "hbs",      // hbs | react | plain
      "version": "1.0.0",
      "category": "marketing",
      "tags": ["hero","landing"],
      "aiHints": { "intents": ["landing"], "industries": ["saas"], "styles": ["modern"] }
    }
    ```
  - `schema.json`：JSON Schema（draft-07+）定义 props；page 可选，component 强烈建议/默认必需。
  - 模板代码：
    - page：`index.hbs` 或 `index.html`（优先 `.hbs`）。
    - component：`component.hbs`（或 `index.hbs`）。
    - theme（可选）：`tokens.css` 或主题变量 JSON。
  - 资产目录：`assets/**` 静态资源。
- 自动识别优先级：
  1) 若存在 `manifest.json` → 以其 `type/engine` 与 `schema` 为准；
  2) 否则启用启发式识别（如 `.hbs` → hbs，存在 `<header>/<footer>` 等片段 → component 候选）。
- 校验：上传入口在后端对 `schema.json` 进行 AJV 校验，失败返回 422 并附带字段路径。

## 仅静态文件上传流程（当前阶段）
- 支持的后缀：`.html/.htm/.css/.js/.jpg/.jpeg/.png/.svg/.gif/.webp/.woff/.woff2/.ttf`。
- 页面识别：所有 `.html/.htm` 被识别为可导入页面模板；其余静态资源按原路径写入 `uploads/u_{userId}/{importId}/` 用于预览/构建。
- 组件候选：从页面 HTML 中启发式抽取常见结构（header/hero/pricing/footer 等），生成预览片段，供装配排序/删除使用（不做表单化编辑）。
- 预览重写：导入后统一重写相对资源为 `/uploads/u_{userId}/{importId}/...`，并在 `<head>` 注入 `<base>` 以确保依赖加载。
- 安全：拒绝路径穿越、限制体积与文件数、仅允许白名单后缀；不因缺少 manifest/schema 拒绝导入。

## 非目标（Out of Scope）
- 跨项目模板市场、在线支付与计费。
- 深度可视化编辑器（本阶段不含高级画布/时间线/多选联动）。
- 动态后端业务逻辑（表单存储、会员系统、权限细粒度 RBAC）。

## 用户故事（EARS）
- 作为管理员，我需要上传 ZIP 并创建模板，以便复用页面与组件。
- 作为编辑，我需要为模板打标签与分类，以便他人快速检索。
- 作为使用者，我需要搜索与预览模板，以便挑选合适的起点。
- 作为管理员，我需要发布/下架与版本回滚，以便安全迭代。
- 作为管理员，我需要导出模板包，以便同步到其他环境。
- 作为组件维护者，我需要注册组件及其 props Schema，以便系统自动生成编辑表单并确保输入合法。
- 作为装配用户，我希望导入结构 JSON，系统能自动匹配主题与组件并生成可预览页面。
- 作为运营，我希望通过主题分类与演示链接帮助用户快速选择合适模板。
- 作为业务管理员，我只需在后台上传网页模板压缩包，系统应自动完成模板库更新与组件候选生成，并在前端页面自动可见（整页与组件预览无需人工干预）。

## 用户操作与自动化流程（当前阶段）
- 后台仅需步骤：上传网页模板 ZIP（仅含 .html/.css/.js/.jpg/.png 等静态文件）。
- 系统自动执行：
  1) 解包与安全校验（白名单后缀、体积与文件数限制、路径规范）；
  2) 识别所有 .html/.htm 为整页模板，落库并生成预览；
  3) 启发式抽取常见结构（header/hero/pricing/footer 等），生成组件候选与预览片段；
  4) 统一重写静态资源引用并注入 <base>，保证预览可用；
  5) 建立检索索引（名称、描述、slug、标签），前端模板库/组件库页面自动可见；
  6) 失败回滚与错误提示（不影响已存在模板）。
- 前端可见能力：
  - 模板库列表：显示新导入的整页模板，支持检索与预览；
  - 组件库列表：显示抽取的组件候选，支持预览；
  - 装配视图：可将组件候选进行排序与删除后生成预览（无表单化编辑）。

## 角色与权限矩阵
- 游客：仅浏览已发布模板、不可下载包。
- 已登录用户：浏览已发布模板、可下载包。
- 编辑：在登录权限基础上，新增草稿创建/编辑、提交发布申请。
- 管理员：拥有全部权限，包括直接发布/下架、版本回滚与删除（软删）。

## 数据模型概览（高层）
- Template：id、name、slug、description、thumbnailUrl、category、tags[]、authorId、status、createdAt、updatedAt。
- TemplateVersion：id、templateId、semver、isLatest、changelog、createdAt、assetPath（uploads 相对路径）。
- AuditLog：id、actorId、action、entityType、entityId、payload、createdAt。
说明：以 Prisma 定义模型并建立外键；对 `Template(slug)` 与 `Template(category, name)` 建唯一索引。

- Component：id、name、slug、category、thumbnailUrl、schemaJson（JSON Schema）、defaultProps、status、createdAt、updatedAt。
- ComponentVersion：id、componentId、semver、isLatest、changelog、assetPath、createdAt。

## API 概览（草案）
- GET `/api/templates`：查询（支持分页、关键词、标签、分类、状态）。
- POST `/api/templates`：创建（上传 ZIP 或引用远程 URL）。
- GET `/api/templates/:id`：详情（含版本列表）。
- PATCH `/api/templates/:id`：编辑元数据、上/下架。
- DELETE `/api/templates/:id`：软删。
- POST `/api/templates/:id/versions`：新增版本（上传 ZIP），可设为最新。
- POST `/api/templates/:id/rollback`：回滚到指定版本。
- GET `/api/templates/:id/export`：导出 ZIP。
- GET `/api/templates/:id/preview?version=...`：获取预览资源（隔离域名或受限路由）。
 - 说明：当上传 ZIP 内包含 `manifest.json` 与 `schema.json` 时，后端优先采用其中信息完成类型识别、引擎确认与 Schema 建档，以便 AI 检索时能按 `type/tags/aiHints` 精准命中。

- GET `/api/components`：查询组件，支持分类/关键词过滤。
- POST `/api/components`：注册组件（含 props Schema 与资源包）。
- GET `/api/components/:id`：组件详情与版本。
- POST `/api/components/:id/versions`：上传组件新版本。
- POST `/api/assembly/render`：输入站点结构 JSON，返回打包 ZIP 或构建产物链接。

## 业务规则与约束
- 名称在同一分类下唯一；生成不可变 `slug`（kebab-case）。
- 版本遵循 semver（major.minor.patch），每次发布必须递增并可设置为 `latest`。
- ZIP 解包需校验安全：禁止路径穿越、限制最大体积与文件数、允许的后缀白名单。
- 预览以只读静态资源方式提供，禁止执行任意脚本（或通过沙箱 iframe + CSP）。
- 存储：元数据入库（Prisma/PostgreSQL），资产写入 `backend/uploads/templates/{id}/{version}/`。
 - i18n：模板元数据字段支持中英文本地化（后续可扩展更多语种）。
 - A11y：预览页面需符合基本可访问性（图像 alt、对比度、键盘导航）。

- Schema 要求：
  - 使用 JSON Schema draft-07 或更高版本；尽可能提供 `title`/`description`/`examples` 以优化表单与 AI 提示。
  - component 模板必须提供 `schema.json`；page 模板建议提供（用于一键生成时的定制项）。
  - `manifest.json` 建议包含 `aiHints` 字段（intents/industries/styles），用于 AI 检索与推荐。

- 组件 Schema 校验：props 必须符合 JSON Schema，后端在创建/更新时进行验证。
- 多主题支持：模板归属主题字段；AI 装配可按行业/风格偏好选择主题。

## 非功能性需求（NFR）
- 性能：
  - 列表查询在 200ms P95 内（本地开发数据量 < 5k）。
  - ZIP 导入/导出 100MB 以内 30s 内完成（本地测试）。
- 可靠性：
  - 导入失败不影响已有版本；采用临时目录 + 原子移动策略。
  - 版本变更产生审计日志，支持问题追溯。
- 安全：
  - 严格 MIME/扩展名白名单（默认允许：.tsx/.jsx/.js/.css/.json/.png/.jpg/.jpeg/.svg/.gif/.webp/.woff/.woff2/.ttf）。
  - 禁止可执行二进制与脚本文件（.sh/.exe 等）。
- 观测性：
  - 关键操作埋点（创建、导入、发布、回滚、导出）计数与时长。
  - 错误分级日志（warn/error），含请求 id。

## 错误与提示规范
- 用户可见错误采用友好提示，后台保留具体原因。
- 常见错误：
  - 400：ZIP 格式不支持 / 校验失败 / 语义化版本不合法。
  - 403：权限不足（需管理员/编辑）。
  - 409：同分类下名称冲突或版本号重复。
  - 413：文件过大（> 配置上限）。
  - 422：包含不允许的文件类型或路径。（当前阶段不会因缺少 manifest/schema 而报错）

## 配置与环境变量
- `TEMPLATE_MAX_UPLOAD_MB`（默认 100）
- `TEMPLATE_ALLOWED_EXTS`（逗号分隔白名单）
- `TEMPLATE_PREVIEW_CSP`（预览 CSP 策略片段）
- `UPLOADS_ROOT`（默认 `backend/uploads`）

## 验收标准（Acceptance Criteria）
- 可在“模板库”列表页完成筛选/分页/排序，并进入详情页查看预览与元数据。
- 可上传 ZIP 创建模板；导入失败时给出明确错误（体积/格式/安全）。
- 可创建新版本并设为最新；可回滚到任意已存在版本。
- 导出功能提供 ZIP 下载；导入/导出在 100MB 内 30s 内完成（本地测试）。
- 权限：未登录仅浏览已发布；编辑/管理员可管理草稿与发布；所有操作有审计日志（最简：数据库记录）。
 - API 在本地环境通过脚本 `test-*.js` 进行冒烟测试（创建/查询/导入/导出）。
 - 预览页在 Chrome/Safari/Firefox 最新版本渲染正常、无控制台严重错误。

- 整页模板（当前阶段）：上传仅含静态文件的 ZIP 后，系统能导入并提供预览与导出；可作为“一键生成”的候选页面。
- 组件候选（当前阶段）：系统能从常见结构中抽取至少 2 类组件候选（如 header/hero），并在组装视图中进行排序与删除（无表单编辑）。
- 自动化：后台仅上传一步，系统在 30s 内（100MB 包本地测试）完成导入、候选生成与索引，前端模板库与组件库页面自动可见并可预览。

- 组件库：可注册组件（含 props Schema）、上传版本、单组件预览成功；非法 props 被拒并提示字段路径。
- 装配：输入示例结构 JSON，系统返回可预览页面并可一键导出 ZIP；支持拖拽调整 section 顺序。表单化 props 编辑推迟到 Phase 2。

## 依赖与集成
- 前端：新增页面 `frontend/src/pages/Templates*.tsx`，服务 `frontend/src/services/templates.ts`，状态 `frontend/src/stores/templates.ts`。
- 后端：新增路由 `backend/src/routes/templates.ts`，服务层与 Prisma 模型；复用 `multer`、`adm-zip`、`rate-limit`、`helmet`、`cors` 等现有中间件与依赖。
 - 共享类型：如需新增跨端类型，更新 `shared/types.ts` 并保持前后端一致。

- 前端新增：`frontend/src/pages/Components*.tsx`、`frontend/src/services/components.ts`、`frontend/src/stores/components.ts`、装配编辑器页 `frontend/src/pages/AssemblyEditor.tsx`。
- 后端新增：`backend/src/routes/components.ts`、`backend/src/routes/assembly.ts` 及对应服务/中间件。

## 风险与缓解
- ZIP 注入/路径穿越：严格路径规范与白名单校验；拒绝危险文件。
- 资产体积过大：限制大小 + 分片上传（后续阶段），当前先限制为 100MB。
- XSS/脚本执行：预览采用静态托管 + CSP；生产禁用内联脚本。

## 里程碑与范围分期
- MVP（当前阶段）：模板库（列表/筛选、详情/预览、CRUD、版本管理、ZIP 导入/导出）、组件库基础（注册/分类/Schema 校验/预览）、装配基础（结构 JSON → 静态产物、简单映射规则）、基础权限与审计日志。
- Phase 2：分片上传、差分版本、批量操作、组件快照测试、装配规则可配置化、标签管理 UI 优化、i18n 扩展。
- Phase 3：模板评分/收藏、团队共享空间、外部模板源同步、可视化编辑器增强与协作。
