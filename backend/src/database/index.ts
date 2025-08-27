import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export async function initDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await prisma.$disconnect();
  logger.info('Database connection closed');
}