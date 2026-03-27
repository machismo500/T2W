import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-new-password'),
}));

vi.mock('@/lib/otp-store', () => ({
  isResetVerified: vi.fn(),
  clearResetVerified: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/auth/reset-password/route';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isResetVerified, clearResetVerified } from '@/lib/otp-store';

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when email is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { newPassword: 'newpassword123' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'test@example.com' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'test@example.com', newPassword: '12345' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain('at least 12');
  });

  it('returns 403 when reset session expired', async () => {
    vi.mocked(isResetVerified).mockResolvedValue(false);

    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'test@example.com', newPassword: 'newpassword123' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(403);
    expect(data.error).toContain('expired');
  });

  it('returns 404 when user not found', async () => {
    vi.mocked(isResetVerified).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'noone@example.com', newPassword: 'newpassword123' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(404);
    expect(data.error).toContain('No account');
  });

  it('resets password successfully', async () => {
    vi.mocked(isResetVerified).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'test@example.com', newPassword: 'newpassword123' },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith('newpassword123');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'test@example.com' },
        data: { password: 'hashed-new-password' },
      })
    );
    expect(clearResetVerified).toHaveBeenCalledWith('test@example.com');
  });

  it('normalizes email to lowercase', async () => {
    vi.mocked(isResetVerified).mockResolvedValue(true);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'u1' } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const req = createNextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'TEST@EXAMPLE.COM', newPassword: 'newpassword123' },
    });
    await POST(req);

    expect(isResetVerified).toHaveBeenCalledWith('test@example.com');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'test@example.com' } })
    );
  });
});
