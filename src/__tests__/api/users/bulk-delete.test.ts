import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/users/bulk-delete/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/users/bulk-delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for non-superadmin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-delete', {
      method: 'POST',
      body: { ids: ['u2'] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 400 when ids array is empty', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-delete', {
      method: 'POST',
      body: { ids: [] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('returns 400 when ids is not an array', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-delete', {
      method: 'POST',
      body: { ids: 'not-array' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it('deletes users and protects built-in accounts', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'protected-1' },
    ] as any);
    vi.mocked(prisma.user.deleteMany).mockResolvedValue({ count: 2 } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-delete', {
      method: 'POST',
      body: { ids: ['u2', 'u3', 'protected-1'] },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedCount).toBe(2);
    expect(data.skippedProtected).toBe(1);
    // Should only delete non-protected IDs
    expect(prisma.user.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['u2', 'u3'] } },
      })
    );
  });

  it('deletes all users when none are protected', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.user.deleteMany).mockResolvedValue({ count: 3 } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-delete', {
      method: 'POST',
      body: { ids: ['u2', 'u3', 'u4'] },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.deletedCount).toBe(3);
    expect(data.skippedProtected).toBe(0);
  });
});
