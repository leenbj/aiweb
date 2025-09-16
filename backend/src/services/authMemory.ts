import bcrypt from 'bcrypt';
import { config } from '../config';

export interface MemUser {
  id: string;
  name: string;
  email: string;
  password: string; // hashed
  role: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const users: MemUser[] = [];

function now() { return new Date().toISOString(); }

export async function ensureDefaultDevUser() {
  // 默认开发账号（避免阻塞登录体验）
  const presets = [
    {
      email: process.env.DEV_DEFAULT_EMAIL || 'dev@example.com',
      name: process.env.DEV_DEFAULT_NAME || 'Dev User',
      plain: process.env.DEV_DEFAULT_PASSWORD || 'dev123456',
      role: 'admin',
    },
    { email: 'demo@example.com', name: 'Demo User', plain: 'demo123', role: 'user' },
  ];
  let last: MemUser | undefined;
  for (const p of presets) {
    let u = users.find(u => u.email === p.email);
    if (!u) {
      const hashed = await bcrypt.hash(p.plain, config.security.bcryptRounds);
      u = {
        id: `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,
        name: p.name,
        email: p.email,
        password: hashed,
        role: p.role,
        createdAt: now(),
        updatedAt: now(),
      };
      users.push(u);
    }
    last = u;
  }
  return last!;
}

export async function memRegister(name: string, email: string, password: string) {
  const exists = users.find(u => u.email === email);
  if (exists) throw new Error('User already exists with this email');
  const hashed = await bcrypt.hash(password, config.security.bcryptRounds);
  const u: MemUser = {
    id: `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,
    name,
    email,
    password: hashed,
    role: 'user',
    createdAt: now(),
    updatedAt: now(),
  };
  users.push(u);
  return u;
}

export async function memFindByEmail(email: string) {
  if (users.length === 0) await ensureDefaultDevUser();
  return users.find(u => u.email === email) || null;
}

export async function memFindById(id: string) {
  if (users.length === 0) await ensureDefaultDevUser();
  return users.find(u => u.id === id) || null;
}
