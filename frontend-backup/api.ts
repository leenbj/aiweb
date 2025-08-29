import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { APIResponse, Website, User, AIConversation, UserSettings, TokenUsage, DailyUsage } from '@/shared/types';

// Base API configuration - 在开发模式下强制使用代理
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 180000, // 增加到3分钟，支持R1推理模型
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // 启用凭据
    });

    // Request interceptor - 统一token获取逻辑
    this.client.interceptors.request.use(
      (config) => {
        // 优先从Zustand存储获取token，向后兼容localStorage
        const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        const token = zustandAuth?.state?.token || localStorage.getItem('auth-token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // 只有在非AI聊天请求时才自动跳转到登录页
          if (!error.config?.url?.includes('/ai/chat-stream')) {
            localStorage.removeItem('auth-token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string): Promise<AxiosResponse<APIResponse<T>>> {
    return this.client.get(url);
  }

  async post<T>(url: string, data?: any): Promise<AxiosResponse<APIResponse<T>>> {
    return this.client.post(url, data);
  }

  async put<T>(url: string, data?: any): Promise<AxiosResponse<APIResponse<T>>> {
    return this.client.put(url, data);
  }

  async delete<T>(url: string): Promise<AxiosResponse<APIResponse<T>>> {
    return this.client.delete(url);
  }

  setAuthHeader(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('auth-token', token);
    // 同步更新Zustand存储
    const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    if (zustandAuth.state) {
      zustandAuth.state.token = token;
      localStorage.setItem('auth-storage', JSON.stringify(zustandAuth));
    }
  }

  removeAuthHeader() {
    delete this.client.defaults.headers.common['Authorization'];
    localStorage.removeItem('auth-token');
    // 同步清除Zustand存储
    const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    if (zustandAuth.state) {
      zustandAuth.state.token = null;
      zustandAuth.state.user = null;
      localStorage.setItem('auth-storage', JSON.stringify(zustandAuth));
    }
  }
}

const apiClient = new APIClient();

// Auth service
export const authService = {
  login: (data: { email: string; password: string }) => 
    apiClient.post<{ user: User; token: string }>('/auth/login', data),
  
  register: (data: { name: string; email: string; password: string }) =>
    apiClient.post<{ user: User; token: string }>('/auth/register', data),
  
  getMe: () =>
    apiClient.get<User>('/auth/me'),
  
  updateProfile: (data: { name?: string; email?: string }) =>
    apiClient.put<User>('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put<{ message: string }>('/auth/password', data),
  
  setAuthHeader: (token: string) => apiClient.setAuthHeader(token),
  removeAuthHeader: () => apiClient.removeAuthHeader(),
};

// Website service
export const websiteService = {
  getWebsites: () =>
    apiClient.get<Website[]>('/websites'),
  
  getWebsite: (id: string) =>
    apiClient.get<Website>(`/websites/${id}`),
  
  createWebsite: (data: { title: string; description?: string; domain: string }) =>
    apiClient.post<Website>('/websites', data),
  
  updateWebsite: (id: string, data: Partial<Website>) =>
    apiClient.put<Website>(`/websites/${id}`, data),
  
  deleteWebsite: (id: string) =>
    apiClient.delete(`/websites/${id}`),
  
  duplicateWebsite: (id: string) =>
    apiClient.post<Website>(`/websites/${id}/duplicate`),
};

// AI service
export const aiService = {
  generateWebsite: (prompt: string, websiteId?: string, conversationId?: string) =>
    apiClient.post<{ website: Website; content: string; reply: string }>('/ai/generate', {
      prompt,
      websiteId,
      conversationId,
    }),
  
  editWebsite: (websiteId: string, instructions: string, conversationId?: string) =>
    apiClient.post<{ website: Website; content: string }>('/ai/edit', {
      websiteId,
      instructions,
      conversationId,
    }),

  // 流式网站生成
  generateWebsiteStream: async (
    prompt: string,
    onChunk: (chunk: { type: string; content?: string; fullHtml?: string; reply?: string }) => void,
    onComplete: (result: { website: Website; content: string; reply: string }) => void,
    onError: (error: string) => void,
    websiteId?: string,
    abortController?: AbortController
  ) => {
    // 统一token获取逻辑
    const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const token = zustandAuth?.state?.token || localStorage.getItem('auth-token');
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    
    try {
      const response = await fetch(`${baseURL}/ai/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, websiteId }),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'html_chunk' || data.type === 'reply') {
                onChunk(data);
              } else if (data.type === 'complete') {
                onComplete(data);
                return;
              } else if (data.type === 'error') {
                console.error('❌ 前端流式生成错误:', data.error);
                onError(data.error);
                return;
              }
            } catch (e) {
        
              // 忽略JSON解析错误，可能是不完整的数据块
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 生成网站已被用户中断');
        onError('生成已被中断');
      } else {
        console.error('Stream generate error:', error);
        onError(error instanceof Error ? error.message : 'Network error');
      }
    }
  },

  // 流式网站编辑
  editWebsiteStream: async (
    websiteId: string,
    instructions: string,
    onChunk: (chunk: { type: string; content?: string; fullContent?: string }) => void,
    onComplete: (result: { website: Website; content: string }) => void,
    onError: (error: string) => void,
    abortController?: AbortController
  ) => {
    console.log('🌊 前端开始流式编辑:', { websiteId, instructions: instructions.substring(0, 50) });
    // 统一token获取逻辑
    const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const token = zustandAuth?.state?.token || localStorage.getItem('auth-token');
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    console.log('🔗 使用API地址:', `${baseURL}/ai/edit-stream`);
    console.log('📦 Token来源检查:', { hasZustand: !!zustandAuth?.state, hasLocalToken: !!localStorage.getItem('auth-token') });
    
    try {
      const response = await fetch(`${baseURL}/ai/edit-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ websiteId, instructions }),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content_chunk') {
                onChunk(data);
              } else if (data.type === 'complete') {
                onComplete(data);
                return;
              } else if (data.type === 'error') {
                onError(data.error);
                return;
              }
            } catch (e) {
              // 忽略JSON解析错误，可能是不完整的数据块
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 编辑网站已被用户中断');
        onError('编辑已被中断');
      } else {
        console.error('Stream edit error:', error);
        onError(error instanceof Error ? error.message : 'Network error');
      }
    }
  },

  chat: (data: {
    message: string;
    conversationHistory: any[];
    stage: string;
    requirements: any;
  }) =>
    apiClient.post<{ reply: string }>('/ai/chat', data),

  chatStream: async (data: {
    message: string;
    conversationHistory: any[];
    stage: string;
    requirements: any;
  }, onChunk: (chunk: string) => void, onComplete: (fullResponse: string) => void, onError: (error: string) => void, abortController?: AbortController) => {
    console.log('🌊 前端开始chat流式请求:', { message: data.message.substring(0, 50), stage: data.stage });
    // 统一token获取逻辑
    const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
    const token = zustandAuth?.state?.token || localStorage.getItem('auth-token');
    console.log('🔑 获取到的token:', token ? token.substring(0, 20) + '...' : 'null');
    console.log('📦 Zustand状态检查:', { hasZustand: !!zustandAuth?.state, hasLocalToken: !!localStorage.getItem('auth-token') });
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    const fullApiUrl = `${baseURL}/ai/chat-stream`;
    console.log('🔗 使用chat-stream API地址:', fullApiUrl);
    console.log('🌍 环境变量检查:', { DEV: import.meta.env.DEV, VITE_API_URL: import.meta.env.VITE_API_URL });
    
    try {
      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: abortController?.signal,
      });

      console.log('📡 Fetch响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP请求失败:', { 
          status: response.status, 
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText 
        });
        
        if (response.status === 401) {
          onError('登录已过期，请重新登录');
          // 清理所有token存储
          localStorage.removeItem('auth-token');
          const zustandAuth = JSON.parse(localStorage.getItem('auth-storage') || '{}');
          if (zustandAuth.state) {
            zustandAuth.state.token = null;
            zustandAuth.state.user = null;
            localStorage.setItem('auth-storage', JSON.stringify(zustandAuth));
          }
          // 延迟跳转，给用户时间看到错误信息
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      console.log('✅ HTTP请求成功，开始读取流式数据');

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应读取器');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';
      let hasReceivedData = false;

      // 设置连接超时
      const connectionTimeout = setTimeout(() => {
        if (!hasReceivedData) {
          reader.cancel();
          onError('连接超时，请检查网络或重试');
        }
      }, 30000); // 30秒超时

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('🏁 SSE读取完成');
            clearTimeout(connectionTimeout);
            if (!hasReceivedData) {
              onError('连接意外中断，请重试');
              return;
            }
            break;
          }
          
          hasReceivedData = true;
          clearTimeout(connectionTimeout);

          const chunk = decoder.decode(value);
          console.log('📥 收到数据块:', chunk.length > 100 ? chunk.substring(0, 100) + '...' : chunk);
          const lines = chunk.split('\n').filter(line => line.trim());
          // 更新最后心跳时间
          const lastHeartbeat = Date.now();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                const eventData = JSON.parse(jsonStr);
                
                // 处理心跳事件
                if (eventData.event === 'heartbeat') {
                  console.log('💓 收到心跳信号');
                  continue;
                }
                
                // 处理连接确认事件
                if (eventData.event === 'connected') {
                  console.log('✅ SSE连接已建立');
                  continue;
                }
                
                if (eventData.type === 'chunk') {
                  const chunkContent = eventData.content || '';
                  fullResponse += chunkContent;
                  onChunk(chunkContent);
                } else if (eventData.type === 'complete' || eventData.type === 'done') {
                  console.log('✅ 收到完成信号');
                  onComplete(fullResponse || eventData.content);
                  return;
                } else if (eventData.type === 'error') {
                  console.error('❌ 收到错误信号:', eventData.error);
                  onError(eventData.error);
                  return;
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        }
        
        // 正常完成
        if (fullResponse) {
          onComplete(fullResponse);
        }
        
      } catch (streamError) {
        clearTimeout(connectionTimeout);
        console.error('🚫 流处理异常:', streamError);
        if (fullResponse) {
          onComplete(fullResponse);
        } else {
          onError('连接处理失败');
        }
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 AI聊天已被用户中断');
        onError('聊天已被中断');
      } else {
        console.error('Stream chat error:', error);
        onError(error instanceof Error ? error.message : 'Network error');
      }
    }
  },
  
  optimizeWebsite: (websiteId: string) =>
    apiClient.post<{ website: Website; content: string }>('/ai/optimize', {
      websiteId,
    }),
  
  createConversation: (websiteId: string, title?: string) =>
    apiClient.post<AIConversation>('/ai/conversation', {
      websiteId,
      title,
    }),
  
  getConversation: (id: string) =>
    apiClient.get<AIConversation>(`/ai/conversation/${id}`),

  getModels: () =>
    apiClient.get<{
      deepseek: { name: string; models: Array<{ id: string; name: string; description: string }> };
      openai: { name: string; models: Array<{ id: string; name: string; description: string }> };
      anthropic: { name: string; models: Array<{ id: string; name: string; description: string }> };
    }>('/ai/models'),

  testConnection: (data: { provider: string; apiKey?: string; model?: string }) =>
    apiClient.post<{
      connected: boolean;
      response?: string;
      error?: string;
      provider: string;
      model: string;
    }>('/ai/test-connection', data),
};

