import { Router } from 'express';
import Joi from 'joi';
import { prisma } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, UserRole, PERMISSIONS } from '../middleware/roleAuth';

const router = Router();

// Users: list
router.get('/users', authenticate, requirePermission('VIEW_ALL_USERS'), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Users: update role (super admin only)
router.put('/users/:id/role', authenticate, async (req: AuthRequest, res) => {
  try {
    // only super admin can change roles
    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ success: false, error: '只有超级管理员可以修改角色' });
    }

    const schema = Joi.object({ role: Joi.string().valid('user', 'admin', 'super_admin').required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: value.role },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, updatedAt: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

// Permissions: definition (for UI)
router.get('/permissions/definition', authenticate, requirePermission('VIEW_ALL_USERS'), async (req, res) => {
  const defs = Object.keys(PERMISSIONS).map((key) => ({ key, roles: PERMISSIONS[key as keyof typeof PERMISSIONS] }));
  res.json({ success: true, data: defs });
});

// Permissions: get user-specific overrides
router.get('/users/:id/permissions', authenticate, requirePermission('VIEW_ALL_USERS'), async (req, res) => {
  try {
    const items = await prisma.userPermission.findMany({ where: { userId: req.params.id } });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user permissions' });
  }
});

// Permissions: set overrides (super admin)
router.put('/users/:id/permissions', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ success: false, error: '只有超级管理员可以分配权限' });
    }

    const schema = Joi.object({
      overrides: Joi.array().items(Joi.object({
        permission: Joi.string().required(),
        granted: Joi.boolean().required(),
      })).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const userId = req.params.id;
    const tx = await prisma.$transaction(async (db) => {
      for (const ov of value.overrides) {
        await db.userPermission.upsert({
          where: { userId_permission: { userId, permission: ov.permission } },
          update: { granted: ov.granted },
          create: { userId, permission: ov.permission, granted: ov.granted },
        });
      }
      return true;
    });

    res.json({ success: true, data: tx });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user permissions' });
  }
});

// Email (SMTP) settings
router.get('/email-settings', authenticate, requirePermission('VIEW_SYSTEM_SETTINGS'), async (req, res) => {
  try {
    const items = await prisma.systemSettings.findMany({ where: { category: 'email' } });
    const map: Record<string, string> = {};
    for (const it of items) map[it.key] = it.value;
    res.json({ success: true, data: {
      smtp_host: map.smtp_host || '',
      smtp_port: map.smtp_port || '587',
      smtp_user: map.smtp_user || '',
      smtp_pass: map.smtp_pass || '',
      smtp_from: map.smtp_from || '',
      smtp_enabled: map.smtp_enabled === 'true',
    }});
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch email settings' });
  }
});

router.put('/email-settings', authenticate, requirePermission('MANAGE_SYSTEM_SETTINGS'), async (req, res) => {
  try {
    const schema = Joi.object({
      smtp_host: Joi.string().allow(''),
      smtp_port: Joi.string().pattern(/^\d+$/).default('587'),
      smtp_user: Joi.string().allow(''),
      smtp_pass: Joi.string().allow(''),
      smtp_from: Joi.string().email().allow(''),
      smtp_enabled: Joi.boolean().default(false),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const entries: [string, string][] = [
      ['smtp_host', value.smtp_host],
      ['smtp_port', value.smtp_port],
      ['smtp_user', value.smtp_user],
      ['smtp_pass', value.smtp_pass],
      ['smtp_from', value.smtp_from],
      ['smtp_enabled', value.smtp_enabled ? 'true' : 'false'],
    ];

    await prisma.$transaction(entries.map(([key, val]) =>
      prisma.systemSettings.upsert({
        where: { key },
        update: { value: String(val), category: 'email' },
        create: { key, value: String(val), category: 'email', isPublic: false },
      })
    ));

    res.json({ success: true, data: value });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update email settings' });
  }
});

export default router;

