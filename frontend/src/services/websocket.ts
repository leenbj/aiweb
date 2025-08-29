import { useAuthStore } from '@/stores/authStore'
import { useWebsiteStore } from '@/stores/websiteStore'
import toast from 'react-hot-toast'

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 5000 // 5 seconds
  private isReconnecting = false

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // 使用后端服务器的端口3001
    const host = window.location.hostname
    const port = '3001'
    const wsUrl = `${protocol}//${host}:${port}`
    
    try {
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.isReconnecting = false
        
        // Authenticate
        this.authenticate()
      }
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        this.handleReconnection()
      }
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.handleReconnection()
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isReconnecting = false
  }

  private authenticate() {
    const { token } = useAuthStore.getState()
    
    if (token && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'authenticate',
        data: { token }
      })
    }
  }

  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'auth':
        console.log('WebSocket authenticated')
        break
        
      case 'error':
        console.error('WebSocket error:', message.error)
        toast.error(`WebSocket error: ${message.error}`)
        break
        
      case 'deployment_update':
        this.handleDeploymentStatus(message.payload)
        break
        
      case 'ai_progress':
        this.handleAIProgress(message.payload)
        break
        
      case 'pong':
        // Heartbeat response
        break
        
      case 'connected':
        console.log('WebSocket connected:', message.payload?.message)
        break
        
      default:
        console.log('Unknown WebSocket message type:', message.type)
    }
  }

  private handleDeploymentStatus(data: any) {
    const { websiteId, status, message, url } = data
    const { updateDeploymentStatus } = useWebsiteStore.getState()
    
    // Update deployment status in store
    updateDeploymentStatus(websiteId, {
      websiteId,
      status: status.toLowerCase(),
      message,
      timestamp: new Date(),
      nginxConfigured: data.nginxConfigured || false,
      sslConfigured: data.sslConfigured || false,
      dnsResolved: data.dnsResolved || false
    })
    
    // Show toast notification
    switch (status) {
      case 'SUCCESS':
        toast.success(`Website deployed successfully! ${url ? `Visit: ${url}` : ''}`)
        break
      case 'ERROR':
        toast.error(`Deployment failed: ${message}`)
        break
      case 'DEPLOYING':
        toast(`Deployment in progress: ${message}`, {
          icon: '⚡',
          duration: 2000
        })
        break
    }
  }

  private handleAIProgress(data: any) {
    const { step, progress, message } = data
    
    // Show progress toast
    toast(`AI ${step}: ${message}`, {
      icon: '🤖',
      duration: 2000
    })
  }

  private handleReconnection() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }
    
    this.isReconnecting = true
    this.reconnectAttempts++
    
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      this.connect()
    }, this.reconnectInterval * this.reconnectAttempts) // Exponential backoff
  }

  ping() {
    this.send({ type: 'ping' })
  }

  // Public methods for sending messages
  subscribeToDeployment(websiteId: string) {
    this.send({
      type: 'subscribe_deployment',
      data: { websiteId }
    })
  }

  unsubscribeFromDeployment(websiteId: string) {
    this.send({
      type: 'unsubscribe_deployment',
      data: { websiteId }
    })
  }
}

export const websocketService = new WebSocketService()

// React hook for using WebSocket service
export const useWebSocket = () => {
  const connect = () => websocketService.connect()
  const disconnect = () => websocketService.disconnect()
  const subscribeToDeployment = (websiteId: string) => 
    websocketService.subscribeToDeployment(websiteId)
  const unsubscribeFromDeployment = (websiteId: string) => 
    websocketService.unsubscribeFromDeployment(websiteId)
  
  return {
    connect,
    disconnect,
    subscribeToDeployment,
    unsubscribeFromDeployment
  }
}