import { vi } from 'vitest';

export const hashPassword = vi.fn().mockResolvedValue('$2b$12$hashedpassword');
export const verifyPassword = vi.fn().mockResolvedValue(true);
export const createToken = vi.fn().mockResolvedValue('mock-jwt-token');
export const verifyToken = vi.fn().mockResolvedValue({ userId: 'user-1' });
export const setAuthCookie = vi.fn().mockResolvedValue(undefined);
export const removeAuthCookie = vi.fn().mockResolvedValue(undefined);
export const getAuthToken = vi.fn().mockResolvedValue('mock-jwt-token');
export const getCurrentUser = vi.fn().mockResolvedValue(null);

export const requireAuth = vi.fn((user: unknown) => {
  if (!user) throw new Error('Unauthorized');
});

export const requireAdmin = vi.fn((user: unknown) => {
  if (!user) throw new Error('Unauthorized');
  const u = user as { role: string };
  if (u.role !== 'admin' && u.role !== 'superadmin') throw new Error('Forbidden');
});
