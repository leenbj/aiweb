import React, { useEffect, useState } from 'react';
import { templateSDK, TemplateDTO } from '@/services/templateSDK';
import { toast } from 'react-hot-toast';

export default function TemplateLibrary() {
  const [items, setItems] = useState<TemplateDTO[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await templateSDK.search({ query: q, limit: 20 });
        setItems(r.items || []);
      } catch (e: any) {
        toast.error(e?.message || '加载模板库失败');
        setItems([]);
      }
    })();
  }, [q]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">模板库</h1>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="搜索模板…" className="border px-3 py-2 rounded w-full max-w-md" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(t => (
          <div key={t.id} className="border rounded p-3">
            <div className="text-sm text-gray-500">{t.type} · {t.engine}</div>
            <div className="font-medium">{t.name}</div>
            {t.previewHtml && (
              (() => {
                const isFullDoc = /<html[\s>]/i.test(t.previewHtml) || /<!DOCTYPE/i.test(t.previewHtml);
                const html = isFullDoc ? t.previewHtml : `<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/></head><body>${t.previewHtml}</body></html>`;
                return (
                  <iframe
                    className="mt-2 w-full h-64 border rounded"
                    srcDoc={html}
                    title={`preview-${t.slug}`}
                  />
                );
              })()
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-gray-500">暂无模板</div>
        )}
      </div>
    </div>
  );
}
