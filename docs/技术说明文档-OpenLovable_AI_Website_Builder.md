# Open Lovable / AI Website Builder 技术说明文档

本文件对项目的功能、技术栈、整体架构、核心实现细节、数据模型、接口设计、前后端协作与流式机制、部署与运行环境、安全与稳定性策略进行全面梳理，帮助研发/运维/产品同学快速理解与扩展本系统。

---

## 1. 项目综述

- 目标：提供“自然语言对话 -> 实时生成/编辑网页 -> 可视化预览/直改 -> 一键部署”的端到端体验。
- 模式：
  - 对话模式（chat）：用自然语言沟通与澄清需求；
  - 生成模式（generate）：产出完整 HTML/CSS/JS 网页；
  - 编辑模式（edit）：在现有 HTML 上按指令进行局部修改与优化；
  - 优化模式（optimize）：对已有内容做整体优化（性能/可读性等）。
- 特性：SSE 流式反馈、代码与自然语言分流展示、可视化预览直改、域名/DNS/SSL 与 Nginx 自动化部署、Token 使用与成本统计、角色与权限控制、邮件通知。

---

## 2. 技术栈概览

- 前端：React 18、TypeScript、Vite、TailwindCSS、Zustand、Monaco Editor、Framer Motion、i18n。
- 后端：Node.js、Express、TypeScript、Prisma + PostgreSQL、JWT + bcrypt、ws(WebSocket)、SSE(Server-Sent Events)、cron。
- AI 供应商：DeepSeek、OpenAI、Anthropic（Claude），可按用户设置动态切换与选型。
- 部署：Nginx、Certbot(SSL)、systemd 服务、可选宝塔 API 集成（baota）。

---

## 3. 目录结构与关键入口

```
frontend/            React 单页应用
backend/             Express API + 服务
shared/              前后端共享类型定义
server-scripts/      服务器初始化与部署脚本
```

- 前端入口：`frontend/src/main.tsx`、应用根组件 `frontend/src/App.tsx`。
- 后端入口：`backend/src/index.ts`（启动 HTTP + WS，注册路由，中间件与定时任务）。
- 数据模型：`backend/prisma/schema.prisma`（通过 Prisma 访问）。
- 共享类型：`shared/types.ts`（API 泛型 `APIResponse<T>`、Website/User 等）。

---

## 4. 后端架构与实现细节

### 4.1 应用启动与基础中间件

- 文件：`backend/src/index.ts`
  - Helmet CSP：限制资源来源，开发期允许 `unsafe-eval` 便于调试。
  - CORS：白名单包含本地前端端口，开放凭据。
  - 压缩：为避免 SSE 首包/分块延迟，对 `text/event-stream` 显式禁用压缩。
  - Rate Limit：基础限流（每分钟 1000 次，开发更宽松）。
  - Body Parser：JSON 与 urlencoded，10MB 限制。
  - 健康检查：`GET /health`。
  - 全局错误：`unhandledRejection/uncaughtException` 记录日志，生产可选择退出。
  - 优雅关闭：SIGTERM/SIGINT 关闭 HTTP 与数据库连接。
  - WebSocket：`ws` 基于 `setupWebSocket` 初始化心跳与认证（见 §4.10）。
  - Cron：示例任务（SSL 与 DNS 检查占位）。

### 4.2 配置与环境变量

