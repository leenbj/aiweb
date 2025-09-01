import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

// 权限级别定义
const ROLE_HIERARCHY = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3
};

// 权限检查中间件
export const requireRole = (minRole: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '未授权访问' });
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role as UserRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minRole];

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ 
        error: '权限不足',
        required: minRole,
        current: req.user.role 
      });
    }

    next();
  };
};

// 便捷权限检查函数
export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

// 检查用户是否为资源的所有者或管理员
export const requireOwnershipOrAdmin = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction,
  resourceUserId: string
) => {
  if (!req.user) {
    return res.status(401).json({ error: '未授权访问' });
  }

  const isOwner = req.user.id === resourceUserId;
  const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: '只能访问自己的资源或需要管理员权限' });
  }

  next();
};

// 权限功能映射
export const PERMISSIONS = {
  // 用户管理
  VIEW_ALL_USERS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_USERS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  DELETE_USERS: [UserRole.SUPER_ADMIN],
  
  // 网站管理
  VIEW_ALL_WEBSITES: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_ALL_WEBSITES: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  DELETE_ANY_WEBSITE: [UserRole.SUPER_ADMIN],
  
  // 系统设置
  VIEW_SYSTEM_SETTINGS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_SYSTEM_SETTINGS: [UserRole.SUPER_ADMIN],
  
  // 部署管理
  MANAGE_DEPLOYMENTS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_DOMAINS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  
  // 活动日志
  VIEW_ALL_ACTIVITIES: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  
  // Token使用统计
  VIEW_TOKEN_USAGE: [UserRole.ADMIN, UserRole.SUPER_ADMIN]
};

// 检查特定权限
export const hasPermission = (userRole: string, permission: keyof typeof PERMISSIONS): boolean => {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole as UserRole);
};

// 权限检查中间件生成器
export const requirePermission = (permission: keyof typeof PERMISSIONS) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: '未授权访问' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ 
        error: '权限不足',
        permission,
        userRole: req.user.role
      });
    }

    next();
  };
};