import express, { Request, Response } from 'express'
import Joi from 'joi'
import { authenticateToken, requireOwnership, AuthRequest } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { DeploymentService } from '../services/deployment'
import { WebSocketService } from '../services/websocket'
import { prisma } from '../database'

const router = express.Router()

const deploySchema = Joi.object({
  domain: Joi.string().domain().required(),
  sslEnabled: Joi.boolean().default(true),
  customConfig: Joi.string().optional()
})

// Deploy website
router.post('/:websiteId/deploy', authenticateToken, requireOwnership('website'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { error, value } = deploySchema.validate(req.body)
  if (error) {
    return res.status(400).json({ error: error.details[0].message })
  }

  const websiteId = req.params.websiteId
  const { domain, sslEnabled, customConfig } = value

  // Get website
  const website = await prisma.website.findUnique({
    where: { id: websiteId }
  })

  if (!website) {
    return res.status(404).json({ error: 'Website not found' })
  }

  // Create deployment record
  const deployment = await prisma.deployment.create({
    data: {
      websiteId,
      status: 'PENDING',
      domain,
      serverPath: `/var/www/sites/${domain}`
    }
  })

  // Start deployment process (async)
  DeploymentService.deployWebsite({
    websiteId,
    domain,
    content: website.html || ''
  }).catch(error => {
    console.error('Deployment error:', error)
  })

  res.status(202).json({ 
    deployment,
    message: 'Deployment started' 
  })
}))

// Get deployment status
router.get('/:websiteId/deployments', authenticateToken, requireOwnership('website'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 10 } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const [deployments, total] = await Promise.all([
    prisma.deployment.findMany({
      where: { websiteId: req.params.websiteId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.deployment.count({
      where: { websiteId: req.params.websiteId }
    })
  ])

  res.json({
    deployments,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  })
}))

// Get single deployment
router.get('/deployment/:deploymentId', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id: req.params.deploymentId },
    include: {
      website: {
        select: {
          id: true,
          domain: true,
          title: true,
          userId: true
        }
      }
    }
  })

  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' })
  }

  // Check ownership
  if (deployment.website.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' })
  }

  res.json({ deployment })
}))

// Rollback deployment
router.post('/:websiteId/rollback/:deploymentId', authenticateToken, requireOwnership('website'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { websiteId, deploymentId } = req.params

  const deployment = await prisma.deployment.findUnique({
    where: { 
      id: deploymentId,
      websiteId
    },
    include: {
      website: true
    }
  })

  if (!deployment || deployment.status !== 'SUCCESS') {
    return res.status(400).json({ error: 'Cannot rollback to this deployment' })
  }

  try {
    await DeploymentService.rollbackDeployment({
      websiteId,
      deploymentId
    })

    res.json({ message: 'Rollback completed successfully' })
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Rollback failed',
      message: error.message 
    })
  }
}))

// Check domain DNS resolution
router.get('/check-dns/:domain', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { domain } = req.params
  const serverIP = process.env.SERVER_IP

  if (!serverIP) {
    return res.status(500).json({ error: 'Server IP not configured' })
  }

  try {
    const dnsStatus = await DeploymentService.checkDNSResolution(domain, serverIP)
    res.json({ dnsStatus })
  } catch (error: any) {
    res.status(500).json({ 
      error: 'DNS check failed',
      message: error.message 
    })
  }
}))

// Get deployment logs
router.get('/deployment/:deploymentId/logs', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const deployment = await prisma.deployment.findUnique({
    where: { id: req.params.deploymentId },
    include: {
      website: {
        select: {
          userId: true
        }
      }
    }
  })

  if (!deployment) {
    return res.status(404).json({ error: 'Deployment not found' })
  }

  // Check ownership
  if (deployment.website.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const logs = await DeploymentService.getDeploymentLogs(deployment.logs || '')
    res.json({ logs })
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to retrieve logs',
      message: error.message 
    })
  }
}))

export { router as deploymentsRouter }