import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { usePromptStore } from '@/stores/promptStore';
import { PromptTable } from '@/components/prompt/PromptTable';
import { PromptDetailPanel } from '@/components/prompt/PromptDetailPanel';
import { PromptImportModal } from '@/components/prompt/PromptImportModal';
import type { PromptStatus } from '@/shared/types';
import { promptApi } from '@/services/promptApi';

const statusOptions: Array<{ value: 'ALL' | PromptStatus; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '待处理' },
  { value: 'PROCESSING', label: '处理中' },
  { value: 'READY', label: '已完成' },
  { value: 'FAILED', label: '失败' },
  { value: 'ARCHIVED', label: '已归档' },
];

export default function PromptAdmin() {
  const [searchInput, setSearchInput] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const {
    items,
    loading,
    page,
    hasNextPage,
    detail,
    detailLoading,
    listPrompts,
    setStatus,
    status,
    setSearch,
    setPage,
    selectedId,
    selectPrompt,
    retryPrompt,
  } = usePromptStore();

  useEffect(() => {
    listPrompts();
  }, [listPrompts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      listPrompts({ page: 1, search: searchInput.trim() });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, setSearch, listPrompts]);

  const handleStatusChange = (value: 'ALL' | PromptStatus) => {
    setStatus(value);
    setPage(1);
    listPrompts({ page: 1, status: value });
  };

  const disablePrev = page <= 1;

  const handlePrev = () => {
    if (disablePrev) return;
    const nextPage = page - 1;
    setPage(nextPage);
    listPrompts({ page: nextPage });
  };

  const handleNext = () => {
    if (!hasNextPage) return;
    const nextPage = page + 1;
    setPage(nextPage);
    listPrompts({ page: nextPage });
  };

  const headerSubtitle = useMemo(() => {
    if (loading) return '加载中...';
    if (!items.length) return '暂无提示词数据';
    return `当前共 ${items.length} 条记录`;
  }, [items, loading]);

  return (
    <div className="h-full flex flex-col p-6 gap-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">提示词管理</h1>
        <p className="text-sm text-gray-500">{headerSubtitle}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div className="flex gap-2 items-center">
          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as 'ALL' | PromptStatus)}
            className="border px-3 py-2 rounded text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索名称、标签或原始内容"
            className="border px-3 py-2 rounded text-sm w-64"
          />
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            onClick={() => setImportOpen(true)}
          >
            批量导入
          </button>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 text-sm rounded border ${disablePrev ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            disabled={disablePrev}
            onClick={handlePrev}
          >
            上一页
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded border ${hasNextPage ? 'text-gray-700 border-gray-300 hover:bg-gray-50' : 'text-gray-400 border-gray-200 cursor-not-allowed'}`}
            disabled={!hasNextPage}
            onClick={handleNext}
          >
            下一页
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 overflow-hidden">
        <div className="overflow-y-auto border rounded-lg bg-white">
          <PromptTable
            items={items}
            loading={loading}
            selectedId={selectedId}
            onSelect={(id) => {
              selectPrompt(id);
            }}
          />
        </div>
        <div className="border rounded-lg bg-white overflow-y-auto">
          <PromptDetailPanel
            detail={detail}
            loading={detailLoading}
            onRetry={async () => {
              if (!selectedId) return;
              try {
                await retryPrompt(selectedId);
                toast.success('提示词已重新排队');
              } catch (error: any) {
                toast.error(error?.message || '重新入队失败');
              }
            }}
          />
        </div>
      </div>

      <PromptImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={async (message) => {
          toast.success(message);
        }}
        onError={(message) => toast.error(message)}
        onImport={async (payload) => promptApi.import(payload)}
        onResult={async (result) => {
          setStatus('ALL');
          setPage(1);
          await listPrompts({ page: 1, status: 'ALL' });
          if (result.created[0]?.promptId) {
            await selectPrompt(result.created[0].promptId);
          }
        }}
      />
    </div>
  );
}
