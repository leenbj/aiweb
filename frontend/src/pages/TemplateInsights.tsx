import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { metricsService, type AiMetrics, type TemplateMetrics } from '@/services/api';

const RANGE_OPTIONS = [7, 30, 90] as const;
const PIPELINE_STATUSES = ['SUCCESS', 'FAILED', 'RUNNING', 'QUEUED', 'ON_HOLD'] as const;

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs <= 0) return '—';
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

export default function TemplateInsights() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const [templateMetrics, setTemplateMetrics] = useState<TemplateMetrics | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AiMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const params = { rangeDays };
        const [templateData, aiData] = await Promise.all([
          metricsService.getTemplateMetrics(params),
          metricsService.getAiMetrics(params),
        ]);
        if (!mounted) return;
        setTemplateMetrics(templateData);
        setAiMetrics(aiData);
      } catch (error) {
        toast.error('加载指标数据失败，请稍后重试');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchMetrics();
    return () => {
      mounted = false;
    };
  }, [rangeDays]);

  const successRate = useMemo(() => {
    if (!templateMetrics) return 0;
    const total = templateMetrics.jobSummary?.TOTAL ?? 0;
    const success = templateMetrics.jobSummary?.SUCCESS ?? 0;
    if (!total) return 0;
    return success / total;
  }, [templateMetrics]);

  const failureCount = templateMetrics?.jobSummary?.FAILED ?? 0;
  const totalJobs = templateMetrics?.jobSummary?.TOTAL ?? 0;

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-gray-900">模板与 AI 指标</h1>
        <p className="text-sm text-gray-500">追踪模板使用频次、流水线成功率以及模型耗时，洞察生成质量。</p>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <div className="text-sm font-medium text-gray-700">时间范围</div>
        <div className="flex gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`rounded px-3 py-1.5 text-sm border ${
                rangeDays === option
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setRangeDays(option)}
              disabled={loading && rangeDays === option}
            >
              近 {option} 天
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-gray-400">加载中...</span>}
      </section>

      <section className="grid gap-4 md:grid-cols-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">成功率</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatPercent(successRate)}</div>
          <div className="mt-1 text-xs text-gray-400">总任务 {totalJobs}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">失败次数</div>
          <div className="mt-2 text-2xl font-semibold text-rose-600">{failureCount}</div>
          <div className="mt-1 text-xs text-gray-400">需关注失败原因列表</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">平均耗时</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatDuration(aiMetrics?.latency.averageMs ?? null)}
          </div>
          <div className="mt-1 text-xs text-gray-400">样本 {aiMetrics?.latency.samples ?? 0}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">P95 耗时</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {formatDuration(aiMetrics?.latency.p95Ms ?? null)}
          </div>
          <div className="mt-1 text-xs text-gray-400">高延迟需排查模型或依赖</div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">模板使用频次</h2>
            <span className="text-xs text-gray-400">
              {templateMetrics ? `${new Date(templateMetrics.range.from).toLocaleDateString()} ~ ${new Date(templateMetrics.range.to).toLocaleDateString()}` : '—'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">模板</th>
                  <th className="px-4 py-2 text-left">类型</th>
                  <th className="px-4 py-2 text-right">生成次数</th>
                  <th className="px-4 py-2 text-right">最近生成</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templateMetrics?.templateUsage?.length ? (
                  templateMetrics.templateUsage.map((item) => (
                    <tr key={item.templateId}>
                      <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-2 text-gray-500 uppercase text-xs">{item.type}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{item.snapshots}</td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {item.lastGeneratedAt ? new Date(item.lastGeneratedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-400" colSpan={4}>
                      暂无模板生成记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">失败原因 Top10</h2>
            <span className="text-xs text-gray-400">按出现次数排序</span>
          </div>
          <div className="p-4 space-y-3">
            {templateMetrics?.failureReasons?.length ? (
              templateMetrics.failureReasons.map((item) => (
                <div key={item.reason} className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <div className="font-medium">{item.reason}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-red-500">出现 {item.count} 次</div>
                </div>
              ))
            ) : (
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                最近周期内没有失败原因统计。
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">流水线状态分布</h2>
            <span className="text-xs text-gray-400">总计 {aiMetrics?.statusBreakdown?.TOTAL ?? 0}</span>
          </div>
          <div className="p-4 space-y-3">
            {PIPELINE_STATUSES.map((status) => {
              const count = aiMetrics?.statusBreakdown?.[status] ?? 0;
              const total = aiMetrics?.statusBreakdown?.TOTAL ?? 0;
              const ratio = total ? count / total : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-medium">{status}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-gray-100">
                    <div
                      className={`h-full rounded ${status === 'SUCCESS' ? 'bg-emerald-500' : status === 'FAILED' ? 'bg-rose-500' : 'bg-blue-400'}`}
                      style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">最近流水线运行</h2>
            <span className="text-xs text-gray-400">最新 20 条</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Run ID</th>
                  <th className="px-4 py-2 text-left">状态</th>
                  <th className="px-4 py-2 text-right">耗时</th>
                  <th className="px-4 py-2 text-right">完成时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aiMetrics?.recentRuns?.length ? (
                  aiMetrics.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{run.id.slice(0, 10)}</td>
                      <td className="px-4 py-2 text-xs font-medium text-gray-600">{run.status}</td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatDuration(run.durationMs)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-400" colSpan={4}>
                      暂无运行记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

