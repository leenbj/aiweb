import type { PromptReviewItem } from '@/shared/types';
import { cn } from '@/lib/utils';

interface PromptTableProps {
  items: PromptReviewItem[];
  loading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

const statusLabel: Record<string, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  READY: '已完成',
  FAILED: '失败',
  ARCHIVED: '已归档',
};

const statusClass: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  READY: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

export function PromptTable({ items, loading, selectedId, onSelect }: PromptTableProps) {
  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-gray-500">加载中...</div>;
  }

  if (!items.length) {
    return <div className="border border-dashed border-gray-200 rounded py-16 text-center text-sm text-gray-500">暂无提示词，请先导入或创建。</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">提示词</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">最新任务</th>
            <th className="px-4 py-3">最近更新</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const prompt = item.prompt;
            const latestJob = item.latestJob;
            const badgeClass = statusClass[prompt.status] || 'bg-gray-100 text-gray-600';
            return (
              <tr
                key={prompt.id}
                onClick={() => onSelect(prompt.id)}
                className={cn(
                  'cursor-pointer hover:bg-blue-50 transition-colors',
                  selectedId === prompt.id && 'bg-blue-50'
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 truncate" title={prompt.name}>{prompt.name}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
                    {prompt.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded-full">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', badgeClass)}>
                    {statusLabel[prompt.status] || prompt.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {latestJob ? (
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900">{latestJob.status}</div>
                      <div className="text-xs text-gray-500">{new Date(latestJob.updatedAt).toLocaleString()}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">暂无任务</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(prompt.updatedAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
