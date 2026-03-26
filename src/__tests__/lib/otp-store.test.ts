import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    otp: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import {
  createEmailOtp,
  verifyEmailOtp,
  createResetOtp,
  verifyResetOtp,
  isResetVerified,
  clearResetVerified,
} from '@/lib/otp-store';

const mockOtp = prisma.otp as unknown as {
  deleteMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OTP Store', () => {
  describe('createEmailOtp', () => {
    it('deletes existing OTPs and creates new one', async () => {
      mockOtp.deleteMany.mockResolvedValue({ count: 0 });
      mockOtp.create.mockResolvedValue({ id: '1', code: '123456' });

      const code = await createEmailOtp('Test@Example.com  ');

      expect(mockOtp.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com', type: 'email_verify' },
      });
      expect(mockOtp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            type: 'email_verify',
          }),
        })
      );
    });

    it('returns a 6-digit code string', async () => {
      mockOtp.deleteMany.mockResolvedValue({ count: 0 });
      mockOtp.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const code = await createEmailOtp('user@test.com');
      expect(code).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyEmailOtp', () => {
    it('returns true when matching OTP found and not expired', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        expiresAt: new Date(Date.now() + 600000), // 10 min from now
      });
      mockOtp.delete.mockResolvedValue({});

      const result = await verifyEmailOtp('user@test.com', '123456');
      expect(result).toBe(true);
      expect(mockOtp.delete).toHaveBeenCalledWith({ where: { id: 'otp-1' } });
    });

    it('returns false when no OTP found', async () => {
      mockOtp.findFirst.mockResolvedValue(null);

      const result = await verifyEmailOtp('user@test.com', '999999');
      expect(result).toBe(false);
    });

    it('returns false when OTP is expired', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-1',
        code: '123456',
        expiresAt: new Date(Date.now() - 1000), // already expired
      });
      mockOtp.delete.mockResolvedValue({});

      const result = await verifyEmailOtp('user@test.com', '123456');
      expect(result).toBe(false);
    });

    it('deletes OTP after check (single-use)', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-2',
        code: '654321',
        expiresAt: new Date(Date.now() + 600000),
      });
      mockOtp.delete.mockResolvedValue({});

      await verifyEmailOtp('user@test.com', '654321');
      expect(mockOtp.delete).toHaveBeenCalledWith({ where: { id: 'otp-2' } });
    });
  });

  describe('createResetOtp', () => {
    it('creates OTP with password_reset type', async () => {
      mockOtp.deleteMany.mockResolvedValue({ count: 0 });
      mockOtp.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      await createResetOtp('user@test.com');

      expect(mockOtp.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@test.com', type: 'password_reset' },
      });
      expect(mockOtp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'password_reset' }),
        })
      );
    });
  });

  describe('verifyResetOtp', () => {
    it('marks OTP as verified and extends expiry', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-3',
        code: '111111',
        expiresAt: new Date(Date.now() + 600000),
      });
      mockOtp.update.mockResolvedValue({});

      const result = await verifyResetOtp('user@test.com', '111111');
      expect(result).toBe(true);
      expect(mockOtp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'otp-3' },
          data: expect.objectContaining({ verified: true }),
        })
      );
    });

    it('returns false and deletes if expired', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-4',
        code: '222222',
        expiresAt: new Date(Date.now() - 1000),
      });
      mockOtp.delete.mockResolvedValue({});

      const result = await verifyResetOtp('user@test.com', '222222');
      expect(result).toBe(false);
    });
  });

  describe('isResetVerified', () => {
    it('returns true when verified entry exists and not expired', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-5',
        verified: true,
        expiresAt: new Date(Date.now() + 300000),
      });

      const result = await isResetVerified('user@test.com');
      expect(result).toBe(true);
    });

    it('returns false and deletes if expired', async () => {
      mockOtp.findFirst.mockResolvedValue({
        id: 'otp-6',
        verified: true,
        expiresAt: new Date(Date.now() - 1000),
      });
      mockOtp.delete.mockResolvedValue({});

      const result = await isResetVerified('user@test.com');
      expect(result).toBe(false);
    });

    it('returns false when no entry exists', async () => {
      mockOtp.findFirst.mockResolvedValue(null);

      const result = await isResetVerified('user@test.com');
      expect(result).toBe(false);
    });
  });

  describe('clearResetVerified', () => {
    it('deletes all reset OTPs for email', async () => {
      mockOtp.deleteMany.mockResolvedValue({ count: 1 });

      await clearResetVerified('User@Test.com');
      expect(mockOtp.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@test.com', type: 'password_reset' },
      });
    });
  });
});
