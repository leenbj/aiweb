// 共享类型定义
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Website {
  id: string;
  userId: string;
  domain: string;
  title: string;
  description?: string;
  content: string; // HTML/CSS/JS content
  html?: string | null;
  css?: string | null;
  js?: string | null;
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

export type TemplateType = 'page' | 'component' | 'theme';
export type TemplateEngine = 'plain' | 'hbs' | 'react';

export interface TemplateAIHintField {
  description?: string;
  example?: string;
  required?: boolean;
}

export interface TemplateAIHints {
  summary?: string;
  recommendedUseCases?: string[];
  keywords?: string[];
  sections?: Record<string, TemplateAIHintField>;
  prompts?: string[];
}

export interface TemplateManifest {
  slug: string;
  name: string;
  version: string;
  type: TemplateType;
  engine: TemplateEngine;
  description?: string;
  entry?: string;
  tags?: string[];
  schema?: Record<string, any> | null;
  aiHints?: TemplateAIHints;
  assets?: string[];
  source?: TemplateSource;
  planSnapshot?: Record<string, any> | null;
}

export type TemplateSource = 'ZIP' | 'PROMPT' | 'MANUAL' | 'SYSTEM';

export type PromptStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
export type PromptSource = 'OPERATION' | 'SYSTEM';
export type PipelineStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ON_HOLD';
export type ImportType = 'ZIP' | 'PROMPT';

export interface UiPrompt {
  id: string;
  name: string;
  rawText: string;
  tags: string[];
  status: PromptStatus;
  source: PromptSource;
  targetSlug?: string | null;
  latestJobId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PromptGenerationRun {
  id: string;
  promptId: string;
  status: PipelineStatus;
  errorMessage?: string | null;
  artifactPath?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
}

export interface TemplatePipelineJob {
  id: string;
  promptId?: string | null;
  importType: ImportType;
  templateIds: string[];
  versionIds: string[];
  status: PipelineStatus;
  retryCount: number;
  metadata?: Record<string, any> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TemplateSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  engine: string;
  version: string;
  tags: string[];
  summary: string;
  keyFields: string[];
  updatedAt: Date | string;
}

export interface TemplatePlanPage {
  slug: string;
  data?: Record<string, any>;
}

export interface TemplatePlanComponent {
  slot: string;
  slug: string;
  data?: Record<string, any>;
}

export interface TemplatePlanTheme {
  slug: string;
  data?: Record<string, any>;
}

export interface TemplatePlan {
  page: TemplatePlanPage;
  components: TemplatePlanComponent[];
  theme?: TemplatePlanTheme | null;
  pages?: TemplatePlanPage[];
  metadata?: Record<string, any> | null;
}

export interface TemplateSnapshotRecord {
  id: string;
  templateId: string;
  versionId?: string | null;
  plan?: Record<string, any> | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  components?: Array<{ slug: string; html: string }> | null;
  metadata?: Record<string, any> | null;
  createdBy?: string | null;
  createdByName?: string | null;
  requestId?: string | null;
  createdAt: Date | string;
}

export interface PromptReviewTemplateSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  version: string;
  tags: string[];
  updatedAt: string;
  previewUrl: string;
}

export interface PromptReviewJobSummary {
  id: string;
  status: string;
  importType: string;
  retryCount: number;
  templateIds: string[];
  versionIds: string[];
  metadata?: Record<string, any> | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  templates: Array<PromptReviewTemplateSummary | { id: string; missing?: boolean }>;
}

export interface PromptReviewItem {
  prompt: {
    id: string;
    name: string;
    tags: string[];
    status: PromptStatus;
    source: PromptSource;
    targetSlug?: string | null;
    latestJobId?: string | null;
    rawText?: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  latestRun: {
    id: string;
    status: PipelineStatus;
    errorMessage?: string | null;
    artifactPath?: string | null;
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
  } | null;
  latestJob: {
    id: string;
    status: PipelineStatus;
    importType: ImportType;
    retryCount: number;
    createdAt: Date | string;
    updatedAt: Date | string;
  } | null;
  jobs: PromptReviewJobSummary[];
  templateSummaries: PromptReviewTemplateSummary[];
  templateSlugs: string[];
  previewUrls: string[];
  patchDownloadUrls: string[];
  artifactPath?: string | null;
  statistics: {
    totalRuns: number;
    totalJobs: number;
  };
}

export interface PromptReviewResponse {
  items: PromptReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface ParsedPromptFile {
  filename: string;
  content: string;
}

export interface ParsedPromptAsset extends ParsedPromptFile {
  encoding?: 'utf8' | 'base64';
  contentType?: string;
}

export interface ParsedPromptDependency extends ParsedPromptFile {
  kind?: 'component' | 'util' | 'data';
}

export interface ParsedPrompt {
  name: string;
  slug?: string;
  description?: string;
  component: {
    code: string;
    filename?: string;
    exportName?: string;
  };
  demo?: {
    code: string;
    filename?: string;
  };
  dependencies?: ParsedPromptDependency[];
  assets?: ParsedPromptAsset[];
  styles?: ParsedPromptFile[];
  npmPackages?: Array<{ name: string; version?: string }>;
  notes?: string[];
}