// Deployment service
export const deploymentService = {
  deployWebsite: (websiteId: string) =>
    apiClient.post<{ message: string }>(`/deployment/deploy/${websiteId}`),
  
  undeployWebsite: (websiteId: string) =>
    apiClient.post<{ message: string }>(`/deployment/undeploy/${websiteId}`),
  
  getDeploymentStatus: (websiteId: string) =>
    apiClient.get<any[]>(`/deployment/status/${websiteId}`),
  
  checkDNS: (domain: string) =>
    apiClient.post<{ resolved: boolean }>('/deployment/check-dns', { domain }),
  
  requestSSL: (domain: string) =>
    apiClient.post<{ success: boolean }>('/deployment/ssl', { domain }),
};

// Server service
export const serverService = {
  getStats: () =>
    apiClient.get<{
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
      activeWebsites: number;
      totalRequests: number;
    }>('/server/stats'),
  
  getDomains: () =>
    apiClient.get<any[]>('/server/domains'),
  
  getServerLogs: (service?: string, lines?: number) =>
    apiClient.get<{ logs: string[] }>(`/server/logs?service=${service}&lines=${lines}`),
};

// Settings service
export const settingsService = {
  getSettings: (showFullKeys?: boolean) =>
    apiClient.get<UserSettings>(`/settings${showFullKeys ? '?showFullKeys=true' : ''}`),

  updateSettings: (data: Partial<UserSettings>) =>
    apiClient.put<UserSettings>('/settings', data),

  getUsage: (params?: {
    startDate?: string;
    endDate?: string;
    provider?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.provider) queryParams.append('provider', params.provider);
    
    return apiClient.get<{
      usage: TokenUsage[];
      totals: { totalTokens: number; totalCost: number };
    }>(`/settings/usage?${queryParams.toString()}`);
  },

  getDailyUsage: (days: number = 30) =>
    apiClient.get<DailyUsage[]>(`/settings/usage/daily?days=${days}`),

  getDefaultPrompts: () =>
    apiClient.get<{
      chatPrompt: string;
      generatePrompt: string;
      editPrompt: string;
    }>('/settings/default-prompts'),
};

