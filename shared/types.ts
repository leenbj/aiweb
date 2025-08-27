// 共享类型定义
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Website {
  id: string;
  userId: string;
  domain: string;
  title: string;
  description?: string;
  content: string; // HTML/CSS/JS content
  status: 'draft' | 'published' | 'deploying' | 'error';
  sslStatus: 'pending' | 'active' | 'error';
  dnsStatus: 'pending' | 'resolved' | 'error';
  createdAt: Date;
  updatedAt: Date;
  deployedAt?: Date;
}

export interface AIConversation {
  id: string;
  websiteId: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  websiteChanges?: WebsiteChange[];
}

export interface WebsiteChange {
  type: 'create' | 'update' | 'delete';
  element: string;
  content: string;
  styles?: Record<string, string>;
}

export interface DeploymentConfig {
  domain: string;
  serverPath: string;
  nginxConfig: string;
  sslCertPath?: string;
}

export type DeploymentStatus = 'pending' | 'deploying' | 'deployed' | 'error';

export interface ServerStats {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeWebsites: number;
  totalRequests: number;
}

// API响应类型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// AI提示工程类型
export interface AIPromptTemplate {
  id: string;
  name: string;
  category: 'generation' | 'editing' | 'optimization';
  prompt: string;
  variables: string[];
}

// 编辑器状态
export interface EditorState {
  selectedElement: string | null;
  mode: 'visual' | 'code';
  history: HistoryItem[];
  currentIndex: number;
}

export interface HistoryItem {
  id: string;
  content: string;
  timestamp: Date;
  description: string;
}

// 用户设置类型
export interface UserSettings {
  id: string;
  userId: string;
  deepseekApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  aiProvider: 'deepseek' | 'openai' | 'anthropic';
  deepseekModel?: string;
  openaiModel?: string;
  anthropicModel?: string;
  systemPrompt?: string; // 保留向后兼容性
  chatPrompt?: string; // 对话聊天提示词
  generatePrompt?: string; // 网站生成提示词
  editPrompt?: string; // 网站编辑提示词
  createdAt: Date;
  updatedAt: Date;
}

// Token使用情况类型
export interface TokenUsage {
  id: string;
  userId: string;
  date: Date;
  tokensUsed: number;
  costRmb: number;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

// 日使用统计
export interface DailyUsage {
  date: string;
  totalTokens: number;
  totalCost: number;
  providers: Record<string, {
    tokens: number;
    cost: number;
  }>;
}