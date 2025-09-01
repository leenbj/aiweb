import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/api';
import { toast } from 'react-hot-toast';
import type { User as SharedUser } from '@/shared/types';

interface User extends SharedUser {
  plan?: 'free' | 'pro' | 'enterprise';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          
          const response = await authService.login({ email, password });
          const { user: userData, token } = (response.data?.data || {}) as { user?: SharedUser; token?: string };
          if (!userData || !token) throw new Error('登录响应无效');
          const user: User = {
            ...userData,
            role: (userData as any).role || 'user',
            plan: (userData as any).plan || 'free'
          };

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Set auth header for future requests
          authService.setAuthHeader(token);
          
          toast.success(`欢迎回来，${user.name}！`);
        } catch (error: any) {
          set({ isLoading: false });
          const message = error.response?.data?.error || '登录失败';
          toast.error(message);
          throw error;
        }
      },

      register: async (name: string, email: string, password: string) => {
        try {
          set({ isLoading: true });
          
          const response = await authService.register({ name, email, password });
          const { user: userData, token } = (response.data?.data || {}) as { user?: SharedUser; token?: string };
          if (!userData || !token) throw new Error('注册响应无效');
          const user: User = {
            ...userData,
            role: (userData as any).role || 'user',
            plan: (userData as any).plan || 'free'
          };
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Set auth header for future requests
          authService.setAuthHeader(token);
          
          toast.success(`欢迎，${user?.name || '用户'}！您的账户已创建。`);
        } catch (error: any) {
          set({ isLoading: false });
          const message = error.response?.data?.error || '注册失败';
          toast.error(message);
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        
        // Remove auth header
        authService.removeAuthHeader();
        
        toast.success('成功登出');
      },

      loadUser: async () => {
        try {
          const { token } = get();
          
          if (!token) {
            set({ isLoading: false, isAuthenticated: false });
            return;
          }
          
          // Set auth header
          authService.setAuthHeader(token);
          
          const response = await authService.getMe();
          const userData = response.data?.data as SharedUser | undefined;
          const user: User | null = userData ? {
            ...userData,
            role: (userData as any).role || 'user',
            plan: (userData as any).plan || 'free'
          } : null;

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to load user:', error);
          // Token is invalid, clear auth state
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          authService.removeAuthHeader();
        }
      },

      updateProfile: async (data: { name?: string; email?: string }) => {
        try {
          const response = await authService.updateProfile(data);
          const updatedUser = (response.data?.data || response.data) as SharedUser | undefined;
          const user: User | null = updatedUser ? {
            ...updatedUser,
            role: (updatedUser as any).role || 'user',
            plan: (updatedUser as any).plan || 'free'
          } : null;

          set({ user });
          toast.success('个人资料更新成功');
        } catch (error: any) {
          const message = error.response?.data?.error || '更新个人资料失败';
          toast.error(message);
          throw error;
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        try {
          await authService.changePassword({ currentPassword, newPassword });
          toast.success('密码修改成功');
        } catch (error: any) {
          const message = error.response?.data?.error || '修改密码失败';
          toast.error(message);
          throw error;
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate auth store:', error);
          return;
        }
        
        if (state && state.token) {
          // Set auth header and load user data on app startup
          authService.setAuthHeader(state.token);
          state.loadUser();
        } else {
          // No token, set loading to false
          if (state) {
            state.setLoading(false);
          } else {
            // Fallback: manually trigger loading false if no state
            setTimeout(() => {
              useAuthStore.getState().setLoading(false);
            }, 0);
          }
        }
      },
    }
  )
);
