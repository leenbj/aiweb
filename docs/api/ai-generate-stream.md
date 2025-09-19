# AI 站点生成流式接口

接口路径：`POST /ai/generate-stream`

## 请求参数

```jsonc
{
  "prompt": "string",              // 必填，用户指令或上下文
  "websiteId": "string?",          // 可选，存在时覆盖指定站点
  "scenario": "string?",           // 可选，传递给 TemplatePlanner 的场景标签
  "filters": {                      // 可选，模板过滤条件
    "type": "page|component|theme",
    "tag": "string",
    "keyword": "string",
    "engine": "string"
  },
  "persist": true                   // 默认为 true，设为 false 时仅返回流式结果不落库
}
```

请求需携带身份认证 Header：`Authorization: Bearer <token>`。

## SSE 事件格式

服务端通过 Server-Sent Events 返回 JSON 数据，每条消息位于 `data:` 前缀后。一条典型的消息如下：

```text
data: {"type":"stage","stage":"planner","status":"start","timestamp":"2025-09-18T06:30:00.000Z"}
```

事件类型说明：

| 类型       | 说明                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `schema`   | 连接建立后首个事件，描述可用事件类型及 `requestId`。                                                    |
| `stage`    | 阶段状态更新，字段：`stage`(`request`\|`planner`\|`composer`\|`persist`)、`status`(`start`\|`success`\|`error`)。 |
| `plan`     | TemplatePlanner 产出的计划：`plan`(`TemplatePlan`)、`metadata`(尝试次数、分片信息等)。                  |
| `preview`  | TemplateComposer 生成的预览：`html`、`components`(各组件渲染)、`metadata`(是否使用 fallback、耗时等)。    |
| `log`      | 诊断信息：`level`(`info`\|`warn`\|`debug`)、`message`、可选附加字段。                                    |
| `complete` | 终止事件：包含 `plan`、`html`、`metadata`、`snapshot`、`website`、`reply`。 接收后连接自动关闭。          |
| `error`    | 终止事件：携带 `message`/`error` 字段描述错误原因，连接自动关闭。                                        |

客户端应忽略未知类型并持续监听直到收到 `complete` 或 `error`。

## 返回示例

```text
data: {"type":"schema","version":"2025-09-17","events":{"preview":"Previewable HTML output"},"requestId":"a5c3..."}

data: {"type":"stage","stage":"planner","status":"start"}

data: {"type":"plan","plan":{"page":{"slug":"hero-banner"},"components":[]},"metadata":{"chunkSize":3}}

data: {"type":"stage","stage":"composer","status":"start"}

data: {"type":"preview","html":"<!DOCTYPE html>...","components":[{"slug":"hero-banner","html":"<section>...</section>"}]}

data: {"type":"stage","stage":"persist","status":"success","websiteId":"web_123"}

data: {"type":"complete","plan":{"page":{"slug":"hero-banner"}},"html":"<!DOCTYPE html>...","reply":"Website plan generated successfully.","metadata":{"composer":{"fallbackUsed":false}}}
```

## 错误示例

```
data: {"type":"error","message":"Prompt and authenticated user are required."}
```

若请求参数缺失或服务器内部错误，返回标准 JSON 响应并终止 SSE。客户端需在 `onError` 或 `onEvent` 中处理。
