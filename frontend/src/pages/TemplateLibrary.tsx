import React, { useEffect, useMemo, useState } from 'react';
import { templateSDK, TemplateDTO } from '@/services/templateSDK';
import { toast } from 'react-hot-toast';
import { TemplateType } from '@/shared/types';
import { downloadTemplateZip } from '@/utils/templateDownload';
import { buildTemplatePreviewDoc } from '@/utils/previewDoc';

const typeTabs: Array<{ value: TemplateType; label: string }> = [
  { value: 'page', label: '页面模板' },
  { value: 'component', label: '组件模板' },
  { value: 'theme', label: '主题模板' },
];

export default function TemplateLibrary() {
  const [items, setItems] = useState<TemplateDTO[]>([]);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TemplateType>('page');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await templateSDK.search({ query: q.trim() || undefined, type, limit: 30 });
        if (!cancelled) {
          setItems(result.items || []);
          setTotal(result.total || 0);
        }
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || '加载模板库失败');
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, type]);

  const emptyMessage = useMemo(() => {
    if (loading) return '加载中…';
    if (type === 'component') return '暂无组件模板，请先导入 ZIP 包';
    if (type === 'theme') return '暂无主题模板';
    return '暂无模板';
  }, [loading, type]);

  const handleExport = async (tpl: TemplateDTO) => {
    try {
      if (!tpl.id) throw new Error('缺少模板ID');
      await downloadTemplateZip(tpl.id, tpl.slug || tpl.name || 'template');
      toast.success('已开始下载模板 ZIP');
    } catch (err: any) {
      toast.error(err?.message || '导出失败');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">模板库</h1>
          <p className="text-sm text-gray-500">共 {total} 个模板，可按类型浏览并导出 ZIP</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeTabs.map(tab => (
            <button
              key={tab.value}
              className={`px-3 py-1 rounded border text-sm ${type === tab.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
              onClick={() => setType(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="搜索模板…"
          className="border px-3 py-2 rounded w-full md:max-w-sm"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t) => {
          const previewDoc = buildTemplatePreviewDoc(t.previewHtml || '');
          return (
            <div key={t.id} className="border rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t.type} · {t.engine}</span>
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => handleExport(t)}
                >
                  导出 ZIP
                </button>
              </div>
              <div className="font-medium truncate" title={t.name}>{t.name}</div>
              <div className="text-xs text-gray-500 truncate" title={t.slug}>{t.slug}</div>
              {t.tags && t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
              {previewDoc && (
                <iframe
                  className="mt-1 w-full h-64 border rounded"
                  srcDoc={previewDoc}
                  title={`preview-${t.slug}`}
                />
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-gray-500 col-span-full text-center border border-dashed border-gray-200 rounded py-10">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
