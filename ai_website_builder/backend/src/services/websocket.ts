import { Server as WebSocketServer, WebSocket } from 'ws'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string
  isAlive?: boolean
}

interface WebSocketMessage {
  type: 'deployment_status' | 'ai_progress' | 'ping' | 'authenticate'
  data: any
}

export class WebSocketService {
  private static wss: WebSocketServer
  private static clients: Map<string, AuthenticatedWebSocket[]> = new Map()

  static setup(wss: WebSocketServer, prisma: PrismaClient): void {
    this.wss = wss
    
    wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      console.log('WebSocket connection established')
      
      // Set up heartbeat
      ws.isAlive = true
      ws.on('pong', () => {
        ws.isAlive = true
      })

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message)
          await this.handleMessage(ws, data, prisma)
        } catch (error) {
          console.error('WebSocket message error:', error)
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }))
        }
      })

      ws.on('close', () => {
        console.log('WebSocket connection closed')
        this.removeClient(ws)
      })

      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
      })
    })

    // Set up heartbeat interval
    const interval = setInterval(() => {
      wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (!ws.isAlive) {
          return ws.terminate()
        }
        
        ws.isAlive = false
        ws.ping()
      })
    }, 30000) // 30 seconds

    wss.on('close', () => {
      clearInterval(interval)
    })
  }

  private static async handleMessage(
    ws: AuthenticatedWebSocket, 
    message: WebSocketMessage, 
    prisma: PrismaClient
  ): Promise<void> {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }))
        break

      case 'authenticate':
        await this.authenticateClient(ws, message.data.token, prisma)
        break

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }))
    }
  }

  private static async authenticateClient(
    ws: AuthenticatedWebSocket, 
    token: string, 
    prisma: PrismaClient
  ): Promise<void> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      })

      if (!user) {
        ws.send(JSON.stringify({
          type: 'auth_error',
          message: 'User not found'
        }))
        return
      }

      ws.userId = user.id
      this.addClient(user.id, ws)

      ws.send(JSON.stringify({
        type: 'authenticated',
        data: { userId: user.id }
      }))

    } catch (error) {
      ws.send(JSON.stringify({
        type: 'auth_error',
        message: 'Invalid token'
      }))
    }
  }

  private static addClient(userId: string, ws: AuthenticatedWebSocket): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, [])
    }
    this.clients.get(userId)!.push(ws)
  }

  private static removeClient(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId)
      if (userClients) {
        const index = userClients.indexOf(ws)
        if (index > -1) {
          userClients.splice(index, 1)
        }
        if (userClients.length === 0) {
          this.clients.delete(ws.userId)
        }
      }
    }
  }

  static notifyDeploymentStatus(websiteId: string, status: {
    status: string
    message: string
    url?: string
  }): void {
    // This would typically get the website owner's ID from the database
    // For simplicity, we're broadcasting to all connected clients
    this.broadcast('deployment_status', {
      websiteId,
      ...status
    })
  }

  static notifyAIProgress(userId: string, progress: {
    step: string
    progress: number
    message?: string
  }): void {
    this.sendToUser(userId, 'ai_progress', progress)
  }

  private static sendToUser(userId: string, type: string, data: any): void {
    const userClients = this.clients.get(userId)
    if (userClients) {
      const message = JSON.stringify({ type, data })
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      })
    }
  }

  private static broadcast(type: string, data: any): void {
    const message = JSON.stringify({ type, data })
    this.clients.forEach(userClients => {
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message)
        }
      })
    })
  }

  static getConnectedUsers(): string[] {
    return Array.from(this.clients.keys())
  }

  static getConnectionCount(): number {
    let total = 0
    this.clients.forEach(userClients => {
      total += userClients.length
    })
    return total
  }
}

export const setupWebSocket = (wss: WebSocketServer, prisma: PrismaClient) => {
  WebSocketService.setup(wss, prisma)
}