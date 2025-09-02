import { Router } from 'express';
import Joi from 'joi';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../database';
import { sendMail } from '../services/mailer';

const router = Router();

const websiteCompleteSchema = Joi.object({
  websiteId: Joi.string().required(),
  toEmails: Joi.string().allow('').optional(), // comma separated, optional overrides
});

// 发送网站完成通知邮件
router.post('/email/website-complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const { error, value } = websiteCompleteSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, error: error.details[0].message });

    const userId = req.user!.id;
    const { websiteId, toEmails } = value;

    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website || (website.userId !== userId && req.user!.role !== 'admin' && req.user!.role !== 'super_admin')) {
      return res.status(404).json({ success: false, error: '网站不存在或无权访问' });
    }

    // 收件人：优先使用传入 toEmails，否则使用用户设置中的 notificationEmails
    let recipients: string[] = [];
    if (toEmails && String(toEmails).trim().length > 0) {
      recipients = String(toEmails).split(',').map((e: string) => e.trim()).filter(Boolean);
    } else {
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      if (settings?.notificationEmails) {
        recipients = settings.notificationEmails.split(',').map(e => e.trim()).filter(Boolean);
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, error: '没有配置通知邮箱' });
    }

    const url = `https://${website.domain}`;
    const subject = '网站搭建完成通知';
    const html = `<p>您好，您的网站已搭建完成：</p><p><a href="${url}">${url}</a></p>`;
    await sendMail(recipients, subject, html, `网站已完成：${url}`);

    res.json({ success: true, data: { recipients, websiteId, url } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '发送邮件失败' });
  }
});

export default router;

