# Tasks Document

- [x] 1.1 ZIP 导入目录与元数据校验
  - Files: backend/src/services/importer/zipImporter.ts, backend/src/utils/templates/zipSchemaValidator.ts (new)
  - Steps:
    1) 实现 `zipSchemaValidator` 校验必需目录与文件（template.json/schema.json/preview.html）；
    2) 在 zipImporter 中调用校验器，返回结构化错误码；
    3) 为缺失或非法文件生成详细错误消息（含路径、字段）。
  - _Leverage: 现有 zipImporter, logger_
  - _Requirements: Requirement 1, 阶段 1 ZIP 导入_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 后端工程师 | Task: 引入 zipSchemaValidator 并在 zipImporter 中执行目录与元数据校验 | Restrictions: 不修改成功路径逻辑；错误需走自定义异常 | _Leverage: zipImporter | _Requirements: Requirement 1 | Success: 任一必需文件缺失时返回 400 与详细错误 | Instructions: 状态按规范标记。_

- [x] 1.2 ZIP 导入日志与索引事件
  - Files: backend/src/services/importer/zipImporter.ts, backend/src/routes/templates.ts, backend/src/events/templateEvents.ts (new)
  - Steps:
    1) 在 zipImporter 记录耗时、importId、模板数量的 info 日志；
    2) 导入成功/失败时分别触发 `TemplateImported` 与 `TemplateImportFailed` 事件；
    3) 在 templates 路由订阅事件，调用 TemplateIndexService.refresh。
  - _Leverage: logger, TemplateIndexService_
  - _Requirements: Requirement 1, 阶段 1 ZIP 导入_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 后端工程师 | Task: 为 ZIP 导入链路补充日志并触发索引刷新事件 | Restrictions: 事件发布需可测试；失败时记录 error 日志 | _Leverage: TemplateIndexService | _Requirements: Requirement 1 | Success: 导入成功触发 refresh，失败日志完整 | Instructions: 状态按规范标记。_

- [x] 1.3 `/api/templates/import-zip` 接口文档更新
  - Files: docs/api/templates.md (new or update), backend/src/routes/templates.ts
  - Steps:
    1) 更新接口描述、请求示例、响应结构、错误码说明；
    2) 在路由中引用新文档链接（注释或 swagger 注解）；
    3) 校验返回结构与文档一致。
  - _Leverage: 现有 API 文档结构_
  - _Requirements: Requirement 1, 阶段 1 ZIP 导入_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 技术文档工程师 | Task: 完善 import-zip 接口文档与实现一致性检查 | Restrictions: 文档使用 ASCII；示例覆盖成功与失败 | _Leverage: existing docs | _Requirements: Requirement 1 | Success: 文档被引用且通过校验脚本 | Instructions: 状态按规范标记。_

