import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { UploadCloud, FileArchive, Info, Loader2, RefreshCcw } from 'lucide-react';

interface ImportResult {
  importId?: string;
  pages?: Array<{ slug: string; name?: string }>;
  components?: Array<{ slug: string; name?: string }>;
  theme?: string;
  summary?: Record<string, any>;
  [key: string]: any;
}

function resolveApiBaseUrl() {
  const meta: any = import.meta;
  return meta?.env?.VITE_API_URL || (meta?.env?.DEV ? '/api' : 'http://localhost:3001/api');
}

function buildAuthHeaders() {
  const headers: Record<string, string> = {};
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.state?.token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore parse error
  }
  return headers;
}

const instructions = [
  'ZIP 顶级目录需包含 template.json / schema.json / preview.html',
  '附带的 assets 会原样进入模板库，可使用相对路径引用',
  '同名 slug 将自动生成新版本，历史版本可在模板库中回滚',
];

export default function UploadZip() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const baseUrl = useMemo(resolveApiBaseUrl, []);

  const handleFile = useCallback((incoming: File | null) => {
    setResult(null);
    setFile(incoming);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!droppedFile.name.endsWith('.zip')) {
      toast.error('只支持 .zip 文件');
      return;
    }
    handleFile(droppedFile);
  }, [handleFile]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast.error('请选择 ZIP 文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${baseUrl}/templates/import-zip`, {
        method: 'POST',
        body: formData,
        headers: buildAuthHeaders(),
        credentials: 'include',
      });

      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || '导入失败');
      }

      setResult(payload);
      toast.success('导入成功');
    } catch (error: any) {
      toast.error(error?.message || '导入失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="flex flex-col items-center py-8 px-4 md:px-10 lg:px-16">
      <div className="w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">导入 ZIP 到模板库</h1>
          <p className="text-sm text-gray-500">
            上传静态 ZIP 包，自动解析页面、组件与主题信息，便于后续在 AI 编辑器和模板索引中复用。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-5">
          <article className="md:col-span-3 bg-white border border-gray-200 rounded-xl shadow-sm">
            <form onSubmit={onSubmit} className="p-6 space-y-6">
              <div
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl px-6 py-10 text-center transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      拖拽 ZIP 文件到此处，或
                      <label className="text-blue-600 hover:underline cursor-pointer ml-1">
                        点击选择
                        <input
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(event) => handleFile(event.target.files?.[0] || null)}
                        />
                      </label>
                    </p>
                    <p className="text-xs text-gray-500 mt-2">最大支持 50MB，建议包含 template.json / schema.json / preview.html</p>
                  </div>
                  {file && (
                    <div className="flex items-center gap-2 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs text-gray-700">
                      <FileArchive className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate max-w-[200px]">{file.name}</span>
                      <span className="text-gray-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {loading ? '正在解析...' : '上传并解析'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  重置
                </button>
              </div>
            </form>
          </article>

          <aside className="md:col-span-2 space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Info className="h-4 w-4 text-blue-500" /> 导入须知
              </h2>
              <ul className="mt-3 space-y-2 text-xs text-gray-600">
                {instructions.map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              上传成功后，可在模板库查看导入的页面/组件，并在 AI 编辑器的模板组合面板中立即复用新内容。
            </div>
          </aside>
        </section>

        {result && (
          <section className="space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">导入结果</h2>
                {result.importId && <p className="text-xs text-gray-500 mt-1">Import ID：{result.importId}</p>}
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">页面</h3>
                <ul className="mt-3 space-y-2 text-xs text-gray-600">
                  {(result.pages || []).length ? (
                    result.pages!.map((page) => (
                      <li key={page.slug} className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <span className="font-medium text-gray-800">{page.slug}</span>
                        {page.name && <span className="text-gray-500">{page.name}</span>}
                      </li>
                    ))
                  ) : (
                    <li className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-gray-400">
                      未解析到页面内容
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">组件</h3>
                <ul className="mt-3 space-y-2 text-xs text-gray-600">
                  {(result.components || []).length ? (
                    result.components!.map((component) => (
                      <li key={component.slug} className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <span className="font-medium text-gray-800">{component.slug}</span>
                        {component.name && <span className="text-gray-500">{component.name}</span>}
                      </li>
                    ))
                  ) : (
                    <li className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-gray-400">
                      未解析到组件内容
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              {result.theme ? (
                <>
                  已抽取主题：
                  <code className="mx-2 rounded bg-white px-2 py-0.5 text-blue-700 border border-blue-200">{result.theme}</code>
                  现在可在 AI 编辑器中应用该主题。
                </>
              ) : (
                '未检测到主题信息，如需要主题支持请确认 ZIP 中包含 theme 元数据。'
              )}
            </div>

            <details className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
              <summary className="cursor-pointer text-sm font-semibold text-gray-900">查看完整响应</summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded bg-gray-900 p-4 text-xs text-white">
{JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </div>
  );
}
