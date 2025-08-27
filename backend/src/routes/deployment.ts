import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { deploymentService } from '../services/deployment';
import { prisma } from '../database';
import { logger } from '../utils/logger';

const router = Router();

// Deploy website
router.post('/deploy/:websiteId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { websiteId } = req.params;
    const userId = req.user!.id;

    // Verify website ownership
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    if (!website.content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Website has no content to deploy',
      });
    }

    // Start deployment process
    await deploymentService.deployWebsite(websiteId, website.domain, website.content);

    res.json({
      success: true,
      message: 'Deployment started successfully',
    });
  } catch (error) {
    logger.error('Deploy website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start deployment',
    });
  }
});

// Undeploy website
router.post('/undeploy/:websiteId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { websiteId } = req.params;
    const userId = req.user!.id;

    // Verify website ownership
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    // Start undeployment process
    await deploymentService.undeployWebsite(website.domain);

    // Update website status
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        status: 'draft',
        deployedAt: null,
      },
    });

    res.json({
      success: true,
      message: 'Website undeployed successfully',
    });
  } catch (error) {
    logger.error('Undeploy website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to undeploy website',
    });
  }
});

// Get deployment status
router.get('/status/:websiteId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { websiteId } = req.params;
    const userId = req.user!.id;

    // Verify website ownership
    const website = await prisma.website.findFirst({
      where: { id: websiteId, userId },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    const deployments = await deploymentService.getDeploymentStatus(websiteId);

    res.json({
      success: true,
      data: deployments,
    });
  } catch (error) {
    logger.error('Get deployment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment status',
    });
  }
});

// Check DNS resolution
router.post('/check-dns', authenticate, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
    }

    // This would typically use the deployment service to check DNS
    // For now, return a placeholder response
    res.json({
      success: true,
      data: { resolved: false, message: 'DNS check not implemented yet' },
    });
  } catch (error) {
    logger.error('DNS check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check DNS',
    });
  }
});

// Request SSL certificate
router.post('/ssl', authenticate, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
    }

    // This would typically use the deployment service to request SSL
    // For now, return a placeholder response
    res.json({
      success: true,
      data: { success: false, message: 'SSL certificate request not implemented yet' },
    });
  } catch (error) {
    logger.error('SSL request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request SSL certificate',
    });
  }
});

export default router;