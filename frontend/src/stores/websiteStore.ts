import { create } from 'zustand'
import { Website, DeploymentStatus } from '@shared/types'
import api from '@/services/api'

interface WebsiteState {
  websites: Website[]
  currentWebsite: Website | null
  loading: boolean
  error: string | null
  deploymentStatus: Record<string, DeploymentStatus> // websiteId -> status
}

interface WebsiteActions {
  fetchWebsites: () => Promise<void>
  fetchWebsite: (id: string) => Promise<void>
  createWebsite: (data: Partial<Website>) => Promise<Website>
  updateWebsite: (id: string, data: Partial<Website>) => Promise<Website>
  deleteWebsite: (id: string) => Promise<void>
  deployWebsite: (id: string, config: any) => Promise<void>
  setCurrentWebsite: (website: Website | null) => void
  updateDeploymentStatus: (websiteId: string, status: DeploymentStatus) => void
  clearError: () => void
}

export const useWebsiteStore = create<WebsiteState & WebsiteActions>((set, get) => ({
  websites: [],
  currentWebsite: null,
  loading: false,
  error: null,
  deploymentStatus: {},

  fetchWebsites: async () => {
    try {
      set({ loading: true, error: null })
      
      const response = await api.get('/websites')
      const { websites } = response.data
      
      set({ websites, loading: false })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch websites',
        loading: false 
      })
    }
  },

  fetchWebsite: async (id: string) => {
    try {
      set({ loading: true, error: null })
      
      const response = await api.get(`/websites/${id}`)
      const { website } = response.data
      
      set({ currentWebsite: website, loading: false })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to fetch website',
        loading: false 
      })
    }
  },

  createWebsite: async (data: Partial<Website>) => {
    try {
      set({ loading: true, error: null })
      
      const response = await api.post('/websites', data)
      const { website } = response.data
      
      const { websites } = get()
      set({ 
        websites: [website, ...websites],
        loading: false 
      })
      
      return website
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to create website',
        loading: false 
      })
      throw error
    }
  },

  updateWebsite: async (id: string, data: Partial<Website>) => {
    try {
      const response = await api.put(`/websites/${id}`, data)
      const { website } = response.data
      
      const { websites, currentWebsite } = get()
      
      set({
        websites: websites.map(w => w.id === id ? website : w),
        currentWebsite: currentWebsite?.id === id ? website : currentWebsite
      })
      
      return website
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to update website'
      })
      throw error
    }
  },

  deleteWebsite: async (id: string) => {
    try {
      await api.delete(`/websites/${id}`)
      
      const { websites, currentWebsite } = get()
      
      set({
        websites: websites.filter(w => w.id !== id),
        currentWebsite: currentWebsite?.id === id ? null : currentWebsite
      })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to delete website'
      })
      throw error
    }
  },

  deployWebsite: async (id: string, config: any) => {
    try {
      set({ loading: true, error: null })
      
      const response = await api.post(`/deployments/${id}/deploy`, config)
      const { deployment } = response.data
      
      // Update deployment status
      const { deploymentStatus } = get()
      set({
        deploymentStatus: {
          ...deploymentStatus,
          [id]: {
            websiteId: id,
            status: 'pending',
            message: 'Deployment initiated',
            timestamp: new Date(),
            nginxConfigured: false,
            sslConfigured: false,
            dnsResolved: false
          }
        },
        loading: false
      })
      
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || 'Failed to deploy website',
        loading: false 
      })
      throw error
    }
  },

  setCurrentWebsite: (website: Website | null) => {
    set({ currentWebsite: website })
  },

  updateDeploymentStatus: (websiteId: string, status: DeploymentStatus) => {
    const { deploymentStatus } = get()
    set({
      deploymentStatus: {
        ...deploymentStatus,
        [websiteId]: status
      }
    })
  },

  clearError: () => set({ error: null }),
}))