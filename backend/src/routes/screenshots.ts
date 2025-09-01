import { Router } from 'express';
import { promises as fs } from 'fs';
import { screenshotService } from '../services/screenshot';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * 获取缩略图文件
 * GET /api/screenshots/:filename
 */
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('../') || filename.includes('..\\')) {
      return res.status(400).json({ error: '无效的文件名' });
    }
    
    // 只允许特定的文件扩展名
    const allowedExtensions = ['.png', '.svg', '.jpg', '.jpeg'];
    const hasValidExtension = allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    
    if (!hasValidExtension) {
      return res.status(400).json({ error: '不支持的文件格式' });
    }
    
    const filePath = screenshotService.getThumbnailPath(filename);
    
    try {
      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        return res.status(404).json({ error: '文件不存在' });
      }
      
      // 设置缓存头
      res.set({
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
        'Last-Modified': fileStats.mtime.toUTCString()
      });
      
      // 检查If-Modified-Since头
      const ifModifiedSince = req.get('If-Modified-Since');
      if (ifModifiedSince && new Date(ifModifiedSince) >= fileStats.mtime) {
        return res.status(304).end();
      }
      
      // 设置正确的Content-Type
      if (filename.toLowerCase().endsWith('.svg')) {
        res.set('Content-Type', 'image/svg+xml');
      } else if (filename.toLowerCase().endsWith('.png')) {
        res.set('Content-Type', 'image/png');
      } else if (filename.toLowerCase().match(/\.(jpg|jpeg)$/)) {
        res.set('Content-Type', 'image/jpeg');
      }
      
      // 发送文件
      res.sendFile(filePath);
      
    } catch (error) {
      logger.warn(`Screenshot file not found: ${filename}`);
      res.status(404).json({ error: '文件不存在' });
    }
    
  } catch (error) {
    logger.error('Error serving screenshot:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * 生成网站缩略图
 * POST /api/screenshots/generate/:websiteId
 */
router.post('/generate/:websiteId', authenticate, async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: '域名是必需的' });
    }
    
    logger.info(`Generating thumbnail for website ${websiteId}, domain: ${domain}`);
    
    // 生成缩略图
    const thumbnailUrl = await screenshotService.generateWebsiteThumbnail(domain, websiteId);
    
    if (!thumbnailUrl) {
      return res.status(500).json({ error: '生成缩略图失败' });
    }
    
    res.json({ 
      success: true, 
      thumbnailUrl,
      message: '缩略图生成成功'
    });
    
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    res.status(500).json({ error: '生成缩略图失败' });
  }
});

/**
 * 获取网站缩略图URL
 * GET /api/screenshots/website/:websiteId
 */
router.get('/website/:websiteId', authenticate, async (req, res) => {
  try {
    const { websiteId } = req.params;
    
    const thumbnailUrl = await screenshotService.getThumbnail(websiteId);
    
    if (!thumbnailUrl) {
      return res.status(404).json({ error: '缩略图不存在' });
    }
    
    res.json({ thumbnailUrl });
    
  } catch (error) {
    logger.error('Error getting thumbnail:', error);
    res.status(500).json({ error: '获取缩略图失败' });
  }
});

/**
 * 删除网站缩略图
 * DELETE /api/screenshots/website/:websiteId
 */
router.delete('/website/:websiteId', authenticate, async (req, res) => {
  try {
    const { websiteId } = req.params;
    
    await screenshotService.deleteThumbnail(websiteId);
    
    res.json({ 
      success: true, 
      message: '缩略图删除成功' 
    });
    
  } catch (error) {
    logger.error('Error deleting thumbnail:', error);
    res.status(500).json({ error: '删除缩略图失败' });
  }
});

export default router;