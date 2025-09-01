import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import punycode from 'punycode';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../database';
// import { screenshotService } from './screenshot';

const execAsync = promisify(exec);

export class DeploymentService {
  
  /**
   * 转换中文域名为 Punycode 格式
   */
  private convertDomainToPunycode(domain: string): string {
    try {
      // 分割域名各部分
      const parts = domain.split('.');
      const convertedParts = parts.map(part => {
        // 检查是否包含非ASCII字符
        if (/[^\x00-\x7F]/.test(part)) {
          // 转换为 Punycode
          return punycode.toASCII(part);
        }
        return part;
      });
      
      const convertedDomain = convertedParts.join('.');
      logger.info(`Domain conversion: ${domain} -> ${convertedDomain}`);
      return convertedDomain;
    } catch (error) {
      logger.error(`Failed to convert domain ${domain}:`, error);
      return domain; // 转换失败则返回原域名
    }
  }
  
  async deployWebsite(websiteId: string, domain: string, content: string): Promise<void> {
    // 转换中文域名
    const convertedDomain = this.convertDomainToPunycode(domain);
    logger.info(`Starting deployment for website ${websiteId} to domain ${domain} (converted: ${convertedDomain})`);

    try {
      // Create deployment record
      const deployment = await prisma.deployment.create({
        data: {
          websiteId,
          domain: convertedDomain, // 使用转换后的域名
          status: 'deploying',
          serverPath: path.join(config.server.sitesPath, convertedDomain),
          logs: `Deployment started for ${domain} (converted to ${convertedDomain})`,
        },
      });

      // Create website directory
      const sitePath = path.join(config.server.sitesPath, convertedDomain);
      await this.ensureDirectory(sitePath);

      // Write website files
      await this.writeWebsiteFiles(sitePath, content, convertedDomain);

      // Configure Nginx
      await this.configureNginx(convertedDomain, sitePath);

      // Check DNS
      const dnsResolved = await this.checkDNS(convertedDomain);

      // Request SSL certificate if DNS is resolved
      let sslConfigured = false;
      if (dnsResolved) {
        sslConfigured = await this.configureSsl(convertedDomain);
      }

      // Update deployment status
      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'completed',
          logs: `Deployment completed. DNS: ${dnsResolved ? 'resolved' : 'pending'}, SSL: ${sslConfigured ? 'configured' : 'pending'}`,
        },
      });

      // Update website status
      await prisma.website.update({
        where: { id: websiteId },
        data: {
          status: 'published',
          dnsStatus: dnsResolved ? 'resolved' : 'pending',
          sslStatus: sslConfigured ? 'active' : 'pending',
          deployedAt: new Date(),
        },
      });

      // TODO: 生成网站缩略图（异步，不阻塞部署）
      // if (sslConfigured) {
      //   setTimeout(async () => {
      //     try {
      //       logger.info(`Generating thumbnail for ${convertedDomain}`);
      //       await screenshotService.generateWebsiteThumbnail(convertedDomain, websiteId);
      //     } catch (thumbnailError) {
      //       logger.warn(`Failed to generate thumbnail for ${convertedDomain}:`, thumbnailError);
      //     }
      //   }, 30000); // 等待30秒让网站稳定
      // }
      
      logger.info(`Deployment completed for ${domain} (${convertedDomain})`);
    } catch (error) {
      logger.error(`Deployment failed for ${domain} (${convertedDomain}):`, error);
      
      // Update deployment with error
      await prisma.deployment.updateMany({
        where: { websiteId, status: 'deploying' },
        data: {
          status: 'failed',
          logs: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });

      throw error;
    }
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      // Set proper permissions
      await execAsync(`chmod 755 ${dirPath}`);
      logger.debug(`Created directory: ${dirPath}`);
    } catch (error) {
      logger.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  private async writeWebsiteFiles(sitePath: string, content: string, domain: string): Promise<void> {
    try {
      // Write main HTML file
      const htmlPath = path.join(sitePath, 'index.html');
      await fs.writeFile(htmlPath, content, 'utf8');

      // Create basic robots.txt
      const robotsContent = `User-agent: *
Allow: /

Sitemap: https://${domain}/sitemap.xml`;
      await fs.writeFile(path.join(sitePath, 'robots.txt'), robotsContent, 'utf8');

      // Create basic sitemap.xml
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${domain}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
      await fs.writeFile(path.join(sitePath, 'sitemap.xml'), sitemapContent, 'utf8');

      // Set proper file permissions
      await execAsync(`chmod -R 644 ${sitePath}/*`);
      await execAsync(`chmod 755 ${sitePath}`);

      logger.debug(`Website files written to ${sitePath}`);
    } catch (error) {
      logger.error(`Failed to write website files:`, error);
      throw error;
    }
  }

  private async configureNginx(domain: string, sitePath: string): Promise<void> {
    try {
      const nginxConfig = this.generateNginxConfig(domain, sitePath);
      const configPath = path.join(config.server.nginxPath, domain);
      
      await fs.writeFile(configPath, nginxConfig, 'utf8');
      
      // Test nginx configuration
      await execAsync('nginx -t');
      
      // Reload nginx
      await execAsync('systemctl reload nginx');
      
      logger.debug(`Nginx configured for ${domain}`);
    } catch (error) {
      logger.error(`Failed to configure Nginx for ${domain}:`, error);
      throw error;
    }
  }

  private generateNginxConfig(domain: string, sitePath: string): string {
    return `server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${sitePath};
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security: deny access to hidden files
    location ~ /\\. {
        deny all;
    }
}`;
  }

  private async checkDNS(domain: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`dig +short ${domain}`);
      const ips = stdout.trim().split('\\n').filter(ip => ip);
      
      // Check if any of the returned IPs match our server IP
      const serverIP = config.server.ip;
      const dnsResolved = ips.includes(serverIP);
      
      logger.debug(`DNS check for ${domain}: ${dnsResolved ? 'resolved' : 'not resolved'}`);
      return dnsResolved;
    } catch (error) {
      logger.error(`DNS check failed for ${domain}:`, error);
      return false;
    }
  }

  private async configureSsl(domain: string): Promise<boolean> {
    try {
      // Request SSL certificate using certbot
      const certbotCmd = `certbot certonly --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos --email admin@${domain}`;
      await execAsync(certbotCmd);

      // Update nginx configuration with SSL
      const sslNginxConfig = this.generateSslNginxConfig(domain);
      const configPath = path.join(config.server.nginxPath, domain);
      
      await fs.writeFile(configPath, sslNginxConfig, 'utf8');
      
      // Test and reload nginx
      await execAsync('nginx -t');
      await execAsync('systemctl reload nginx');
      
      logger.debug(`SSL configured for ${domain}`);
      return true;
    } catch (error) {
      logger.error(`SSL configuration failed for ${domain}:`, error);
      return false;
    }
  }

  private generateSslNginxConfig(domain: string): string {
    const sitePath = path.join(config.server.sitesPath, domain);
    const certPath = path.join(config.server.certbotPath, domain);
    
    return `# HTTP redirect to HTTPS
server {
    listen 80;
    server_name ${domain} www.${domain};
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name ${domain} www.${domain};
    root ${sitePath};
    index index.html;

    # SSL configuration
    ssl_certificate ${certPath}/fullchain.pem;
    ssl_certificate_key ${certPath}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main location
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security: deny access to hidden files
    location ~ /\\. {
        deny all;
    }
}`;
  }

  async undeployWebsite(domain: string): Promise<void> {
    // 转换中文域名
    const convertedDomain = this.convertDomainToPunycode(domain);
    
    try {
      logger.info(`Starting undeployment for domain ${domain} (converted: ${convertedDomain})`);

      // Remove website files
      const sitePath = path.join(config.server.sitesPath, convertedDomain);
      await execAsync(`rm -rf ${sitePath}`);

      // Remove nginx configuration
      const configPath = path.join(config.server.nginxPath, convertedDomain);
      await execAsync(`rm -f ${configPath}`);

      // Reload nginx
      await execAsync('systemctl reload nginx');

      // Revoke SSL certificate
      try {
        await execAsync(`certbot delete --cert-name ${convertedDomain} --non-interactive`);
      } catch (error) {
        logger.warn(`Failed to revoke SSL certificate for ${convertedDomain}:`, error);
      }

      logger.info(`Undeployment completed for ${domain} (${convertedDomain})`);
    } catch (error) {
      logger.error(`Undeployment failed for ${domain} (${convertedDomain}):`, error);
      throw error;
    }
  }

  async getDeploymentStatus(websiteId: string): Promise<any> {
    const deployments = await prisma.deployment.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return deployments;
  }

  // 部署网站的静态方法版本
  static async deployWebsite(params: {
    websiteId: string;
    domain: string;
    content: string;
  }): Promise<void> {
    const service = new DeploymentService();
    return service.deployWebsite(params.websiteId, params.domain, params.content);
  }

  // 回滚部署
  static async rollbackDeployment(params: {
    websiteId: string;
    deploymentId: string;
  }): Promise<void> {
    try {
      logger.info(`Rolling back deployment ${params.deploymentId} for website ${params.websiteId}`);

      const deployment = await prisma.deployment.findUnique({
        where: { id: params.deploymentId },
        include: { website: true },
      });

      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // 获取之前的成功部署
      const previousDeployment = await prisma.deployment.findFirst({
        where: {
          websiteId: params.websiteId,
          status: 'deployed',
          createdAt: { lt: deployment.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        include: { website: true },
      });

      if (!previousDeployment) {
        throw new Error('No previous deployment found for rollback');
      }

      // 重新部署之前的版本
      const service = new DeploymentService();
      await service.deployWebsite(
        params.websiteId,
        deployment.domain,
        previousDeployment.website.content
      );

      // 更新部署状态
      await prisma.deployment.update({
        where: { id: params.deploymentId },
        data: {
          status: 'rolled_back',
          logs: `${deployment.logs || ''}\nRolled back to deployment ${previousDeployment.id}`,
        },
      });

      logger.info(`Rollback completed for deployment ${params.deploymentId}`);
    } catch (error) {
      logger.error(`Rollback failed for deployment ${params.deploymentId}:`, error);
      throw error;
    }
  }

  // DNS解析检查
  static async checkDNSResolution(domain: string, expectedIP: string): Promise<{
    resolved: boolean;
    ips: string[];
  }> {
    try {
      const { stdout } = await execAsync(`dig +short ${domain}`);
      const ips = stdout.trim().split('\n').filter(ip => ip && ip !== '');
      
      const resolved = ips.includes(expectedIP);
      
      logger.debug(`DNS check for ${domain}: resolved=${resolved}, ips=${ips.join(', ')}`);
      
      return {
        resolved,
        ips,
      };
    } catch (error) {
      logger.error(`DNS resolution check failed for ${domain}:`, error);
      return {
        resolved: false,
        ips: [],
      };
    }
  }

  // 获取部署日志
  static async getDeploymentLogs(logPath: string): Promise<string> {
    try {
      if (!logPath) {
        return 'No log file specified';
      }

      const logs = await fs.readFile(logPath, 'utf-8');
      return logs;
    } catch (error) {
      logger.error(`Failed to read deployment logs from ${logPath}:`, error);
      return `Error reading logs: ${(error as Error).message}`;
    }
  }
}

export const deploymentService = new DeploymentService();