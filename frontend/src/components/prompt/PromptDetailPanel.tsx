import type { PromptReviewItem } from '@/shared/types';
import type { PipelineStatus } from '@/shared/types';

interface PromptDetailPanelProps {
  detail?: {
    prompt: PromptReviewItem['prompt'];
    runs: Array<{ id: string; status: PipelineStatus; errorMessage?: string | null; startedAt?: string | Date | null; finishedAt?: string | Date | null; artifactPath?: string | null }>;
    jobs: PromptReviewItem['jobs'];
  } | null;
  loading: boolean;
  onRetry: () => void;
}

const statusLabel: Record<string, string> = {
  QUEUED: '排队中',
  RUNNING: '执行中',
  SUCCESS: '成功',
  FAILED: '失败',
  ON_HOLD: '挂起',
};

export function PromptDetailPanel({ detail, loading, onRetry }: PromptDetailPanelProps) {
  if (loading) {
    return <div className="p-6 text-sm text-gray-500">加载详情中...</div>;
  }

  if (!detail) {
    return <div className="p-6 text-sm text-gray-400">请选择左侧列表中的提示词查看详情。</div>;
  }

  const prompt = detail.prompt;

  const canRetry = prompt.status === 'FAILED' || prompt.status === 'PENDING';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{prompt.name}</h2>
          <p className="text-xs text-gray-500 mt-1">ID: {prompt.id}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">状态：{prompt.status}</span>
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">来源：{prompt.source}</span>
            {prompt.targetSlug && <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-600">目标模板：{prompt.targetSlug}</span>}
          </div>
        </div>
        <button
          className={`px-3 py-1 text-sm rounded ${canRetry ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          onClick={() => canRetry && onRetry()}
          disabled={!canRetry}
        >
          重新入队
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">提示词内容</h3>
        {prompt.rawText ? (
          <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto max-h-60 whitespace-pre-wrap">
            {prompt.rawText}
          </pre>
        ) : (
          <div className="text-xs text-gray-400">暂无原始提示词内容。</div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">最新运行</h3>
        <div className="space-y-2">
          {detail.runs.length === 0 && <div className="text-xs text-gray-400">暂无流水线运行记录。</div>}
          {detail.runs.map((run) => (
            <div key={run.id} className="border rounded p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>运行 ID：{run.id}</span>
                <span>{statusLabel[run.status] || run.status}</span>
              </div>
              {run.startedAt && <div>开始时间：{new Date(run.startedAt).toLocaleString()}</div>}
              {run.finishedAt && <div>完成时间：{new Date(run.finishedAt).toLocaleString()}</div>}
              {run.errorMessage && <div className="text-rose-600">错误：{run.errorMessage}</div>}
              {run.artifactPath && (
                <a
                  className="text-blue-600 hover:underline"
                  href={run.artifactPath}
                  target="_blank"
                  rel="noreferrer"
                >
                  下载产物
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">流水线任务</h3>
        <div className="space-y-3">
          {detail.jobs.length === 0 && <div className="text-xs text-gray-400">暂无任务。</div>}
          {detail.jobs.map((job) => (
            <div key={job.id} className="border rounded p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-gray-700">
                <span>任务 ID：{job.id}</span>
                <span>状态：{job.status}</span>
              </div>
              <div className="text-gray-500">导入类型：{job.importType}</div>
              <div className="text-gray-500">重试次数：{job.retryCount}</div>
              <div className="text-gray-500">更新时间：{new Date(job.updatedAt).toLocaleString()}</div>
              {job.templates.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {job.templates.map((tpl) => (
                    <a
                      key={tpl.id}
                      className={`px-2 py-1 rounded border ${tpl.missing ? 'border-rose-200 text-rose-500' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                      href={tpl.previewUrl || '#'}
                      target={tpl.previewUrl ? '_blank' : undefined}
                      rel={tpl.previewUrl ? 'noreferrer' : undefined}
                    >
                      {tpl.slug || tpl.id}
                    </a>
                  ))}
                </div>
              )}
              {job.metadata && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">查看元数据</summary>
                  <pre className="mt-2 bg-gray-50 p-2 rounded text-[11px] overflow-x-auto max-h-40">{JSON.stringify(job.metadata, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
