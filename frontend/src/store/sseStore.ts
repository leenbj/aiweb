import { create } from 'zustand'

interface SseState {
  connected: boolean
  lastHeartbeat: number | null
  pulse: boolean
  setConnected: (v: boolean) => void
  setHeartbeat: (ts: number | null) => void
  triggerPulse: () => void
}

export const useSseStore = create<SseState>((set, get) => ({
  connected: false,
  lastHeartbeat: null,
  pulse: false,
  setConnected: (v) => set({ connected: v }),
  setHeartbeat: (ts) => set({ lastHeartbeat: ts }),
  triggerPulse: () => {
    set({ pulse: true })
    // 简单的短暂脉冲
    setTimeout(() => set({ pulse: false }), 700)
  },
}))

