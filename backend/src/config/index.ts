import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ai_website_builder',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  ai: {
    provider: process.env.AI_PROVIDER || 'deepseek', // 'deepseek' | 'openai' | 'anthropic'
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      availableModels: [
        'deepseek-chat',           // DeepSeek V3
        'deepseek-reasoner',       // DeepSeek R1 推理模型
      ],
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      availableModels: [
        'gpt-4o',                  // 最新的GPT-4o
        'gpt-4o-mini',             // 轻量版
        'gpt-4-turbo',             // GPT-4 Turbo
        'gpt-4',                   // 标准GPT-4
        'gpt-3.5-turbo',           // GPT-3.5 Turbo
      ],
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      availableModels: [
        'claude-3-5-sonnet-20241022',  // Claude 3.5 Sonnet 最新版
        'claude-3-5-haiku-20241022',   // Claude 3.5 Haiku
        'claude-3-opus-20240229',      // Claude 3 Opus
        'claude-3-sonnet-20240229',    // Claude 3 Sonnet
        'claude-3-haiku-20240307',     // Claude 3 Haiku
      ],
    },
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  server: {
    sitesPath: process.env.SITES_PATH || '/var/www/sites',
    nginxPath: process.env.NGINX_PATH || '/etc/nginx/sites-enabled',
    certbotPath: process.env.CERTBOT_PATH || '/etc/letsencrypt/live',
    domain: process.env.SERVER_DOMAIN || 'localhost',
    ip: process.env.SERVER_IP || '127.0.0.1',
  },
  
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  
  websocket: {
    heartbeatInterval: 30000,
    maxConnections: 100,
  },
  
  baota: {
    url: process.env.BT_PANEL_URL || '',
    apiKey: process.env.BT_API_KEY || '',
  },
  
  security: {
    bcryptRounds: 12,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100,
  },
};
