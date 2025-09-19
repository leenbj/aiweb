import { useMemo, useState } from 'react';

import type { PromptImportPayload } from '@/utils/promptImport';
import { chunkPromptPayloads, parseJsonPrompts, parseMarkdownPrompts } from '@/utils/promptImport';

interface PromptImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onImport: (
    payload: string | PromptImportPayload[],
    mode: 'json' | 'markdown' | 'single'
  ) => Promise<{ created?: Array<{ promptId: string; name?: string }>; skipped?: Array<{ name: string; reason: string }> }>;
  onResult?: (
    summary: {
      created: Array<{ promptId: string; name?: string }>;
      skipped: Array<{ name: string; reason: string }>;
    }
  ) => void | Promise<void>;
}

export function PromptImportModal({ open, onClose, onSuccess, onError, onImport, onResult }: PromptImportModalProps) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'json' | 'markdown' | 'single'>('json');
  const [singleName, setSingleName] = useState('');
  const [singleTags, setSingleTags] = useState('');
  const [singleRaw, setSingleRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  if (!open) return null;

  const placeholder = useMemo(() => {
    if (mode === 'markdown') {
      return ['## hero-section', 'Tags: marketing, hero', '', '### 目标', '生成带号召性用语的 hero 区块...'].join('\n');
    }
    if (mode === 'json') {
      return '[{"name": "landing-page", "rawText": "...", "tags": ["landing", "marketing"]}]';
    }
    return '';
  }, [mode]);

  const handleSubmit = async () => {
    if (mode === 'single') {
      if (!singleName.trim() || !singleRaw.trim()) {
        onError('请输入名称与提示词内容');
        return;
      }
    } else if (!content.trim()) {
      onError('请输入 JSON 数组或 Markdown 文本');
      return;
    }

    try {
      setSubmitting(true);
      setProgress(null);

      let payloads: PromptImportPayload[] = [];
      if (mode === 'single') {
        const tags = singleTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        payloads = [
          {
            name: singleName.trim(),
            rawText: singleRaw.trim(),
            tags,
          },
        ];
      } else if (mode === 'json') {
        payloads = parseJsonPrompts(content);
      } else {
        payloads = parseMarkdownPrompts(content);
      }

      if (!payloads.length) {
        onError('未解析到有效的提示词条目');
        return;
      }

      const chunks = chunkPromptPayloads(payloads, 25);
      const aggregated = {
        created: [] as Array<{ promptId: string; name?: string }>,
        skipped: [] as Array<{ name: string; reason: string }>,
      };

      for (let index = 0; index < chunks.length; index += 1) {
        setProgress({ current: index + 1, total: chunks.length });
        const chunk = chunks[index];
        const result = await onImport(chunk, 'json');
        if (result?.created?.length) {
          aggregated.created.push(...result.created);
        }
        if (result?.skipped?.length) {
          aggregated.skipped.push(...result.skipped);
        }
      }

      const createdCount = aggregated.created.length;
      const skippedCount = aggregated.skipped.length;
      const messageParts: string[] = [];
      if (createdCount) messageParts.push(`成功 ${createdCount} 条`);
      if (skippedCount) messageParts.push(`跳过 ${skippedCount} 条`);

      if (skippedCount) {
        const skippedSummary = aggregated.skipped
          .slice(0, 3)
          .map((item) => `${item.name}(${item.reason})`)
          .join('，');
        if (skippedSummary) {
          messageParts.push(`示例：${skippedSummary}${skippedCount > 3 ? '...' : ''}`);
        }
      }

      await onResult?.(aggregated);

      onSuccess(messageParts.length ? messageParts.join('；') : '导入任务已提交');
      setContent('');
      setSingleName('');
      setSingleTags('');
      setSingleRaw('');
      onClose();
    } catch (error: any) {
      onError(error?.message || '导入失败');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">批量导入提示词</h2>
            <p className="text-xs text-gray-500 mt-1">支持 JSON 数组或 Markdown 段落，将会自动拆分入库并创建流水线任务。</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose} disabled={submitting}>
            ✕
          </button>
        </div>

        <div className="flex gap-2 text-xs flex-wrap">
          <button
            className={`px-3 py-1 rounded border ${mode === 'json' ? 'border-blue-500 text-blue-600' : 'border-gray-200 text-gray-500'}`}
            onClick={() => setMode('json')}
            disabled={submitting}
          >
            JSON 数组
          </button>
          <button
            className={`px-3 py-1 rounded border ${mode === 'markdown' ? 'border-blue-500 text-blue-600' : 'border-gray-200 text-gray-500'}`}
            onClick={() => setMode('markdown')}
            disabled={submitting}
          >
            Markdown 文本
          </button>
          <button
            className={`px-3 py-1 rounded border ${mode === 'single' ? 'border-blue-500 text-blue-600' : 'border-gray-200 text-gray-500'}`}
            onClick={() => setMode('single')}
            disabled={submitting}
          >
            单条录入
          </button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">名称</label>
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="例如：landing-page-prompt"
                value={singleName}
                onChange={(event) => setSingleName(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">标签（逗号分隔）</label>
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="landing, hero, marketing"
                value={singleTags}
                onChange={(event) => setSingleTags(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">提示词内容</label>
              <textarea
                className="w-full h-40 border rounded px-3 py-2 text-sm"
                placeholder="请输入 Markdown 或纯文本提示词"
                value={singleRaw}
                onChange={(event) => setSingleRaw(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
        ) : (
          <textarea
            className="w-full h-64 border rounded px-3 py-2 text-sm font-mono"
            placeholder={placeholder}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            disabled={submitting}
          />
        )}

        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? progress
                ? `导入中... (${progress.current}/${progress.total})`
                : '导入中...'
              : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}
