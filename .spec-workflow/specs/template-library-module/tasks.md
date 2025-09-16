# 任务分解 — 模板库 + 组件库 + 装配（Phase 3: Tasks）

说明：针对仅静态文件上传的场景，细化为可执行的最小步骤。

- [ ] 1. Importer：仅静态文件整页识别与落盘
  - Files: backend/src/services/importer/zipImporter.ts
  - Steps:
    1) 遍历 ZIP 条目，过滤白名单后缀与路径穿越；
    2) 非 HTML 资源写入 `uploads/u_{userId}/{importId}/`；
    3) 对每个 `.html/.htm`：读取内容、提取 `<title>`、生成唯一 `slug`、初始 `previewHtml`。
  - _Leverage: adm-zip, cheerio, addMemoryTemplate, prisma.template_
  - _Requirements: 需求/仅静态文件上传流程, 设计/Overview-当前阶段_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Node.js 后端工程师 | Task: 在 zipImporter.ts 实现仅静态文件整页识别与落盘 | Restrictions: 路径 ensureRelative；slug 冲突追加短 id | _Leverage: 现有 zipImporter | _Requirements: 静态文件流程 | Success: pages[] 返回新 slugs，预览可渲染 | Instructions: 开始标记为 [-]，完成改为 [x]。_

- [ ] 2. Importer：资源重写与 <base> 注入
  - Files: backend/src/services/importer/zipImporter.ts
  - Steps:
    1) 使用 cheerio 重写 link/script/img 等相对路径为 `/uploads/u_{userId}/{importId}/...`；
    2) 在 `<head>` 注入 `<base href>`；
    3) 保存处理后的 previewHtml。
  - _Leverage: rewriteAssets(), cheerio_
  - _Requirements: 需求/预览重写, 设计/Importer 流程_
  - _Prompt: Implement the task for spec template-library-module... | Success: 预览无 404 资源错误 | Instructions: 状态更新。_

- [ ] 3. Importer：启发式组件候选抽取
  - Files: backend/src/services/importer/zipImporter.ts
  - Steps:
    1) 定义候选选择器集：header/footer/hero/pricing/features/team/service 等；
    2) 提取外层片段并参数化为 HBS（失败则保留原 HTML）；
    3) 生成唯一 slug，保存为 Template(type=component, engine=hbs, previewHtml)。
  - _Leverage: parametrizeComponentHtml(), Handlebars, prisma.template, addMemoryTemplate_
  - _Requirements: 需求/组件候选, 设计/Importer 流程_
  - _Prompt: Implement the task for spec template-library-module... | Success: 至少抽取 2 类候选；预览正常 | Instructions: 状态更新。_

- [ ] 4. Templates 路由：上传导入端点与返回结构
  - Files: backend/src/routes/templates.ts
  - Steps:
    1) `POST /api/templates/import-zip` 调用 zipImporter 并返回 `{ importId, pages, components, assetsBase }`；
    2) 错误处理与耗时日志；
  - _Leverage: multer, logger, zipImporter_
  - _Requirements: 设计/API-约定, 需求/自动化SLA_
  - _Prompt: Implement the task for spec template-library-module... | Success: 前端拿到 pages/components 并展示 | Instructions: 状态更新。_
  - Files: backend/src/routes/templates.ts, backend/src/services/templateExporter.ts (new)
  - Desc: 新增 `GET /api/templates/:id/export`，将渲染产物（或源码）与 `assets/**` 打包，附带 `meta.json`（slug、version、type、engine、tags）。
  - _Leverage: backend/src/services/templateRenderer.ts, uploads 静态资源目录_
  - _Requirements: 需求/API-导出, 设计/API-导出ZIP_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 后端工程师 | Task: 实现模板导出服务与路由，打包 index.html/源码、关联静态资源与 meta.json，返回下载 | Restrictions: 路径规范化，避免目录穿越；大文件流式输出 | _Leverage: renderer/compose 结果 | _Requirements: 导出 | Success: 能下载包含完整资源的 ZIP 包，导入同构包应可还原 | Instructions: 进度按规范标记。_

