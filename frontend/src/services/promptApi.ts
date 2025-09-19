const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.DEV ? '/api' : 'http://localhost:3001/api');

function getToken() {
  const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
  return zustandAuth?.state?.token || localStorage.getItem('auth-token') || '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error || parsed?.message || text;
    } catch {
      // ignore
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const data = await response.json();
  return (data?.data ?? data) as T;
}

export interface PromptListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export const promptApi = {
  list(params: PromptListParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search) query.set('search', params.search.trim());
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    const qs = query.toString();
    return request(`/prompts${qs ? `?${qs}` : ''}`);
  },

  get(id: string) {
    return request(`/prompts/${id}`);
  },

  retry(id: string) {
    return request(`/prompts/${id}/retry`, { method: 'POST' });
  },

  import(payload: string | Record<string, any> | Array<Record<string, any>>) {
    return request<{ created?: Array<{ promptId: string }>; skipped?: Array<{ name: string; reason: string }> }>('/prompts/import', {
      method: 'POST',
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      headers: {
        'Content-Type': typeof payload === 'string' ? 'text/plain' : 'application/json',
      },
    });
  },
};