- 文件：`backend/src/config/index.ts`
- 关键配置：
  - `AI_PROVIDER`：默认 `deepseek`，支持 `openai`、`anthropic`。
  - DeepSeek：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`。
  - OpenAI：`OPENAI_API_KEY`、`OPENAI_MODEL`。
  - Anthropic：`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`。
  - JWT：`JWT_SECRET`、`JWT_EXPIRES_IN`。
  - 数据库：`DATABASE_URL`。
  - 前端地址：`FRONTEND_URL`（用于 CORS)。
  - 服务器：站点根目录/ Nginx/ Certbot 路径，IP、域名等。
  - 上传：大小上限与允许的 MIME 类型。

注意：`backend/.env.example` 含有旧的变量名（如 `CLAUDE_API_KEY`、`WEBSITES_ROOT` 等），请以 `src/config/index.ts` 的键为准维护最新配置。

### 4.3 鉴权与权限

- 文件：`backend/src/middleware/auth.ts`
  - `authenticate`：从 `Authorization: Bearer <JWT>` 解析用户，验证签名与过期时间，附着 `req.user`。
  - `requireRole/requireOwnership`：检查角色与资源归属。
- 文件：`backend/src/middleware/roleAuth.ts`
  - 角色：`user/admin/super_admin`，层级与特定权限映射（`PERMISSIONS`）。
  - `requirePermission`：支持基于库表 `user_permissions` 的覆盖与按角色回退。

### 4.4 数据库模型（Prisma）

- 文件：`backend/prisma/schema.prisma`
- 主要实体：
  - `User`：基础账户、角色、限额。
  - `Website`：网站主体，含 `content/html/css/js` 字段与部署状态/时间。
  - `AIConversation`/`AIMessage`：对话与消息历史，支持记录结构化 `websiteChanges`。
  - `UserSettings`：每用户 AI 配置（供应商/模型/三类提示词）及通知/安全/偏好设置。
  - `TokenUsage`：按天/小时/供应商记录 Token 用量与人民币成本，支持 `model/operation` 维度。
  - `Deployment`：部署记录（域名、路径、日志、状态）。
  - `SystemSettings`：系统级设置（如 SMTP）。
  - `UserPermission`：用户级权限覆盖。

### 4.5 AI 服务抽象与三种提示词

- 文件：`backend/src/services/ai.ts`
  - 接口 `AIProvider`：定义 `chat/chatStream/generateWebsite/generateWebsiteStream/editWebsite/editWebsiteStream/optimizeWebsite` 等方法。
  - Provider 实现：DeepSeek（默认）、OpenAI、Anthropic；根据用户 `UserSettings.aiProvider` 与对应 API Key/Model 选择。
  - 三种提示词：`chat/generate/edit`，函数 `getUserPrompt(userId, PromptType)` 与路由侧 `getUserPromptByMode` 会按优先级“专用 > 通用 > 默认”选择。
  - Token 统计：收到供应商返回的 `usage` 后调用 `TokenTracker.recordUsage` 记账（见 §4.6）。

#### 4.5.1 HTML 提取与标准化

- 函数：`extractPureHtmlFromResponse(content)` + `standardizeHtmlDocument(content)`
  - 作用：从 LLM 输出中剥离 Markdown 围栏与描述性文字，过滤不完整/重复标签序列，必要时标准化为 `<!DOCTYPE html> + <html lang="zh-CN"> + ... + </html>` 结构，以保证前端实时渲染稳定性与完整性。
  - 用途：流式生成时仅向前端推送“净化后的 HTML 片段”，避免描述文字进入代码编辑器。

#### 4.5.2 流式（SSE）生成/编辑

- 生成：`POST /api/ai/generate-stream`
  - 后端：根据用户配置选择 Provider，调用 `generateWebsiteStream`，逐块推送 `{type: 'html_chunk', content, fullHtml}`；完成后可进行完整性检查与自动补全。
  - 前端：`aiService.generateWebsiteStream` 使用 `fetch + ReadableStream` 解析 `data:` 行，实时拼接到编辑器与预览。

- 编辑：`POST /api/ai/edit-stream`
  - 后端：基于当前网站 `content` 与 `instructions` 调用 Provider 的 `editWebsite` 或流式版本，按 `{type: 'content_chunk'}` 推送，完成后落库。
  - 前端：`aiService.editWebsiteStream` 同步更新编辑器内容。

- 对话：`POST /api/ai-chat/stream`
  - 专用服务层 `backend/src/services/aiChat.ts` 维护 SSE 心跳（connected/heartbeat/done）、断线处理与“尾部兜底合并”（补齐 `</body></html>`）。

### 4.6 Token 用量与成本统计

- 文件：`backend/src/services/tokenTracker.ts`
  - 单价：按供应商/模型区分“输入/输出 token 的每千 token 人民币单价”。
  - 粒度：以“天 + 小时 + 供应商”为唯一键累加，记录 `model/operation` 维度方便后续报表。
  - 接口：
    - 概览：`GET /api/tokens/overview`
    - 趋势：`GET /api/tokens/usage/trend?dimension=provider|model`
    - 按日：`GET /api/tokens/usage/daily?date=YYYY-MM-DD`
    - 区间：`GET /api/tokens/usage/range?startDate&endDate&groupBy=day|hour&dimension=...`

### 4.7 业务路由总览（节选）

- 认证：`/api/auth/register|login|me|profile|password`
- 网站：`/api/websites (GET/POST)`、`/api/websites/:id (GET/PUT/DELETE)`、`/api/websites/:id/duplicate`、`/api/websites/:id/export`
- AI：
  - 同步：`/api/ai/generate`、`/api/ai/edit`、`/api/ai/optimize`
  - 流式：`/api/ai/generate-stream`、`/api/ai/edit-stream`
  - 对话：`/api/ai/chat`、`/api/ai/chat-stream`
  - 其它：`/api/ai/conversation`、`/api/ai/conversation/:id`、`/api/ai/models`、`/api/ai/test-connection`、`/api/ai/detect-mode`
- 设置：`/api/settings (GET/PUT)`、`/api/settings/usage`、`/api/settings/usage/daily`、`/api/settings/default-prompts`
- Token：`/api/tokens/*`（见 §4.6）
- 部署：`/api/deployment/deploy/:websiteId`、`/api/deployment/undeploy/:websiteId`、`/api/deployment/status/:websiteId`、`/api/deployment/check-dns`、`/api/deployment/ssl`
- 上传：`/api/uploads/file|files|stats|...`（静态文件通过 `/uploads/:userId/:filename` 提供访问）
- 通知：`/api/notifications/email/website-complete`
- 管理：`/api/admin/users`、权限 *definition/get/set*、SMTP 设置 *get/put*
- 服务器：`/api/server/stats|domains|logs|restart/:service|status/:service`（管理员权限）

### 4.8 网站部署与运维

- 文件：`backend/src/services/deployment.ts`
  - 中文域名 Punycode：写入文件系统/Nginx 前转换为 ASCII。
  - 静态产物：写入 `index.html/robots.txt/sitemap.xml`，并设置文件权限。
  - Nginx：生成非 SSL/SSL 两套 server 配置，`nginx -t` 校验并 `systemctl reload nginx`。
  - DNS 检查：`dig +short` 与服务端 IP 比对。
  - 证书：`certbot certonly --nginx ...` 获取并切换至 HTTPS 配置。
  - 状态落库：`Deployment` 与 `Website` 的部署/SSL/DNS 字段更新。

- 宝塔集成：`backend/src/services/baota.ts`
  - 通过面板 API 创建站点、绑定域名、写入静态文件、申请 SSL 与开启 HTTPS。

### 4.9 文件上传

- 文件：`backend/src/routes/uploads.ts`
  - Multer 磁盘存储，以 `UPLOAD_PATH/<userId>` 隔离；默认 10MB 上限，过滤常见图片/CSS/JS/HTML。
  - 静态访问：`GET /uploads/:userId/:filename`。
  - 统计：返回用户上传的文件计数、类型分布与容量。

### 4.10 WebSocket 与 SSE

- SSE：用于 AI 对话/生成/编辑实时流（见 §4.5.2 与 `services/aiChat.ts`）。
- WebSocket：
  - `backend/src/websocket/index.ts`：当前服务启动时挂载，具备认证、心跳、订阅与广播占位；
  - `backend/src/services/websocket.ts`：另一套封装（含 per-user 多连接管理），当前未在入口绑定，保留为后续能力扩展方案。

### 4.11 错误处理与日志

- 错误中间件：`backend/src/middleware/error.ts` 统一返回 `{ success:false, error }`；404 透传。
- 业务端口统一在出错时返回更明确的状态码（如 400/402/429），便于前端区分“密钥缺失/频控/余额不足”。
- 日志：`backend/src/utils/logger.ts` 简洁的结构化控制台输出；`/api/server/logs` 支持读取 systemd/nginx 日志（管理员）。

---

## 5. 前端架构与实现细节

### 5.1 应用启动与路由

- 入口：`frontend/src/main.tsx`，Vite 构建。
- 轻量路由：`frontend/src/lib/router.ts` 使用 Zustand 存储映射 URL 与路由状态，页面包括 `dashboard/editor/settings/deployments/tokens` 等。
- 国际化：`frontend/src/i18n/*` 默认中文。

### 5.2 服务层与拦截器

- 文件：`frontend/src/services/api.ts`
  - Axios 基础实例：从 `VITE_API_URL` 读取服务端地址；`withCredentials`；统一超时（3 分钟）。
  - 请求拦截：从 Zustand `auth-storage` 或 `localStorage` 取 JWT 写入 `Authorization`。
  - 响应拦截：401 且非 AI SSE 时跳转登录。
  - 资源方法：`authService/websiteService/aiService/deploymentService/...`。
  - SSE：`chatStream/generateWebsiteStream/editWebsiteStream` 使用原生 `fetch + ReadableStream` 逐行解析 `data:` 事件，具备心跳/超时/中断处理。

### 5.3 状态管理

- 认证：`frontend/src/store/authStore.ts`，持久化用户与 token，应用启动时自动 `getMe` 同步用户信息。
- 网站：`frontend/src/store/websiteStore.ts`，增删改查、复制、导出等，并管理当前编辑网站。
- SSE 全局状态：`frontend/src/store/sseStore.ts`，用于全局心跳/连接指示。

### 5.4 AI 编辑器与对话

- UI 容器：`frontend/src/components/AIEditorWithNewUI.tsx`，左右分栏：
  - 左侧：`AIAssistantModern`（对话区）
  - 右侧：预览/代码标签页；`Monaco CodeEditor`；可切换设备尺寸；支持“直改”（iframe 内 `contentEditable`，输入事件节流同步回代码）。

- 对话组件：`frontend/src/components/AIAssistantModern.tsx`
  - 将流式文本按围栏或 HTML 信号拆分为“文本说明”与“代码”，只把代码传给右侧编辑器（避免将说明文字写入网页）。
  - 智能判定“生成网站意图”触发右侧动画与阶段提示。
  - 中途中断/继续：AbortController 支持暂停；自动追加“继续输出”提示词继续生成。

### 5.5 上传与替换图片

- 组件：在“直改”模式下点击 iframe 内 IMG 元素后，可通过 `uploadsService.uploadFile` 上传新图并就地替换，随后把整个 HTML 同步回编辑器。

### 5.6 控制台与统计

- `frontend/src/pages/Dashboard.tsx`：网站卡片列表，批量操作、跳转编辑器与部署配置。
- Token 统计/趋势页（`pages/TokenStats*.tsx`）：调用 `/api/tokens/*` 展示日/周/月统计与供应商/模型维度趋势。
- 设置页（`pages/Settings.tsx`）：编辑三类提示词、AI 供应商与模型、测试连通性，获取系统默认提示词作为参考。

---

## 6. 端到端逻辑框架（关键流程）

1) 登录鉴权
   - 前端输入账号密码 -> `POST /api/auth/login` -> 返回 JWT；Zustand/LocalStorage 持久化；Axios 拦截器写入头部。

2) 新建网站与对话澄清
   - `POST /api/websites` 创建空站点或从仪表板进入编辑器；
   - 在对话区输入自然语言（需求澄清/生成请求），`/api/ai-chat/stream` SSE 逐块返回；
   - 组件将“文本说明”与“HTML 代码”拆分显示，并将代码增量同步到右侧编辑器/预览。

3) 一次性生成（或流式生成）
   - 一次性：`POST /api/ai/generate`，服务端调用 `aiService.generateWebsite` 返回 `{reply, html}` 并保存 `Website.content`；
   - 流式：`POST /api/ai/generate-stream`，仅推送净化后的 HTML 块，完成后做完整性检查/自动补全；前端组装并写回编辑器。

4) 增量编辑
   - `POST /api/ai/edit-stream`，基于现有 `Website.content` 与 `instructions`，实时返回 `content_chunk`，最终保存新内容。

5) 一键部署
   - 后端校验站点与内容 -> 写入 `sitesPath/<domain>` -> 生成 Nginx 配置并 reload -> DNS 检查 -> Certbot 申请 SSL -> 更新 `Website/Deployment` 状态；
   - 支持宝塔 API 流程作为替代路径。

6) Token 记账
   - Provider 返回 `usage` 后，统一调用 `TokenTracker.recordUsage`，按小时聚合并计价，供统计页面展示。

---

## 7. 安全性与鲁棒性

- 认证/鉴权：JWT + 角色/权限覆盖；资源所有权校验。
- 限流：通用限流与 AI 单独限流（`middleware/rateLimiter.ts`）。
- CSP/Headers：Helmet 基础安全头；生产环境请去除 `unsafe-eval`。
- SSE 稳定性：服务端心跳、禁用压缩、前端连接超时与断线重试提示。
- 输入校验：多数路由使用 `Joi` 校验必填与格式。
- 错误语义化：密钥缺失/频控/余额不足分别返回 400/429/402，便于前端提示。

---

## 8. 运行与部署

### 8.1 本地开发

```
npm run install:all
cd backend && npx prisma migrate dev && npx prisma generate
cd .. && npm run dev
```

- 前端：http://localhost:3000
- 后端：http://localhost:3001
- 健康检查：http://localhost:3001/health

### 8.2 服务器初始化与一键部署

- 初始化（需要 root）：`server-scripts/setup-server.sh`
  - 安装 Nginx/PostgreSQL/Node/Certbot，创建用户与目录，设置 systemd 服务。
- 部署：`server-scripts/deploy.sh <repo> <branch>`
  - 拉代码、安装、构建、迁移、启动服务并配置反向代理。

---

## 9. 扩展与定制

- 新增 AI 供应商：实现 `AIProvider` 接口并在 `aiService` 中注册映射；补充配置与模型清单；在设置页暴露选择。
- 自定义提示词：后端 `constants/prompts.ts` 提供默认值；前端设置页允许 per-user 覆盖。
- 上下文增强：`services/context7MCP.ts` 支持基于 MCP 检索库文档，可在生成/编辑前拼接到系统提示词（当前为独立服务，未默认启用）。
- WebSocket 实时推送：现已具备基础框架，可将部署进度/AI 进度等事件化后向指定用户广播。

---

## 10. 已知注意事项与建议

- `.env.example` 与实际配置存在历史差异，务必以 `backend/src/config/index.ts` 的键为准（尤其是 DeepSeek/Anthropic 相关）。
- WebSocket 存在两套实现（`websocket/index.ts` 与 `services/websocket.ts`），当前入口只挂载前者，后者可作为后续能力扩展（用户多连接管理/单播广播）。
- 生产 CSP 建议移除 `unsafe-eval`，前端构建需避免依赖 eval。
- 证书申请需确保 DNS 已解析至服务器 IP；若自动化失败，需手工检查 Nginx/Certbot 日志。

---

## 11. 关键文件索引

- 后端入口：`backend/src/index.ts`
- 配置中心：`backend/src/config/index.ts`
- 提示词：`backend/src/constants/prompts.ts`
- AI 服务：`backend/src/services/ai.ts`
- 流式聊天：`backend/src/services/aiChat.ts`
- Token 记账：`backend/src/services/tokenTracker.ts`
- 部署服务：`backend/src/services/deployment.ts`
- 上传服务：`backend/src/routes/uploads.ts`
- 路由总览：`backend/src/routes/*.ts`
- Prisma 模型：`backend/prisma/schema.prisma`
- 前端服务层：`frontend/src/services/api.ts`
- 编辑器页：`frontend/src/components/AIEditorWithNewUI.tsx`
- 对话组件：`frontend/src/components/AIAssistantModern.tsx`
- 状态存储：`frontend/src/store/*.ts`

---

如需进一步细化某一模块的时序图/类图/伪代码，请在对应章节提出需求，我们可继续补充工程级设计文档。

