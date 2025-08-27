import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as cron from 'node-cron'

export class BackupService {
  private static readonly BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30')

  static async createBackup(prisma: PrismaClient, websiteId: string): Promise<void> {
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    })

    if (!website) {
      throw new Error('Website not found')
    }

    // Get current version number
    const lastBackup = await prisma.websiteBackup.findFirst({
      where: { websiteId },
      orderBy: { version: 'desc' }
    })

    const version = (lastBackup?.version || 0) + 1

    // Create backup record
    const backup = await prisma.websiteBackup.create({
      data: {
        websiteId,
        version,
        html: website.html,
        css: website.css,
        js: website.js
      }
    })

    // Create backup file if deployment path exists
    if (website.deploymentPath) {
      try {
        const backupDir = path.join(website.deploymentPath, 'backups')
        await fs.mkdir(backupDir, { recursive: true })

        const backupFile = path.join(backupDir, `backup-v${version}.json`)
        const backupData = {
          id: backup.id,
          version,
          html: website.html,
          css: website.css,
          js: website.js,
          createdAt: backup.createdAt.toISOString()
        }

        await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2))
        
        // 备份文件已创建，路径为: ${backupFile}
        console.log(`Backup file created: ${backupFile}`)

      } catch (error) {
        console.error('Failed to create backup file:', error)
      }
    }

    console.log(`Created backup for website ${websiteId} (version ${version})`)
  }

  static async restoreFromBackup(
    prisma: PrismaClient, 
    websiteId: string, 
    backupId: string
  ): Promise<void> {
    const backup = await prisma.websiteBackup.findFirst({
      where: {
        id: backupId,
        websiteId
      }
    })

    if (!backup) {
      throw new Error('Backup not found')
    }

    // Create backup of current state before restore
    await this.createBackup(prisma, websiteId)

    // Restore from backup
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        html: backup.html,
        css: backup.css,
        js: backup.js
      }
    })

    console.log(`Restored website ${websiteId} from backup ${backupId}`)
  }

  static async cleanupOldBackups(prisma: PrismaClient): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.BACKUP_RETENTION_DAYS)

    const oldBackups = await prisma.websiteBackup.findMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    for (const backup of oldBackups) {
      // Delete backup file if it exists (构造文件路径)
      try {
        const backupDir = path.join(process.cwd(), 'backups', backup.websiteId)
        const timestamp = backup.createdAt.toISOString().replace(/[:.]/g, '-')
        const backupFile = path.join(backupDir, `backup-v${backup.version}-${timestamp}.json`)
        
        await fs.unlink(backupFile)
        console.log(`Deleted backup file: ${backupFile}`)
      } catch (error) {
        // 文件可能不存在，这是正常的
        console.debug(`Backup file not found or already deleted:`, (error as Error).message)
      }

      // Delete backup record
      await prisma.websiteBackup.delete({
        where: { id: backup.id }
      })
    }

    console.log(`Cleaned up ${oldBackups.length} old backups`)
  }

  static async getBackupStats(prisma: PrismaClient, websiteId?: string): Promise<any> {
    const where = websiteId ? { websiteId } : {}

    const stats = await prisma.websiteBackup.groupBy({
      by: ['websiteId'],
      where,
      _count: {
        id: true
      },
      _min: {
        createdAt: true
      },
      _max: {
        createdAt: true
      }
    })

    return stats
  }

  static async createFullSystemBackup(prisma: PrismaClient): Promise<string> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
    const backupDir = path.join(process.cwd(), 'backups', `system-backup-${timestamp}`)
    
    await fs.mkdir(backupDir, { recursive: true })

    // Export all websites
    const websites = await prisma.website.findMany()
    await fs.writeFile(
      path.join(backupDir, 'websites.json'), 
      JSON.stringify(websites, null, 2)
    )

    // Export all users (without passwords)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
    await fs.writeFile(
      path.join(backupDir, 'users.json'), 
      JSON.stringify(users, null, 2)
    )

    // Export deployments
    const deployments = await prisma.deployment.findMany()
    await fs.writeFile(
      path.join(backupDir, 'deployments.json'), 
      JSON.stringify(deployments, null, 2)
    )

    // Export backups metadata
    const backups = await prisma.websiteBackup.findMany()
    await fs.writeFile(
      path.join(backupDir, 'backups.json'), 
      JSON.stringify(backups, null, 2)
    )

    console.log(`Created full system backup at ${backupDir}`)
    return backupDir
  }
}

export const setupBackupSchedule = (prisma: PrismaClient) => {
  const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *' // Daily at 2 AM
  
  cron.schedule(schedule, async () => {
    console.log('Running scheduled backup cleanup...')
    try {
      await BackupService.cleanupOldBackups(prisma)
      
      // Create full system backup weekly
      const now = new Date()
      if (now.getDay() === 0) { // Sunday
        await BackupService.createFullSystemBackup(prisma)
      }
    } catch (error) {
      console.error('Scheduled backup failed:', error)
    }
  })

  console.log(`Backup schedule set up: ${schedule}`)
}