- [ ] 5. 导出能力：模板导出 ZIP
  - Files: backend/src/routes/templates.ts, backend/src/services/templateVersioning.ts (new), backend/prisma/schema.prisma (若需索引)
  - Desc: 新增 `POST /api/templates/:id/versions`、`POST /api/templates/:id/rollback`；支持复制当前代码生成新版本、按指定版本回滚并更新 Template.version。
  - _Leverage: backend/prisma/models Template/TemplateVersion_
  - _Requirements: 需求/版本管理, 设计/API-版本管理_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 后端工程师 | Task: 新增版本创建与回滚服务/路由，确保 semver 检查与事务一致性 | Restrictions: 版本重复返回 409；回滚仅允许已存在版本 | _Leverage: Prisma | _Requirements: 版本管理 | Success: 版本创建/回滚接口按规范返回，DB 记录正确 | Instructions: 按进度更新任务状态。_

- [ ] 6. 搜索/展示：模板与组件候选可见
  - Files: backend/src/services/templateIndex.ts, frontend/src/pages/TemplateLibrary.tsx
  - Steps（后端）: 保持按 type 过滤与排序；（前端）TemplateLibrary 支持 type 切换/新建 ComponentsLibrary。
  - _Leverage: templateSDK.search/get_
  - _Requirements: 需求/前端可见性, 设计/Overview-前端自动可见_
  - _Prompt: Implement the task for spec template-library-module... | Success: 导入后即可在前端看到新页面与候选组件 | Instructions: 状态更新。_
  - Files: frontend/src/pages/ComponentsLibrary.tsx (new), frontend/src/lib/router.ts, frontend/src/components/DashboardSidebar.tsx
  - Desc: 基于 TemplateLibrary 复用，默认过滤 `type=component`，提供分类/关键词筛选与预览。
  - _Leverage: frontend/src/pages/TemplateLibrary.tsx, frontend/src/services/templateSDK.ts_
  - _Requirements: 需求/组件库, 设计/前端页面与模块_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师（React+Vite+TS） | Task: 新增 ComponentsLibrary 页面并接入路由/侧边栏，默认展示 component 类型模板 | Restrictions: 2 空格缩进、TSX、遵循现有样式 | _Leverage: TemplateLibrary 代码 | _Requirements: 组件库 | Success: 页面可检索与预览组件模板，并从侧边栏可达 | Instructions: 更新任务状态标记。_

- [ ] 7. 前端：装配视图排序/删除与预览（无表单）
  - Files: frontend/src/components/AIEditorWithNewUI.tsx
  - Desc: 组件候选选择、上/下移动、删除、预览刷新；不做表单。
  - _Leverage: templateSDK.compose/render_
  - _Requirements: 需求/装配（无表单）
  - _Prompt: Implement the task for spec template-library-module... | Success: 可排序/删除并实时预览 | Instructions: 状态更新。_
  - Files: frontend/src/components/AIEditorWithNewUI.tsx
  - Desc: 为选中组件/页面基于 `schemaJson` 生成表单（基础类型映射），支持上/下移动、删除 section，实时预览。
  - _Leverage: templateSDK.compose/render, 现有编辑器 UI_
  - _Requirements: 需求/装配, 需求/业务规则-Schema要求, 设计/前端页面与模块_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 在编辑器中加入 Schema 表单渲染与组件排序能力，表单变更触发 compose 预览刷新 | Restrictions: 不引入大型表单库，优先轻量实现；保持 UI 一致 | _Leverage: 现有 compose 流程 | _Requirements: 装配+Schema | Success: 可对组件 props 表单化编辑并预览更新；列表可移动/删除 | Instructions: 照流程更新任务状态。_

- [ ] 8. 性能与日志：导入耗时与关键日志
  - Files: backend/src/services/importer/zipImporter.ts
  - Desc: 统计耗时、记录页面/组件计数、失败原因；warn/error 分级，含 request id。
  - _Leverage: logger_
  - _Requirements: 需求/自动化, 需求/观测性
  - _Prompt: Implement the task for spec template-library-module... | Success: 日志包含耗时与统计 | Instructions: 状态更新。_

- [ ] 9. 前端：一键导出集成
  - Files: frontend/src/components/AIEditorWithNewUI.tsx, frontend/src/pages/TemplateLibrary.tsx
  - Desc: 在编辑器与库页面增加“导出”按钮，调用 `GET /api/templates/:id/export` 下载 ZIP（或对 compose 结果前端打包作为兜底）。
  - _Leverage: templateSDK（新增 export 方法）, 文件下载工具_
  - _Requirements: 需求/导出, 设计/API-导出ZIP_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 前端工程师 | Task: 集成导出功能并提供下载交互 | Restrictions: 避免阻塞主线程，提供错误提示 | _Leverage: fetch 下载流 | _Requirements: 导出 | Success: 点击可下载包含预览的 ZIP 包 | Instructions: 更新任务状态标记。_

