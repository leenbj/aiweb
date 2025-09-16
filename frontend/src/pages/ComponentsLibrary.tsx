import React, { useEffect, useMemo, useState } from 'react';
import { templateSDK, TemplateDTO } from '@/services/templateSDK';
import { toast } from 'react-hot-toast';
import { downloadTemplateZip } from '@/utils/templateDownload';

export default function ComponentsLibrary() {
  const [items, setItems] = useState<TemplateDTO[]>([]);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: any = { query: q.trim() || undefined, type: 'component' as const, limit: 60 };
        if (tag !== 'all') params.tags = [tag];
        const result = await templateSDK.search(params);
        if (!cancelled) {
          setItems(result.items || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || '加载组件库失败');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, tag]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      (item.tags || []).forEach(t => set.add(t));
    });
    return Array.from(set);
  }, [items]);

  const handleExport = async (tpl: TemplateDTO) => {
    try {
      await downloadTemplateZip(tpl.id, tpl.slug || tpl.name || 'component');
      toast.success('已开始下载组件 ZIP');
    } catch (err: any) {
      toast.error(err?.message || '导出失败');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">组件库</h1>
          <p className="text-sm text-gray-500">筛选组件模板并支持一键导出</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded border text-sm ${tag === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
            onClick={() => setTag('all')}
          >
            全部
          </button>
          {tags.map(t => (
            <button
              key={t}
              className={`px-3 py-1 rounded border text-sm ${tag === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="搜索组件…"
          className="border px-3 py-2 rounded w-full md:max-w-sm"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(t => {
          const isFullDoc = /<html[\s>]/i.test(t.previewHtml || '') || /<!DOCTYPE/i.test(t.previewHtml || '');
          const previewDoc = isFullDoc
            ? t.previewHtml || ''
            : `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body>${t.previewHtml || ''}</body></html>`;
          return (
            <div key={t.id} className="border rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t.slug}</span>
                <button className="text-blue-600 hover:underline" onClick={() => handleExport(t)}>导出</button>
              </div>
              <div className="font-medium truncate" title={t.name}>{t.name}</div>
              {t.tags && t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.map(tagName => (
                    <span key={tagName} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tagName}</span>
                  ))}
                </div>
              )}
              {t.previewHtml && (
                <iframe
                  className="mt-1 w-full h-64 border rounded"
                  srcDoc={previewDoc}
                  title={`component-${t.slug}`}
                />
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-gray-500 text-center border border-dashed border-gray-200 rounded py-10">
            {loading ? '加载中…' : '暂无组件模板'}
          </div>
        )}
      </div>
    </div>
  );
}
