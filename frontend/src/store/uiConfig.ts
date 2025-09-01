import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HeartbeatStyle = 'dot' | 'bar'
export type ThemeMode = 'auto' | 'light' | 'dark'

interface UiConfigState {
  showGlobalHeartbeat: boolean
  heartbeatStyle: HeartbeatStyle
  themeMode: ThemeMode
  setShowGlobalHeartbeat: (v: boolean) => void
  setHeartbeatStyle: (v: HeartbeatStyle) => void
  setThemeMode: (v: ThemeMode) => void
}

export const useUiConfig = create<UiConfigState>()(
  persist(
    (set) => ({
      showGlobalHeartbeat: true,
      heartbeatStyle: 'dot',
      themeMode: 'auto',
      setShowGlobalHeartbeat: (v) => set({ showGlobalHeartbeat: v }),
      setHeartbeatStyle: (v) => set({ heartbeatStyle: v }),
      setThemeMode: (v) => set({ themeMode: v }),
    }),
    { name: 'ui-config' }
  )
)

