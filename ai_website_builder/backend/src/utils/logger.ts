import { config } from '../config';

export class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = this.getTimestamp();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage('INFO', message, meta));
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage('ERROR', message, error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  debug(message: string, meta?: any): void {
    if (config.env === 'development') {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }
}

export const logger = new Logger();