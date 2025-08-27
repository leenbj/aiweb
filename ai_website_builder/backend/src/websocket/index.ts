import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
  error?: string;
}

export function setupWebSocket(wss: WebSocketServer) {
  logger.info('Setting up WebSocket server');

  // Handle WebSocket server errors
  wss.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
    ws.isAlive = true;
    logger.debug('New WebSocket connection established');

    // Handle authentication
    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());

        switch (message.type) {
          case 'auth':
            await handleAuth(ws, message.payload?.token);
            break;

          case 'ping':
            handlePing(ws);
            break;

          case 'subscribe':
            handleSubscribe(ws, message.payload?.channel);
            break;

          default:
            if (ws.userId) {
              await handleMessage(ws, message);
            } else {
              sendError(ws, 'Authentication required');
            }
            break;
        }
      } catch (error) {
        logger.error('WebSocket message error:', error);
        try {
          sendError(ws, 'Invalid message format');
        } catch (sendError) {
          logger.error('Failed to send error message:', sendError);
        }
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      logger.debug(`WebSocket connection closed for user ${ws.userId}`);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket connection error:', error);
      // Don't try to send error message to a broken connection
      if (ws.readyState === ws.OPEN) {
        try {
          ws.close();
        } catch (closeError) {
          logger.error('Failed to close WebSocket connection:', closeError);
        }
      }
    });

    // Send welcome message
    send(ws, { type: 'connected', payload: { message: 'WebSocket connected' } });
  });

  // Heartbeat to detect broken connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (!ws.isAlive) {
        logger.debug('Terminating inactive WebSocket connection');
        try {
          ws.terminate();
        } catch (error) {
          logger.error('Error terminating WebSocket:', error);
        }
        return;
      }
      
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (error) {
        logger.error('Error pinging WebSocket:', error);
        try {
          ws.terminate();
        } catch (terminateError) {
          logger.error('Error terminating WebSocket after ping failure:', terminateError);
        }
      }
    });
  }, config.websocket.heartbeatInterval);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  logger.info('WebSocket server setup completed');
}

async function handleAuth(ws: AuthenticatedWebSocket, token: string) {
  if (!token) {
    sendError(ws, 'Token required');
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    ws.userId = decoded.id;
    
    send(ws, { type: 'auth', payload: { authenticated: true, userId: decoded.id } });
    logger.debug(`WebSocket authenticated for user ${decoded.id}`);
  } catch (error) {
    sendError(ws, 'Invalid token');
    ws.close();
  }
}

function handlePing(ws: AuthenticatedWebSocket) {
  ws.isAlive = true;
  send(ws, { type: 'pong' });
}

function handleSubscribe(ws: AuthenticatedWebSocket, channel: string) {
  if (!ws.userId) {
    sendError(ws, 'Authentication required');
    return;
  }

  // Add channel subscription logic here
  send(ws, { type: 'subscribed', payload: { channel } });
  logger.debug(`User ${ws.userId} subscribed to channel: ${channel}`);
}

async function handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
  const { type, payload } = message;

  switch (type) {
    case 'deployment_status':
      // Handle real-time deployment status updates
      broadcastToUser(ws.userId!, { type: 'deployment_update', payload });
      break;

    case 'ai_progress':
      // Handle AI generation progress updates
      broadcastToUser(ws.userId!, { type: 'ai_progress', payload });
      break;

    default:
      logger.warn(`Unknown WebSocket message type: ${type}`);
      break;
  }
}

function send(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
      try {
        ws.close();
      } catch (closeError) {
        logger.error('Failed to close WebSocket after send error:', closeError);
      }
    }
  }
}

function sendError(ws: AuthenticatedWebSocket, error: string) {
  send(ws, { type: 'error', error });
}

function broadcastToUser(userId: string, message: WebSocketMessage) {
  // Get WebSocket server instance (this would need to be stored globally)
  // For now, this is a placeholder for the broadcast functionality
  logger.debug(`Broadcasting to user ${userId}:`, message);
}

export function broadcastDeploymentUpdate(userId: string, websiteId: string, status: any) {
  broadcastToUser(userId, {
    type: 'deployment_update',
    payload: { websiteId, status }
  });
}

export function broadcastAIProgress(userId: string, progress: any) {
  broadcastToUser(userId, {
    type: 'ai_progress',
    payload: progress
  });
}