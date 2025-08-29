import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import { User } from '@shared/types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

// 统一token同步函数
const syncTokens = (token: string | null) => {
  if (token) {
    localStorage.setItem('auth-token', token)
    // 使用API客户端的setAuthHeader方法
    api.setAuthHeader?.(token)
  } else {
    localStorage.removeItem('auth-token')
    // 清除认证头
    api.clearAuthHeader?.()
  }
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ loading: true, error: null })
          
          const response = await api.post('/auth/login', { email, password })
          const { user, token } = response.data?.data || response.data || {}
          
          // 同步更新所有token存储
          syncTokens(token)
          
          set({ user, token, loading: false })
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Login failed', 
            loading: false 
          })
          throw error
        }
      },

      register: async (email: string, name: string, password: string) => {
        try {
          set({ loading: true, error: null })
          
          const response = await api.post('/auth/register', { email, name, password })
          const { user, token } = response.data?.data || response.data || {}
          
          // 同步更新所有token存储
          syncTokens(token)
          
          set({ user, token, loading: false })
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || 'Registration failed', 
            loading: false 
          })
          throw error
        }
      },

      logout: async () => {
        try {
          const { token } = get()
          
          if (token) {
            await api.post('/auth/logout')
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // 清理所有token存储
          syncTokens(null)
          
          set({ user: null, token: null, error: null })
        }
      },

      checkAuth: async () => {
        try {
          const { token } = get()
          
          if (!token) {
            set({ loading: false })
            return
          }
          
          set({ loading: true })
          
          // 同步更新所有token存储
          syncTokens(token)
          
          const response = await api.get('/auth/me')
          const { user } = response.data?.data || response.data || {}
          
          set({ user, loading: false })
        } catch (error: any) {
          console.error('Auth check failed:', error)
          
          // 清理无效token
          syncTokens(null)
          set({ user: null, token: null, loading: false })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token 
      }),
      onRehydrateStorage: () => (state) => {
        // 同步重水合时的token设置
        syncTokens(state?.token || null)
      },
    }
  )
)