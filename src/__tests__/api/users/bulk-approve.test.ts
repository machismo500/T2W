import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { POST } from '@/app/api/users/bulk-approve/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

describe('POST /api/users/bulk-approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 403 for regular riders', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'rider' } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-approve', {
      method: 'POST',
      body: { ids: ['u2', 'u3'] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('returns 403 for unauthenticated users', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-approve', {
      method: 'POST',
      body: { ids: ['u2'] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it('approves specific users by IDs', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'superadmin' } as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 2 } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-approve', {
      method: 'POST',
      body: { ids: ['u2', 'u3'] },
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.approvedCount).toBe(2);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['u2', 'u3'] }, isApproved: false },
        data: { isApproved: true },
      })
    );
  });

  it('approves all pending users when no ids provided', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 5 } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-approve', {
      method: 'POST',
      body: {},
    });
    const res = await POST(req);
    const { status, data } = await parseResponse(res);
    expect(status).toBe(200);
    expect(data.approvedCount).toBe(5);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isApproved: false },
        data: { isApproved: true },
      })
    );
  });

  it('allows core_member access', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1', role: 'core_member' } as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 } as any);

    const req = createNextRequest('http://localhost:3000/api/users/bulk-approve', {
      method: 'POST',
      body: { ids: ['u2'] },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
