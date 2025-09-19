import { logger } from '../../utils/logger';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertPayload {
  severity: AlertSeverity;
  message: string;
  context?: Record<string, any>;
}

type AlertListener = (payload: AlertPayload) => void | Promise<void>;

const listeners = new Set<AlertListener>();

export function registerAlertListener(listener: AlertListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function publishAlert(payload: AlertPayload) {
  const { severity, message, context } = payload;
  const logMethod = severity === 'critical' ? logger.error.bind(logger) : logger.warn.bind(logger);
  logMethod(`pipeline.alert.${severity}`, { message, context });

  for (const listener of listeners) {
    try {
      await listener(payload);
    } catch (error) {
      logger.error('alertListener.failed', {
        severity,
        message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      });
    }
  }
}

