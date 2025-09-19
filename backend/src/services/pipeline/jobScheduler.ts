import cron, { ScheduledTask } from 'node-cron';

import type { PrismaClient, TemplatePipelineJob } from '@prisma/client';

import { logger } from '../../utils/logger';
import { publishAlert, type AlertSeverity } from '../alerts/alertPublisher';
import { getPipelineMetricsSnapshot, getPipelineStatusBreakdown } from '../metrics/pipelineMetricsCollector';
import { prisma as defaultPrisma } from '../../database';

export interface JobSchedulerOptions {
  reportCron?: string;
  retryCron?: string;
  timezone?: string;
  staleMinutes?: number;
  retryBatchSize?: number;
}

export interface SchedulerDependencies {
  prisma: PrismaClient;
  publishAlert: typeof publishAlert;
  logger: typeof logger;
  getSnapshot: typeof getPipelineMetricsSnapshot;
  getStatusBreakdown: typeof getPipelineStatusBreakdown;
}

const DEFAULT_OPTIONS: Required<Omit<JobSchedulerOptions, 'retryBatchSize'>> & { retryBatchSize: number } = {
  reportCron: '0 9 * * MON', // 每周一 09:00
  retryCron: '*/15 * * * *', // 每 15 分钟检查一次挂起任务
  timezone: 'Asia/Shanghai',
  staleMinutes: 30,
  retryBatchSize: 20,
};

export function buildWeeklyReport(snapshot = getPipelineMetricsSnapshot(), statusBreakdown = getPipelineStatusBreakdown()): string {
  const { totals, averageDurationMs, recentFailures } = snapshot;
  const total = totals.success + totals.failure;
  const successRate = total ? Math.round((totals.success / total) * 1000) / 10 : 0;

  const lines = [
    `模板自动化周报（总量 ${total}）`,
    `- 成功：${totals.success}，失败：${totals.failure}，成功率：${successRate}%`,
    `- 平均耗时：${averageDurationMs ? `${averageDurationMs} ms` : '暂无数据'}`,
    `- 状态分布：SUCCESS ${statusBreakdown.SUCCESS ?? 0}｜FAILED ${statusBreakdown.FAILED ?? 0}｜RUNNING ${statusBreakdown.RUNNING ?? 0}`,
  ];

  if (recentFailures.length) {
    lines.push('- 最近失败：');
    recentFailures.forEach((failure) => {
      lines.push(`  • [${failure.stage}] ${failure.reason} @ ${failure.at}`);
    });
  }

  return lines.join('\n');
}

export function shouldRetryJob(job: Pick<TemplatePipelineJob, 'status' | 'updatedAt'>, threshold: Date): boolean {
  if (job.status !== 'ON_HOLD') return false;
  if (!job.updatedAt) return true;
  return job.updatedAt < threshold;
}

export class PipelineJobScheduler {
  private readonly options: typeof DEFAULT_OPTIONS;
  private reportTask?: ScheduledTask;
  private retryTask?: ScheduledTask;

  constructor(private readonly deps: SchedulerDependencies, options: JobSchedulerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  start() {
    this.reportTask = cron.schedule(
      this.options.reportCron,
      () => {
        void this.runWeeklyReport();
      },
      { timezone: this.options.timezone },
    );

    this.retryTask = cron.schedule(
      this.options.retryCron,
      () => {
        void this.runRetryHoldJobs();
      },
      { timezone: this.options.timezone },
    );

    this.deps.logger.info('pipeline.scheduler.started', {
      reportCron: this.options.reportCron,
      retryCron: this.options.retryCron,
      timezone: this.options.timezone,
    });
  }

  stop() {
    this.reportTask?.stop();
    this.retryTask?.stop();
    this.reportTask = undefined;
    this.retryTask = undefined;
    this.deps.logger.info('pipeline.scheduler.stopped');
  }

  async runWeeklyReport() {
    try {
      const snapshot = this.deps.getSnapshot();
      const status = this.deps.getStatusBreakdown();
      const message = buildWeeklyReport(snapshot, status);

      await this.deps.publishAlert({
        severity: 'info',
        message,
        context: {
          snapshot,
          status,
        },
      });

      this.deps.logger.info('pipeline.scheduler.weeklyReport', { snapshot, status });
      return message;
    } catch (error) {
      this.deps.logger.error('pipeline.scheduler.weeklyReport.failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async runRetryHoldJobs() {
    const threshold = new Date(Date.now() - this.options.staleMinutes * 60 * 1000);
    try {
      const candidates = await this.deps.prisma.templatePipelineJob.findMany({
        where: {
          status: 'ON_HOLD',
          updatedAt: { lt: threshold },
        },
        orderBy: { updatedAt: 'asc' },
        take: this.options.retryBatchSize,
      });

      if (!candidates.length) return 0;

      for (const job of candidates) {
        await this.deps.prisma.templatePipelineJob.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            retryCount: { increment: 1 },
            metadata: {
              ...(job.metadata as Record<string, any> | null),
              schedulerRetriedAt: new Date().toISOString(),
            },
          },
        });
      }

      await this.deps.publishAlert({
        severity: 'warning' as AlertSeverity,
        message: `已重新入队 ${candidates.length} 条 ON_HOLD 任务`,
        context: {
          jobIds: candidates.map((job) => job.id),
          threshold: threshold.toISOString(),
        },
      });

      this.deps.logger.warn('pipeline.scheduler.retryHoldJobs', {
        count: candidates.length,
        jobIds: candidates.map((job) => job.id),
      });

      return candidates.length;
    } catch (error) {
      this.deps.logger.error('pipeline.scheduler.retryHoldJobs.failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}

export function createDefaultPipelineJobScheduler(options: JobSchedulerOptions = {}) {
  const scheduler = new PipelineJobScheduler(
    {
      prisma: defaultPrisma,
      publishAlert,
      logger,
      getSnapshot: () => getPipelineMetricsSnapshot(),
      getStatusBreakdown: () => getPipelineStatusBreakdown(),
    },
    options,
  );

  return scheduler;
}

