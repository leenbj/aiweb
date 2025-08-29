import { create } from 'zustand';
import { websiteService } from '../services/api';
import { toast } from 'react-hot-toast';
import type { Website } from '@/shared/types';

interface WebsiteState {
  websites: Website[];
  currentWebsite: Website | null;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Actions
  fetchWebsites: () => Promise<void>;
  createWebsite: (data: { title: string; description?: string; domain: string }) => Promise<Website>;
  updateWebsite: (id: string, data: Partial<Website>) => Promise<void>;
  deleteWebsite: (id: string) => Promise<void>;
  setCurrentWebsite: (website: Website | null) => void;
  getWebsite: (id: string) => Promise<Website>;
  duplicateWebsite: (id: string) => Promise<Website>;
}

export const useWebsiteStore = create<WebsiteState>((set, get) => ({
  websites: [],
  currentWebsite: null,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,

  fetchWebsites: async () => {
    try {
      set({ isLoading: true });
      
      const response = await websiteService.getWebsites();
      const websites = response.data?.data || [];
      
      set({ websites, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      const message = error.response?.data?.error || '获取网站列表失败';
      toast.error(message);
      throw error;
    }
  },

  createWebsite: async (data: { title: string; description?: string; domain: string }) => {
    try {
      set({ isCreating: true });
      
      const response = await websiteService.createWebsite(data);
      const newWebsite = response.data?.data;
      
      set((state) => ({
        websites: [newWebsite, ...state.websites],
        currentWebsite: newWebsite,
        isCreating: false,
      }));
      
      toast.success('网站创建成功！');
      return newWebsite;
    } catch (error: any) {
      set({ isCreating: false });
      const message = error.response?.data?.error || '创建网站失败';
      toast.error(message);
      throw error;
    }
  },

  updateWebsite: async (id: string, data: Partial<Website>) => {
    try {
      set({ isUpdating: true });
      
      const response = await websiteService.updateWebsite(id, data);
      const updatedWebsite = response.data?.data;
      
      set((state) => ({
        websites: state.websites.map(site => 
          site.id === id ? updatedWebsite : site
        ),
        currentWebsite: state.currentWebsite?.id === id 
          ? updatedWebsite 
          : state.currentWebsite,
        isUpdating: false,
      }));
      
      toast.success('网站更新成功！');
    } catch (error: any) {
      set({ isUpdating: false });
      const message = error.response?.data?.error || '更新网站失败';
      toast.error(message);
      throw error;
    }
  },

  deleteWebsite: async (id: string) => {
    try {
      set({ isDeleting: true });
      
      await websiteService.deleteWebsite(id);
      
      set((state) => ({
        websites: state.websites.filter(site => site.id !== id),
        currentWebsite: state.currentWebsite?.id === id 
          ? null 
          : state.currentWebsite,
        isDeleting: false,
      }));
      
      toast.success('网站删除成功！');
    } catch (error: any) {
      set({ isDeleting: false });
      const message = error.response?.data?.error || '删除网站失败';
      toast.error(message);
      throw error;
    }
  },

  setCurrentWebsite: (website: Website | null) => {
    set({ currentWebsite: website });
  },

  getWebsite: async (id: string) => {
    try {
      // Check if website is already in store
      const existingWebsite = get().websites.find(site => site.id === id);
      if (existingWebsite) {
        set({ currentWebsite: existingWebsite });
        return existingWebsite;
      }
      
      // Fetch from API
      const response = await websiteService.getWebsite(id);
      const website = response.data?.data;
      
      set({ currentWebsite: website });
      
      // Add to websites list if not present
      set((state) => ({
        websites: state.websites.some(site => site.id === id)
          ? state.websites
          : [...state.websites, website],
      }));
      
      return website;
    } catch (error: any) {
      const message = error.response?.data?.error || '获取网站失败';
      toast.error(message);
      throw error;
    }
  },

  duplicateWebsite: async (id: string) => {
    try {
      set({ isCreating: true });
      
      const response = await websiteService.duplicateWebsite(id);
      const newWebsite = response.data?.data;
      
      set((state) => ({
        websites: [newWebsite, ...state.websites],
        isCreating: false,
      }));
      
      toast.success('网站复制成功！');
      return newWebsite;
    } catch (error: any) {
      set({ isCreating: false });
      const message = error.response?.data?.error || '复制网站失败';
      toast.error(message);
      throw error;
    }
  },
}));