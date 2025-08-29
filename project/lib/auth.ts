import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        // 模拟登录API调用
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 模拟成功登录
        if (email && password) {
          const user: User = {
            id: '1',
            email,
            name: email.split('@')[0],
            plan: 'free',
            createdAt: new Date(),
          };
          
          set({ user, isAuthenticated: true });
          return true;
        }
        
        return false;
      },

      register: async (email: string, password: string, name: string) => {
        // 模拟注册API调用
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (email && password && name) {
          const user: User = {
            id: '1',
            email,
            name,
            plan: 'free',
            createdAt: new Date(),
          };
          
          set({ user, isAuthenticated: true });
          return true;
        }
        
        return false;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);