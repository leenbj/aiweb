// Lazy-load nodemailer on demand to avoid boot crash if not installed
import { prisma } from '../database';
import { logger } from '../utils/logger';

export interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  enabled: boolean;
}

export async function getSMTPConfig(): Promise<SMTPConfig> {
  // load from system_settings, fallback to env
  const items = await prisma.systemSettings.findMany({ where: { category: 'email' } });
  const map: Record<string, string> = {};
  for (const it of items) map[it.key] = it.value;

  const host = map.smtp_host || process.env.SMTP_HOST || '';
  const port = parseInt(map.smtp_port || process.env.SMTP_PORT || '587', 10);
  const user = map.smtp_user || process.env.SMTP_USER || '';
  const pass = map.smtp_pass || process.env.SMTP_PASS || '';
  const from = map.smtp_from || process.env.SMTP_FROM || '';
  const enabled = (map.smtp_enabled || '').toLowerCase() === 'true';

  return { host, port, user, pass, from, enabled };
}

export async function sendMail(to: string | string[], subject: string, html: string, text?: string) {
  const cfg = await getSMTPConfig();
  if (!cfg.enabled) {
    throw new Error('邮件发送未启用，请在设置中启用SMTP');
  }
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.from) {
    throw new Error('SMTP配置不完整');
  }
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({ from: cfg.from, to, subject, html, text });
  logger.info(`邮件已发送: ${info.messageId}`);
  return info;
}
