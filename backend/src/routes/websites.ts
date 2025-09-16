import { Router } from 'express';
import Joi from 'joi';
import { prisma } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { buildStaticSite } from '../services/buildService';
import { ensureRelative } from '../utils/file';

const router = Router();

// Validation schemas
const createWebsiteSchema = Joi.object({
  title: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  domain: Joi.string().min(3).max(100).required(),
});

const updateWebsiteSchema = Joi.object({
  title: Joi.string().min(1).max(100).optional(),
  description: Joi.string().max(500).optional(),
  domain: Joi.string().min(3).max(100).optional(),
  content: Joi.string().optional(),
  status: Joi.string().valid('draft', 'published', 'deploying', 'error').optional(),
});

// Get all websites for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const websites = await prisma.website.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    res.json({
      success: true,
      data: websites,
    });
  } catch (error) {
    logger.error('Get websites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch websites',
    });
  }
});

// Get single website
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const website = await prisma.website.findFirst({
      where: { id, userId },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    res.json({
      success: true,
      data: website,
    });
  } catch (error) {
    logger.error('Get website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch website',
    });
  }
});

// Create website
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { error } = createWebsiteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { title, description, domain } = req.body;
    const userId = req.user!.id;

    // Check if domain already exists
    const existingWebsite = await prisma.website.findUnique({
      where: { domain },
    });

    if (existingWebsite) {
      return res.status(400).json({
        success: false,
        error: 'Domain already exists',
      });
    }

    const website = await prisma.website.create({
      data: {
        userId,
        title,
        description,
        domain,
        content: '',
        status: 'draft',
      },
    });

    logger.info(`Website created: ${website.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: website,
    });
  } catch (error) {
    logger.error('Create website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create website',
    });
  }
});

// Update website
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { error } = updateWebsiteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { id } = req.params;
    const userId = req.user!.id;
    const updateData = req.body;

    // Check if website exists and belongs to user
    const existingWebsite = await prisma.website.findFirst({
      where: { id, userId },
    });

    if (!existingWebsite) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    // Check if domain is being updated and already exists
    if (updateData.domain && updateData.domain !== existingWebsite.domain) {
      const domainExists = await prisma.website.findUnique({
        where: { domain: updateData.domain },
      });

      if (domainExists) {
        return res.status(400).json({
          success: false,
          error: 'Domain already exists',
        });
      }
    }

    const updatedWebsite = await prisma.website.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    logger.info(`Website updated: ${id} by user ${userId}`);

    res.json({
      success: true,
      data: updatedWebsite,
    });
  } catch (error) {
    logger.error('Update website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update website',
    });
  }
});

// Delete website
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if website exists and belongs to user
    const website = await prisma.website.findFirst({
      where: { id, userId },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    // Delete website and all related data (cascading)
    await prisma.website.delete({
      where: { id },
    });

    logger.info(`Website deleted: ${id} by user ${userId}`);

    res.json({
      success: true,
      message: 'Website deleted successfully',
    });
  } catch (error) {
    logger.error('Delete website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete website',
    });
  }
});

// Duplicate website
router.post('/:id/duplicate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get original website
    const originalWebsite = await prisma.website.findFirst({
      where: { id, userId },
    });

    if (!originalWebsite) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    // Generate unique domain
    const timestamp = Date.now();
    const newDomain = `${originalWebsite.domain.split('.')[0]}-copy-${timestamp}.com`;

    // Create duplicate
    const duplicatedWebsite = await prisma.website.create({
      data: {
        userId,
        title: `${originalWebsite.title} (Copy)`,
        description: originalWebsite.description,
        domain: newDomain,
        content: originalWebsite.content,
        status: 'draft',
      },
    });

    logger.info(`Website duplicated: ${id} -> ${duplicatedWebsite.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: duplicatedWebsite,
    });
  } catch (error) {
    logger.error('Duplicate website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate website',
    });
  }
});

// Export website
router.get('/:id/export', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const website = await prisma.website.findFirst({
      where: { id, userId },
    });

    if (!website) {
      return res.status(404).json({
        success: false,
        error: 'Website not found',
      });
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${website.title}.html"`);
    res.send(website.content);
  } catch (error) {
    logger.error('Export website error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export website',
    });
  }
});

export default router;

// Build static site for preview/deploy
router.post('/:id/build-static', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const website = await prisma.website.findFirst({ where: { id, userId } });
    if (!website) return res.status(404).json({ success: false, error: 'Website not found' });

    const body = req.body || {};
    // 规范路径
    if (Array.isArray(body.pages)) {
      body.pages = body.pages.map((p: any) => ({ ...p, path: ensureRelative(p.path || 'index.html') }));
    }
    const r = await buildStaticSite({ websiteId: id, ...body });
    res.json(r);
  } catch (error: any) {
    logger.error('build-static error', error);
    res.status(500).json({ success: false, error: error?.message || 'Server error' });
  }
});
