import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { logger } from '../utils/logger';

/**
 * Context7 MCP客户端服务
 * 用于查询最新的资料来增强AI回答质量
 */
export class Context7MCPService {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CONTEXT7_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('⚠️ Context7 API密钥未配置，将使用有限的免费功能');
    }
  }

  /**
   * 初始化MCP客户端连接
   */
  async initialize(): Promise<void> {
    try {
      if (this.client) {
        return; // 已经初始化
      }

      logger.info('🔌 正在连接Context7 MCP服务器...');

      // 创建SSE传输层
      this.transport = new SSEClientTransport(
        new URL('https://mcp.context7.com/sse'),
        {
          headers: this.apiKey ? {
            'CONTEXT7_API_KEY': this.apiKey
          } : {}
        }
      );

      // 创建MCP客户端
      this.client = new Client(
        {
          name: 'ai-website-builder',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      );

      // 连接到MCP服务器
      await this.client.connect(this.transport);
      logger.info('✅ Context7 MCP连接成功');

    } catch (error) {
      logger.error('❌ Context7 MCP连接失败:', error);
      throw new Error(`Context7 MCP连接失败: ${error}`);
    }
  }

  /**
   * 解析库名获取Context7库ID
   * @param libraryName 库名（如：react, vue, next.js等）
   * @returns Context7兼容的库ID
   */
  async resolveLibraryId(libraryName: string): Promise<string | null> {
    try {
      await this.initialize();

      logger.info(`🔍 正在解析库名: ${libraryName}`);

      const result = await this.client!.callTool({
        name: 'resolve-library-id',
        arguments: {
          libraryName: libraryName
        }
      });

      if (result.content && result.content.length > 0) {
        const content = result.content[0];
        if (content.type === 'text') {
          const libraryId = content.text.trim();
          logger.info(`✅ 解析成功，库ID: ${libraryId}`);
          return libraryId;
        }
      }

      logger.warn(`⚠️ 未能解析库名: ${libraryName}`);
      return null;

    } catch (error) {
      logger.error(`❌ 解析库名失败 ${libraryName}:`, error);
      return null;
    }
  }

  /**
   * 获取库的文档资料
   * @param libraryId Context7库ID
   * @param topic 可选的主题聚焦
   * @param maxTokens 最大token数
   * @returns 库的文档资料
   */
  async getLibraryDocs(
    libraryId: string,
    topic?: string,
    maxTokens: number = 10000
  ): Promise<string | null> {
    try {
      await this.initialize();

      logger.info(`📚 正在获取库文档: ${libraryId}${topic ? ` (主题: ${topic})` : ''}`);

      const args: any = {
        context7CompatibleLibraryID: libraryId,
        tokens: maxTokens
      };

      if (topic) {
        args.topic = topic;
      }

      const result = await this.client!.callTool({
        name: 'get-library-docs',
        arguments: args
      });

      if (result.content && result.content.length > 0) {
        const content = result.content[0];
        if (content.type === 'text') {
          const docs = content.text;
          logger.info(`✅ 文档获取成功，长度: ${docs.length} 字符`);
          return docs;
        }
      }

      logger.warn(`⚠️ 未能获取库文档: ${libraryId}`);
      return null;

    } catch (error) {
      logger.error(`❌ 获取库文档失败 ${libraryId}:`, error);
      return null;
    }
  }

  /**
   * 从用户查询中提取可能的库名
   * @param query 用户查询
   * @returns 可能的库名列表
   */
  extractLibraryNames(query: string): string[] {
    const libraries: string[] = [];

    // 常见的前端库
    const commonLibraries = [
      'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
      'express', 'koa', 'fastify', 'hapi',
      'webpack', 'vite', 'rollup', 'parcel',
      'typescript', 'javascript', 'node.js',
      'tailwind', 'styled-components', 'emotion',
      'redux', 'zustand', 'mobx', 'pinia',
      'axios', 'fetch', 'graphql', 'apollo',
      'mongodb', 'postgresql', 'mysql', 'redis',
      'jest', 'vitest', 'cypress', 'playwright'
    ];

    const lowerQuery = query.toLowerCase();

    // 检查是否包含已知的库名
    for (const lib of commonLibraries) {
      if (lowerQuery.includes(lib)) {
        libraries.push(lib);
      }
    }

    // 尝试提取package.json风格的库名（如：@types/react, lodash-es等）
    const packagePattern = /(['"`])((?:@\w+\/)?[\w-]+(?:\/[\w-]+)?)\1/g;
    let match;
    while ((match = packagePattern.exec(query)) !== null) {
      const libName = match[2];
      if (!libraries.includes(libName)) {
        libraries.push(libName);
      }
    }

    return libraries;
  }

  /**
   * 查询相关资料并整合到上下文中
   * @param query 用户查询
   * @param mode AI助手模式
   * @returns 增强的上下文信息
   */
  async queryRelevantDocs(query: string, mode: string): Promise<{
    libraryDocs: Array<{ libraryId: string; docs: string; libraryName: string }>;
    contextSummary: string;
  }> {
    try {
      logger.info(`🔍 开始查询相关资料，查询: "${query}", 模式: ${mode}`);

      // 提取可能的库名
      const libraryNames = this.extractLibraryNames(query);
      logger.info(`📋 检测到的库名: ${libraryNames.join(', ')}`);

      const libraryDocs: Array<{ libraryId: string; docs: string; libraryName: string }> = [];

      // 为每个检测到的库获取文档
      for (const libName of libraryNames.slice(0, 3)) { // 限制最多查询3个库
        try {
          // 解析库ID
          const libraryId = await this.resolveLibraryId(libName);
          if (!libraryId) {
            logger.warn(`⚠️ 无法解析库: ${libName}`);
            continue;
          }

          // 获取文档
          const docs = await this.getLibraryDocs(libraryId, mode);
          if (docs) {
            libraryDocs.push({
              libraryId,
              docs,
              libraryName: libName
            });
            logger.info(`✅ 成功获取库文档: ${libName} (${libraryId})`);
          }
        } catch (error) {
          logger.warn(`⚠️ 获取库文档失败 ${libName}:`, error);
        }
      }

      // 生成上下文摘要
      let contextSummary = '';
      if (libraryDocs.length > 0) {
        contextSummary = `基于最新的文档资料，我为您提供了以下库的最新信息：\n\n`;
        libraryDocs.forEach((lib, index) => {
          contextSummary += `${index + 1}. ${lib.libraryName} (${lib.libraryId})\n`;
        });
        contextSummary += `\n这些资料来自Context7的最新文档，确保信息的时效性和准确性。\n\n`;
      }

      logger.info(`🎯 查询完成，共获取 ${libraryDocs.length} 个库的文档`);

      return {
        libraryDocs,
        contextSummary
      };

    } catch (error) {
      logger.error('❌ 查询相关资料失败:', error);
      return {
        libraryDocs: [],
        contextSummary: ''
      };
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      if (this.transport) {
        this.transport = null;
      }
      logger.info('🔌 Context7 MCP连接已关闭');
    } catch (error) {
      logger.error('❌ 关闭Context7 MCP连接失败:', error);
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.client !== null;
  }
}

// 导出单例实例
export const context7MCPService = new Context7MCPService();
