// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before importing auth
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: 'mock-token' }),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock the database
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    riderProfile: {
      findFirst: vi.fn(),
    },
  },
}));

import { hashPassword, verifyPassword, createToken, verifyToken, requireAuth } from '@/lib/auth';

describe('auth library', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash', async () => {
      const hash = await hashPassword('testpassword');
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('different calls produce different hashes (salt)', async () => {
      const hash1 = await hashPassword('testpassword');
      const hash2 = await hashPassword('testpassword');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password/hash pair', async () => {
      const hash = await hashPassword('mypassword');
      const result = await verifyPassword('mypassword', hash);
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('mypassword');
      const result = await verifyPassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('createToken / verifyToken', () => {
    it('creates a valid JWT string', async () => {
      const token = await createToken('user-123');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('token can be verified with verifyToken', async () => {
      const token = await createToken('user-456');
      const payload = await verifyToken(token);
      expect(payload).toEqual({ userId: 'user-456' });
    });

    it('returns null for invalid token', async () => {
      const result = await verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('returns null for tampered token', async () => {
      const token = await createToken('user-789');
      const tampered = token.slice(0, -5) + 'xxxxx';
      const result = await verifyToken(tampered);
      expect(result).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('does not throw for truthy user', () => {
      expect(() => requireAuth({ id: '1', name: 'Test' })).not.toThrow();
    });

    it('throws "Unauthorized" for null', () => {
      expect(() => requireAuth(null)).toThrow('Unauthorized');
    });

    it('throws "Unauthorized" for undefined', () => {
      expect(() => requireAuth(undefined)).toThrow('Unauthorized');
    });
  });

});
