# Requirements Document

## Introduction

The AI 编辑器需要支持将生成的网站内容拆分为多文件（HTML、CSS、JS 及资源），并在生成过程中直接落地服务器，避免在聊天窗口输出大量代码导致生成中断。用户希望在编辑器中可靠地生成复杂站点并查看每个文件的源代码，同时保持现有 AI 交互体验。

## Alignment with Product Vision

该能力提升 AI 建站的稳定性与专业度，使生成的网站结构更贴近真实工程项目（多文件结构、独立资源管理），从而支持后续的部署与团队协作，符合产品“让 AI 输出可落地的网站”愿景。

## Requirements

### Requirement 1

**User Story:** 作为一名使用 AI 编辑器生成网站的产品运营，我希望 AI 在生成过程中自动将 HTML、CSS、JS 等资源写入服务器文件结构，而不是一次性返回超长代码，以便生成过程不会因为内容过多而中断。

#### Acceptance Criteria

1. WHEN AI 生成流程启动 THEN 系统 SHALL 流式接收生成片段并写入服务器上的多文件结构，而非将完整代码全部输出到对话窗口。
2. IF 生成过程中网络短暂抖动 THEN 系统 SHALL 能够恢复继续写入剩余片段，而不会因单条消息过长导致中断。
3. WHEN 生成完成 THEN 系统 SHALL 返回包含主页面与附属文件（CSS/JS/资源）的清单供前端展示。

### Requirement 2

**User Story:** 作为一名前端开发，我想在 AI 编辑器右侧的代码模块中按文件夹/文件树查看生成结果，以便快速定位并审阅不同类型的源代码。

#### Acceptance Criteria

1. WHEN 生成完成 THEN 前端 SHALL 在代码模块中显示文件树，至少包含 HTML 页面、CSS、JS 与资源目录。
2. WHEN 用户点击文件节点 THEN 系统 SHALL 加载并展示该文件内容，支持读取超过 100KB 的文件而不阻塞界面。
3. IF 文件更新（例如重复生成或手动调整） THEN 代码模块 SHALL 反映最新内容。

### Requirement 3

**User Story:** 作为一名网站维护人员，我希望生成的资源全部保存在自有服务器（/uploads/websites/{id}/…），而不是引用第三方 CDN，从而确保站点在离线或内网环境下也能正常访问。

#### Acceptance Criteria

1. WHEN AI 引用外部 CSS/JS 资源（含 CDN 链接） THEN 系统 SHALL 下载并改写为本地 `/uploads/websites/{id}/assets/**` 引用。
2. WHEN AI 输出内联 CSS/JS THEN 系统 SHALL 抽取并生成独立文件，主 HTML 引用新的本地路径。
3. IF 资源下载失败 THEN 系统 SHALL 记录日志并向用户提示受影响的文件，同时保留原链接以便手动补齐。

## Non-Functional Requirements

### Code Architecture and Modularity
- 保持前后端拆分：后端负责流式写入、多文件管理，前端负责展示文件树。
- 新增的服务或 hook 应尽量复用现有存储 / API 模块，避免跨层耦合。
- 输出的多文件结构需具备可扩展性，以便未来支持多页面路由或组件复用。

### Performance
- 流式写入需支持至少 5 MB 的生成内容而不引发超时；单个资源下载操作需有 10 秒超时与重试机制。
- 前端文件树加载单个文件的时间不超过 1 秒（200KB 文件在本地测试环境）。

### Security
- 写入路径必须限制在 `/uploads/websites/{websiteId}`；拒绝相对路径穿越。
- 仅登录且拥有网站权限的用户才能请求生成或读取对应文件。

### Reliability
- 生成失败时需保留已写入的部分，同时给出可重试的操作提示；重复生成应覆盖旧文件并保持一次性写入的一致性。
- 提供必要的日志记录（requestId、文件路径、异常详情），方便排查。

### Usability
- 前端需提示多文件结构变更（例如 toast 或提示条），并提供“复制文件内容”的快捷操作。
- 聊天窗口返回的文本应聚焦结果概要与操作指南，避免再次出现超长代码块。
