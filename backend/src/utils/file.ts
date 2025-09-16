import path from 'path';
import crypto from 'crypto';

export function ensureRelative(p: string) {
  // 防止目录穿越，仅允许相对路径
  const norm = path.posix.normalize(p).replace(/^\/+/, '');
  if (norm.startsWith('..')) throw new Error('INVALID_PATH');
  return norm;
}

export function contentHash(buf: Buffer | string, len = 8) {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return crypto.createHash('md5').update(b).digest('hex').slice(0, len);
}

