# Requirements Document

## Introduction

本规划围绕“规划:执行总览”，聚焦双源模板入库、提示词到模板的自动化流水线、AI 建站编排与前端体验改造。目标是在既有模板导入能力的基础上，补齐 UI 提示词落库、组件生成、知识库索引、AI 自动组合与监控运维，形成可审计、可回滚、可追踪的全链路能力。

## Alignment with Product Vision

该能力支撑平台“AI 驱动建站”愿景：让运营与模型协同维护可复用的模板资产，保障素材质量、提升组合效率，并为最终用户提供更智能的建站体验。通过统一入库、知识索引与 AI 编排，确保生成站点可预览、可发布且便于追踪。

## Requirements

### Requirement 1

**User Story:** 作为模板运营专员，我希望 ZIP 模板与 UI 提示词都能落到同一模板库，以便统一版本管理和溯源。

#### Acceptance Criteria

1. WHEN 运营人员通过 `POST /api/templates/import-zip` 上传符合目录规范的 ZIP THEN 系统 SHALL 校验目录结构、`template.json`、`schema.json`、`preview.html` 并记录校验日志。
2. IF ZIP 缺少必需元数据 OR 预览渲染失败 THEN 系统 SHALL 拒绝入库并返回可读错误，日志内含失败原因与文件路径。
3. WHEN 运营人员调用 UI 提示词上传接口（批量 JSON 粘贴） THEN 系统 SHALL 在 `ui_prompts` 表写入名称、原始文本、标签、状态、生成记录并与模板 slug 关联。
4. WHEN ZIP 或提示词成功入库 THEN 系统 SHALL 分配 slug、版本号并写入统一模板存储，后续可通过版本接口查询。

### Requirement 2

**User Story:** 作为自动化流水线工程师，我希望提示词可以自动生成组件模板包，从而缩短人工加工周期。

#### Acceptance Criteria

1. WHEN PromptParser 接收到 Markdown 提示词 THEN 系统 SHALL 拆分主组件、demo、依赖文件、CSS 片段、npm 依赖与实施指南并生成结构化结果。
2. WHEN ComponentBuilder 执行生成流程 THEN 系统 SHALL 写入 `components/ui`、整理依赖、拼装 demo 与静态资源，生成 `preview.html`。
3. WHEN 解析到依赖组件已存在 THEN 系统 SHALL 生成 `PackagePatch` 与 `StylePatch` 避免重复导入，并输出合并脚本供 DevOps 执行。
4. WHEN SchemaGenerator 运行 THEN 系统 SHALL 从提示词状态与常量生成 `schema.json` 与默认数据，并校验 JSON 结构。
5. WHEN 模板包生成完成 THEN 系统 SHALL 打包 ZIP、调用导入接口落库、记录 slug/版本；若导入失败 THEN 系统 SHALL 挂起任务等待人工复核或自动重试。

### Requirement 3

**User Story:** 作为知识库管理员，我希望模板索引与提示策略自动更新，以便模型始终使用最新资产。

#### Acceptance Criteria

1. WHEN 新模板入库成功 THEN 系统 SHALL 更新模板索引服务并生成用途摘要、关键字段、标签。
2. WHEN 客户端调用 `GET /api/templates/summary` THEN 系统 SHALL 返回最新的页面/组件/主题模板摘要与标签。
3. WHEN Prompt 策略更新触发 THEN 系统 SHALL 将模板摘要与示例计划嵌入系统提示，约束模型仅引用登记的 slug 并输出标准 `TemplatePlan` JSON。
4. IF 模板知识库规模导致提示长度超限 THEN 系统 SHALL 支持分场景或分页注入并记录策略选型。

### Requirement 4

**User Story:** 作为 AI 建站编排器产品负责人，我希望对话式建站能够自动挑选并组合模板，提供可预览、可发布的站点。

#### Acceptance Criteria

1. WHEN TemplatePlanner 接收到用户上下文 THEN 系统 SHALL 结合模板索引调用模型生成页面与组件组合方案，包含数据填充与主题选择。
2. WHEN TemplateComposer 执行方案 THEN 系统 SHALL 校验 slug 与 schema，补齐默认值或在失败时回退到默认模板。
3. WHEN `generateWebsiteStream` 流程运行 THEN 系统 SHALL 推送文本、计划、预览 HTML 阶段性结果，并在失败时自动重试或降级。
4. WHEN 生成完成 THEN 系统 SHALL 保存 plan/HTML 快照，支持版本回滚与审计查询。

### Requirement 5

**User Story:** 作为前端使用者与运营人员，我希望 AI 编辑器与管理界面更易用，以便快速查看与管理生成结果。

#### Acceptance Criteria

1. WHEN AI 回复生成代码 THEN 前端 SHALL 自动触发 `onCodeUpdate` 并展示所用页面/组件、主题与关键字段。
2. WHEN 运营人员管理提示词导入 THEN 系统 SHALL 提供批量导入、状态追踪、错误重试与 schema 手动编辑界面。
3. WHEN 新依赖产生 THEN 依赖合并工具 SHALL 生成 `package.json` 与 Tailwind 增量 patch，并提供 CLI/脚本供开发者应用。
4. WHEN 监控面板访问 THEN 系统 SHALL 展示模板使用频率、生成成功率、失败原因与模型调用耗时。

### Requirement 6

**User Story:** 作为平台运维与质量负责人，我希望建立自动化测试与监控流程，以保障链路稳定可追溯。

#### Acceptance Criteria

1. WHEN 开发新增 PromptParser 或 SchemaGenerator 能力 THEN 测试套件 SHALL 覆盖单测与端到端链路（提示词→模板→AI 生成）。
2. WHEN 前端对话生成流程上线 THEN E2E 测试 SHALL 覆盖核心路径并在 CI 中运行。
3. WHEN AI 组合流程触发 THEN 埋点 SHALL 记录模板命中率、回退比例、依赖缺失告警并推送告警。
4. WHEN 操作手册发布 THEN 文档 SHALL 覆盖提示词编写、ZIP 规范、审核流程，并完成运营/客服培训签到。

## Non-Functional Requirements

### Code Architecture and Modularity
- 流水线组件（PromptParser、ComponentBuilder、SchemaGenerator、TemplatePlanner）需模块化，遵循单一职责，便于独立测试与部署。
- 依赖处理、版本管理与索引服务需通过清晰接口与事件通知 decouple，避免紧耦合。

### Performance
- ZIP 或提示词入库全流程（含校验与落库）平均耗时不超过 5 分钟，异常情况需在 60 秒内返回失败原因。
- TemplatePlanner + TemplateComposer 在常规站点生成下应于 30 秒内输出首个预览片段。

### Security
- 所有导入路径需进行目录穿越防护，静态资源仅允许写入指定 uploads 目录。
- 模型调用返回的 JSON 需严格校验 schema，失败时走降级路径并记录安全日志。

### Reliability
- 流水线需支持失败重试与人工挂起；失败任务必须保留原始输入供复核。
- 版本管理与快照需持久化，任何回滚操作都可审计。
- 按“周 1-9”的迭代节奏推进，每周结束生成状态报告，持续阶段聚焦模板扩充与指标优化。

### Usability
- 前端界面需提供清晰的模板与提示词状态显示、错误提示与重试入口。
- 运营后台需提供使用反馈收集入口，以支持持续优化模板与 prompt。
