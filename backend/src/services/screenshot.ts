import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { config } from '../config';

const execAsync = promisify(exec);

export class ScreenshotService {
  private screenshotsPath = path.join(config.server.sitesPath, 'screenshots');
  
  constructor() {
    this.ensureScreenshotsDirectory();
  }
  
  private async ensureScreenshotsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotsPath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create screenshots directory:', error);
    }
  }
  
  /**
   * 生成网站缩略图
   */
  async generateWebsiteThumbnail(domain: string, websiteId: string): Promise<string | null> {
    try {
      const filename = `${websiteId}.png`;
      const outputPath = path.join(this.screenshotsPath, filename);
      const url = `https://${domain}`;
      
      logger.info(`Generating thumbnail for ${domain} (${websiteId})`);
      
      // 检查是否安装了截图工具
      const tool = await this.getAvailableScreenshotTool();
      if (!tool) {
        logger.warn('No screenshot tool available, using placeholder');
        return await this.generatePlaceholderThumbnail(websiteId, domain);
      }
      
      // 生成缩略图
      await this.captureScreenshot(url, outputPath, tool);
      
      // 验证文件是否生成成功
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        logger.warn(`Screenshot file is empty for ${domain}, using placeholder`);
        return await this.generatePlaceholderThumbnail(websiteId, domain);
      }
      
      logger.info(`Thumbnail generated successfully for ${domain}: ${filename}`);
      return `/api/screenshots/${filename}`;
      
    } catch (error) {
      logger.error(`Failed to generate thumbnail for ${domain}:`, error);
      return await this.generatePlaceholderThumbnail(websiteId, domain);
    }
  }
  
  /**
   * 检测可用的截图工具
   */
  private async getAvailableScreenshotTool(): Promise<'wkhtmltoimage' | 'chrome' | null> {
    try {
      // 首先检查是否有Chrome/Chromium（用于Puppeteer或直接使用）
      try {
        await execAsync('which google-chrome || which chromium-browser || which chromium');
        return 'chrome';
      } catch {
        // Chrome未安装
      }
      
      // 检查wkhtmltoimage
      try {
        await execAsync('which wkhtmltoimage');
        return 'wkhtmltoimage';
      } catch {
        // wkhtmltoimage未安装
      }
      
      return null;
    } catch (error) {
      logger.error('Error checking screenshot tools:', error);
      return null;
    }
  }
  
  /**
   * 使用可用工具截图
   */
  private async captureScreenshot(url: string, outputPath: string, tool: 'chrome' | 'wkhtmltoimage'): Promise<void> {
    switch (tool) {
      case 'chrome':
        await this.captureWithChrome(url, outputPath);
        break;
      case 'wkhtmltoimage':
        await this.captureWithWkhtmltoimage(url, outputPath);
        break;
    }
  }
  
  /**
   * 使用Chrome/Chromium截图
   */
  private async captureWithChrome(url: string, outputPath: string): Promise<void> {
    const command = [
      'google-chrome --headless --disable-gpu --no-sandbox --disable-dev-shm-usage',
      '--disable-extensions --disable-plugins --disable-images --disable-javascript',
      `--window-size=1200,800 --screenshot=${outputPath}`,
      `"${url}"`
    ].join(' ');
    
    await execAsync(command);
  }
  
  /**
   * 使用wkhtmltoimage截图
   */
  private async captureWithWkhtmltoimage(url: string, outputPath: string): Promise<void> {
    const command = [
      'wkhtmltoimage',
      '--width 1200 --height 800',
      '--disable-javascript --no-images',
      `"${url}" "${outputPath}"`
    ].join(' ');
    
    await execAsync(command);
  }
  
  /**
   * 生成占位符缩略图
   */
  private async generatePlaceholderThumbnail(websiteId: string, domain: string): Promise<string> {
    try {
      const filename = `${websiteId}_placeholder.svg`;
      const outputPath = path.join(this.screenshotsPath, filename);
      
      const svgContent = this.generatePlaceholderSVG(domain);
      await fs.writeFile(outputPath, svgContent);
      
      return `/api/screenshots/${filename}`;
    } catch (error) {
      logger.error('Failed to generate placeholder thumbnail:', error);
      return '/api/screenshots/default.svg';
    }
  }
  
  /**
   * 生成占位符SVG
   */
  private generatePlaceholderSVG(domain: string): string {
    const colors = [
      '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', 
      '#EF4444', '#06B6D4', '#84CC16', '#F97316'
    ];
    const color = colors[domain.length % colors.length];
    const initials = domain.charAt(0).toUpperCase();
    
    return `
<svg width="400" height="300" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="${color}"/>
  <circle cx="200" cy="120" r="40" fill="white" opacity="0.2"/>
  <text x="200" y="135" font-family="Arial, sans-serif" font-size="32" font-weight="bold" 
        text-anchor="middle" fill="white">${initials}</text>
  <text x="200" y="180" font-family="Arial, sans-serif" font-size="14" 
        text-anchor="middle" fill="white" opacity="0.8">${domain}</text>
  <rect x="50" y="220" width="300" height="4" fill="white" opacity="0.3" rx="2"/>
  <rect x="50" y="235" width="200" height="4" fill="white" opacity="0.2" rx="2"/>
  <rect x="50" y="250" width="250" height="4" fill="white" opacity="0.2" rx="2"/>
</svg>`;
  }
  
  /**
   * 获取缩略图
   */
  async getThumbnail(websiteId: string): Promise<string | null> {
    try {
      // 检查PNG格式的缩略图
      const pngPath = path.join(this.screenshotsPath, `${websiteId}.png`);
      try {
        await fs.access(pngPath);
        return `/api/screenshots/${websiteId}.png`;
      } catch {
        // PNG不存在
      }
      
      // 检查占位符SVG
      const svgPath = path.join(this.screenshotsPath, `${websiteId}_placeholder.svg`);
      try {
        await fs.access(svgPath);
        return `/api/screenshots/${websiteId}_placeholder.svg`;
      } catch {
        // SVG也不存在
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get thumbnail for ${websiteId}:`, error);
      return null;
    }
  }
  
  /**
   * 删除缩略图
   */
  async deleteThumbnail(websiteId: string): Promise<void> {
    try {
      const files = [`${websiteId}.png`, `${websiteId}_placeholder.svg`];
      
      for (const file of files) {
        const filePath = path.join(this.screenshotsPath, file);
        try {
          await fs.unlink(filePath);
          logger.info(`Deleted thumbnail: ${file}`);
        } catch (error) {
          // 文件不存在，忽略错误
        }
      }
    } catch (error) {
      logger.error(`Failed to delete thumbnail for ${websiteId}:`, error);
    }
  }
  
  /**
   * 获取缩略图文件路径
   */
  getThumbnailPath(filename: string): string {
    return path.join(this.screenshotsPath, filename);
  }
}

export const screenshotService = new ScreenshotService();
