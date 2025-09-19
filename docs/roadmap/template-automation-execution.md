# 模板自动化执行迭代节奏

## 总览

- **周期**：9 周交付 + 持续优化阶段；
- **核心目标**：完成提示词→模板的自动化闭环、监控体系与运营培训；
- **产出物**：流水线服务、Prompt 管理前端、监控面板、培训资料、运维工具集。

## 周别计划

| 周次 | 关注主题 | 关键交付 |
| ---- | -------- | -------- |
| Week 1 | ZIP 导入基线 | 目录校验器、错误码、日志链路梳理 |
| Week 2 | 提示词入库 MVP | Prisma 模型、Prompt 导入/状态 API、初版后台 UI |
| Week 3 | 模板索引 | TemplateIndexService 扩展、Summary API、PromptStrategyService |
| Week 4 | TemplatePlanner/Composer | 模型调用、流式输出、快照与回滚 |
| Week 5 | 前端管理面板 | Prompt 管理列表、批量导入、AI 编辑器流式展示 |
| Week 6 | 监控与文档 | Metrics API、模板洞察页、运维/培训文档初稿 |
| Week 7 | 依赖与调度 | merge-template-patches CLI、JobScheduler、告警通道打通 |
| Week 8 | 自动化测试矩阵 | Backend 集成测试、Playwright E2E、CI 集成 |
| Week 9 | 稳定性冲刺 | 性能回归、失败案例复盘、培训落地、迭代 Retrospective |

## 持续阶段（Month 3+）

- 提示词模板库扩容，按业务线建立专题看板；
- 监控指标接入统一 Observability 平台（Prometheus / Grafana）；
- 与部署流水线联动，支持模板上线自动审批；
- 定期（双周）与运营复盘成功率、失败标签，持续迭代提示词规范。

## 验收指标

- **功能性**：Prompt → 模板 → 导入全链路 95% 成功率；
- **效率**：新模板交付周期从 3 天降至 < 1 天；
- **稳定性**：关键告警（Planner/Composer Failure）平均响应 < 30 分钟；
- **可维护性**：培训资料齐全，支持新同学 1 天内上手；
- **质量保障**：自动化测试矩阵覆盖关键路径，CI 全绿。