- [ ] 10. 共享类型：导入结果与模板枚举
  - Files: shared/types.ts
  - Desc: 新增 `TemplateManifest`、`TemplateAIHints`、`TemplateType`、`TemplateEngine` 等类型；不破坏现有导出。
  - _Leverage: shared/types.ts_
  - _Requirements: 需求/上传包规范, 设计/Best Practices_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: TypeScript 工程师 | Task: 在 shared/types.ts 补充 manifest 与 hints 类型定义并导出 | Restrictions: 不修改现有接口字段；仅新增类型 | _Leverage: 共享类型文件 | _Requirements: 上传包规范 | Success: 前后端可引入这些类型编译通过 | Instructions: 按进度更新任务状态。_

- [ ] 11. 冒烟测试脚本：导入/渲染/组装/导出
  - Files: test-import-manifest.js (repo root)
  - Desc: 使用示例 ZIP（含 manifest/schema）调用 `/import-zip`、`/search`、`/render`、`/compose`、`/:id/export`，校验关键返回与文件。
  - _Leverage: test-*.js 现有脚本风格_
  - _Requirements: 需求/验收标准, 设计/Testing Strategy_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA 工程师 | Task: 编写 Node 脚本依序调用服务并断言响应码与关键字段 | Restrictions: 不引入额外依赖；使用 node 原生或轻量库 | _Leverage: 现有 test-*.js | _Requirements: 验收标准 | Success: 脚本可在本地跑通并输出通过摘要 | Instructions: 开始设为 [-]，完成改为 [x]。_

- [ ] 12. 安全与日志：导入与渲染日志埋点
  - Files: backend/src/services/importer/zipImporter.ts, backend/src/services/templateRenderer.ts
  - Desc: 为关键操作增加 warn/error 级别日志（含 request id），便于问题追溯；对 422/409 等返回进行统一日志格式。
  - _Leverage: backend/src/utils/logger.ts_
  - _Requirements: 需求/非功能性-观测性, 设计/Security & Compliance_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 后端工程师 | Task: 加入规范化日志与错误分级，确保敏感信息不落盘 | Restrictions: 不打印用户上传原始内容；仅记录必要上下文 | _Leverage: logger | _Requirements: 观测性 | Success: 日志包含操作类别、耗时、结果、错误摘要 | Instructions: 按进度更新任务状态。_

- [ ] 13. 文档：仅静态文件上传说明
  - Files: docs/templates/manifest-schema-examples.md (new)
  - Desc: 提供 `manifest.json` 与 `schema.json` 示例、命名建议、aiHints 使用说明、ZIP 目录结构建议。
  - _Leverage: docs/
  - _Requirements: 需求/上传包规范, 设计/Best Practices_
  - _Prompt: Implement the task for spec template-library-module, first run spec-workflow-guide to get the workflow guide then implement the task: Role: 文档工程师 | Task: 整理示例与约定并形成文档 | Restrictions: 中文撰写；结构清晰；与需求/设计一致 | _Leverage: 现有 docs | _Requirements: 上传包规范 | Success: 团队可按文档产出合规 ZIP 包 | Instructions: 按进度更新任务状态。_

---

补充细化明细（实现指引）

- Importer 函数与变量
  - 常量 `ALLOWED_EXTS`；函数 `isAllowed()`, `safeJoinUploads()`, `rewriteAssets()`, `tryCompile()`；变量 `assetsBase`。
  - 日志输出结构：info（importId, pages, components, durationMs）、warn（skipped file）、error（message）。

- 组件候选选择器清单
  - header:first, footer:first, section.hero:first, .hero:first, .pricing:first, section.pricing:first, [class*=pricing]:first, .features:first, [class*=feature]:first, .team:first, [class*=team]:first, .service:first, [class*=service]:first

- 预览校验
  - `<base href="/uploads/u_.../">` 存在；iframe 渲染无 404；返回 html 非空。

- 前端 UI 改动点
  - `TemplateLibrary.tsx`：type 切换、空态、错误 toast、预览 iframe `srcDoc`。
  - 装配视图：候选选择、上/下移动/删除、预览调用 compose。

- 冒烟脚本断言
  - 导入响应 pages/components 至少一个；
  - 搜索 `type=page|component` 可命中；
  - compose/render 成功返回 html；导出 ZIP 可下载。
