import { create } from 'zustand';
import { PromptReviewItem, PromptReviewResponse, PromptStatus, PipelineStatus } from '@/shared/types';
import { promptApi, type PromptListParams } from '@/services/promptApi';

export type PromptStatusFilter = 'ALL' | PromptStatus;

interface PromptDetail {
  prompt: PromptReviewItem['prompt'];
  runs: Array<{ id: string; status: PipelineStatus; errorMessage?: string | null; startedAt?: string | Date | null; finishedAt?: string | Date | null; artifactPath?: string | null }>;
  jobs: Array<{
    id: string;
    status: string;
    importType: string;
    retryCount: number;
    templateIds: string[];
    versionIds: string[];
    metadata?: Record<string, any> | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    templates: Array<{ id: string; slug?: string; missing?: boolean; previewUrl?: string }>;
  }>;
}

interface PromptStoreState {
  items: PromptReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
  status: PromptStatusFilter;
  search: string;
  loading: boolean;
  error?: string;
  selectedId?: string;
  detail?: PromptDetail | null;
  detailLoading: boolean;
  listPrompts: (params?: Partial<PromptListParams>) => Promise<void>;
  setStatus: (status: PromptStatusFilter) => void;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  selectPrompt: (id: string | undefined) => Promise<void>;
  retryPrompt: (id: string) => Promise<void>;
}

export const usePromptStore = create<PromptStoreState>((set, get) => ({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  hasNextPage: false,
  status: 'ALL',
  search: '',
  loading: false,
  detailLoading: false,

  async listPrompts(params) {
    const { status, search, page, pageSize } = {
      status: get().status,
      search: get().search,
      page: get().page,
      pageSize: get().pageSize,
      ...params,
    };

    set({ loading: true, error: undefined });
    try {
      const response: PromptReviewResponse = await promptApi.list({ page, pageSize, status, search });
      set({
        items: response.items,
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        hasNextPage: response.hasNextPage,
        loading: false,
      });
    } catch (error: any) {
      set({ loading: false, error: error?.message || '加载提示词失败', items: [], total: 0, hasNextPage: false });
    }
  },

  setStatus(status) {
    set({ status, page: 1 });
  },

  setSearch(search) {
    set({ search, page: 1 });
  },

  setPage(page) {
    set({ page });
  },

  async selectPrompt(id) {
    if (!id) {
      set({ selectedId: undefined, detail: null });
      return;
    }
    set({ selectedId: id, detailLoading: true, detail: undefined, error: undefined });
    try {
      const detail = await promptApi.get(id);
      const normalizedJobs = (detail.jobs || []).map((job: any) => ({
        ...job,
        templates: Array.isArray(job.templates)
          ? job.templates
          : (job.templateIds || []).map((templateId: string) => ({ id: templateId })),
      }));

      set({
        detail: {
          prompt: detail.prompt,
          runs: detail.runs || [],
          jobs: normalizedJobs,
        },
        detailLoading: false,
      });
    } catch (error: any) {
      set({ detailLoading: false, error: error?.message || '获取提示词详情失败' });
    }
  },

  async retryPrompt(id) {
    await promptApi.retry(id);
    await Promise.all([get().listPrompts(), get().selectPrompt(get().selectedId)]);
  },
}));