- [x] 1.4 Prisma 模型：ui_prompts 与流水线表
  - Files: backend/prisma/schema.prisma, backend/prisma/migrations/*
  - Steps:
    1) 增加 `UiPrompt`、`PromptGenerationRun`、`TemplatePipelineJob` 模型与枚举；
    2) 生成迁移并更新 Prisma Client；
    3) 在 `shared/types.ts` 补充对应类型。
  - _Leverage: Prisma schema, shared/types.ts_
  - _Requirements: Requirement 1, 阶段 1 提示词入库_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 数据库工程师 | Task: 定义提示词与流水线相关数据模型并生成迁移 | Restrictions: 字段命名符合 snakeCase -> camelCase 映射；migration 描述清晰 | _Leverage: Prisma | _Requirements: Requirement 1 | Success: Prisma migrate 成功，类型文件更新 | Instructions: 状态按规范标记。_

- [x] 1.5 提示词导入接口（批量 JSON/Markdown）
  - Files: backend/src/routes/prompts.ts (new), backend/src/services/prompts/promptService.ts (new), backend/src/services/prompts/promptRepository.ts (new)
  - Steps:
    1) 实现 `POST /api/prompts/import` 支持 JSON 数组与 Markdown 文本；
    2) 使用 PromptRepository 写入 UiPrompt 与初始 job 记录；
    3) 返回批量结果（成功/失败/已存在），含 jobId。
  - _Leverage: Prisma client, validation middleware_
  - _Requirements: Requirement 1, 阶段 1 提示词入库_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 后端工程师 | Task: 开发提示词导入接口并处理批量幂等 | Restrictions: 重复导入需返回 409 或 skip；记录操作日志 | _Leverage: Prisma, logger | _Requirements: Requirement 1 | Success: 批量导入返回每条状态，DB 记录正确 | Instructions: 状态按规范标记。_

- [x] 1.6 提示词状态查询与重试 API
  - Files: backend/src/routes/prompts.ts, backend/src/services/prompts/promptService.ts
  - Steps:
    1) 实现 `GET /api/prompts/:id` 返回提示词详情、最新流水线状态、错误信息；
    2) 实现 `POST /api/prompts/:id/retry` 重新入队失败任务；
    3) 加入权限/速率限制与错误处理。
  - _Leverage: PipelineOrchestrator, Prisma_
  - _Requirements: Requirement 1, 阶段 1 提示词入库_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 后端工程师 | Task: 提供提示词状态查询与重试接口 | Restrictions: 重试次数限制；失败响应 409 | _Leverage: orchestrator | _Requirements: Requirement 1 | Success: 接口返回准确状态，失败任务可成功重试 | Instructions: 状态按规范标记。_

- [x] 2.1 PromptParser 解析引擎
  - Files: backend/src/services/pipeline/promptParser.ts, backend/src/services/pipeline/__tests__/promptParser.test.ts
  - Steps:
    1) 将 Markdown 转 AST，解析主组件、demo、依赖文件、CSS、npm 依赖、实施指南；
    2) 输出 `ParsedPrompt`，缺失段落时附带警告；
    3) 单测覆盖成功、缺字段、语法错误。
  - _Leverage: remark/markdown-it, shared/types.ts_
  - _Requirements: Requirement 2, 阶段 1 解析组件提示词_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 工程师 | Task: 实现 PromptParser 并补单测 | Restrictions: 不写文件；返回结构化 warning | _Leverage: Markdown AST | _Requirements: Requirement 2 | Success: 测试通过并输出完整 ParsedPrompt | Instructions: 状态按规范标记。_

- [x] 2.2 componentBuilder：源码与 demo 生成
  - Files: backend/src/services/pipeline/componentBuilder.ts, backend/src/services/pipeline/__tests__/componentBuilder.test.ts
  - Steps:
    1) 将 ParsedPrompt 主组件写入临时目录 `components/ui`；
    2) 复制 demo、静态资源并生成 `index.tsx`/`demo.tsx`；
    3) 单测验证文件生成、命名冲突处理。
  - _Leverage: fs/promises, 模板片段_
  - _Requirements: Requirement 2, 阶段 2 ComponentBuilder_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 全栈工程师 | Task: 编写 componentBuilder 生成组件及 demo | Restrictions: 仅写入 tmp；生成文件需记录 manifest | _Leverage: template utilities | _Requirements: Requirement 2 | Success: 生成结果包含组件、demo、资源，测试通过 | Instructions: 状态按规范标记。_

- [x] 2.3 PackagePatchFactory 与依赖校验
  - Files: backend/src/services/pipeline/packagePatchFactory.ts, backend/src/services/pipeline/__tests__/packagePatchFactory.test.ts
  - Steps:
    1) 比较现有 `package.json` 与新依赖生成 PackagePatch；
    2) 根据 ParsedPrompt 的 CSS 与 Tailwind 配置生成 StylePatch；
    3) 冲突时输出警告与合并脚本说明。
  - _Leverage: package.json 解析工具, Tailwind 配置读取_
  - _Requirements: Requirement 2, 阶段 2 依赖处理_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 工程师 | Task: 生成依赖与样式补丁避免重复导入 | Restrictions: 不直接写 package.json；输出 patch JSON | _Leverage: JSON diff 工具 | _Requirements: Requirement 2 | Success: 生成 patch 文件并附冲突提示 | Instructions: 状态按规范标记。_

- [x] 2.4 PreviewBuilder 与静态预览
  - Files: backend/src/services/pipeline/previewBuilder.ts, backend/src/services/pipeline/__tests__/previewBuilder.test.ts
  - Steps:
    1) 使用 demo 渲染静态 HTML，必要时调用 headless 浏览器生成截图；
    2) 支持主题注入与资源路径重写；
    3) 单测覆盖渲染成功、资源缺失警告。
  - _Leverage: existing renderTemplate, cheerio_
  - _Requirements: Requirement 2, 阶段 2 预览产出_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 工作流工程师 | Task: 构建 previewBuilder 生成 HTML/截图 | Restrictions: 截图可选；警告需记录 | _Leverage: renderTemplate | _Requirements: Requirement 2 | Success: 产出 preview.html 并可附截图 | Instructions: 状态按规范标记。_

- [x] 2.5 SchemaGenerator 与默认数据
  - Files: backend/src/services/pipeline/schemaGenerator.ts, backend/src/services/pipeline/__tests__/schemaGenerator.test.ts
  - Steps:
    1) 基于 ParsedPrompt 状态/常量生成 schema.json 与 defaults.json；
    2) 校验 JSON schema 正确性并输出错误定位；
    3) 单测覆盖字段映射、缺省值、错误场景。
  - _Leverage: jsonschema 库, shared/types.ts_
  - _Requirements: Requirement 2, 阶段 2 SchemaGenerator_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 工程师 | Task: 生成 schema 与默认数据 | Restrictions: schema 必须通过 validator；类型补充 shared/types | _Leverage: jsonschema | _Requirements: Requirement 2 | Success: schema/defaults 文件生成且测试通过 | Instructions: 状态按规范标记。_

- [x] 2.6 PipelineOrchestrator：打包导入与挂起
  - Files: backend/src/services/pipeline/pipelineOrchestrator.ts, backend/src/services/pipeline/__tests__/pipelineOrchestrator.test.ts
  - Steps:
    1) 串联 PromptParser → ComponentBuilder → SchemaGenerator → PreviewBuilder → ZIP 打包；
    2) 调用 `/api/templates/import-zip` 完成落库，记录 slug/version；
    3) 处理失败重试与挂起逻辑，写入 TemplatePipelineJob；
    4) 单测覆盖成功、失败、重试流程。
  - _Leverage: zipImporter, TemplateVersioning_
  - _Requirements: Requirement 2, 阶段 2 打包导入_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 工作流工程师 | Task: 实现 pipelineOrchestrator 串联各步骤并处理失败 | Restrictions: 重试次数可配置；失败保留 artifacts | _Leverage: zipImporter | _Requirements: Requirement 2 | Success: 自动流水线可落库且失败挂起待复核 | Instructions: 状态按规范标记。_

- [x] 2.7 后台审核页面数据接口
  - Files: backend/src/routes/prompts.ts (list), backend/src/services/prompts/promptService.ts, backend/src/services/prompts/promptAssembler.ts (new)
  - Steps:
    1) 新增列表接口，返回提示词、流水线任务、生成模板摘要；
    2) 提供依赖 patch 下载、预览地址；
    3) 支持分页、状态筛选。
  - _Leverage: Prisma, TemplateIndexService_
  - _Requirements: Requirement 2, 阶段 2 后台审核_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 后端工程师 | Task: 构建后台审核所需数据聚合接口 | Restrictions: 单次查询限制分页；响应包含 slug 列表 | _Leverage: Prisma | _Requirements: Requirement 2 | Success: 审核界面可展示完整生成结果 | Instructions: 状态按规范标记。_

- [x] 3.1 TemplateIndexService 摘要扩展
  - Files: backend/src/services/templateIndex.ts, backend/src/services/templateIndex/__tests__/templateIndex.test.ts
  - Steps:
    1) 聚合页面/组件/主题模板，生成用途摘要、关键字段、标签；
    2) 缓存摘要并支持手动 refresh；
    3) 单测覆盖新增字段与缓存失效。
  - _Leverage: TemplateIndexService, Prisma_
  - _Requirements: Requirement 3, 阶段 3 模板索引_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 后端工程师 | Task: 扩展模板索引生成摘要与标签 | Restrictions: 缓存过期时间可配置；摘要长度受限 | _Leverage: TemplateIndexService | _Requirements: Requirement 3 | Success: summary 数据正确且可刷新 | Instructions: 状态按规范标记。_

- [x] 3.2 `GET /api/templates/summary` 接口
  - Files: backend/src/routes/templates.ts, shared/types.ts, backend/src/services/templates/templatesController.ts (new)
  - Steps:
    1) 暴露 summary 接口，支持 type、tag、keyword 筛选与分页；
    2) 返回模板 slug、摘要、关键字段、版本；
    3) 加入缓存命中指标。
  - _Leverage: TemplateIndexService_
  - _Requirements: Requirement 3, 阶段 3 模板索引_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 后端工程师 | Task: 提供 summary API | Restrictions: 必须鉴权；限制返回数量 | _Leverage: TemplateIndexService | _Requirements: Requirement 3 | Success: 客户端可获取摘要并分页 | Instructions: 状态按规范标记。_

- [x] 3.3 PromptStrategyService 系统提示编排
  - Files: backend/src/services/ai/promptStrategy.ts, backend/src/services/ai/__tests__/promptStrategy.test.ts
  - Steps:
    1) 将模板摘要、示例计划注入系统提示；
    2) 约束模型仅输出已登记 slug，提供 JSON 示例；
    3) 支持分场景/分页注入逻辑，记录策略切换。
  - _Leverage: TemplateIndexService, AI client_
  - _Requirements: Requirement 3, 阶段 3 Prompt 策略_
  - _Prompt: Implement the task for spec template-automation-execution... Role: AI Prompt 工程师 | Task: 构建 PromptStrategyService 并约束 slug 使用 | Restrictions: 超长时需拆分分页；配置化策略 | _Leverage: TemplateIndexService | _Requirements: Requirement 3 | Success: 生成 system prompt 包含有效 slug 清单 | Instructions: 状态按规范标记。_

- [x] 3.4 索引与提示缓存同步
  - Files: backend/src/events/templateEvents.ts, backend/src/services/templateIndex/cacheRefresher.ts (new)
  - Steps:
    1) 订阅导入成功事件更新索引缓存；
    2) 同步 PromptStrategyService 的模板缓存；
    3) 失败时记录降级日志并允许手动刷新。
  - _Leverage: TemplateEvents, cache 层_
  - _Requirements: Requirement 3, 阶段 3 数据同步_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 平台工程师 | Task: 保持模板索引与提示缓存同步 | Restrictions: 失败重试策略可配置；日志需含 templateId | _Leverage: events | _Requirements: Requirement 3 | Success: 导入后索引与提示缓存即时更新 | Instructions: 状态按规范标记。_

- [x] 4.1 TemplatePlanner 模型调用与校验
  - Files: backend/src/services/ai/templatePlanner.ts, backend/src/services/ai/__tests__/templatePlanner.test.ts
  - Steps:
    1) 组装对话上下文 + 模板摘要，调用模型生成 TemplatePlan JSON；
    2) 使用 JSON schema 校验并处理自动重试；
    3) 记录模型响应与降级策略。
  - _Leverage: PromptStrategyService, AI provider_
  - _Requirements: Requirement 4, 阶段 4 TemplatePlanner_
  - _Prompt: Implement the task for spec template-automation-execution... Role: AI 后端工程师 | Task: 实现 TemplatePlanner 并校验模型输出 | Restrictions: schema 校验失败自动重试≤2次；保留原始响应 | _Leverage: AI client | _Requirements: Requirement 4 | Success: 返回有效 TemplatePlan 且日志完整 | Instructions: 状态按规范标记。_

- [x] 4.2 TemplateComposer 模板组合与默认值补齐
  - Files: backend/src/services/ai/templateComposer.ts, backend/src/services/ai/__tests__/templateComposer.test.ts
  - Steps:
    1) 校验 plan 中 slug/schema 是否存在，缺失则补默认值或回退；
    2) 调用 composePage/renderTemplate 生成 HTML/CSS/JS；
    3) 失败时记录降级并返回默认模板。
  - _Leverage: TemplateRepository, TemplateVersioning_
  - _Requirements: Requirement 4, 阶段 4 TemplateComposer_
  - _Prompt: Implement the task for spec template-automation-execution... Role: Node.js 后端工程师 | Task: 组合模板并保障 schema 一致性 | Restrictions: 禁止写入生产模板；快照保存 plan+HTML | _Leverage: renderTemplate | _Requirements: Requirement 4 | Success: 可生成最终 HTML 并留存快照 | Instructions: 状态按规范标记。_

- [x] 4.3 generateWebsiteStream 流式输出
  - Files: backend/src/routes/ai/generate.ts, backend/src/services/ai/streamEmitter.ts, frontend/src/services/aiApi.ts
  - Steps:
    1) 扩展 streamEmitter 推送 plan、阶段日志、preview HTML；
    2) 在路由中接入 TemplatePlanner/Composer 并处理重试；
    3) 返回流式事件格式文档。
  - _Leverage: existing generateWebsiteStream, WebSocket/SSE_
  - _Requirements: Requirement 4, 阶段 4 流式支持_
  - _Prompt: Implement the task for spec template-automation-execution... Role: AI 后端工程师 | Task: 优化 generateWebsiteStream 推送阶段结果 | Restrictions: 失败需自动降级；事件 schema 与前端匹配 | _Leverage: stream pipeline | _Requirements: Requirement 4 | Success: 前端可实时收到 plan 与预览 | Instructions: 状态按规范标记。_

- [x] 4.4 模板版本快照与回滚
  - Files: backend/src/services/templateVersioning.ts, backend/src/routes/templates.ts, backend/prisma/schema.prisma (TemplateSnapshot 模型)
  - Steps:
    1) 保存每次生成的 plan/HTML/CSS/JS 到 TemplateSnapshot；
    2) 扩展版本管理接口支持快照回滚；
    3) 记录审计日志，提供回滚操作人。
  - _Leverage: TemplateVersioning, Prisma_
  - _Requirements: Requirement 4, 阶段 4 版本管理_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 平台工程师 | Task: 实现模板快照保存与回滚 | Restrictions: 回滚需鉴权；版本冲突返回 409 | _Leverage: versioning service | _Requirements: Requirement 4 | Success: 可查询快照并执行回滚 | Instructions: 状态按规范标记。_

- [x] 5.1 Prompt 管理前端：列表与详情
  - Files: frontend/src/pages/PromptAdmin.tsx, frontend/src/components/prompt/PromptTable.tsx, frontend/src/stores/promptStore.ts
  - Steps:
    1) 构建提示词列表，展示状态、错误、最新 job；
    2) 支持筛选、分页、下载 patch；
    3) 详情面板展示组件预览、schema 编辑入口。
  - _Leverage: API client, UI 组件库_
  - _Requirements: Requirement 5, 阶段 5 上传管理界面_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 前端工程师 | Task: 构建 Prompt 管理界面基础列表与详情 | Restrictions: 遵循设计系统；错误提示友好 | _Leverage: Table/Modal | _Requirements: Requirement 5 | Success: 界面展示完整信息且交互流畅 | Instructions: 状态按规范标记。_

- [x] 5.2 Prompt 管理前端：批量导入与重试
  - Files: frontend/src/components/prompt/PromptImportModal.tsx, frontend/src/services/promptApi.ts
  - Steps:
    1) 实现 JSON/Markdown 粘贴导入 UI，调用 `/api/prompts/import`；
    2) 支持错误提示与分批导入；
    3) 在界面中触发 retry API 并反馈结果。
  - _Leverage: 前端表单组件, promptStore_
  - _Requirements: Requirement 5, 阶段 5 上传管理界面_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 前端工程师 | Task: 实现批量导入与重试交互 | Restrictions: 导入前校验 JSON；loading 状态明确 | _Leverage: promptApi | _Requirements: Requirement 5 | Success: 用户可批量上传并重试失败项 | Instructions: 状态按规范标记。_

- [x] 5.3 AI 编辑器：流式结果与模板展示
  - Files: frontend/src/pages/AiEditor.tsx, frontend/src/components/TemplatePlanSidebar.tsx, frontend/src/stores/aiEditorStore.ts
  - Steps:
    1) 消费流式事件，实时刷新代码与 plan；
    2) 展示所用模板、组件、主题、关键字段；
    3) 隐藏手动组合入口，提供回滚历史。
  - _Leverage: 现有 AI 编辑器, stream hooks_
  - _Requirements: Requirement 5, 阶段 5 简化 AI 编辑器_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 前端工程师 | Task: 升级 AI 编辑器消费流式 plan 并展示模板信息 | Restrictions: 状态管理与既有一致；错误提示清晰 | _Leverage: AiEditor components | _Requirements: Requirement 5 | Success: 对话生成实时刷新且显示模板详情 | Instructions: 状态按规范标记。_

- [x] 5.4 依赖合并 CLI
  - Files: server-scripts/merge-template-patches.ts, server-scripts/README.md
  - Steps:
    1) 读取 PackagePatch/StylePatch，生成合并建议；
    2) 提供 dry-run 与 apply 选项；
    3) 文档说明使用流程与注意事项。
  - _Leverage: Node CLI utils, package.json parser_
  - _Requirements: Requirement 5, 阶段 5 依赖合并工具_
  - _Prompt: Implement the task for spec template-automation-execution... Role: DevOps 工程师 | Task: 开发依赖合并 CLI 辅助 DevOps 应用 patch | Restrictions: 默认 dry-run；apply 前需确认 | _Leverage: existing scripts | _Requirements: Requirement 5 | Success: CLI 输出清晰 diff，文档指导使用 | Instructions: 状态按规范标记。_

- [x] 5.5 监控统计 API 与前端面板
  - Files: backend/src/routes/metrics.ts, backend/src/services/metrics/templateMetricsService.ts, frontend/src/pages/TemplateInsights.tsx
  - Steps:
    1) 收集模板使用频率、生成成功率、失败原因、模型耗时指标；
    2) 暴露 `/api/metrics/templates` 与 `/api/metrics/ai` 接口；
    3) 前端绘制图表与过滤器。
  - _Leverage: metrics 工具, chart 组件_
  - _Requirements: Requirement 5, Requirement 6, 阶段 5 监控统计_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 全栈工程师 | Task: 构建模板与 AI 指标监控 API + 前端面板 | Restrictions: API 需鉴权；前端支持时间区间 | _Leverage: metrics infra | _Requirements: Requirement 5 & 6 | Success: 仪表盘实时展示关键指标 | Instructions: 状态按规范标记。_

- [x] 6.1 自动化测试矩阵
  - Files: backend/tests/test-template-pipeline.ts, frontend/tests/e2e/ai-editor.spec.ts, frontend/tests/e2e/prompt-admin.spec.ts
  - Steps:
    1) 编写后端集成测试覆盖提示词→模板→导入→AI 生成；
    2) 编写前端 E2E 覆盖提示词导入、审核、AI 生成；
    3) 在 CI 中配置执行，输出报告。
  - _Leverage: test-*.js 示例, Playwright_
  - _Requirements: Requirement 6, 阶段 6 自动化测试_
  - _Prompt: Implement the task for spec template-automation-execution... Role: QA 工程师 | Task: 构建端到端测试矩阵覆盖核心链路 | Restrictions: 测试可并行；使用 mock 降低依赖 | _Leverage: existing tests | _Requirements: Requirement 6 | Success: 测试在 CI 稳定通过 | Instructions: 状态按规范标记。_

- [x] 6.2 运行监控与告警
  - Files: backend/src/services/metrics/pipelineMetricsCollector.ts, backend/src/services/alerts/alertPublisher.ts (new), docs/operations/pipeline-monitoring.md
  - Steps:
    1) 埋点记录模板命中率、回退比例、依赖缺失告警；
    2) 建立错误告警与人工复核流程（文档化）；
    3) 与监控面板联动显示实时状态。
  - _Leverage: metrics infra, logger_
  - _Requirements: Requirement 6, 阶段 6 运行监控_
  - _Prompt: Implement the task for spec template-automation-execution... Role: DevOps 工程师 | Task: 落实运行监控与告警流程 | Restrictions: 告警渠道配置化；文档 ASCII | _Leverage: metrics tools | _Requirements: Requirement 6 | Success: 告警触发并可复盘，文档可指导运营 | Instructions: 状态按规范标记。_

- [x] 6.3 操作手册与培训资料
  - Files: docs/operations/template-pipeline-manual.md, docs/training/prompt-authoring.md
  - Steps:
    1) 编写提示词编写指南、ZIP 规范、审核流程；
    2) 加入常见错误与排查清单；
    3) 记录培训计划与签到模版。
  - _Leverage: existing docs 模板_
  - _Requirements: Requirement 6, 阶段 6 文档与培训_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 技术写作者 | Task: 整理操作手册与培训资料 | Restrictions: 文档 ASCII；附参考示例 | _Leverage: docs templates | _Requirements: Requirement 6 | Success: 文档覆盖所有流程并可用于培训 | Instructions: 状态按规范标记。_

- [x] 6.4 迭代节奏与调度
  - Files: docs/roadmap/template-automation-execution.md, backend/src/services/pipeline/jobScheduler.ts, backend/src/services/pipeline/__tests__/jobScheduler.test.ts
  - Steps:
    1) 在文档中细化周 1-9 与持续阶段目标与验收；
    2) 实现 jobScheduler 定期输出周报、重试挂起任务、提醒运营；
    3) 单测覆盖调度逻辑与配置化参数。
  - _Leverage: existing job runner, logger_
  - _Requirements: 迭代节奏建议、后续关注点_
  - _Prompt: Implement the task for spec template-automation-execution... Role: 平台工程师 | Task: 落实迭代节奏文档与自动调度机制 | Restrictions: 调度周期可配置；日志记录统计 | _Leverage: job runner | _Requirements: Roadmap guidance | Success: 周期任务执行并生成周报，文档保持同步 | Instructions: 状态按规范标记。_
