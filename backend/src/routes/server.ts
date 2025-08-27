import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const execAsync = promisify(exec);

// Get server statistics (admin only)
router.get('/stats', authenticate, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    // Get CPU usage
    const { stdout: cpuInfo } = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | sed \'s/%us,//\'');
    const cpuUsage = parseFloat(cpuInfo.trim()) || 0;

    // Get memory usage
    const { stdout: memInfo } = await execAsync('free -m | awk \'NR==2{printf "%.2f", $3*100/$2}\'');
    const memoryUsage = parseFloat(memInfo.trim()) || 0;

    // Get disk usage
    const { stdout: diskInfo } = await execAsync('df -h / | awk \'NR==2{print $5}\' | sed \'s/%//\'');
    const diskUsage = parseFloat(diskInfo.trim()) || 0;

    // Get active websites count (mock data)
    const activeWebsites = 0; // Would query actual data from database

    // Get total requests (mock data)
    const totalRequests = 0; // Would parse from nginx logs

    res.json({
      success: true,
      data: {
        cpuUsage,
        memoryUsage,
        diskUsage,
        activeWebsites,
        totalRequests,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get server stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get server statistics',
    });
  }
});

// Get domain configurations (admin only)
router.get('/domains', authenticate, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    // This would typically query domain configurations from database
    // For now, return empty array
    res.json({
      success: true,
      data: [],
    });
  } catch (error) {
    logger.error('Get domains error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get domain configurations',
    });
  }
});

// Get server logs (admin only)
router.get('/logs', authenticate, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { service = 'backend', lines = '50' } = req.query;

    let logCommand = '';
    switch (service) {
      case 'backend':
        logCommand = `journalctl -u ai-website-builder-backend -n ${lines} --no-pager`;
        break;
      case 'frontend':
        logCommand = `journalctl -u ai-website-builder-frontend -n ${lines} --no-pager`;
        break;
      case 'nginx':
        logCommand = `tail -n ${lines} /var/log/nginx/error.log`;
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid service specified',
        });
    }

    const { stdout } = await execAsync(logCommand);
    const logs = stdout.trim().split('\n').filter(line => line.length > 0);

    res.json({
      success: true,
      data: { logs },
    });
  } catch (error) {
    logger.error('Get server logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get server logs',
    });
  }
});

// Restart service (admin only)
router.post('/restart/:service', authenticate, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { service } = req.params;
    const allowedServices = ['ai-website-builder-backend', 'ai-website-builder-frontend', 'nginx'];

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service specified',
      });
    }

    await execAsync(`systemctl restart ${service}`);

    logger.info(`Service restarted: ${service} by user ${req.user!.id}`);

    res.json({
      success: true,
      message: `Service ${service} restarted successfully`,
    });
  } catch (error) {
    logger.error('Restart service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart service',
    });
  }
});

// Get service status (admin only)
router.get('/status/:service', authenticate, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { service } = req.params;
    const allowedServices = ['ai-website-builder-backend', 'ai-website-builder-frontend', 'nginx', 'postgresql'];

    if (!allowedServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service specified',
      });
    }

    const { stdout } = await execAsync(`systemctl is-active ${service}`);
    const isActive = stdout.trim() === 'active';

    const { stdout: statusOutput } = await execAsync(`systemctl status ${service} --no-pager -l`);

    res.json({
      success: true,
      data: {
        service,
        isActive,
        status: statusOutput,
      },
    });
  } catch (error) {
    logger.error('Get service status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
    });
  }
});

export default router;