# 流水线监控与告警手册

本手册介绍模板自动化流水线的运行监控指标、告警触发方式以及日常排查流程。目标是确保「提示词 → 模板组合 → 导入」链路的可观测性，及时发现失败或性能回退。

## 指标采集总览

后端新增 `pipelineMetricsCollector` 用于在运行时采集核心指标并保留最近 200 条事件：

- **成功事件**：记录模板 slug、渲染耗时（`durationMs`）及请求 ID；
- **失败事件**：记录失败 stage（planner / composer 等）与原因，同时触发 `alertPublisher`；
- **快照接口**：`getPipelineMetricsSnapshot()` 提供最近一小时的成功/失败统计、平均耗时与失败详情；
- **状态分布**：`getPipelineStatusBreakdown()` 可直接用于看板绘制。

在 `POST /api/ai/generate-stream` 的路由中已接入：

- Planner 失败会记录 warning，并触发 planner 级别告警；
- Composer 成功会采集耗时与模板 slug；
- Composer 失败会触发 critical 告警（默认写日志，可通过注册监听器扩展到飞书、Slack 等渠道）。

## 指标拉取方式

1. **REST API**：
   - `/api/metrics/templates`：模板使用频次、流水线成功率、失败原因 Top10；
   - `/api/metrics/ai`：Prompt/Composer 耗时、状态分布、最近运行列表。
   前端 `TemplateInsights` 页面已将以上接口可视化，可作为一线运营与 RD 共用的监控面板。

2. **代码内快照**：
   - 对接监控系统时，可在定时任务中调用 `getPipelineMetricsSnapshot()`/`getPipelineStatusBreakdown()`，再推送到 Prometheus、OpenTelemetry 等指标仓库。

## 告警配置

`alertPublisher` 默认写入应用日志，并支持注册多个监听器：

```ts
import { registerAlertListener } from '@/services/alerts/alertPublisher';

registerAlertListener(async (alert) => {
  await feishuClient.sendCard({
    title: `[流水线告警] ${alert.severity.toUpperCase()}`,
    content: alert.message,
    extra: alert.context,
  });
});
```

- **Severity 决策**：Planner / Composer 失败为 `critical`，其余 stage 默认为 `warning`；
- **常见告警落地**：
  - 飞书 / Slack Webhook；
  - PagerDuty（需要将 `publishAlert` 监听器对接事件 API）；
  - 邮件备用通道：可在监听器内调用 nodemailer。

## 日常巡检流程

1. 打开前端 `模板洞察` 面板，关注：
   - 成功率是否低于 90%；
   - 平均耗时是否 > 2s；
   - 失败原因列表是否出现新类型；
2. 如遇连续告警：
   - 通过 `getPipelineMetricsSnapshot()` 获取最近失败详情及 requestId；
   - 使用 requestId 在日志系统检索具体提示词、模型响应；
   - 根据失败 stage 决定处理人：
     - Planner 失败：提示词或索引问题 → 提示词运营；
     - Composer 失败：模板缺失或渲染异常 → 前端模板组；
3. 修复后观察指标回升，必要时手动触发 `POST /api/metrics/templates` 拉取最新数据刷新面板。

## 后续扩展建议

- 将 `pipelineMetricsCollector` 的事件通过 OpenTelemetry 导出，统一接入 APM；
- 为 `alertPublisher` 增加基于配置文件的多通道注册与阈值开关；
- 在 CI 中运行 `backend/tests/test-template-pipeline.ts` 以验证指标聚合逻辑未被破坏；
- 结合前端 Playwright 用例（位于 `frontend/tests/e2e`）完成回归测试矩阵的自动执行。

