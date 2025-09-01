import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/api';
import type { User as SharedUser } from '@/shared/types';

export interface User extends SharedUser {
  plan: 'free' | 'pro' | 'enterprise';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuth = create<AuthState>()(
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
          const { user: userData, token } = response.data?.data || {} as { user?: SharedUser; token?: string };
          if (!userData || !token) throw new Error('登录响应无效');
          
          // Map backend user to frontend user format
          const user: User = {
            id: String(userData.id),
            email: String(userData.email),
            name: String(userData.name),
            role: (userData as any).role || 'user',
            plan: 'free', // Default to free plan
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
          };
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Set auth header for future requests
          authService.setAuthHeader(token);
          
          return true;
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Login failed:', error);
          return false;
        }
      },

      register: async (email: string, password: string, name: string) => {
        try {
          set({ isLoading: true });
          
          const response = await authService.register({ name, email, password });
          const { user: userData, token } = response.data?.data || {} as { user?: SharedUser; token?: string };
          if (!userData || !token) throw new Error('注册响应无效');
          
          // Map backend user to frontend user format
          const user: User = {
            id: String(userData.id),
            email: String(userData.email),
            name: String(userData.name),
            role: (userData as any).role || 'user',
            plan: 'free', // Default to free plan
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
          };
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Set auth header for future requests
          authService.setAuthHeader(token);
          
          return true;
        } catch (error: any) {
          set({ isLoading: false });
          console.error('Registration failed:', error);
          return false;
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
          
          if (userData) {
            const user: User = {
              id: String(userData.id),
              email: String(userData.email),
              name: String(userData.name),
              role: (userData as any).role || 'user',
              plan: 'free', // Default to free plan
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt,
            };

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Token is invalid, clear auth state
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
            authService.removeAuthHeader();
          }
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

      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
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
          }
        }
      },
    }
  )
);