// Token statistics service
export const tokenService = {
  getOverview: () =>
    apiClient.get<{
      today: { tokensUsed: number; costRmb: number; operations: number };
      yesterday: { tokensUsed: number; costRmb: number };
      month: { tokensUsed: number; costRmb: number };
      providers: Array<{ provider: string; tokensUsed: number; costRmb: number }>;
    }>('/tokens/overview'),

  getTrend: () =>
    apiClient.get<{
      trend: Array<{ date: string; provider: string; tokensUsed: number; costRmb: number }>;
      period: { startDate: string; endDate: string };
    }>('/tokens/usage/trend'),

  getDailyUsage: (params: { date: string; provider?: string }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('date', params.date);
    if (params.provider) queryParams.append('provider', params.provider);
    
    return apiClient.get<{
      date: string;
      hourlyStats: Array<{ hour: number; tokensUsed: number; costRmb: number; details: any[] }>;
      providerStats: Record<string, { tokensUsed: number; costRmb: number; operations: number }>;
      totals: { totalTokens: number; totalCost: number; totalOperations: number };
      rawData: any[];
    }>(`/tokens/usage/daily?${queryParams.toString()}`);
  },

  getRangeUsage: (params: { 
    startDate: string; 
    endDate: string; 
    provider?: string; 
    groupBy?: 'day' | 'hour' 
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    if (params.provider) queryParams.append('provider', params.provider);
    if (params.groupBy) queryParams.append('groupBy', params.groupBy);
    
    return apiClient.get<{
      usage: Array<{ date: string; hour?: number; provider: string; tokensUsed: number; costRmb: number }>;
      totals: { totalTokens: number; totalCost: number };
      period: { startDate: string; endDate: string };
      groupBy: string;
    }>(`/tokens/usage/range?${queryParams.toString()}`);
  },
};

export default apiClient;