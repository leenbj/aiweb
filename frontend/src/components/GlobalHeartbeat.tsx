import React, { useEffect, useState } from 'react'
import { settingsService, aiService } from '@/services/api'

export default function GlobalHeartbeat() {
  // LLM 连接心跳：周期性检测是否能连接大模型 API
  const [connected, setConnected] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(false)
  const [pulse, setPulse] = useState<boolean>(false)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [providerName, setProviderName] = useState<string>('')
  const [modelName, setModelName] = useState<string>('')

  const heartbeatStyle: string = 'dot'

  const ping = async () => {
    try {
      setChecking(true)
      // 获取用户设置（包含完整密钥）
      const res = await settingsService.getSettings(true)
      const s = res.data?.data as any
      const provider = s?.aiProvider || 'deepseek'
      setProviderName(String(provider))
      const apiKey =
        provider === 'deepseek' ? s?.deepseekApiKey :
        provider === 'openai' ? s?.openaiApiKey :
        provider === 'anthropic' ? s?.anthropicApiKey : undefined
      const model =
        provider === 'deepseek' ? (s?.deepseekModel || 'deepseek-chat') :
        provider === 'openai' ? (s?.openaiModel || 'gpt-4o') :
        provider === 'anthropic' ? (s?.anthropicModel || 'claude-3-5-sonnet-20241022') : undefined
      if (model) setModelName(String(model))

      if (!apiKey || String(apiKey).includes('*')) {
        // 无有效密钥，视为未连接
        setConnected(false)
        setLastChecked(Date.now())
        return
      }

      const test = await aiService.testConnection({ provider, apiKey, model })
      const ok = !!test.data?.data?.connected
      setConnected(ok)
      setLastChecked(Date.now())
      setPulse(true)
      setTimeout(() => setPulse(false), 700)
    } catch (e) {
      setConnected(false)
      setLastChecked(Date.now())
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await ping()
    }
    run()
    const id = setInterval(run, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const isDark = document.documentElement.classList.contains('dark')
  const bgClass = isDark ? 'bg-gray-800/70 border-gray-700 text-gray-200' : 'bg-white/80 border-gray-200 text-gray-600'
  const name = modelName || providerName || '未配置'
  const label = `${name}:${connected ? '已连接' : '未连接'}`
  const color = connected ? 'bg-emerald-500' : 'bg-red-500'

  if (heartbeatStyle === 'bar') {
    return (
      <div className={`fixed bottom-3 right-3 z-50 select-none ${bgClass} rounded-lg px-3 py-1 border shadow-sm flex items-center gap-3`}
        role="status" aria-live="polite">
        <div className="flex items-center gap-1">
          <span className={`inline-block w-1.5 h-4 rounded-sm ${color}`}></span>
          <span className={`inline-block w-1.5 h-4 rounded-sm ${color} opacity-70`}></span>
          <span className={`inline-block w-1.5 h-4 rounded-sm ${color} opacity-50`}></span>
          {pulse && <span className={`inline-block w-1.5 h-4 rounded-sm ${color} opacity-30 animate-pulse`}></span>}
        </div>
        <span className="text-xs">{label}{checking ? '（检测中）' : ''}</span>
      </div>
    )
  }

  // default: dot
  return (
    <div className={`fixed bottom-3 right-3 z-50 flex items-center gap-2 select-none ${bgClass} rounded-lg px-2 py-1 border shadow-sm`}
      role="status" aria-live="polite">
      <div className="relative">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`}></span>
        {pulse && <span className={`absolute -inset-1 rounded-full ${color} opacity-30 animate-ping`}></span>}
      </div>
      <span className="text-xs">{label}{checking ? '（检测中）' : ''}</span>
    </div>
  )
}
