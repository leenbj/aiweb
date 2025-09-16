import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function UploadZip() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [themeSlug, setThemeSlug] = useState<string>('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error('请选择 ZIP 文件');
    const form = new FormData();
    form.append('file', file);
    setLoading(true);
    try {
      // 带上凭证（若服务端需要）
      const headers: any = {};
      try {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const obj = JSON.parse(raw);
          const token = obj?.state?.token;
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {}
      const r = await fetch('/api/templates/import-zip', { method:'POST', body: form, headers });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || '上传失败');
      setResult(data);
      if (data?.theme) setThemeSlug(data.theme);
      toast.success('上传成功');
    } catch (err: any) {
      toast.error(err?.message || '上传失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">导入静态 ZIP 为模板库</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="file" accept=".zip" onChange={e=>setFile(e.target.files?.[0]||null)} />
        <button disabled={loading || !file} className="px-4 py-2 bg-blue-600 text-white rounded">
          {loading ? '处理中…' : '上传并解析'}
        </button>
      </form>
      {result && (
        <>
          <pre className="bg-gray-900 text-white p-3 rounded text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          {themeSlug && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm text-blue-900">已抽取主题：<code className="px-1 py-0.5 bg-white border rounded">{themeSlug}</code></div>
              <div className="text-xs text-blue-800 mt-1">可在“AI 编辑器 → 模板组合预览”中选择该主题应用到页面。</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
